import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { LogOut, Plus, ExternalLink, Cable, Loader2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface BlingConnection {
  id: string;
  bling_account_name: string | null;
  created_at: string;
  expires_at: string;
}

export default function Conexoes() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [connections, setConnections] = useState<BlingConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;

    const fetchConnections = async () => {
      // Read from bling_tokens (where OAuth callback saves) and map to expected shape
      const { data: tokenData, error } = await supabase
        .from('bling_tokens')
        .select('id, created_at, expires_at, scope')
        .order('created_at', { ascending: false });

      if (!error && tokenData) {
        setConnections(tokenData.map(t => ({
          id: t.id,
          bling_account_name: null,
          created_at: t.created_at,
          expires_at: t.expires_at,
        })));
      }
      setLoading(false);
    };

    fetchConnections();
  }, [user]);

  const handleConnect = async () => {
    setConnecting(true);
    setConnectError(null);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bling-config`,
        {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao buscar configuração');

      const { clientId, redirectUri } = data;
      const state = crypto.randomUUID();
      sessionStorage.setItem('bling_oauth_state', state);

      const url = `https://bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=produtos,pedidos`;
      window.location.href = url;
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Erro desconhecido ao preparar conexão.');
      setConnecting(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cable className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">ULTRADATA</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground">Minhas contas Bling</h2>
          <p className="text-muted-foreground mt-1">
            Gerencie suas conexões com o Bling para sincronizar produtos e pedidos.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : connections.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Cable className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-lg mb-2">
                Nenhuma conta Bling conectada.
              </p>
              <p className="text-muted-foreground text-sm">
                Clique no botão abaixo para conectar uma nova conta.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {connections.map((conn) => (
              <Card key={conn.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium text-foreground">
                      {conn.bling_account_name || 'Conta Bling'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Conectada em {format(new Date(conn.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/${conn.id}`)}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Acessar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {connectError && (
          <Alert variant="destructive" className="mt-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{connectError}</span>
              <Button variant="outline" size="sm" onClick={handleConnect} className="ml-4">
                Tentar novamente
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="mt-8">
          <Button
            onClick={handleConnect}
            disabled={connecting}
            className="bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-[hsl(var(--success-foreground))]"
          >
            {connecting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Preparando conexão...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Conectar nova conta Bling
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
}
