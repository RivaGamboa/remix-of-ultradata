import { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, AlertTriangle, Check, Loader2, Play, Pause, Camera, ImageIcon, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getAbbreviations } from '@/config';
import UltraDataImageSearch from './UltraDataImageSearch';
import type { ProductRow, FieldConfig, ProcessedProduct } from '@/pages/UltraData';

interface UltraDataProcessingProps {
  rawData: ProductRow[];
  fieldConfigs: FieldConfig[];
  userId?: string;
  isProcessing: boolean;
  setIsProcessing: (val: boolean) => void;
  onComplete: (products: ProcessedProduct[]) => void;
  onDataUpdate?: (data: ProductRow[]) => void;
  sessionId?: string | null;
  onSessionUpdate?: (sessionId: string, updates: {
    status?: 'pending' | 'processing' | 'paused' | 'completed' | 'failed';
    itemsProcessed?: number;
  }) => Promise<boolean>;
}

const UltraDataProcessing = ({
  rawData,
  fieldConfigs,
  userId,
  isProcessing,
  setIsProcessing,
  onComplete,
  onDataUpdate,
  sessionId,
  onSessionUpdate,
}: UltraDataProcessingProps) => {
  const { toast } = useToast();
  const [progress, setProgress] = useState(0);
  const [currentItem, setCurrentItem] = useState(0);
  const [processedProducts, setProcessedProducts] = useState<ProcessedProduct[]>([]);
  const [logs, setLogs] = useState<{ type: 'info' | 'success' | 'warning' | 'error'; message: string }[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [imageSearchOpen, setImageSearchOpen] = useState(false);
  const [imageSearchQuery, setImageSearchQuery] = useState('');
  const [imageSearchProductIndex, setImageSearchProductIndex] = useState<number | null>(null);
  const [batchSize, setBatchSize] = useState(3);
  const abortRef = useRef(false);
  const cacheRef = useRef<Map<string, ProcessedProduct>>(new Map());

  // Load abbreviations from config
  const abbreviations = useRef(getAbbreviations());

  const addLog = (type: 'info' | 'success' | 'warning' | 'error', message: string) => {
    setLogs(prev => [...prev.slice(-99), { type, message }]);
  };

  const analyzeColumns = fieldConfigs.filter(fc => fc.action === 'analyze').map(fc => fc.column);

  const processProduct = async (row: ProductRow, index: number): Promise<ProcessedProduct> => {
    const productToEnrich: Record<string, any> = {};
    analyzeColumns.forEach(col => {
      if (row[col] !== undefined && row[col] !== null) {
        productToEnrich[col] = row[col];
      }
    });

    // Check cache
    const cacheKey = JSON.stringify(productToEnrich);
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      addLog('info', `Item ${index + 1}: Cache hit ⚡`);
      return { ...cached, original: row };
    }

    try {
      const { data, error } = await supabase.functions.invoke('enriquecer-produto', {
        body: {
          produto: productToEnrich,
          user_id: userId,
          abbreviations: abbreviations.current,
        },
      });

      if (error) throw error;

      if (data.error) {
        addLog('error', `Item ${index + 1}: ${data.mensagem}`);
        return {
          original: row,
          enriched: {},
          necessita_revisao: true,
          razao_revisao: data.mensagem || 'Erro no processamento',
          validado: false,
        };
      }

      const needsReview = data.status_inferencia?.necessita_revisao ?? false;
      
      if (needsReview) {
        addLog('warning', `Item ${index + 1}: Necessita revisão - ${data.status_inferencia?.razao}`);
      } else {
        addLog('success', `Item ${index + 1}: Processado em ${data.tempo_processamento_ms}ms`);
      }

      const result: ProcessedProduct = {
        original: row,
        enriched: {
          nome_padronizado: data.nome_padronizado,
          descricao_enriquecida: data.descricao_enriquecida,
          categoria_inferida: data.categoria_inferida,
          marca_inferida: data.marca_inferida,
          origem_inferida: data.origem_inferida,
          ncm_sugerido: data.ncm_sugerido,
        },
        necessita_revisao: needsReview,
        razao_revisao: data.status_inferencia?.razao,
        validado: false,
        tempo_processamento_ms: data.tempo_processamento_ms,
      };

      // Store in cache
      cacheRef.current.set(cacheKey, result);

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      addLog('error', `Item ${index + 1}: ${message}`);
      return {
        original: row,
        enriched: {},
        necessita_revisao: true,
        razao_revisao: message,
        validado: false,
      };
    }
  };

  const startProcessing = async () => {
    if (rawData.length === 0) return;

    setIsProcessing(true);
    setProgress(0);
    setCurrentItem(0);
    setProcessedProducts([]);
    setLogs([]);
    abortRef.current = false;

    if (sessionId && onSessionUpdate) {
      await onSessionUpdate(sessionId, { status: 'processing' });
    }

    addLog('info', `Iniciando processamento de ${rawData.length} itens (lote: ${batchSize})...`);
    addLog('info', `Colunas para análise: ${analyzeColumns.join(', ')}`);
    addLog('info', `Abreviações carregadas: ${Object.keys(abbreviations.current).length} regras`);

    const results: ProcessedProduct[] = [];

    // Process in parallel batches
    for (let i = 0; i < rawData.length; i += batchSize) {
      if (abortRef.current) {
        addLog('warning', 'Processamento cancelado pelo usuário');
        break;
      }

      while (isPaused && !abortRef.current) {
        await new Promise(r => setTimeout(r, 100));
      }

      const batch = rawData.slice(i, Math.min(i + batchSize, rawData.length));
      const batchPromises = batch.map((row, bIdx) => processProduct(row, i + bIdx));
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      setCurrentItem(Math.min(i + batchSize, rawData.length));
      setProcessedProducts([...results]);
      setProgress((results.length / rawData.length) * 100);

      // Rate limit delay between batches
      if (i + batchSize < rawData.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    setIsProcessing(false);
    
    const needsReview = results.filter(r => r.necessita_revisao).length;
    addLog('info', `Processamento concluído: ${results.length} itens, ${needsReview} necessitam revisão`);

    toast({
      title: "Processamento concluído!",
      description: `${results.length} produtos processados. ${needsReview} necessitam revisão.`,
    });

    if (results.length > 0) {
      onComplete(results);
    }
  };

  const pauseProcessing = async () => {
    setIsPaused(true);
    addLog('info', 'Processamento pausado');
    
    if (sessionId && onSessionUpdate) {
      await onSessionUpdate(sessionId, { 
        status: 'paused',
        itemsProcessed: processedProducts.length,
      });
    }
  };

  const resumeProcessing = async () => {
    setIsPaused(false);
    addLog('info', 'Processamento retomado');
    
    if (sessionId && onSessionUpdate) {
      await onSessionUpdate(sessionId, { status: 'processing' });
    }
  };

  const cancelProcessing = async () => {
    abortRef.current = true;
    setIsPaused(false);
    setIsProcessing(false);
    
    if (sessionId && onSessionUpdate) {
      await onSessionUpdate(sessionId, { 
        status: 'failed',
        itemsProcessed: processedProducts.length,
      });
    }
  };

  const logColors = {
    info: 'text-muted-foreground',
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-destructive',
  };

  const reviewCount = processedProducts.filter(p => p.necessita_revisao).length;
  const successCount = processedProducts.filter(p => !p.necessita_revisao).length;

  const openImageSearchForProduct = (product: ProcessedProduct, idx: number) => {
    const name = product.enriched.nome_padronizado || product.original['nome'] || product.original['Nome'] || '';
    setImageSearchQuery(String(name));
    setImageSearchProductIndex(idx);
    setImageSearchOpen(true);
  };

  const IMAGE_COLUMN = 'URL Imagens Externas';

  const handleImageSelected = (imageUrl: string) => {
    if (imageSearchProductIndex !== null && onDataUpdate) {
      const updatedData = rawData.map((row, i) => {
        if (i === imageSearchProductIndex) {
          const existing = String(row[IMAGE_COLUMN] || '').trim();
          return {
            ...row,
            [IMAGE_COLUMN]: existing ? `${existing}|${imageUrl}` : imageUrl,
          };
        }
        return row;
      });
      onDataUpdate(updatedData);

      // Also update the processed product's original data for display
      setProcessedProducts(prev =>
        prev.map((p, i) => {
          if (i === imageSearchProductIndex) {
            const existing = String(p.original[IMAGE_COLUMN] || '').trim();
            return {
              ...p,
              original: {
                ...p.original,
                [IMAGE_COLUMN]: existing ? `${existing}|${imageUrl}` : imageUrl,
              },
            };
          }
          return p;
        })
      );
    }

    toast({
      title: 'Imagem vinculada!',
      description: `URL salva na coluna "${IMAGE_COLUMN}" do produto.`,
    });
    setImageSearchOpen(false);
    setImageSearchProductIndex(null);
  };

  return (
    <div className="space-y-6">
      <UltraDataImageSearch
        isOpen={imageSearchOpen}
        onClose={() => setImageSearchOpen(false)}
        onImageSelect={handleImageSelected}
        initialQuery={imageSearchQuery}
      />
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Processamento com IA</h2>
        <p className="text-muted-foreground">
          A DeepSeek AI irá enriquecer seus produtos automaticamente.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-muted/50 rounded-lg text-center">
          <p className="text-2xl font-bold text-foreground">{rawData.length}</p>
          <p className="text-sm text-muted-foreground">Total de itens</p>
        </div>
        <div className="p-4 bg-muted/50 rounded-lg text-center">
          <p className="text-2xl font-bold text-foreground">{analyzeColumns.length}</p>
          <p className="text-sm text-muted-foreground">Colunas IA</p>
        </div>
        <div className="p-4 bg-success/10 rounded-lg text-center">
          <p className="text-2xl font-bold text-success">{successCount}</p>
          <p className="text-sm text-muted-foreground">Sucesso</p>
        </div>
        <div className="p-4 bg-warning/10 rounded-lg text-center">
          <p className="text-2xl font-bold text-warning">{reviewCount}</p>
          <p className="text-sm text-muted-foreground">Revisão</p>
        </div>
      </div>

      {/* Batch Size Control */}
      {!isProcessing && processedProducts.length === 0 && (
        <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <Label className="text-sm font-medium whitespace-nowrap">Lote paralelo:</Label>
          </div>
          <Slider
            value={[batchSize]}
            onValueChange={([v]) => setBatchSize(v)}
            min={1}
            max={10}
            step={1}
            className="flex-1 max-w-[200px]"
          />
          <span className="text-sm font-mono text-muted-foreground w-16">{batchSize} item{batchSize > 1 ? 's' : ''}</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {cacheRef.current.size > 0 && `• ${cacheRef.current.size} em cache`}
          </span>
        </div>
      )}
      {/* Progress */}
      {(isProcessing || processedProducts.length > 0) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Processando item {currentItem} de {rawData.length}
            </span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-3" />
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-3">
        {!isProcessing ? (
          <>
            <Button onClick={startProcessing} size="lg" className="flex-1">
              <Sparkles className="h-4 w-4 mr-2" />
              {processedProducts.length > 0 ? 'Reprocessar' : 'Iniciar Enriquecimento'}
            </Button>
            {processedProducts.length > 0 && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  setImageSearchQuery('');
                  setImageSearchOpen(true);
                }}
              >
                <Camera className="h-4 w-4 mr-2" />
                Buscar Imagens
              </Button>
            )}
          </>
        ) : (
          <>
            {isPaused ? (
              <Button onClick={resumeProcessing} variant="outline" className="flex-1">
                <Play className="h-4 w-4 mr-2" />
                Continuar
              </Button>
            ) : (
              <Button onClick={pauseProcessing} variant="outline" className="flex-1">
                <Pause className="h-4 w-4 mr-2" />
                Pausar
              </Button>
            )}
            <Button onClick={cancelProcessing} variant="destructive">
              Cancelar
            </Button>
          </>
        )}
      </div>

      {/* Logs */}
      {logs.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-foreground">Log de Processamento</h3>
          <ScrollArea className="h-[200px] border rounded-lg p-3 bg-muted/30">
            <div className="space-y-1 font-mono text-xs">
              {logs.map((log, idx) => (
                <div key={idx} className={`flex items-start gap-2 ${logColors[log.type]}`}>
                  {log.type === 'success' && <Check className="h-3 w-3 mt-0.5 flex-shrink-0" />}
                  {log.type === 'warning' && <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />}
                  {log.type === 'error' && <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />}
                  {log.type === 'info' && <Sparkles className="h-3 w-3 mt-0.5 flex-shrink-0" />}
                  <span>{log.message}</span>
                </div>
              ))}
              {isProcessing && !isPaused && (
                <div className="flex items-center gap-2 text-primary">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Processando...</span>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Processed items preview with review highlights */}
      {processedProducts.length > 0 && !isProcessing && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Itens Processados</h3>
            <div className="flex gap-2">
              <Badge variant="secondary">{successCount} ok</Badge>
              {reviewCount > 0 && (
                <Badge variant="destructive">{reviewCount} revisão</Badge>
              )}
            </div>
          </div>
          <ScrollArea className="h-[200px] border rounded-lg">
            <div className="p-3 space-y-2">
              {processedProducts.slice(0, 20).map((product, idx) => (
                <div 
                  key={idx}
                  className={`p-3 rounded-lg border ${
                    product.necessita_revisao 
                      ? 'border-warning/50 bg-warning/5' 
                      : 'border-success/50 bg-success/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {product.enriched.nome_padronizado || product.original['nome'] || product.original['Nome'] || `Item ${idx + 1}`}
                      </p>
                      {product.enriched.categoria_inferida && (
                        <p className="text-xs text-muted-foreground truncate">
                          {product.enriched.categoria_inferida}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {(() => {
                        const imgUrls = String(product.original['URL Imagens Externas'] || '').trim();
                        const imgCount = imgUrls ? imgUrls.split('|').filter(Boolean).length : 0;
                        return (
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-7 gap-1 px-1.5 ${imgCount > 0 ? 'text-primary' : 'text-muted-foreground'}`}
                            title={imgCount > 0 ? `${imgCount} imagem(ns) vinculada(s)` : 'Buscar imagem para este produto'}
                            onClick={() => openImageSearchForProduct(product, idx)}
                          >
                            {imgCount > 0 ? (
                              <>
                                <ImageIcon className="h-3.5 w-3.5" />
                                <span className="text-xs font-semibold">{imgCount}</span>
                              </>
                            ) : (
                              <Camera className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        );
                      })()}
                      {product.necessita_revisao ? (
                        <Badge variant="outline" className="border-warning text-warning">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Revisar
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-success text-success">
                          <Check className="h-3 w-3 mr-1" />
                          OK
                        </Badge>
                      )}
                    </div>
                  </div>
                  {product.razao_revisao && (
                    <p className="text-xs text-warning mt-1">{product.razao_revisao}</p>
                  )}
                </div>
              ))}
              {processedProducts.length > 20 && (
                <p className="text-xs text-center text-muted-foreground py-2">
                  +{processedProducts.length - 20} itens não mostrados
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
};

export default UltraDataProcessing;
