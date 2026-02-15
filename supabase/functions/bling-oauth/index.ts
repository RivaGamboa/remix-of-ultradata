import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BLING_AUTH_URL = "https://www.bling.com.br/Api/v3/oauth/authorize";
const BLING_TOKEN_URL = "https://www.bling.com.br/Api/v3/oauth/token";

function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

function getBlingCredentials() {
  const clientId = Deno.env.get("BLING_CLIENT_ID");
  const clientSecret = Deno.env.get("BLING_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("BLING_CLIENT_ID and BLING_CLIENT_SECRET must be set");
  }
  return { clientId, clientSecret };
}

function basicAuth(clientId: string, clientSecret: string) {
  return btoa(`${clientId}:${clientSecret}`);
}

async function getUserId(req: Request): Promise<string> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) throw new Error("Missing authorization header");

  const supabase = getSupabaseAdmin();
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error("Invalid token");
  return data.user.id;
}

// Exchange authorization code for tokens
async function exchangeCode(code: string, redirectUri: string) {
  const { clientId, clientSecret } = getBlingCredentials();

  const res = await fetch(BLING_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth(clientId, clientSecret)}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bling token exchange failed [${res.status}]: ${text}`);
  }

  return await res.json();
}

// Refresh an expired access token
async function refreshAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = getBlingCredentials();

  const res = await fetch(BLING_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth(clientId, clientSecret)}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bling token refresh failed [${res.status}]: ${text}`);
  }

  return await res.json();
}

async function saveTokens(
  userId: string,
  tokenData: { access_token: string; refresh_token: string; expires_in: number; scope?: string }
) {
  const supabase = getSupabaseAdmin();
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  const { error } = await supabase
    .from("bling_tokens")
    .upsert(
      {
        user_id: userId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt,
        scope: tokenData.scope || null,
      },
      { onConflict: "user_id" }
    );

  if (error) throw new Error(`Failed to save tokens: ${error.message}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // 1. Generate authorization URL (no auth needed)
    if (action === "authorize") {
      const { clientId } = getBlingCredentials();
      const fixedRedirectUri = Deno.env.get("BLING_REDIRECT_URI");
      const redirectUri = url.searchParams.get("redirect_uri") || fixedRedirectUri;
      const state = url.searchParams.get("state") || "";

      if (!redirectUri) {
        throw new Error("redirect_uri is required");
      }

      const authUrl = `${BLING_AUTH_URL}?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;

      return new Response(JSON.stringify({ url: authUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Exchange code for tokens (requires auth)
    if (action === "callback") {
      const userId = await getUserId(req);
      const body = await req.json();
      const { code, redirect_uri } = body;

      if (!code || !redirect_uri) {
        throw new Error("code and redirect_uri are required");
      }

      const tokenData = await exchangeCode(code, redirect_uri);
      await saveTokens(userId, tokenData);

      return new Response(
        JSON.stringify({ success: true, expires_in: tokenData.expires_in }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Refresh token (requires auth)
    if (action === "refresh") {
      const userId = await getUserId(req);
      const supabase = getSupabaseAdmin();

      const { data: tokens, error } = await supabase
        .from("bling_tokens")
        .select("refresh_token")
        .eq("user_id", userId)
        .single();

      if (error || !tokens) {
        throw new Error("No Bling tokens found. Please reconnect.");
      }

      const tokenData = await refreshAccessToken(tokens.refresh_token);
      await saveTokens(userId, tokenData);

      return new Response(
        JSON.stringify({ success: true, expires_in: tokenData.expires_in }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Get token status (requires auth)
    if (action === "status") {
      const userId = await getUserId(req);
      const supabase = getSupabaseAdmin();

      const { data: tokens, error } = await supabase
        .from("bling_tokens")
        .select("expires_at, scope")
        .eq("user_id", userId)
        .single();

      if (error || !tokens) {
        return new Response(
          JSON.stringify({ connected: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const isExpired = new Date(tokens.expires_at) < new Date();

      return new Response(
        JSON.stringify({
          connected: true,
          expired: isExpired,
          expires_at: tokens.expires_at,
          scope: tokens.scope,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Disconnect (requires auth)
    if (action === "disconnect") {
      const userId = await getUserId(req);
      const supabase = getSupabaseAdmin();

      await supabase
        .from("bling_tokens")
        .delete()
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Get valid access token (auto-refreshes if expired) — for internal use by other edge functions
    if (action === "get-token") {
      const userId = await getUserId(req);
      const supabase = getSupabaseAdmin();

      const { data: tokens, error } = await supabase
        .from("bling_tokens")
        .select("access_token, refresh_token, expires_at")
        .eq("user_id", userId)
        .single();

      if (error || !tokens) {
        throw new Error("No Bling tokens found. Please connect first.");
      }

      let accessToken = tokens.access_token;

      // Auto-refresh if expired or expiring in next 5 minutes
      const expiresAt = new Date(tokens.expires_at);
      const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000);

      if (expiresAt < fiveMinFromNow) {
        const tokenData = await refreshAccessToken(tokens.refresh_token);
        await saveTokens(userId, tokenData);
        accessToken = tokenData.access_token;
      }

      return new Response(
        JSON.stringify({ access_token: accessToken }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err) {
    console.error("Bling OAuth error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
