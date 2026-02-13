import { useState, useCallback } from 'react';
import { Search, Image, Loader2, Download, Check, X, Camera, Palette, RotateCcw, Square } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ImageResult {
  id: string;
  url: string;
  prompt: string;
  selected: boolean;
}

interface UltraDataImageSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onImageSelect?: (imageUrl: string) => void;
  initialQuery?: string;
}

const STYLE_OPTIONS = [
  { value: 'catalog', label: 'Catálogo', description: 'Fundo branco profissional' },
  { value: 'lifestyle', label: 'Lifestyle', description: 'Cenário natural' },
  { value: 'minimal', label: 'Minimalista', description: 'Fundo puro, sombras suaves' },
] as const;

const ANGLE_OPTIONS = [
  { value: 'front', label: 'Frontal' },
  { value: 'angle', label: 'Angulado 45°' },
  { value: 'top', label: 'Vista superior' },
  { value: 'detail', label: 'Detalhe / Close-up' },
];

const BACKGROUND_OPTIONS = [
  { value: 'white', label: 'Fundo branco' },
  { value: 'gradient', label: 'Gradiente suave' },
  { value: 'context', label: 'Contexto de uso' },
  { value: 'transparent', label: 'Sem fundo' },
];

const RECENT_SEARCHES = [
  'Sofá moderno couro',
  'Cadeira escritório ergonômica',
  'Mesa jantar madeira',
  'Luminária pendente',
  'Estante industrial',
];

const UltraDataImageSearch = ({
  isOpen,
  onClose,
  onImageSelect,
  initialQuery = '',
}: UltraDataImageSearchProps) => {
  const { toast } = useToast();
  const [query, setQuery] = useState(initialQuery);
  const [style, setStyle] = useState<'catalog' | 'lifestyle' | 'minimal'>('catalog');
  const [angle, setAngle] = useState('front');
  const [background, setBackground] = useState('white');
  const [color, setColor] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ImageResult[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>(RECENT_SEARCHES);

  const buildAdvancedPrompt = useCallback(() => {
    const parts = [query.trim()];
    if (color) parts.push(`cor predominante: ${color}`);
    if (angle !== 'front') {
      const angleLabel = ANGLE_OPTIONS.find(a => a.value === angle)?.label || angle;
      parts.push(`ângulo: ${angleLabel}`);
    }
    if (background !== 'white') {
      const bgLabel = BACKGROUND_OPTIONS.find(b => b.value === background)?.label || background;
      parts.push(`fundo: ${bgLabel}`);
    }
    return parts.join(', ');
  }, [query, color, angle, background]);

  const searchImages = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const advancedPrompt = buildAdvancedPrompt();

      // Call generate-image edge function
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
          productName: advancedPrompt,
          style,
        },
      });

      if (error) throw error;

      if (data?.imageUrl) {
        const newResult: ImageResult = {
          id: `img_${Date.now()}`,
          url: data.imageUrl,
          prompt: advancedPrompt,
          selected: false,
        };
        setResults(prev => [newResult, ...prev]);

        // Add to search history
        if (!searchHistory.includes(query.trim())) {
          setSearchHistory(prev => [query.trim(), ...prev.slice(0, 9)]);
        }

        toast({
          title: 'Imagem gerada!',
          description: `Resultado para "${query}"`,
        });
      } else {
        toast({
          title: 'Nenhuma imagem gerada',
          description: data?.error || 'Tente novamente com uma descrição diferente.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Erro na busca de imagens:', err);
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({
        title: 'Erro na busca',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (result: ImageResult) => {
    onImageSelect?.(result.url);
    toast({
      title: 'Imagem selecionada',
      description: 'A imagem foi adicionada ao produto.',
    });
  };

  const handleQuickSearch = (term: string) => {
    setQuery(term);
    // Trigger search after state update
    setTimeout(() => {
      searchImages();
    }, 0);
  };

  const clearResults = () => {
    setResults([]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Busca Avançada de Imagens
          </DialogTitle>
          <DialogDescription>
            Gere imagens de produtos usando IA com filtros avançados de estilo, ângulo e fundo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4">
          {/* Search Input */}
          <div className="flex gap-2">
            <Input
              placeholder="Descreva o produto... ex: Sofá moderno de couro marrom"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchImages()}
              className="flex-1"
            />
            <Button
              onClick={searchImages}
              disabled={loading || !query.trim()}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span className="ml-2 hidden sm:inline">Buscar</span>
            </Button>
          </div>

          {/* Filters Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Palette className="h-3 w-3" />
                Estilo
              </Label>
              <Select value={style} onValueChange={(v: 'catalog' | 'lifestyle' | 'minimal') => setStyle(v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STYLE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <RotateCcw className="h-3 w-3" />
                Ângulo
              </Label>
              <Select value={angle} onValueChange={setAngle}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANGLE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Square className="h-3 w-3" />
                Fundo
              </Label>
              <Select value={background} onValueChange={setBackground}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BACKGROUND_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Cor principal</Label>
              <Input
                placeholder="ex: marrom, azul"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          {/* Quick Search Tags */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground self-center">Buscas rápidas:</span>
            {searchHistory.slice(0, 6).map(term => (
              <Badge
                key={term}
                variant="secondary"
                className="cursor-pointer hover:bg-primary/20 transition-colors text-xs"
                onClick={() => handleQuickSearch(term)}
              >
                {term}
              </Badge>
            ))}
          </div>

          {/* Results */}
          <ScrollArea className="flex-1 max-h-[380px]">
            {results.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-foreground">
                    Resultados ({results.length})
                  </h4>
                  <Button variant="ghost" size="sm" onClick={clearResults}>
                    <X className="h-3 w-3 mr-1" />
                    Limpar
                  </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {results.map((result) => (
                    <div
                      key={result.id}
                      className="group relative border rounded-lg overflow-hidden bg-muted/30 hover:border-primary/50 transition-colors"
                    >
                      <div className="aspect-square">
                        <img
                          src={result.url}
                          alt={result.prompt}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleSelect(result)}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Usar
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          asChild
                        >
                          <a href={result.url} download target="_blank" rel="noopener noreferrer">
                            <Download className="h-3 w-3" />
                          </a>
                        </Button>
                      </div>
                      <div className="p-2">
                        <p className="text-xs text-muted-foreground truncate">{result.prompt}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Image className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {loading ? 'Gerando imagem...' : 'Descreva o produto e clique em buscar para gerar imagens com IA'}
                </p>
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UltraDataImageSearch;
