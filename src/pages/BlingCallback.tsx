import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBlingAuth } from '@/hooks/useBlingAuth';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

const BlingCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleCallback } = useBlingAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setErrorMsg(searchParams.get('error_description') || error);
      return;
    }

    if (!code || !state) {
      setStatus('error');
      setErrorMsg('Parâmetros de callback ausentes.');
      return;
    }

    handleCallback(code, state)
      .then(() => {
        setStatus('success');
        setTimeout(() => navigate('/conexoes'), 2000);
      })
      .catch((err) => {
        setStatus('error');
        setErrorMsg(err.message);
      });
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        {status === 'loading' && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">Conectando ao Bling...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="h-12 w-12 text-primary mx-auto" />
            <p className="text-foreground font-medium">Bling conectado com sucesso!</p>
            <p className="text-sm text-muted-foreground">Redirecionando...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <p className="text-foreground font-medium">Erro ao conectar</p>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <button onClick={() => navigate('/conexoes')} className="text-primary underline text-sm">
              Voltar ao início
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default BlingCallback;
