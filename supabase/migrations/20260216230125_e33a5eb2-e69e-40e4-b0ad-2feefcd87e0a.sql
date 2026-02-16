
-- Mover extensão pg_trgm para schema extensions
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- Recriar o índice usando o schema correto
DROP INDEX IF EXISTS idx_ncm_cache_descricao_trgm;
CREATE INDEX idx_ncm_cache_descricao_trgm ON public.ncm_cache USING GIN (descricao extensions.gin_trgm_ops);

-- Atualizar função de busca para usar extensions.similarity
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
    extensions.similarity(nc.descricao, termo))::real AS relevancia
  FROM public.ncm_cache nc
  WHERE
    nc.search_vector @@ plainto_tsquery('portuguese', termo)
    OR nc.descricao ILIKE '%' || termo || '%'
    OR nc.codigo LIKE termo || '%'
  ORDER BY relevancia DESC
  LIMIT limite;
END;
$$;
