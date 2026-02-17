import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Database, LogOut, Cable, Loader2, AlertTriangle, Zap, Download, Settings, HelpCircle, MoreVertical, Tags as TagsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { SearchBar } from '@/components/dashboard/SearchBar';
import { TagFilter } from '@/components/dashboard/TagFilter';
import { ProductTable, type ProductRow } from '@/components/dashboard/ProductTable';
import { ColumnConfigModal } from '@/components/dashboard/ColumnConfigModal';
import { NcmCorrectionModal } from '@/components/dashboard/NcmCorrectionModal';
import { CanonicalTagsModal } from '@/components/dashboard/CanonicalTagsModal';
import { supabase } from '@/integrations/supabase/client';

export default function BlingDashboard() {
  const { connectionId } = useParams<{ connectionId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();

  // Data state
  const [rawData, setRawData] = useState<ProductRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [filteredData, setFilteredData] = useState<ProductRow[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Table state
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [ncmSuggestions, setNcmSuggestions] = useState<Record<string, any>>({});

  // Batch state
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [ncmSynced, setNcmSynced] = useState(false);

  // Loading
  const [blingLoading, setBlingLoading] = useState(false);
  const [blingError, setBlingError] = useState<string | null>(null);

  // Modals
  const [ncmModalOpen, setNcmModalOpen] = useState(false);
  const [ncmModalProduct, setNcmModalProduct] = useState<{ name: string; sku: string; ncm: string; rowIndex: number } | null>(null);
  const [canonicalTagsModal, setCanonicalTagsModal] = useState<{ open: boolean; productId: string; productName: string } | null>(null);

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !user) navigate('/');
  }, [user, authLoading, navigate]);

  // Initialize visible columns
  useEffect(() => {
    const saved = localStorage.getItem('ultradata_visible_columns');
    if (saved && columns.length > 0) {
      const parsed = JSON.parse(saved);
      setVisibleColumns(parsed.filter((c: string) => columns.includes(c)));
    } else if (columns.length > 0) {
      setVisibleColumns(columns.slice(0, 8));
    }
  }, [columns]);

  useEffect(() => {
    if (visibleColumns.length > 0) {
      localStorage.setItem('ultradata_visible_columns', JSON.stringify(visibleColumns));
    }
  }, [visibleColumns]);

  // Load Bling products
  useEffect(() => {
    if (!connectionId || !user) return;

    const loadBlingProducts = async () => {
      setBlingLoading(true);
      setBlingError(null);

      try {
        let allProducts: any[] = [];
        let page = 1;
        let hasMore = true;

        while (hasMore && page <= 10) {
          const { data, error } = await supabase.functions.invoke('bling-proxy', {
            body: { connectionId, endpoint: '/produtos', params: { pagina: String(page), limite: '100' } },
          });
          if (error) throw new Error(error.message);
          const products = data?.data || [];
          if (products.length === 0) { hasMore = false; } else {
            allProducts = [...allProducts, ...products];
            page++;
            if (products.length < 100) hasMore = false;
          }
        }

        if (allProducts.length === 0) {
          setBlingError('Nenhum produto encontrado nesta conta Bling.');
          return;
        }

        const rows: ProductRow[] = allProducts.map((p: any) => ({
          ID: p.id,
          Nome: p.nome || '',
          SKU: p.codigo || '',
          'Preço': p.preco || 0,
          'Preço Custo': p.precoCusto || 0,
          NCM: p.codigoNCM || '',
          CEST: p.cest || '',
          Marca: p.marca || '',
          Categoria: p.categoria?.descricao || '',
          Tipo: p.tipo || '',
          Situação: p.situacao || '',
          Unidade: p.unidade || '',
          Estoque: p.estoque?.saldoVirtualTotal ?? '',
          'Peso Bruto': p.pesoBruto || '',
          'Peso Líquido': p.pesoLiquido || '',
          GTIN: p.gtin || '',
          Observações: p.observacoes || '',
        }));

        const cols = Object.keys(rows[0]);
        setColumns(cols);
        setRawData(rows);
        setFilteredData(rows);
        setSelectedRows(new Set());
        setTags([]);

        toast({ title: '✅ Produtos carregados', description: `${rows.length} produtos importados do Bling.` });
      } catch (err: any) {
        console.error('Bling load error:', err);
        setBlingError(err.message || 'Erro ao carregar produtos do Bling.');
      } finally {
        setBlingLoading(false);
      }
    };

    loadBlingProducts();
  }, [connectionId, user, toast]);

  // Filter by tags
  useEffect(() => {
    if (tags.length === 0) { setFilteredData(rawData); return; }

    const fieldTags = tags.filter(t => ['NCM', 'CEST', 'MARCA', 'CATEGORIA', 'SKU', 'PREÇO', 'ESTOQUE'].includes(t.toUpperCase()));
    const searchTerms = tags.filter(t => !fieldTags.includes(t));

    let result = rawData;
    if (searchTerms.length > 0) {
      result = result.filter(row => {
        const rowText = Object.values(row).join(' ').toLowerCase();
        return searchTerms.every(term => rowText.includes(term.toLowerCase()));
      });
    }
    if (fieldTags.includes('NCM')) {
      result = result.filter(row => {
        const ncmCol = columns.find(c => /ncm/i.test(c));
        if (!ncmCol) return true;
        const val = row[ncmCol];
        return !val || String(val).trim() === '' || String(val) === '99.99.9999' || String(val) === '99999999' || String(val) === '0';
      });
    }
    setFilteredData(result);
    setSelectedRows(new Set());
  }, [tags, rawData, columns]);

  // Search
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) { setFilteredData(rawData); return; }
    setIsSearching(true);
    setTimeout(() => setIsSearching(false), 300);
  }, [rawData]);

  const handleTagsExtracted = (newTags: string[]) => setTags(newTags);
  const handleRemoveTag = (tag: string) => setTags(prev => prev.filter(t => t !== tag));
  const handleClearTags = () => setTags([]);

  const handleToggleColumn = (col: string) => {
    setVisibleColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  };

  const handleToggleRow = (index: number) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };

  // Sync NCM
  const handleSyncNcm = async () => {
    setIsBatchProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-ncm');
      if (error) throw error;
      setNcmSynced(true);
      toast({ title: '✅ NCM sincronizado', description: data.message || 'Base NCM atualizada.' });
    } catch (error: any) {
      toast({ title: 'Erro ao sincronizar NCM', description: error.message, variant: 'destructive' });
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // Batch NCM
  const handleBatchNcm = async () => {
    if (selectedRows.size === 0) {
      toast({ title: 'Nenhum produto selecionado', variant: 'destructive' });
      return;
    }
    setIsBatchProcessing(true);
    try {
      const selected = Array.from(selectedRows).map(i => filteredData[i]);
      let corrected = 0;
      for (const product of selected) {
        const name = String(product['Nome'] || product['nome'] || '');
        if (!name) continue;
        const { data, error } = await supabase.functions.invoke('buscar-ncm', { body: { termo: name, limite: 1 } });
        if (!error && data?.resultados?.length > 0) {
          const ncmCol = columns.find(c => /ncm/i.test(c));
          if (ncmCol) {
            const idx = rawData.indexOf(product);
            if (idx >= 0) { rawData[idx][ncmCol] = data.resultados[0].codigo; corrected++; }
          }
        }
      }
      setRawData([...rawData]);
      setSelectedRows(new Set());
      toast({ title: '✅ NCM corrigido em lote', description: `${corrected} de ${selected.length} produtos atualizados.` });
    } catch (error: any) {
      toast({ title: 'Erro na correção', description: error.message, variant: 'destructive' });
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // Individual NCM
  const handleOpenNcmModal = (rowIndex: number) => {
    const row = filteredData[rowIndex];
    const ncmCol = columns.find(c => /ncm/i.test(c));
    setNcmModalProduct({
      name: String(row['Nome'] || ''),
      sku: String(row['SKU'] || rowIndex),
      ncm: ncmCol ? String(row[ncmCol] || '') : '',
      rowIndex,
    });
    setNcmModalOpen(true);
  };

  const handleApplyNcm = (ncm: string, descricao: string) => {
    if (!ncmModalProduct) return;
    const ncmCol = columns.find(c => /ncm/i.test(c));
    if (!ncmCol) return;
    const globalIdx = rawData.indexOf(filteredData[ncmModalProduct.rowIndex]);
    if (globalIdx >= 0) {
      rawData[globalIdx][ncmCol] = ncm;
      setRawData([...rawData]);
      toast({ title: '✅ NCM aplicado', description: `${ncm} — ${descricao}` });
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ColumnConfigModal
        open={showColumnConfig}
        onOpenChange={setShowColumnConfig}
        allColumns={columns}
        visibleColumns={visibleColumns}
        onToggleColumn={handleToggleColumn}
        onSelectAll={() => setVisibleColumns([...columns])}
        onDeselectAll={() => setVisibleColumns([])}
      />
      {ncmModalProduct && (
        <NcmCorrectionModal
          open={ncmModalOpen}
          onOpenChange={setNcmModalOpen}
          productName={ncmModalProduct.name}
          productSku={ncmModalProduct.sku}
          currentNcm={ncmModalProduct.ncm}
          onApply={handleApplyNcm}
        />
      )}
      {canonicalTagsModal && connectionId && (
        <CanonicalTagsModal
          open={canonicalTagsModal.open}
          onOpenChange={(open) => setCanonicalTagsModal(open ? canonicalTagsModal : null)}
          connectionId={connectionId}
          productId={canonicalTagsModal.productId}
          productName={canonicalTagsModal.productName}
        />
      )}

      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-primary/10 rounded-lg">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-lg font-bold text-foreground">ULTRADATA</h1>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/conexoes">
                <Button variant="ghost" size="sm" title="Conexões"><Cable className="h-4 w-4" /></Button>
              </Link>
              <Button variant="ghost" size="sm" title="Configurações"><Settings className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" title="Suporte"><HelpCircle className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => signOut()} title="Sair">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-4">
        {/* 1ª Linha – Search */}
        <SearchBar onSearch={handleSearch} onTagsExtracted={handleTagsExtracted} isLoading={isSearching} />

        {/* 2ª Linha – Tags dinâmicas */}
        <TagFilter tags={tags} onRemoveTag={handleRemoveTag} onClearAll={handleClearTags} />

        {/* Loading */}
        {blingLoading && (
          <div className="flex items-center justify-center py-12 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-muted-foreground">Carregando produtos do Bling...</span>
          </div>
        )}

        {blingError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{blingError}</AlertDescription>
          </Alert>
        )}

        {/* 3ª Linha – Batch actions */}
        {rawData.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="default" size="sm" disabled={selectedRows.size === 0 || isBatchProcessing} onClick={handleBatchNcm} className="gap-1.5">
              <Zap className="h-4 w-4" />
              Enriquecer NCM ({selectedRows.size})
            </Button>
            <Button variant="outline" size="sm" disabled={isBatchProcessing} className="gap-1.5">
              <Zap className="h-4 w-4" />
              Enriquecer CEST
            </Button>
            {!ncmSynced && (
              <Button variant="outline" size="sm" onClick={handleSyncNcm} disabled={isBatchProcessing} className="gap-1.5">
                <Download className="h-4 w-4" />
                Sincronizar base NCM
              </Button>
            )}
            <Badge variant="secondary" className="ml-auto">
              {filteredData.length} produto{filteredData.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        )}

        {/* 4ª Linha – Product table */}
        {!blingLoading && rawData.length === 0 && !blingError ? (
          <div className="border-2 border-dashed border-border rounded-2xl p-16 text-center">
            <Database className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">Nenhum produto encontrado</h2>
            <p className="text-sm text-muted-foreground">
              Verifique a conexão com o Bling ou tente novamente.
            </p>
            <Button className="mt-4" variant="outline" onClick={() => navigate('/conexoes')}>
              <Cable className="h-4 w-4 mr-2" />
              Voltar às conexões
            </Button>
          </div>
        ) : rawData.length > 0 ? (
          <ProductTable
            data={filteredData}
            columns={columns}
            visibleColumns={visibleColumns}
            onToggleColumn={handleToggleColumn}
            onShowColumnConfig={() => setShowColumnConfig(true)}
            selectedRows={selectedRows}
            onToggleRow={handleToggleRow}
            onSelectAll={() => setSelectedRows(new Set(filteredData.map((_, i) => i)))}
            onDeselectAll={() => setSelectedRows(new Set())}
            ncmSuggestions={ncmSuggestions}
            onCorrectNcm={handleOpenNcmModal}
          />
        ) : null}
      </main>
    </div>
  );
}
