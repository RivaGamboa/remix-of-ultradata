import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface NcmResult {
  codigo: string;
  descricao: string;
  tipo: string;
  relevancia: number;
}

interface NcmCorrectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  productSku: string;
  currentNcm: string;
  onApply: (ncm: string, descricao: string) => void;
}

export function NcmCorrectionModal({
  open,
  onOpenChange,
  productName,
  productSku,
  currentNcm,
  onApply,
}: NcmCorrectionModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<NcmResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNcm, setSelectedNcm] = useState<NcmResult | null>(null);
  const [autoSuggestions, setAutoSuggestions] = useState<NcmResult[]>([]);
  const [autoLoading, setAutoLoading] = useState(false);

  // Auto-suggest based on product name when modal opens
  useEffect(() => {
    if (!open || !productName) return;
    setSelectedNcm(null);
    setSearchTerm('');
    setResults([]);

    const fetchSuggestions = async () => {
      setAutoLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('buscar-ncm', {
          body: { termo: productName, limite: 5 },
        });
        if (!error && data?.resultados) {
          setAutoSuggestions(data.resultados);
        }
      } catch {
        // ignore
      } finally {
        setAutoLoading(false);
      }
    };

    fetchSuggestions();
  }, [open, productName]);

  const handleSearch = useCallback(async () => {
    if (!searchTerm.trim() || searchTerm.trim().length < 2) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('buscar-ncm', {
        body: { termo: searchTerm.trim(), limite: 15 },
      });
      if (!error && data?.resultados) {
        setResults(data.resultados);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  const handleApply = () => {
    if (selectedNcm) {
      onApply(selectedNcm.codigo, selectedNcm.descricao);
      onOpenChange(false);
    }
  };

  const NcmItem = ({ item, isSelected }: { item: NcmResult; isSelected: boolean }) => (
    <button
      onClick={() => setSelectedNcm(item)}
      className={cn(
        "w-full text-left p-3 rounded-lg border transition-all hover:shadow-sm",
        isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border hover:border-primary/40"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono font-semibold text-sm">{item.codigo}</span>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {item.tipo}
          </Badge>
          {isSelected && <Check className="h-4 w-4 text-primary" />}
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.descricao}</p>
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Corrigir NCM</DialogTitle>
          <DialogDescription className="space-y-1">
            <span className="block font-medium text-foreground">{productName}</span>
            <span className="block text-xs">SKU: {productSku} | NCM atual: {currentNcm || 'Vazio'}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <form
          onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
          className="flex gap-2"
        >
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar NCM por descrição ou código..."
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={loading || searchTerm.trim().length < 2}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </form>

        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-4 pr-2">
            {/* Auto suggestions */}
            {autoSuggestions.length > 0 && results.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  💡 Sugestões automáticas (baseadas na descrição do produto)
                </p>
                {autoSuggestions.map((item) => (
                  <NcmItem
                    key={item.codigo}
                    item={item}
                    isSelected={selectedNcm?.codigo === item.codigo}
                  />
                ))}
              </div>
            )}

            {autoLoading && results.length === 0 && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Buscando sugestões...</span>
              </div>
            )}

            {/* Search results */}
            {results.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  🔍 Resultados da busca ({results.length})
                </p>
                {results.map((item) => (
                  <NcmItem
                    key={item.codigo}
                    item={item}
                    isSelected={selectedNcm?.codigo === item.codigo}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t">
          {selectedNcm ? (
            <p className="text-sm">
              Selecionado: <span className="font-mono font-bold">{selectedNcm.codigo}</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Selecione um NCM acima</p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button size="sm" disabled={!selectedNcm} onClick={handleApply}>
              Aplicar NCM
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
