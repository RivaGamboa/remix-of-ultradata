import { useState, useMemo } from 'react';
import { 
  Wand2, 
  SpellCheck, 
  Check, 
  X, 
  Loader2, 
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  RotateCcw,
  Pencil,
  Undo2,
  BookA
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useUserAbbreviations } from '@/hooks/useUserAbbreviations';
import type { ProductRow, FieldConfig } from '@/pages/UltraData';

interface UltraDataTextCorrectionProps {
  rawData: ProductRow[];
  columns: string[];
  fieldConfigs: FieldConfig[];
  onDataUpdate: (data: ProductRow[]) => void;
}

interface TextCorrection {
  rowIndex: number;
  column: string;
  original: string;
  corrected: string;
  manualEdit?: string; // Texto editado manualmente
  alterations: Array<{
    original: string;
    corrigido: string;
    tipo: string;
  }>;
  source: 'abbreviation' | 'spelling';
  accepted: boolean | null; // null = pending, true = accepted, false = rejected
  isEditing?: boolean; // Flag para modo de edição
}

const UltraDataTextCorrection = ({
  rawData,
  columns,
  fieldConfigs,
  onDataUpdate,
}: UltraDataTextCorrectionProps) => {
  const { toast } = useToast();
  const { abbreviations, loading: loadingAbbreviations } = useUserAbbreviations();
  
  const [corrections, setCorrections] = useState<TextCorrection[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingType, setProcessingType] = useState<'abbreviation' | 'spelling' | null>(null);
  const [progress, setProgress] = useState(0);
  const [showOnlyChanges, setShowOnlyChanges] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Colunas de texto para corrigir
  const textColumns = useMemo(() => {
    return fieldConfigs
      .filter(fc => fc.action === 'analyze' && !fc.isLocked)
      .map(fc => fc.column)
      .filter(col => {
        // Verificar se é coluna de texto (não numérica)
        const hasText = rawData.some(row => {
          const val = row[col];
          return typeof val === 'string' && val.trim().length > 0;
        });
        return hasText;
      });
  }, [fieldConfigs, rawData]);

  // Expandir abreviações usando a biblioteca
  const expandAbbreviations = (text: string, abbreviations: Record<string, string>): {
    expanded: string;
    changes: Array<{ original: string; corrigido: string; tipo: string }>;
  } => {
    let result = text;
    const changes: Array<{ original: string; corrigido: string; tipo: string }> = [];

    Object.entries(abbreviations).forEach(([abbr, full]) => {
      // Criar regex para encontrar abreviação como palavra inteira
      const regex = new RegExp(`\\b${abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      const matches = result.match(regex);
      
      if (matches) {
        matches.forEach(match => {
          changes.push({
            original: match,
            corrigido: full,
            tipo: 'abreviacao',
          });
        });
        result = result.replace(regex, full);
      }
    });

    return { expanded: result, changes };
  };

  // Processar expansão de abreviações
  const handleExpandAbbreviations = async () => {
    setIsProcessing(true);
    setProcessingType('abbreviation');
    setProgress(0);
    setCorrections([]);

    const newCorrections: TextCorrection[] = [];
    const total = rawData.length * textColumns.length;
    let processed = 0;

    for (let rowIndex = 0; rowIndex < rawData.length; rowIndex++) {
      const row = rawData[rowIndex];
      
      for (const column of textColumns) {
        const originalText = row[column]?.toString() || '';
        
        if (originalText.trim()) {
          const { expanded, changes } = expandAbbreviations(originalText, abbreviations);
          
          if (changes.length > 0) {
            newCorrections.push({
              rowIndex,
              column,
              original: originalText,
              corrected: expanded,
              alterations: changes,
              source: 'abbreviation',
              accepted: null,
            });
          }
        }
        
        processed++;
        setProgress((processed / total) * 100);
      }
    }

    setCorrections(newCorrections);
    setIsProcessing(false);
    setProcessingType(null);

    toast({
      title: "Expansão concluída",
      description: `${newCorrections.length} textos com abreviações encontradas.`,
    });
  };

  // Processar correção ortográfica com DeepSeek
  const handleSpellingCorrection = async () => {
    if (textColumns.length === 0) {
      toast({
        title: "Nenhuma coluna de texto",
        description: "Configure colunas para análise antes de corrigir.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setProcessingType('spelling');
    setProgress(0);
    setCorrections([]);

    const newCorrections: TextCorrection[] = [];
    
    // Preparar textos para enviar à API
    const textosParaCorrigir: Array<{ id: string; texto: string; campo: string }> = [];
    
    rawData.forEach((row, rowIndex) => {
      textColumns.forEach(column => {
        const texto = row[column]?.toString() || '';
        if (texto.trim()) {
          textosParaCorrigir.push({
            id: `${rowIndex}-${column}`,
            texto,
            campo: column,
          });
        }
      });
    });

    if (textosParaCorrigir.length === 0) {
      setIsProcessing(false);
      toast({
        title: "Nenhum texto para corrigir",
        description: "As colunas selecionadas estão vazias.",
      });
      return;
    }

    // Processar em batches
    const batchSize = 10;
    const totalBatches = Math.ceil(textosParaCorrigir.length / batchSize);

    for (let i = 0; i < textosParaCorrigir.length; i += batchSize) {
      const batch = textosParaCorrigir.slice(i, i + batchSize);
      
      try {
        const { data, error } = await supabase.functions.invoke('corrigir-texto', {
          body: { textos: batch },
        });

        if (error) throw error;

        if (data?.resultados) {
          data.resultados.forEach((resultado: any) => {
            if (resultado.houve_alteracao) {
              const [rowIndex, column] = resultado.id.split('-');
              newCorrections.push({
                rowIndex: parseInt(rowIndex),
                column,
                original: resultado.texto_original,
                corrected: resultado.texto_corrigido,
                alterations: resultado.alteracoes || [],
                source: 'spelling',
                accepted: null,
              });
            }
          });
        }
      } catch (err) {
        console.error('Erro na correção:', err);
      }

      setProgress(((i + batchSize) / textosParaCorrigir.length) * 100);
      
      // Delay para evitar rate limiting
      if (i + batchSize < textosParaCorrigir.length) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    setCorrections(newCorrections);
    setIsProcessing(false);
    setProcessingType(null);

    toast({
      title: "Correção concluída",
      description: `${newCorrections.length} textos com correções sugeridas.`,
    });
  };

  // Aceitar/Rejeitar correção individual
  const handleCorrectionDecision = (index: number, accepted: boolean) => {
    setCorrections(prev => prev.map((c, i) => 
      i === index ? { ...c, accepted, isEditing: false } : c
    ));
  };

  // Ativar modo de edição
  const handleStartEditing = (index: number) => {
    setCorrections(prev => prev.map((c, i) => 
      i === index ? { ...c, isEditing: true, manualEdit: c.manualEdit ?? c.corrected } : c
    ));
  };

  // Atualizar texto editado manualmente
  const handleManualEditChange = (index: number, newText: string) => {
    setCorrections(prev => prev.map((c, i) => 
      i === index ? { ...c, manualEdit: newText } : c
    ));
  };

  // Confirmar edição manual e aceitar
  const handleConfirmEdit = (index: number) => {
    setCorrections(prev => prev.map((c, i) => 
      i === index ? { ...c, corrected: c.manualEdit ?? c.corrected, isEditing: false, accepted: true } : c
    ));
  };

  // Cancelar edição
  const handleCancelEdit = (index: number) => {
    setCorrections(prev => prev.map((c, i) => 
      i === index ? { ...c, isEditing: false, manualEdit: undefined } : c
    ));
  };

  // Restaurar texto corrigido original
  const handleRestoreOriginalCorrection = (index: number, originalCorrected: string) => {
    setCorrections(prev => prev.map((c, i) => 
      i === index ? { ...c, manualEdit: originalCorrected } : c
    ));
  };

  // Aceitar todas as correções pendentes
  const handleAcceptAll = () => {
    setCorrections(prev => prev.map(c => 
      c.accepted === null ? { ...c, accepted: true } : c
    ));
  };

  // Rejeitar todas as correções pendentes
  const handleRejectAll = () => {
    setCorrections(prev => prev.map(c => 
      c.accepted === null ? { ...c, accepted: false } : c
    ));
  };

  // Aplicar correções aceitas aos dados (usa manualEdit se disponível)
  const handleApplyCorrections = () => {
    const acceptedCorrections = corrections.filter(c => c.accepted === true);
    
    if (acceptedCorrections.length === 0) {
      toast({
        title: "Nenhuma correção aceita",
        description: "Aceite pelo menos uma correção antes de aplicar.",
        variant: "destructive",
      });
      return;
    }

    const newData = [...rawData];
    
    acceptedCorrections.forEach(correction => {
      // Usa o texto editado manualmente se existir, senão usa o corrigido
      const finalText = correction.manualEdit ?? correction.corrected;
      newData[correction.rowIndex] = {
        ...newData[correction.rowIndex],
        [correction.column]: finalText,
      };
    });

    onDataUpdate(newData);
    setCorrections([]);
    
    toast({
      title: "Correções aplicadas!",
      description: `${acceptedCorrections.length} alterações aplicadas com sucesso.`,
    });
  };

  // Limpar correções
  const handleReset = () => {
    setCorrections([]);
  };

  // Toggle row expansion
  const toggleRowExpansion = (rowIndex: number) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowIndex)) {
        newSet.delete(rowIndex);
      } else {
        newSet.add(rowIndex);
      }
      return newSet;
    });
  };

  // Stats
  const stats = useMemo(() => ({
    total: corrections.length,
    pending: corrections.filter(c => c.accepted === null).length,
    accepted: corrections.filter(c => c.accepted === true).length,
    rejected: corrections.filter(c => c.accepted === false).length,
  }), [corrections]);

  // Agrupar correções por linha
  const correctionsByRow = useMemo(() => {
    const grouped = new Map<number, TextCorrection[]>();
    corrections.forEach(c => {
      if (!grouped.has(c.rowIndex)) {
        grouped.set(c.rowIndex, []);
      }
      grouped.get(c.rowIndex)!.push(c);
    });
    return grouped;
  }, [corrections]);

  const filteredCorrections = showOnlyChanges 
    ? corrections 
    : corrections;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Correção de Texto</h2>
        <p className="text-muted-foreground">
          Expanda abreviações e corrija ortografia em lote com validação manual.
        </p>
      </div>

      {/* Colunas que serão processadas */}
      <div className="p-4 bg-muted/50 rounded-lg">
        <p className="text-sm font-medium text-foreground mb-2">
          Colunas de texto para correção:
        </p>
        <div className="flex flex-wrap gap-2">
          {textColumns.length > 0 ? (
            textColumns.map(col => (
              <Badge key={col} variant="secondary">{col}</Badge>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma coluna de texto configurada para análise.
            </p>
          )}
        </div>
      </div>

      {/* Info sobre abreviações */}
      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border">
        <BookA className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground flex-1">
          Usando <strong className="text-foreground">{Object.keys(abbreviations).length}</strong> abreviações 
          da sua biblioteca personalizada.
        </span>
        {loadingAbbreviations && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Botões de ação */}
      <div className="flex flex-wrap gap-3">
        <Button 
          onClick={handleExpandAbbreviations}
          disabled={isProcessing || textColumns.length === 0 || loadingAbbreviations}
          variant="outline"
          className="flex-1 min-w-[200px]"
        >
          {isProcessing && processingType === 'abbreviation' ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4 mr-2" />
          )}
          Expandir Abreviações ({Object.keys(abbreviations).length})
        </Button>
        
        <Button 
          onClick={handleSpellingCorrection}
          disabled={isProcessing || textColumns.length === 0}
          className="flex-1 min-w-[200px]"
        >
          {isProcessing && processingType === 'spelling' ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <SpellCheck className="h-4 w-4 mr-2" />
          )}
          Corrigir Ortografia (IA)
        </Button>
      </div>

      {/* Barra de progresso */}
      {isProcessing && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {processingType === 'abbreviation' 
                ? 'Expandindo abreviações...' 
                : 'Corrigindo ortografia com IA...'}
            </span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Resultados */}
      {corrections.length > 0 && (
        <div className="space-y-4">
          {/* Stats e ações em massa */}
          <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex gap-2">
              <Badge variant="secondary">{stats.total} alterações</Badge>
              {stats.pending > 0 && (
                <Badge variant="outline">{stats.pending} pendentes</Badge>
              )}
              {stats.accepted > 0 && (
                <Badge className="bg-success/20 text-success border-success/50">
                  {stats.accepted} aceitas
                </Badge>
              )}
              {stats.rejected > 0 && (
                <Badge variant="destructive">{stats.rejected} rejeitadas</Badge>
              )}
            </div>

            <div className="flex-1" />

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleAcceptAll}
                disabled={stats.pending === 0}
              >
                <Check className="h-4 w-4 mr-1" />
                Aceitar Tudo
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRejectAll}
                disabled={stats.pending === 0}
              >
                <X className="h-4 w-4 mr-1" />
                Rejeitar Tudo
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleReset}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            </div>
          </div>

          {/* Toggle para mostrar apenas mudanças */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowOnlyChanges(!showOnlyChanges)}
            >
              {showOnlyChanges ? (
                <Eye className="h-4 w-4 mr-1" />
              ) : (
                <EyeOff className="h-4 w-4 mr-1" />
              )}
              {showOnlyChanges ? 'Mostrando alterações' : 'Mostrando tudo'}
            </Button>
          </div>

          {/* Lista de correções */}
          <ScrollArea className="h-[400px] border rounded-lg">
            <div className="divide-y">
              {corrections.map((correction, idx) => (
                <div 
                  key={`${correction.rowIndex}-${correction.column}-${idx}`}
                  className={`p-4 transition-colors ${
                    correction.accepted === true 
                      ? 'bg-success/5' 
                      : correction.accepted === false 
                        ? 'bg-destructive/5' 
                        : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Info */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          Linha {correction.rowIndex + 1}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {correction.column}
                        </Badge>
                        <Badge 
                          variant={correction.source === 'abbreviation' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {correction.source === 'abbreviation' ? 'Abreviação' : 'Ortografia'}
                        </Badge>
                      </div>

                      {/* Antes vs Depois */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-2 bg-destructive/10 rounded border border-destructive/20">
                          <p className="text-xs font-medium text-destructive mb-1">Antes:</p>
                          <p className="text-sm text-foreground">{correction.original}</p>
                        </div>
                        
                        {/* Campo de edição inline ou visualização */}
                        {correction.isEditing ? (
                          <div className="p-2 bg-primary/10 rounded border border-primary/30 space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium text-primary">Editar:</p>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs"
                                onClick={() => handleRestoreOriginalCorrection(idx, correction.corrected)}
                              >
                                <Undo2 className="h-3 w-3 mr-1" />
                                Restaurar
                              </Button>
                            </div>
                            <Textarea
                              value={correction.manualEdit ?? correction.corrected}
                              onChange={(e) => handleManualEditChange(idx, e.target.value)}
                              className="text-sm min-h-[60px] resize-none"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleConfirmEdit(idx)}
                                className="flex-1 bg-success hover:bg-success/90"
                              >
                                <Check className="h-3 w-3 mr-1" />
                                Confirmar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCancelEdit(idx)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="p-2 bg-success/10 rounded border border-success/20">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs font-medium text-success">
                                {correction.manualEdit ? 'Editado:' : 'Depois:'}
                              </p>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => handleStartEditing(idx)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </div>
                            <p className="text-sm text-foreground">
                              {correction.manualEdit ?? correction.corrected}
                            </p>
                            {correction.manualEdit && correction.manualEdit !== correction.corrected && (
                              <p className="text-xs text-muted-foreground mt-1 italic">
                                (Sugestão original: {correction.corrected.substring(0, 50)}...)
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Alterações detalhadas */}
                      {correction.alterations.length > 0 && !correction.isEditing && (
                        <div className="flex flex-wrap gap-1">
                          {correction.alterations.map((alt, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              <span className="line-through text-destructive/70">{alt.original}</span>
                              {' → '}
                              <span className="text-success">{alt.corrigido}</span>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Ações */}
                    {!correction.isEditing && (
                      <div className="flex flex-col gap-1">
                        <Button
                          size="sm"
                          variant={correction.accepted === true ? 'default' : 'outline'}
                          className={correction.accepted === true ? 'bg-success hover:bg-success/90' : ''}
                          onClick={() => handleCorrectionDecision(idx, true)}
                          title="Aceitar correção"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartEditing(idx)}
                          title="Editar manualmente"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={correction.accepted === false ? 'destructive' : 'outline'}
                          onClick={() => handleCorrectionDecision(idx, false)}
                          title="Rejeitar correção"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Botão aplicar */}
          {stats.accepted > 0 && (
            <Button 
              onClick={handleApplyCorrections} 
              size="lg" 
              className="w-full"
            >
              <Check className="h-4 w-4 mr-2" />
              Aplicar {stats.accepted} Correções Aceitas
            </Button>
          )}
        </div>
      )}

      {/* Estado vazio */}
      {!isProcessing && corrections.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <SpellCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Clique em um dos botões acima para iniciar a correção de textos.</p>
          <p className="text-sm mt-2">
            As alterações serão mostradas lado a lado para sua aprovação.
          </p>
        </div>
      )}
    </div>
  );
};

export default UltraDataTextCorrection;
