
-- Extensão trigram
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Tabela de cache NCM/CEST
CREATE TABLE public.ncm_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo text NOT NULL UNIQUE,
  descricao text NOT NULL,
  tipo text NOT NULL DEFAULT 'ncm',
  ncm_pai text,
  unidade text,
  aliquota_ipi numeric,
  metadata jsonb DEFAULT '{}'::jsonb,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('portuguese', coalesce(codigo, '') || ' ' || coalesce(descricao, ''))
  ) STORED,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_ncm_cache_codigo ON public.ncm_cache (codigo);
CREATE INDEX idx_ncm_cache_tipo ON public.ncm_cache (tipo);
CREATE INDEX idx_ncm_cache_search ON public.ncm_cache USING GIN (search_vector);
CREATE INDEX idx_ncm_cache_descricao_trgm ON public.ncm_cache USING GIN (descricao gin_trgm_ops);

-- RLS
ALTER TABLE public.ncm_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "NCM cache readable by authenticated users"
ON public.ncm_cache FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Função de busca NCM
CREATE OR REPLACE FUNCTION public.buscar_ncm(
  termo text,
  limite integer DEFAULT 20
)
RETURNS TABLE (
  codigo text,
  descricao text,
  tipo text,
  relevancia real
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    nc.codigo,
    nc.descricao,
    nc.tipo,
    (ts_rank(nc.search_vector, plainto_tsquery('portuguese', termo)) +
    similarity(nc.descricao, termo))::real AS relevancia
  FROM public.ncm_cache nc
  WHERE
    nc.search_vector @@ plainto_tsquery('portuguese', termo)
    OR nc.descricao ILIKE '%' || termo || '%'
    OR nc.codigo LIKE termo || '%'
  ORDER BY relevancia DESC
  LIMIT limite;
END;
$$;

-- Trigger updated_at
CREATE TRIGGER update_ncm_cache_updated_at
BEFORE UPDATE ON public.ncm_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
