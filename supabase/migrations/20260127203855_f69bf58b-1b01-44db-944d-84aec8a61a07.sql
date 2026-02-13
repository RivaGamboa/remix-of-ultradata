-- Criar tabela para produtos processados pelo UltraData
CREATE TABLE public.produtos_processados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID REFERENCES public.product_enrichment_sessions(id) ON DELETE SET NULL,
  
  -- Dados originais
  produto_original JSONB NOT NULL,
  
  -- Dados enriquecidos pela IA
  nome_padronizado TEXT,
  descricao_enriquecida TEXT,
  categoria_inferida TEXT,
  marca_inferida TEXT,
  origem_inferida TEXT,
  
  -- Status de inferência
  necessita_revisao BOOLEAN NOT NULL DEFAULT false,
  razao_revisao TEXT,
  
  -- Flags de validação
  validado BOOLEAN NOT NULL DEFAULT false,
  validado_em TIMESTAMP WITH TIME ZONE,
  
  -- Metadados
  modelo_ia TEXT DEFAULT 'deepseek-chat',
  tempo_processamento_ms INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.produtos_processados ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own processed products" 
ON public.produtos_processados 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own processed products" 
ON public.produtos_processados 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own processed products" 
ON public.produtos_processados 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own processed products" 
ON public.produtos_processados 
FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_produtos_processados_updated_at
BEFORE UPDATE ON public.produtos_processados
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_produtos_processados_user_id ON public.produtos_processados(user_id);
CREATE INDEX idx_produtos_processados_session_id ON public.produtos_processados(session_id);
CREATE INDEX idx_produtos_processados_necessita_revisao ON public.produtos_processados(necessita_revisao);
CREATE INDEX idx_produtos_processados_validado ON public.produtos_processados(validado);