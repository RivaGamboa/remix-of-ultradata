import { useState } from 'react';
import { Sparkles, Loader2, Check, AlertTriangle, X, Copy, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface EnrichmentOptions {
  nome: boolean;
  descricao: boolean;
  categoria: boolean;
  marca: boolean;
  origem: boolean;
  ncm: boolean;
}

interface EnrichmentResult {
  nome_padronizado?: string;
  descricao_enriquecida?: string;
  categoria_inferida?: string;
  marca_inferida?: string;
  origem_inferida?: string;
  ncm_sugerido?: {
    codigo: string;
    descricao: string;
    confianca: 'alta' | 'media' | 'baixa';
    observacao: string;
  };
  status_inferencia?: {
    necessita_revisao: boolean;
    razao: string;
  };
  tempo_processamento_ms?: number;
}

interface UltraDataEnrichmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  onEnrichmentComplete?: (result: EnrichmentResult) => void;
}

const DEFAULT_OPTIONS: EnrichmentOptions = {
  nome: true,
  descricao: true,
  categoria: true,
  marca: true,
  origem: true,
  ncm: true,
};

const UltraDataEnrichmentModal = ({
  isOpen,
  onClose,
  userId,
  onEnrichmentComplete,
}: UltraDataEnrichmentModalProps) => {
  const { toast } = useToast();
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [options, setOptions] = useState<EnrichmentOptions>(DEFAULT_OPTIONS);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EnrichmentResult | null>(null);

  const handleEnrich = async () => {
    if (!productName.trim()) {
      toast({
        title: 'Nome do produto obrigatório',
        description: 'Informe ao menos o nome do produto para enriquecer.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const produto: Record<string, string> = {};
      if (productName) produto['nome'] = productName;
      if (productDescription) produto['descricao'] = productDescription;
      if (productCategory) produto['categoria'] = productCategory;

      const { data, error } = await supabase.functions.invoke('enriquecer-produto', {
        body: {
          produto,
          user_id: userId,
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast({
          title: 'Erro no enriquecimento',
          description: data.mensagem || 'Erro desconhecido',
          variant: 'destructive',
        });
        return;
      }

      setResult(data);
      onEnrichmentComplete?.(data);

      toast({
        title: 'Enriquecimento concluído!',
        description: `Processado em ${data.tempo_processamento_ms}ms via DeepSeek`,
      });
    } catch (err) {
      console.error('Erro no enriquecimento:', err);
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Falha ao enriquecer produto',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado!', description: 'Texto copiado para a área de transferência.' });
  };

  const resetForm = () => {
    setProductName('');
    setProductDescription('');
    setProductCategory('');
    setResult(null);
  };

  const ncmBadgeColor = (confianca?: string) => {
    if (confianca === 'alta') return 'default';
    if (confianca === 'media') return 'secondary';
    return 'outline';
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Enriquecimento com DeepSeek AI
          </DialogTitle>
          <DialogDescription>
            Insira os dados do produto para receber sugestões de padronização, categoria, NCM e mais.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[60vh]">
          <div className="space-y-5 pr-4">
            {/* Input Fields */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="productName">Nome do Produto *</Label>
                <Input
                  id="productName"
                  placeholder="ex: Mouse Gamer RGB Logitech G502"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleEnrich()}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="productDesc">Descrição (opcional)</Label>
                <Input
                  id="productDesc"
                  placeholder="ex: Mouse com sensor HERO 25K, 11 botões programáveis"
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="productCat">Categoria atual (opcional)</Label>
                <Input
                  id="productCat"
                  placeholder="ex: Informática > Periféricos"
                  value={productCategory}
                  onChange={(e) => setProductCategory(e.target.value)}
                />
              </div>
            </div>

            {/* Options */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Campos para enriquecer</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(Object.keys(options) as (keyof EnrichmentOptions)[]).map(key => (
                  <div key={key} className="flex items-center gap-2 p-2 rounded-md border bg-muted/30">
                    <Switch
                      id={`opt-${key}`}
                      checked={options[key]}
                      onCheckedChange={(checked) => setOptions(prev => ({ ...prev, [key]: checked }))}
                    />
                    <Label htmlFor={`opt-${key}`} className="text-sm capitalize cursor-pointer">
                      {key === 'ncm' ? 'NCM' : key.charAt(0).toUpperCase() + key.slice(1)}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Button */}
            <Button
              onClick={handleEnrich}
              disabled={loading || !productName.trim()}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Enriquecendo com DeepSeek...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Enriquecer Produto
                </>
              )}
            </Button>

            {/* Results */}
            {result && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-foreground flex items-center gap-2">
                      <Check className="h-4 w-4 text-success" />
                      Resultado do Enriquecimento
                    </h4>
                    {result.tempo_processamento_ms && (
                      <Badge variant="outline" className="text-xs">
                        {result.tempo_processamento_ms}ms
                      </Badge>
                    )}
                  </div>

                  {/* Review warning */}
                  {result.status_inferencia?.necessita_revisao && (
                    <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-warning">Necessita revisão</p>
                        <p className="text-xs text-muted-foreground">{result.status_inferencia.razao}</p>
                      </div>
                    </div>
                  )}

                  {/* Result fields */}
                  <div className="space-y-3">
                    {result.nome_padronizado && options.nome && (
                      <ResultField
                        label="Nome Padronizado"
                        original={productName}
                        enriched={result.nome_padronizado}
                        onCopy={() => copyToClipboard(result.nome_padronizado!)}
                      />
                    )}
                    {result.descricao_enriquecida && options.descricao && (
                      <ResultField
                        label="Descrição Enriquecida"
                        original={productDescription || '—'}
                        enriched={result.descricao_enriquecida}
                        onCopy={() => copyToClipboard(result.descricao_enriquecida!)}
                      />
                    )}
                    {result.categoria_inferida && options.categoria && (
                      <ResultField
                        label="Categoria"
                        original={productCategory || '—'}
                        enriched={result.categoria_inferida}
                        onCopy={() => copyToClipboard(result.categoria_inferida!)}
                      />
                    )}
                    {result.marca_inferida && options.marca && (
                      <ResultField
                        label="Marca"
                        original="—"
                        enriched={result.marca_inferida}
                        onCopy={() => copyToClipboard(result.marca_inferida!)}
                      />
                    )}
                    {result.origem_inferida && options.origem && (
                      <ResultField
                        label="Origem"
                        original="—"
                        enriched={result.origem_inferida}
                        onCopy={() => copyToClipboard(result.origem_inferida!)}
                      />
                    )}

                    {/* NCM section */}
                    {result.ncm_sugerido?.codigo && options.ncm && (
                      <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground uppercase tracking-wider">NCM Sugerido</Label>
                          <Badge variant={ncmBadgeColor(result.ncm_sugerido.confianca)}>
                            {result.ncm_sugerido.confianca}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-lg font-mono font-bold text-foreground">
                            {result.ncm_sugerido.codigo}
                          </code>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(result.ncm_sugerido!.codigo)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">{result.ncm_sugerido.descricao}</p>
                        {result.ncm_sugerido.observacao && (
                          <p className="text-xs text-muted-foreground italic">{result.ncm_sugerido.observacao}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <Button variant="outline" onClick={resetForm} size="sm">
            Limpar
          </Button>
          <Button variant="ghost" onClick={onClose} size="sm">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Sub-component for showing original → enriched comparison
const ResultField = ({
  label,
  original,
  enriched,
  onCopy,
}: {
  label: string;
  original: string;
  enriched: string;
  onCopy: () => void;
}) => (
  <div className="p-3 rounded-lg border bg-muted/30 space-y-1.5">
    <div className="flex items-center justify-between">
      <Label className="text-xs text-muted-foreground uppercase tracking-wider">{label}</Label>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCopy}>
        <Copy className="h-3 w-3" />
      </Button>
    </div>
    <div className="flex items-start gap-2 text-sm">
      <span className="text-muted-foreground line-through truncate max-w-[40%]">{original}</span>
      <ArrowRight className="h-3 w-3 mt-1 flex-shrink-0 text-primary" />
      <span className="font-medium text-foreground flex-1">{enriched}</span>
    </div>
  </div>
);

export default UltraDataEnrichmentModal;
