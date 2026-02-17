
-- Create produto_tags table for canonical/persistent tags
CREATE TABLE public.produto_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL,
  produto_id text NOT NULL,
  tag text NOT NULL,
  tipo text DEFAULT 'geral',
  user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(connection_id, produto_id, tag)
);

-- Indexes
CREATE INDEX idx_produto_tags_connection ON public.produto_tags(connection_id);
CREATE INDEX idx_produto_tags_user ON public.produto_tags(user_id);
CREATE INDEX idx_produto_tags_produto ON public.produto_tags(produto_id);

-- Enable RLS
ALTER TABLE public.produto_tags ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own product tags"
ON public.produto_tags FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own product tags"
ON public.produto_tags FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own product tags"
ON public.produto_tags FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own product tags"
ON public.produto_tags FOR DELETE
USING (auth.uid() = user_id);
