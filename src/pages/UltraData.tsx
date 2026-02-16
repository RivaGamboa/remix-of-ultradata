import { useState, useCallback, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Database, User, LogOut, Cable, History, Zap, Download, AlertTriangle, Loader2, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/toaster';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { AuthModal } from '@/components/AuthModal';
import { SearchBar } from '@/components/dashboard/SearchBar';
import { TagFilter } from '@/components/dashboard/TagFilter';
import { ProductTable, type ProductRow } from '@/components/dashboard/ProductTable';
import { ColumnConfigModal } from '@/components/dashboard/ColumnConfigModal';
import { NcmCorrectionModal } from '@/components/dashboard/NcmCorrectionModal';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

const UltraData = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const connectionId = searchParams.get('connection');
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Data state
  const [rawData, setRawData] = useState<ProductRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [filteredData, setFilteredData] = useState<ProductRow[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Table state
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [ncmSuggestions, setNcmSuggestions] = useState<Record<string, any>>({});

  // Batch NCM state
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [ncmSynced, setNcmSynced] = useState(false);

  // Bling loading state
  const [blingLoading, setBlingLoading] = useState(false);
  const [blingError, setBlingError] = useState<string | null>(null);

  // NCM correction modal
  const [ncmModalOpen, setNcmModalOpen] = useState(false);
  const [ncmModalProduct, setNcmModalProduct] = useState<{ name: string; sku: string; ncm: string; rowIndex: number } | null>(null);

  // Initialize visible columns from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('ultradata_visible_columns');
    if (saved && columns.length > 0) {
      const parsed = JSON.parse(saved);
      setVisibleColumns(parsed.filter((c: string) => columns.includes(c)));
    } else if (columns.length > 0) {
      setVisibleColumns(columns.slice(0, 8));
    }
  }, [columns]);

  // Save visible columns
  useEffect(() => {
    if (visibleColumns.length > 0) {
      localStorage.setItem('ultradata_visible_columns', JSON.stringify(visibleColumns));
    }
  }, [visibleColumns]);

  // Load products from Bling when connectionId is present
  useEffect(() => {
    if (!connectionId || !user) return;

    const loadBlingProducts = async () => {
      setBlingLoading(true);
      setBlingError(null);

      try {
        // Fetch all products (paginated)
        let allProducts: any[] = [];
        let page = 1;
        let hasMore = true;

        while (hasMore && page <= 10) {
          const { data, error } = await supabase.functions.invoke('bling-proxy', {
            body: {
              connectionId,
              endpoint: '/produtos',
              params: { pagina: String(page), limite: '100' },
            },
          });

          if (error) throw new Error(error.message);
          
          const products = data?.data || [];
          if (products.length === 0) {
            hasMore = false;
          } else {
            allProducts = [...allProducts, ...products];
            page++;
            if (products.length < 100) hasMore = false;
          }
        }

        if (allProducts.length === 0) {
          setBlingError('Nenhum produto encontrado nesta conta Bling.');
          return;
        }

        // Map Bling product fields to table rows
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

        toast({
          title: '✅ Produtos carregados do Bling',
          description: `${rows.length} produtos importados.`,
        });
      } catch (err: any) {
        console.error('Bling load error:', err);
        setBlingError(err.message || 'Erro ao carregar produtos do Bling.');
      } finally {
        setBlingLoading(false);
      }
    };

    loadBlingProducts();
  }, [connectionId, user, toast]);

  // Filter data based on tags
  useEffect(() => {
    if (tags.length === 0) {
      setFilteredData(rawData);
      return;
    }

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

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<ProductRow>(worksheet, { defval: '' });

      if (jsonData.length === 0) {
        toast({ title: 'Arquivo vazio', description: 'A planilha não contém dados.', variant: 'destructive' });
        return;
      }

      const cols = Object.keys(jsonData[0]);
      setColumns(cols);
      setRawData(jsonData);
      setFilteredData(jsonData);
      setSelectedRows(new Set());
      setTags([]);

      toast({ title: '✅ Planilha carregada', description: `${jsonData.length} produtos e ${cols.length} colunas.` });
    } catch (error) {
      toast({ title: 'Erro ao ler arquivo', description: 'Verifique se o arquivo é uma planilha válida.', variant: 'destructive' });
    }
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  // Search handler
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredData(rawData);
      return;
    }
    setIsSearching(true);
    setTimeout(() => setIsSearching(false), 300);
  }, [rawData]);

  // Tag management
  const handleTagsExtracted = (newTags: string[]) => setTags(newTags);
  const handleRemoveTag = (tag: string) => setTags(prev => prev.filter(t => t !== tag));
  const handleClearTags = () => setTags([]);

  // Column config
  const handleToggleColumn = (col: string) => {
    setVisibleColumns(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  // Row selection
  const handleToggleRow = (index: number) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  // Sync NCM
  const handleSyncNcm = async () => {
    if (!user) { setShowAuthModal(true); return; }
    setIsBatchProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-ncm');
      if (error) throw error;
      setNcmSynced(true);
      toast({ title: '✅ NCM sincronizado', description: data.message || 'Base NCM atualizada com sucesso.' });
    } catch (error: any) {
      toast({ title: 'Erro ao sincronizar NCM', description: error.message, variant: 'destructive' });
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // Batch NCM correction
  const handleBatchNcm = async () => {
    if (!user) { setShowAuthModal(true); return; }
    if (selectedRows.size === 0) {
      toast({ title: 'Nenhum produto selecionado', description: 'Selecione os produtos para corrigir.', variant: 'destructive' });
      return;
    }

    setIsBatchProcessing(true);
    try {
      const selected = Array.from(selectedRows).map(i => filteredData[i]);
      let corrected = 0;

      for (const product of selected) {
        const name = String(product['Nome'] || product['nome'] || product['Descrição'] || product['descricao'] || '');
        if (!name) continue;

        const { data, error } = await supabase.functions.invoke('buscar-ncm', {
          body: { termo: name, limite: 1 },
        });

        if (!error && data?.resultados?.length > 0) {
          const ncmCol = columns.find(c => /ncm/i.test(c));
          if (ncmCol) {
            const idx = rawData.indexOf(product);
            if (idx >= 0) {
              rawData[idx][ncmCol] = data.resultados[0].codigo;
              corrected++;
            }
          }
        }
      }

      setRawData([...rawData]);
      setSelectedRows(new Set());
      toast({ title: '✅ NCM corrigido em lote', description: `${corrected} de ${selected.length} produtos atualizados.` });
    } catch (error: any) {
      toast({ title: 'Erro na correção em lote', description: error.message, variant: 'destructive' });
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // Individual NCM correction
  const handleOpenNcmModal = (rowIndex: number) => {
    const row = filteredData[rowIndex];
    const ncmCol = columns.find(c => /ncm/i.test(c));
    setNcmModalProduct({
      name: String(row['Nome'] || row['nome'] || row['Descrição'] || ''),
      sku: String(row['SKU'] || row['sku'] || row['Código'] || rowIndex),
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

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
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
              {user ? (
                <>
                  <Link to="/conexoes">
                    <Button variant="ghost" size="sm"><Cable className="h-4 w-4" /></Button>
                  </Link>
                  <Link to="/history">
                    <Button variant="ghost" size="sm"><History className="h-4 w-4" /></Button>
                  </Link>
                  <Button variant="ghost" size="sm" onClick={() => signOut()}>
                    <LogOut className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button onClick={() => setShowAuthModal(true)} variant="outline" size="sm">
                  <User className="h-4 w-4 mr-1" /> Entrar
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-4">
        {/* Search Bar */}
        <SearchBar
          onSearch={handleSearch}
          onTagsExtracted={handleTagsExtracted}
          isLoading={isSearching}
        />

        {/* Tag filters */}
        <TagFilter tags={tags} onRemoveTag={handleRemoveTag} onClearAll={handleClearTags} />

        {/* Bling loading state */}
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

        {/* Actions bar */}
        {rawData.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="default"
              size="sm"
              disabled={selectedRows.size === 0 || isBatchProcessing}
              onClick={handleBatchNcm}
              className="gap-1.5"
            >
              <Zap className="h-4 w-4" />
              Corrigir NCM em lote ({selectedRows.size})
            </Button>
            {!ncmSynced && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncNcm}
                disabled={isBatchProcessing}
                className="gap-1.5"
              >
                <Download className="h-4 w-4" />
                Sincronizar base NCM
              </Button>
            )}
          </div>
        )}

        {/* Empty state / Drop zone */}
        {!blingLoading && rawData.length === 0 && !blingError ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-border rounded-2xl p-16 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.xlsx,.xls,.csv';
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) handleFileUpload(file);
              };
              input.click();
            }}
          >
            <Database className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Arraste uma planilha ou clique para enviar
            </h2>
            <p className="text-sm text-muted-foreground">
              Formatos aceitos: .xlsx, .xls, .csv — ou conecte sua conta Bling
            </p>
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
};

export default UltraData;
