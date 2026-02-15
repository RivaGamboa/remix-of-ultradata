
-- Create bling_connections table for multiple Bling accounts per user
CREATE TABLE public.bling_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  bling_account_name TEXT DEFAULT 'Conta Bling',
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bling_connections ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own connections" ON public.bling_connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own connections" ON public.bling_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own connections" ON public.bling_connections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own connections" ON public.bling_connections FOR DELETE USING (auth.uid() = user_id);

-- Auto-update trigger
CREATE TRIGGER update_bling_connections_updated_at
  BEFORE UPDATE ON public.bling_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
