import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileSpreadsheet, Calendar, BarChart3, Loader2, History as HistoryIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { AuthModal } from '@/components/AuthModal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ProcessingLog {
  id: string;
  filename: string;
  rows_processed: number;
  duplicates_found: number;
  abbreviations_applied: number;
  original_columns: string[] | null;
  processed_columns: string[] | null;
  created_at: string;
}

const History = () => {
  const { user, loading: authLoading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [logs, setLogs] = useState<ProcessingLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchLogs = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('processing_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching logs:', error);
      } else {
        setLogs(data as ProcessingLog[]);
      }
      setLoading(false);
    };

    fetchLogs();
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />

      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Link to="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
              </Link>
              <div className="p-2 bg-primary/10 rounded-lg">
                <HistoryIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  Histórico de Processamentos
                </h1>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  Visualize seus processamentos anteriores
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {!user ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <HistoryIcon className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Faça login para ver seu histórico
              </h2>
              <p className="text-muted-foreground text-center mb-6 max-w-md">
                O histórico de processamentos é salvo automaticamente quando você está logado.
              </p>
              <Button onClick={() => setShowAuthModal(true)}>
                Entrar na conta
              </Button>
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : logs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileSpreadsheet className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Nenhum processamento encontrado
              </h2>
              <p className="text-muted-foreground text-center mb-6 max-w-md">
                Quando você processar arquivos, eles aparecerão aqui.
              </p>
              <Link to="/">
                <Button>
                  Iniciar novo processamento
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total de Processamentos</CardDescription>
                  <CardTitle className="text-3xl">{logs.length}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Linhas Processadas</CardDescription>
                  <CardTitle className="text-3xl">
                    {logs.reduce((acc, log) => acc + (log.rows_processed || 0), 0).toLocaleString('pt-BR')}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Abreviações Aplicadas</CardDescription>
                  <CardTitle className="text-3xl">
                    {logs.reduce((acc, log) => acc + (log.abbreviations_applied || 0), 0).toLocaleString('pt-BR')}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* History Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Processamentos Recentes
                </CardTitle>
                <CardDescription>
                  Detalhes de cada sessão de enriquecimento
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Data
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4" />
                          Arquivo
                        </div>
                      </TableHead>
                      <TableHead className="text-right">Linhas</TableHead>
                      <TableHead className="text-right">Duplicados</TableHead>
                      <TableHead className="text-right">Abreviações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">
                          {format(new Date(log.created_at), "dd 'de' MMM, yyyy 'às' HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={log.filename}>
                          {log.filename}
                        </TableCell>
                        <TableCell className="text-right">
                          {(log.rows_processed || 0).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          {(log.duplicates_found || 0).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          {(log.abbreviations_applied || 0).toLocaleString('pt-BR')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default History;
