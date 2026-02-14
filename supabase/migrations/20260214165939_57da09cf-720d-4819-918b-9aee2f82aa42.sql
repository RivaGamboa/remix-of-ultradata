
-- Table to store Bling OAuth2 tokens per user
CREATE TABLE public.bling_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  scope TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.bling_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own tokens
CREATE POLICY "Users can view own bling tokens"
  ON public.bling_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bling tokens"
  ON public.bling_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bling tokens"
  ON public.bling_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bling tokens"
  ON public.bling_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update timestamps
CREATE TRIGGER update_bling_tokens_updated_at
  BEFORE UPDATE ON public.bling_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
