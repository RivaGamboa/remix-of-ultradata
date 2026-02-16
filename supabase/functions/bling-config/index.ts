const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get("BLING_CLIENT_ID");
    if (!clientId) {
      throw new Error("BLING_CLIENT_ID is not configured");
    }

    // Use origin from request to build redirect URI dynamically
    const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/$/, "") || "";
    const fixedRedirectUri = Deno.env.get("BLING_REDIRECT_URI");
    
    // If origin matches production domain, use the fixed URI; otherwise build from origin
    let redirectUri: string;
    if (fixedRedirectUri && origin.includes("ultradata.app")) {
      redirectUri = fixedRedirectUri;
    } else if (origin) {
      redirectUri = `${origin}/auth/bling/callback`;
    } else {
      redirectUri = fixedRedirectUri || "https://ultradata.app/auth/bling/callback";
    }

    return new Response(
      JSON.stringify({ clientId, redirectUri }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
