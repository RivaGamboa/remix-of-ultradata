import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BLING_API_BASE = "https://www.bling.com.br/Api/v3";
const BLING_TOKEN_URL = "https://www.bling.com.br/Api/v3/oauth/token";

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function refreshToken(supabase: any, connection: any) {
  const clientId = Deno.env.get("BLING_CLIENT_ID")!;
  const clientSecret = Deno.env.get("BLING_CLIENT_SECRET")!;

  const res = await fetch(BLING_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: connection.refresh_token,
    }),
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status}`);
  }

  const tokenData = await res.json();
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  // Update in both tables (token may be in either)
  await supabase.from("bling_tokens").update({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: expiresAt,
  }).eq("id", connection.id);

  await supabase.from("bling_connections").update({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: expiresAt,
  }).eq("id", connection.id);

  return tokenData.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth via getClaims (ES256-compatible, required for Lovable Cloud)
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    // Use anon key client to validate the user JWT
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const supabase = getSupabaseAdmin();

    const { connectionId, endpoint, method = "GET", body: reqBody, params } = await req.json();

    if (!connectionId || !endpoint) {
      return new Response(JSON.stringify({ error: "connectionId e endpoint são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get connection — try bling_tokens first (where OAuth callback saves), fallback to bling_connections
    let conn: any = null;
    let connError: any = null;

    const { data: tokenData, error: tokenError } = await supabase
      .from("bling_tokens")
      .select("*")
      .eq("id", connectionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (tokenData) {
      conn = tokenData;
    } else {
      const { data: connData, error: connErr } = await supabase
        .from("bling_connections")
        .select("*")
        .eq("id", connectionId)
        .eq("user_id", userId)
        .maybeSingle();
      conn = connData;
      connError = connErr;
    }

    if (connError || !conn) {
      return new Response(JSON.stringify({ error: "Conexão não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check token expiry and refresh if needed
    let accessToken = conn.access_token;
    if (new Date(conn.expires_at) <= new Date()) {
      accessToken = await refreshToken(supabase, conn);
    }

    // Build URL with query params
    let url = `${BLING_API_BASE}${endpoint}`;
    if (params) {
      const qs = new URLSearchParams(params).toString();
      url += `?${qs}`;
    }

    // Proxy request to Bling
    const fetchOptions: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    };

    if (reqBody && method !== "GET") {
      fetchOptions.body = JSON.stringify(reqBody);
    }

    const blingRes = await fetch(url, fetchOptions);
    const blingData = await blingRes.json();

    if (!blingRes.ok) {
      // If 401, try refresh once
      if (blingRes.status === 401) {
        try {
          accessToken = await refreshToken(supabase, conn);
          fetchOptions.headers = {
            ...fetchOptions.headers as Record<string, string>,
            Authorization: `Bearer ${accessToken}`,
          };
          const retryRes = await fetch(url, fetchOptions);
          const retryData = await retryRes.json();
          return new Response(JSON.stringify(retryData), {
            status: retryRes.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch {
          return new Response(JSON.stringify({ error: "Token expirado. Reconecte sua conta Bling." }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    return new Response(JSON.stringify(blingData), {
      status: blingRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("bling-proxy error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
