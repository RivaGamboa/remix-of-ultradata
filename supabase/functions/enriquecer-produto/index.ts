import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SISTEMA DE PROMPT OTIMIZADO PARA PRODUTOS BRASILEIROS COM NCM
const SISTEMA_PROMPT = `
Você é o motor de enriquecimento do UltraData, especialista em e-commerce brasileiro.

<REGRA DE OURO>
NUNCA INVENTE VALORES. Sua tarefa é PADRONIZAR, NÃO CRIAR.
Se um dado não puder ser inferido com 95% de confiança a partir do contexto, deixe vazio e sinalize para revisão.
</REGRA DE OURO>

<FORMATO DE RESPOSTA OBRIGATÓRIO>
Responda APENAS com este JSON:
{
  "nome_padronizado": "string (corrige grafia, acentos, maiúsculas conforme padrão de catálogo)",
  "descricao_enriquecida": "string (melhora a descrição mantendo APENAS fatos existentes, expande abreviações)",
  "categoria_inferida": "string (formato: 'Categoria > Subcategoria' ou vazio se incerto)",
  "marca_inferida": "string (SÓ se for explícita ou óbvia no contexto. Senão, vazio)",
  "origem_inferida": "Nacional" | "Importado" | "",
  "ncm_sugerido": {
    "codigo": "string (código NCM de 8 dígitos no formato XXXX.XX.XX ou vazio)",
    "descricao": "string (descrição resumida da posição NCM)",
    "confianca": "alta" | "media" | "baixa",
    "observacao": "string (explicação sobre a classificação sugerida)"
  },
  "status_inferencia": {
    "necessita_revisao": boolean,
    "razao": "string (explicação clara do que é incerto)"
  }
}
</FORMATO DE RESPOSTA>

<REGRAS NCM>
1. O NCM (Nomenclatura Comum do Mercosul) deve ser sugerido APENAS se houver informação suficiente sobre o produto.
2. Use a estrutura de 8 dígitos: XXXX.XX.XX (Capítulo.Posição.Subposição.Item)
3. SEMPRE marque "confianca": "baixa" ou "media" e inclua observação indicando que é uma SUGESTÃO para pesquisa.
4. Exemplos comuns:
   - Ferramentas manuais: 8205.XX.XX
   - Produtos eletrônicos: 8471.XX.XX (computadores), 8528.XX.XX (monitores/TVs)
   - Móveis: 9403.XX.XX
   - Vestuário: 61XX.XX.XX (malha), 62XX.XX.XX (tecido plano)
5. Se não for possível determinar, deixe o campo codigo vazio e explique na observação.
</REGRAS NCM>

<EXEMPLOS>
1. Entrada: {"nome": "mouse gamer rgb logitech g502"}
   Saída: {
     "nome_padronizado": "Mouse Gamer RGB Logitech G502",
     "descricao_enriquecida": "Mouse gamer Logitech modelo G502 com iluminação RGB",
     "categoria_inferida": "Informática > Periféricos > Mouses",
     "marca_inferida": "Logitech",
     "origem_inferida": "Importado",
     "ncm_sugerido": {
       "codigo": "8471.60.53",
       "descricao": "Mouses para máquinas automáticas de processamento de dados",
       "confianca": "media",
       "observacao": "Sugestão baseada em mouse para computador. Confirmar com contador/despachante."
     },
     "status_inferencia": {"necessita_revisao": false, "razao": ""}
   }

2. Entrada: {"nome": "Furadeira Black+Decker 500W", "categoria": ""}
   Saída: {
     "nome_padronizado": "Furadeira Black+Decker 500W",
     "descricao_enriquecida": "Furadeira elétrica Black+Decker com potência de 500 Watts",
     "categoria_inferida": "Ferramentas > Elétricas > Furadeiras",
     "marca_inferida": "Black+Decker",
     "origem_inferida": "",
     "ncm_sugerido": {
       "codigo": "8467.21.00",
       "descricao": "Furadeiras de todos os tipos, incluindo perfuratrizes",
       "confianca": "alta",
       "observacao": "NCM comum para furadeiras elétricas manuais."
     },
     "status_inferencia": {"necessita_revisao": false, "razao": ""}
   }

3. Entrada: {"nome": "camiseta preta básica"}
   Saída: {
     "nome_padronizado": "Camiseta Preta Básica",
     "descricao_enriquecida": "Camiseta básica na cor preta",
     "categoria_inferida": "Vestuário > Camisetas",
     "marca_inferida": "",
     "origem_inferida": "",
     "ncm_sugerido": {
       "codigo": "",
       "descricao": "",
       "confianca": "baixa",
       "observacao": "Não é possível determinar NCM sem saber composição (algodão, sintético) e tipo de tecido (malha/plano)."
     },
     "status_inferencia": {"necessita_revisao": true, "razao": "Marca e composição do tecido não identificadas."}
   }
</EXEMPLOS>
`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { produto, user_id, session_id, abbreviations } = await req.json();
    
    if (!produto) {
      return new Response(
        JSON.stringify({ error: true, mensagem: "Produto não fornecido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const deepseekApiKey = Deno.env.get("DEEPSEEK_API_KEY");
    if (!deepseekApiKey) {
      return new Response(
        JSON.stringify({ error: true, mensagem: "DEEPSEEK_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build user message with abbreviations context
    let userContent = JSON.stringify(produto);
    if (abbreviations && Object.keys(abbreviations).length > 0) {
      userContent = `Produto: ${JSON.stringify(produto)}\n\nAbreviações conhecidas (expanda quando encontrar): ${JSON.stringify(abbreviations)}`;
    }

    // 1. CHAMADA À API DEEPSEEK
    console.log("Chamando DeepSeek API para produto:", JSON.stringify(produto).substring(0, 100));
    
    const deepseekResponse = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${deepseekApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SISTEMA_PROMPT },
          { role: "user", content: userContent }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      }),
    });

    if (!deepseekResponse.ok) {
      const errorText = await deepseekResponse.text();
      console.error("Erro DeepSeek:", deepseekResponse.status, errorText);
      throw new Error(`Falha na API DeepSeek: ${deepseekResponse.status}`);
    }
    
    const deepseekData = await deepseekResponse.json();
    console.log("Resposta DeepSeek recebida");
    
    let resultado;
    try {
      resultado = JSON.parse(deepseekData.choices[0].message.content);
    } catch (parseError) {
      console.error("Erro ao parsear resposta:", deepseekData.choices[0].message.content);
      throw new Error("Resposta da IA não é JSON válido");
    }

    const tempoProcessamento = Date.now() - startTime;
    
    // 2. SALVAR NO BANCO (se user_id fornecido)
    if (user_id) {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      
      const { error: insertError } = await supabaseClient
        .from("produtos_processados")
        .insert({
          user_id,
          session_id: session_id || null,
          produto_original: produto,
          nome_padronizado: resultado.nome_padronizado || null,
          descricao_enriquecida: resultado.descricao_enriquecida || null,
          categoria_inferida: resultado.categoria_inferida || null,
          marca_inferida: resultado.marca_inferida || null,
          origem_inferida: resultado.origem_inferida || null,
          necessita_revisao: resultado.status_inferencia?.necessita_revisao ?? true,
          razao_revisao: resultado.status_inferencia?.razao || null,
          validado: false,
          modelo_ia: 'deepseek-chat',
          tempo_processamento_ms: tempoProcessamento,
          metadata: {
            ncm_sugerido: resultado.ncm_sugerido || null,
          },
        });
      
      if (insertError) {
        console.error("Erro ao salvar no banco:", insertError);
        // Continua mesmo com erro no banco - retorna o resultado
      }
    }
    
    return new Response(
      JSON.stringify({
        ...resultado,
        tempo_processamento_ms: tempoProcessamento,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Erro no processamento:", error);
    return new Response(
      JSON.stringify({ 
        error: true, 
        mensagem: error instanceof Error ? error.message : "Erro desconhecido",
        status_inferencia: { necessita_revisao: true, razao: "Erro no processamento" }
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
