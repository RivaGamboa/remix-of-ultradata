import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TagGenerationRequest {
  productName: string;
  productDescription?: string;
  existingTags?: string;
  count?: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productName, productDescription, existingTags, count = 10 }: TagGenerationRequest = await req.json();

    if (!productName) {
      return new Response(
        JSON.stringify({ error: 'Product name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `Você é um especialista em SEO e e-commerce brasileiro. Sua tarefa é gerar tags/palavras-chave relevantes para produtos de catálogo.

REGRAS:
1. Gere exatamente ${count} tags únicas e relevantes
2. Tags devem ser em português brasileiro
3. Use palavras-chave que clientes reais pesquisariam
4. Inclua variações (singular/plural, com/sem acento)
5. Priorize termos específicos sobre genéricos
6. Considere sinônimos e termos relacionados
7. NÃO repita tags que já existem no produto

Retorne APENAS um JSON válido no formato:
{
  "tags": ["tag1", "tag2", "tag3", ...]
}`;

    const userPrompt = `Produto: ${productName}
${productDescription ? `Descrição: ${productDescription}` : ''}
${existingTags ? `Tags existentes (NÃO repetir): ${existingTags}` : ''}

Gere ${count} novas tags SEO para este produto.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI request failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Extract JSON from response
    let tags: string[] = [];
    try {
      // Try to parse as JSON directly
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        tags = parsed.tags || [];
      }
    } catch (parseError) {
      // If JSON parsing fails, try to extract tags from text
      const lines = content.split('\n').filter((line: string) => line.trim());
      tags = lines
        .map((line: string) => line.replace(/^[-*\d.)\s]+/, '').trim())
        .filter((tag: string) => tag.length > 0 && tag.length < 50);
    }

    // Clean and dedupe tags
    tags = [...new Set(tags.map(t => t.toLowerCase().trim()))]
      .filter(t => t.length >= 2)
      .slice(0, count);

    return new Response(
      JSON.stringify({ 
        tags,
        model: 'google/gemini-3-flash-preview',
        prompt: userPrompt 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Tag generation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
