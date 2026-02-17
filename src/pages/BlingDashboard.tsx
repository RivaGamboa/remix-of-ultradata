import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Database, LogOut, Cable, Loader2, AlertTriangle, Zap, Download, Settings, HelpCircle, Tags as TagsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { SearchBar } from '@/components/dashboard/SearchBar';
import { TagFilter } from '@/components/dashboard/TagFilter';
import { ProductTable, type ProductRow } from '@/components/dashboard/ProductTable';
import { ColumnConfigModal } from '@/components/dashboard/ColumnConfigModal';
import { NcmCorrectionModal } from '@/components/dashboard/NcmCorrectionModal';
import { CanonicalTagsModal } from '@/components/dashboard/CanonicalTagsModal';
import { supabase } from '@/integrations/supabase/client';

const PAGE_SIZE = 50;

export default function BlingDashboard() {
  const { connectionId } = useParams<{ connectionId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();

  // Data state
  const [pageData, setPageData] = useState<ProductRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [pageLoading, setPageLoading] = useState(false);

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

  // Fetch a page of products from Bling
  const fetchPage = useCallback(async (page: number) => {
    if (!connectionId || !user) return;
    setPageLoading(true);
    setBlingError(null);

    try {
      const { data, error } = await supabase.functions.invoke('bling-proxy', {
        body: {
          connectionId,
          endpoint: '/produtos',
          params: { pagina: String(page), limite: String(PAGE_SIZE) },
        },
      });
      if (error) throw new Error(error.message);

      const products = data?.data || [];

      // Try to get total from Bling response headers or estimate
      // Bling v3 doesn't always return total; we estimate from response
      if (data?.total != null) {
        setTotalProducts(data.total);
      } else if (products.length < PAGE_SIZE && page === 1) {
        setTotalProducts(products.length);
      } else if (products.length < PAGE_SIZE) {
        setTotalProducts((page - 1) * PAGE_SIZE + products.length);
      }
      // If full page, we don't know total yet — keep previous or set a high estimate
      if (products.length === PAGE_SIZE && totalProducts < page * PAGE_SIZE) {
        setTotalProducts(page * PAGE_SIZE + 1); // at least one more page
      }

      const rows: ProductRow[] = products.map((p: any) => ({
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

      if (rows.length > 0 && columns.length === 0) {
        setColumns(Object.keys(rows[0]));
      }

      setPageData(rows);
      setSelectedRows(new Set());

      if (page === 1 && rows.length === 0) {
        setBlingError('Nenhum produto encontrado nesta conta Bling.');
      }
    } catch (err: any) {
      console.error('Bling load error:', err);
      setBlingError(err.message || 'Erro ao carregar produtos do Bling.');
    } finally {
      setPageLoading(false);
      setBlingLoading(false);
    }
  }, [connectionId, user, columns.length, totalProducts]);

  // Initial load
  useEffect(() => {
    if (!connectionId || !user) return;
    setBlingLoading(true);
    setCurrentPage(1);
    setTags([]);
    fetchPage(1);
  }, [connectionId, user]);

  // Page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchPage(page);
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Filter by tags — client-side filtering on current page data
  const filteredData = (() => {
    if (tags.length === 0) return pageData;

    const fieldTags = tags.filter(t => ['NCM', 'CEST', 'MARCA', 'CATEGORIA', 'SKU', 'PREÇO', 'ESTOQUE'].includes(t.toUpperCase()));
    const searchTerms = tags.filter(t => !fieldTags.includes(t));

    let result = pageData;
    if (searchTerms.length > 0) {
      result = result.filter(row => {
        const rowText = Object.values(row).join(' ').toLowerCase();
        return searchTerms.every(term => rowText.includes(term.toLowerCase()));
      });
    }
    if (fieldTags.includes('NCM')) {
      result = result.filter(row => {
        const val = row['NCM'];
        return !val || String(val).trim() === '' || String(val) === '99.99.9999' || String(val) === '99999999' || String(val) === '0';
      });
    }
    return result;
  })();

  // Search
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      // Reset to page 1 unfiltered
      setCurrentPage(1);
      fetchPage(1);
      return;
    }
    setIsSearching(true);
    setTimeout(() => setIsSearching(false), 300);
  }, [fetchPage]);

  const handleTagsExtracted = (newTags: string[]) => setTags(newTags);
  const handleRemoveTag = (tag: string) => setTags(prev => prev.filter(t => t !== tag));
  const handleClearTags = () => {
    setTags([]);
    setCurrentPage(1);
    fetchPage(1);
  };

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
        const name = String(product['Nome'] || '');
        if (!name) continue;
        const { data, error } = await supabase.functions.invoke('buscar-ncm', { body: { termo: name, limite: 1 } });
        if (!error && data?.resultados?.length > 0) {
          const idx = pageData.indexOf(product);
          if (idx >= 0) {
            pageData[idx]['NCM'] = data.resultados[0].codigo;
            corrected++;
          }
        }
      }
      setPageData([...pageData]);
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
    setNcmModalProduct({
      name: String(row['Nome'] || ''),
      sku: String(row['SKU'] || rowIndex),
      ncm: String(row['NCM'] || ''),
      rowIndex,
    });
    setNcmModalOpen(true);
  };

  const handleApplyNcm = (ncm: string, descricao: string) => {
    if (!ncmModalProduct) return;
    const globalIdx = pageData.indexOf(filteredData[ncmModalProduct.rowIndex]);
    if (globalIdx >= 0) {
      pageData[globalIdx]['NCM'] = ncm;
      setPageData([...pageData]);
      toast({ title: '✅ NCM aplicado', description: `${ncm} — ${descricao}` });
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalProducts / PAGE_SIZE));

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
        {/* Search */}
        <SearchBar onSearch={handleSearch} onTagsExtracted={handleTagsExtracted} isLoading={isSearching} />

        {/* Tags */}
        <TagFilter tags={tags} onRemoveTag={handleRemoveTag} onClearAll={handleClearTags} />

        {/* Loading initial */}
        {blingLoading && !pageLoading && (
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

        {/* Batch actions */}
        {pageData.length > 0 && (
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
              Página {currentPage} de {totalPages} • {filteredData.length} produto{filteredData.length !== 1 ? 's' : ''} na página
            </Badge>
          </div>
        )}

        {/* Skeleton loader while page loads */}
        {pageLoading && (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        )}

        {/* Product table */}
        {!blingLoading && !pageLoading && pageData.length === 0 && !blingError ? (
          <div className="border-2 border-dashed border-border rounded-2xl p-16 text-center">
            <Database className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">Nenhum produto encontrado</h2>
            <p className="text-sm text-muted-foreground">Verifique a conexão com o Bling ou tente novamente.</p>
            <Button className="mt-4" variant="outline" onClick={() => navigate('/conexoes')}>
              <Cable className="h-4 w-4 mr-2" />
              Voltar às conexões
            </Button>
          </div>
        ) : !pageLoading && pageData.length > 0 ? (
          <>
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
              onViewCanonicalTags={(productId, productName) =>
                setCanonicalTagsModal({ open: true, productId, productName })
              }
            />

            {/* Pagination controls */}
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1 || pageLoading}
                onClick={() => handlePageChange(currentPage - 1)}
              >
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground px-3">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages || pageLoading}
                onClick={() => handlePageChange(currentPage + 1)}
              >
                Próxima
              </Button>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
