import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BLING_TOKEN_URL = "https://www.bling.com.br/Api/v3/oauth/token";

function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

function getBlingCredentials() {
  const clientId = Deno.env.get("BLING_CLIENT_ID");
  const clientSecret = Deno.env.get("BLING_CLIENT_SECRET");
  const redirectUri = Deno.env.get("BLING_REDIRECT_URI");
  if (!clientId || !clientSecret) {
    throw new Error("BLING_CLIENT_ID and BLING_CLIENT_SECRET must be set");
  }
  return { clientId, clientSecret, redirectUri };
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = await getUserId(req);
    const body = await req.json();
    const { code } = body;

    if (!code) {
      throw new Error("Authorization code is required");
    }

    const { clientId, clientSecret, redirectUri } = getBlingCredentials();

    if (!redirectUri) {
      throw new Error("BLING_REDIRECT_URI is not configured");
    }

    // Exchange authorization code for tokens
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
      console.error("Bling token exchange failed:", text);
      throw new Error(`Falha na troca do código: ${res.status}`);
    }

    const tokenData = await res.json();

    // Fetch Bling user info to get account email/name
    let blingAccountName: string | null = null;
    try {
      const userRes = await fetch("https://www.bling.com.br/Api/v3/usuarios", {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: "application/json",
        },
      });
      if (userRes.ok) {
        const userData = await userRes.json();
        const firstUser = userData?.data?.[0];
        blingAccountName = firstUser?.email || firstUser?.nome || null;
      }
    } catch (e) {
      console.warn("Failed to fetch Bling user info:", e);
    }

    // Save tokens to database
    const supabase = getSupabaseAdmin();
    const expiresAt = new Date(
      Date.now() + tokenData.expires_in * 1000
    ).toISOString();

    const { error: dbError } = await supabase.from("bling_tokens").upsert(
      {
        user_id: userId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt,
        scope: tokenData.scope || null,
        bling_account_name: blingAccountName,
      },
      { onConflict: "user_id" }
    );

    if (dbError) {
      throw new Error(`Falha ao salvar tokens: ${dbError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, expires_in: tokenData.expires_in }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Bling OAuth Callback error:", err);
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
