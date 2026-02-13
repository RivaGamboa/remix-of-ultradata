-- =====================================================
-- ULTRACLEAN PRÉ-PRODUÇÃO - NOVAS TABELAS E STORAGE
-- =====================================================

-- 1. Tabela de sessões de enriquecimento (histórico de processamento)
CREATE TABLE IF NOT EXISTS public.product_enrichment_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  original_filename TEXT NOT NULL,
  total_items INTEGER NOT NULL DEFAULT 0,
  items_processed INTEGER NOT NULL DEFAULT 0,
  duplicates_found INTEGER NOT NULL DEFAULT 0,
  images_added INTEGER NOT NULL DEFAULT 0,
  tags_generated INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_enrichment_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sessions
CREATE POLICY "Users can view their own sessions"
  ON public.product_enrichment_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sessions"
  ON public.product_enrichment_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
  ON public.product_enrichment_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions"
  ON public.product_enrichment_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_product_enrichment_sessions_updated_at
  BEFORE UPDATE ON public.product_enrichment_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Tabela de imagens processadas
CREATE TABLE IF NOT EXISTS public.processed_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.product_enrichment_sessions(id) ON DELETE CASCADE,
  product_sku TEXT NOT NULL,
  product_name TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('search', 'ai_generated', 'upload')),
  original_url TEXT,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  width INTEGER DEFAULT 1080,
  height INTEGER DEFAULT 1080,
  format TEXT DEFAULT 'webp',
  file_size_bytes INTEGER,
  is_background_removed BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.processed_images ENABLE ROW LEVEL SECURITY;

-- RLS Policies for images
CREATE POLICY "Users can view their own images"
  ON public.processed_images FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own images"
  ON public.processed_images FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own images"
  ON public.processed_images FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own images"
  ON public.processed_images FOR DELETE
  USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX idx_processed_images_sku ON public.processed_images(product_sku);
CREATE INDEX idx_processed_images_session ON public.processed_images(session_id);

-- 3. Tabela de tags geradas por IA
CREATE TABLE IF NOT EXISTS public.generated_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.product_enrichment_sessions(id) ON DELETE CASCADE,
  product_sku TEXT NOT NULL,
  product_name TEXT,
  original_tags TEXT,
  generated_tags TEXT[] NOT NULL DEFAULT '{}',
  tag_group TEXT NOT NULL DEFAULT 'ULTRACLEAN',
  combined_tags TEXT,
  ai_model TEXT DEFAULT 'gemini-3-flash',
  prompt_used TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.generated_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tags
CREATE POLICY "Users can view their own tags"
  ON public.generated_tags FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tags"
  ON public.generated_tags FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tags"
  ON public.generated_tags FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tags"
  ON public.generated_tags FOR DELETE
  USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX idx_generated_tags_sku ON public.generated_tags(product_sku);
CREATE INDEX idx_generated_tags_session ON public.generated_tags(session_id);

-- 4. Tabela para árvore de categorias do Bling
CREATE TABLE IF NOT EXISTS public.category_trees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'Categorias Bling',
  categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.category_trees ENABLE ROW LEVEL SECURITY;

-- RLS Policies for category trees
CREATE POLICY "Users can view their own category trees"
  ON public.category_trees FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own category trees"
  ON public.category_trees FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own category trees"
  ON public.category_trees FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own category trees"
  ON public.category_trees FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_category_trees_updated_at
  BEFORE UPDATE ON public.category_trees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Criar bucket de storage para imagens de produtos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for product-images bucket
CREATE POLICY "Anyone can view product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update their own product images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'product-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own product images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'product-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );