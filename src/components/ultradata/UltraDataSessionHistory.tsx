import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  History,
  FileSpreadsheet,
  Clock,
  Play,
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle,
  Pause,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import type { SessionData } from '@/hooks/useSessionHistory';
import type { ProductRow, FieldConfig, ProcessedProduct } from '@/pages/UltraData';

interface UltraDataSessionHistoryProps {
  sessions: SessionData[];
  loading: boolean;
  onResumeSession: (
    rawData: ProductRow[],
    columns: string[],
    fieldConfigs: FieldConfig[],
    processedProducts: ProcessedProduct[],
    targetTab: string
  ) => void;
  onDeleteSession: (sessionId: string) => Promise<boolean>;
}

const statusConfig = {
  pending: {
    label: 'Pendente',
    color: 'bg-muted text-muted-foreground',
    icon: Clock,
  },
  processing: {
    label: 'Processando',
    color: 'bg-primary/20 text-primary',
    icon: Loader2,
  },
  paused: {
    label: 'Pausado',
    color: 'bg-warning/20 text-warning',
    icon: Pause,
  },
  completed: {
    label: 'Concluído',
    color: 'bg-success/20 text-success',
    icon: CheckCircle,
  },
  failed: {
    label: 'Falhou',
    color: 'bg-destructive/20 text-destructive',
    icon: AlertCircle,
  },
};

const UltraDataSessionHistory = ({
  sessions,
  loading,
  onResumeSession,
  onDeleteSession,
}: UltraDataSessionHistoryProps) => {
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleResume = (session: SessionData) => {
    const metadata = session.metadata || {};
    const rawData = metadata.rawData || [];
    const columns = metadata.columns || [];
    const fieldConfigs = metadata.fieldConfigs || [];
    const processedProducts = metadata.processedProducts || [];
    const targetTab = metadata.currentTab || 'config';

    if (rawData.length === 0) {
      toast({
        title: 'Dados não encontrados',
        description: 'Esta sessão não possui dados salvos para retomar.',
        variant: 'destructive',
      });
      return;
    }

    onResumeSession(rawData, columns, fieldConfigs, processedProducts, targetTab);
    
    toast({
      title: 'Sessão retomada',
      description: `Continuando trabalho em "${session.originalFilename}"`,
    });
  };

  const handleDelete = async (sessionId: string) => {
    setDeletingId(sessionId);
    const success = await onDeleteSession(sessionId);
    setDeletingId(null);

    if (success) {
      toast({
        title: 'Sessão excluída',
        description: 'A sessão foi removida do histórico.',
      });
    } else {
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir a sessão.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="p-4 bg-muted rounded-full w-fit mx-auto mb-4">
          <History className="h-12 w-12 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Nenhuma sessão anterior
        </h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          Quando você iniciar um processamento, ele será salvo automaticamente para que você possa retomar depois.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <History className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">Sessões Anteriores</h3>
        <Badge variant="secondary">{sessions.length}</Badge>
      </div>

      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-3">
          {sessions.map((session) => {
            const status = statusConfig[session.status] || statusConfig.pending;
            const StatusIcon = status.icon;
            const progress = session.totalItems > 0 
              ? Math.round((session.itemsProcessed / session.totalItems) * 100) 
              : 0;

            return (
              <div
                key={session.id}
                className="p-4 border rounded-lg bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="p-2 bg-muted rounded-lg flex-shrink-0">
                      <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">
                        {session.originalFilename}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{session.totalItems.toLocaleString('pt-BR')} itens</span>
                        <span>•</span>
                        <span>
                          {format(new Date(session.updatedAt), "dd MMM, HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      
                      {/* Progress bar for incomplete sessions */}
                      {session.status !== 'completed' && session.itemsProcessed > 0 && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Progresso</span>
                            <span className="font-medium">{progress}%</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <Badge className={`${status.color} border-0`}>
                      <StatusIcon className={`h-3 w-3 mr-1 ${session.status === 'processing' ? 'animate-spin' : ''}`} />
                      {status.label}
                    </Badge>

                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResume(session)}
                        className="h-8"
                      >
                        {session.status === 'completed' ? (
                          <>
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Revisar
                          </>
                        ) : (
                          <>
                            <Play className="h-3 w-3 mr-1" />
                            Retomar
                          </>
                        )}
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={deletingId === session.id}
                          >
                            {deletingId === session.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir sessão?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. A sessão "{session.originalFilename}" será excluída permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(session.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default UltraDataSessionHistory;
