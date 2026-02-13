import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Prompt otimizado para correção de texto em produtos brasileiros
const SISTEMA_PROMPT = `
Você é um especialista em correção de textos para catálogos de produtos brasileiros.

<TAREFA>
Corrija ortografia, gramática e padronize o texto recebido seguindo as regras abaixo.
</TAREFA>

<REGRAS>
1. Corrija erros de ortografia e acentuação
2. Padronize capitalização (primeira letra de cada palavra significativa em maiúscula para nomes de produtos)
3. Remova espaços extras e caracteres especiais desnecessários
4. Mantenha números, códigos e siglas intactos
5. NÃO altere o significado do texto
6. NÃO invente informações
7. NÃO remova informações técnicas (medidas, modelos, etc.)
</REGRAS>

<FORMATO DE RESPOSTA>
Responda APENAS com este JSON:
{
  "texto_corrigido": "string (texto corrigido)",
  "alteracoes": [
    {
      "original": "string (parte original)",
      "corrigido": "string (parte corrigida)",
      "tipo": "ortografia" | "acentuacao" | "capitalizacao" | "espacos" | "pontuacao"
    }
  ],
  "houve_alteracao": boolean
}
</FORMATO DE RESPOSTA>

<EXEMPLOS>
Entrada: "chave de fenda ponta philips 3/16 x 4" profissional"
Saída: {
  "texto_corrigido": "Chave de Fenda Ponta Philips 3/16 x 4\" Profissional",
  "alteracoes": [
    {"original": "chave", "corrigido": "Chave", "tipo": "capitalizacao"},
    {"original": "fenda", "corrigido": "Fenda", "tipo": "capitalizacao"},
    {"original": "ponta", "corrigido": "Ponta", "tipo": "capitalizacao"},
    {"original": "philips", "corrigido": "Philips", "tipo": "capitalizacao"},
    {"original": "profissional", "corrigido": "Profissional", "tipo": "capitalizacao"}
  ],
  "houve_alteracao": true
}

Entrada: "parafuso   sextavado  m8 x 50mm  zincado"
Saída: {
  "texto_corrigido": "Parafuso Sextavado M8 x 50mm Zincado",
  "alteracoes": [
    {"original": "parafuso   sextavado", "corrigido": "Parafuso Sextavado", "tipo": "espacos"},
    {"original": "50mm  zincado", "corrigido": "50mm Zincado", "tipo": "espacos"}
  ],
  "houve_alteracao": true
}

Entrada: "Alicate Universal 8 Polegadas"
Saída: {
  "texto_corrigido": "Alicate Universal 8 Polegadas",
  "alteracoes": [],
  "houve_alteracao": false
}
</EXEMPLOS>
`;

interface TextoParaCorrigir {
  id: string | number;
  texto: string;
  campo: string;
}

interface ResultadoCorrecao {
  id: string | number;
  campo: string;
  texto_original: string;
  texto_corrigido: string;
  alteracoes: Array<{
    original: string;
    corrigido: string;
    tipo: string;
  }>;
  houve_alteracao: boolean;
  erro?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { textos, user_id } = await req.json() as { 
      textos: TextoParaCorrigir[]; 
      user_id?: string;
    };
    
    if (!textos || !Array.isArray(textos) || textos.length === 0) {
      return new Response(
        JSON.stringify({ error: true, mensagem: "Textos não fornecidos" }),
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

    const resultados: ResultadoCorrecao[] = [];

    // Processar em batches para evitar timeout
    const batchSize = 5;
    for (let i = 0; i < textos.length; i += batchSize) {
      const batch = textos.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (item): Promise<ResultadoCorrecao> => {
        if (!item.texto || item.texto.trim() === '') {
          return {
            id: item.id,
            campo: item.campo,
            texto_original: item.texto,
            texto_corrigido: item.texto,
            alteracoes: [],
            houve_alteracao: false,
          };
        }

        try {
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
                { role: "user", content: item.texto }
              ],
              temperature: 0.1,
              response_format: { type: "json_object" }
            }),
          });

          if (!deepseekResponse.ok) {
            throw new Error(`API retornou ${deepseekResponse.status}`);
          }

          const deepseekData = await deepseekResponse.json();
          const resultado = JSON.parse(deepseekData.choices[0].message.content);

          return {
            id: item.id,
            campo: item.campo,
            texto_original: item.texto,
            texto_corrigido: resultado.texto_corrigido || item.texto,
            alteracoes: resultado.alteracoes || [],
            houve_alteracao: resultado.houve_alteracao ?? false,
          };
        } catch (error) {
          console.error(`Erro ao corrigir texto ID ${item.id}:`, error);
          return {
            id: item.id,
            campo: item.campo,
            texto_original: item.texto,
            texto_corrigido: item.texto,
            alteracoes: [],
            houve_alteracao: false,
            erro: error instanceof Error ? error.message : 'Erro desconhecido',
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      resultados.push(...batchResults);

      // Delay entre batches para evitar rate limiting
      if (i + batchSize < textos.length) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    const tempoProcessamento = Date.now() - startTime;
    const totalAlterados = resultados.filter(r => r.houve_alteracao).length;

    return new Response(
      JSON.stringify({
        resultados,
        estatisticas: {
          total: textos.length,
          alterados: totalAlterados,
          sem_alteracao: textos.length - totalAlterados,
          tempo_ms: tempoProcessamento,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro no processamento:", error);
    return new Response(
      JSON.stringify({ 
        error: true, 
        mensagem: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
