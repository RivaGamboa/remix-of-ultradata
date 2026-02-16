import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NcmItem {
  Codigo: string;
  Descricao: string;
  Data_Inicio: string;
  Data_Fim: string;
  Tipo_Ato_Ini: string;
  Numero_Ato_Ini: string;
  Ano_Ato_Ini: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch NCM data from SISCOMEX/Receita Federal open API
    // Using the open data portal for NCM codes
    const ncmUrl = "https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json";
    
    let ncmData: NcmItem[] = [];
    
    try {
      const response = await fetch(ncmUrl, {
        headers: { "Accept": "application/json" },
      });
      
      if (response.ok) {
        const jsonData = await response.json();
        ncmData = jsonData?.Nomenclaturas || jsonData || [];
      }
    } catch (fetchError) {
      console.log("SISCOMEX API unavailable, using fallback approach");
    }

    // If SISCOMEX API is unavailable, try alternative source
    if (ncmData.length === 0) {
      try {
        const altUrl = "https://brasilapi.com.br/api/ncm/v1";
        const altResponse = await fetch(altUrl);
        if (altResponse.ok) {
          const altData = await altResponse.json();
          ncmData = altData.map((item: any) => ({
            Codigo: item.codigo,
            Descricao: item.descricao,
          }));
        }
      } catch {
        console.log("Alternative API also unavailable");
      }
    }

    if (ncmData.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: "Não foi possível obter dados NCM das APIs públicas",
          suggestion: "Tente novamente mais tarde ou importe manualmente" 
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert NCM data in batches
    const batchSize = 500;
    let inserted = 0;
    let updated = 0;

    for (let i = 0; i < ncmData.length; i += batchSize) {
      const batch = ncmData.slice(i, i + batchSize).map((item) => ({
        codigo: item.Codigo?.replace(/\./g, "").trim() || "",
        descricao: item.Descricao?.trim() || "",
        tipo: "ncm" as const,
      })).filter(item => item.codigo && item.descricao);

      if (batch.length === 0) continue;

      const { data, error } = await supabase
        .from("ncm_cache")
        .upsert(batch, { onConflict: "codigo", ignoreDuplicates: false });

      if (error) {
        console.error(`Batch error at ${i}:`, error.message);
      } else {
        inserted += batch.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_processados: ncmData.length,
        inseridos: inserted,
        message: `${inserted} códigos NCM sincronizados com sucesso`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync NCM error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
