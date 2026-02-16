import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const AuthBlingCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const processCallback = async () => {
    const code = searchParams.get('code');

    if (!code) {
      setStatus('error');
      setErrorMsg('Código de autorização não encontrado.');
      return;
    }

    try {
      setStatus('loading');

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        setStatus('error');
        setErrorMsg('Usuário não autenticado. Faça login primeiro.');
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bling-oauth-callback`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ code }),
        }
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao processar autorização.');
      }

      setStatus('success');
      setTimeout(() => navigate('/conexoes'), 2500);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Erro desconhecido.');
    }
  };

  useEffect(() => {
    processCallback();
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center space-y-5 max-w-md">
        {status === 'loading' && (
          <>
            <Loader2 className="h-14 w-14 animate-spin text-primary mx-auto" />
            <h2 className="text-lg font-semibold text-foreground">Processando autorização, aguarde...</h2>
            <p className="text-sm text-muted-foreground">Estamos trocando o código de autorização pelo token de acesso.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="h-14 w-14 text-primary mx-auto" />
            <h2 className="text-lg font-semibold text-foreground">Bling conectado com sucesso!</h2>
            <p className="text-sm text-muted-foreground">Redirecionando para Conexões...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="h-14 w-14 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold text-foreground">Erro na autorização</h2>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={processCallback} variant="default">
                Tentar novamente
              </Button>
              <Button onClick={() => navigate('/conexoes')} variant="ghost">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Voltar para Conexões
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthBlingCallback;
