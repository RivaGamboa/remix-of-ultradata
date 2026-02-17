import { useState, useMemo } from 'react';
import { Settings2, CheckSquare, Square, ChevronDown, ChevronUp, Edit3, MoreVertical, Tags, EyeOff } from 'lucide-react';
// Table components replaced with native elements to avoid double-scroll-container conflict
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface ProductRow {
  [key: string]: string | number | null | undefined;
}

interface ProductTableProps {
  data: ProductRow[];
  columns: string[];
  visibleColumns: string[];
  onToggleColumn: (col: string) => void;
  onShowColumnConfig: () => void;
  selectedRows: Set<number>;
  onToggleRow: (index: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  ncmSuggestions?: Record<string, { codigo: string; descricao: string; relevancia: number }[]>;
  onCorrectNcm?: (rowIndex: number) => void;
  onViewCanonicalTags?: (productId: string, productName: string) => void;
}

export function ProductTable({
  data,
  columns,
  visibleColumns,
  onToggleColumn,
  onShowColumnConfig,
  selectedRows,
  onToggleRow,
  onSelectAll,
  onDeselectAll,
  ncmSuggestions,
  onCorrectNcm,
  onViewCanonicalTags,
}: ProductTableProps) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const sortedData = useMemo(() => {
    if (!sortColumn) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortColumn] ?? '';
      const bVal = b[sortColumn] ?? '';
      const cmp = String(aVal).localeCompare(String(bVal), 'pt-BR', { numeric: true });
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [data, sortColumn, sortDirection]);

  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDirection(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  };

  const allSelected = data.length > 0 && selectedRows.size === data.length;

  const isNcmColumn = (col: string) => /ncm|cest/i.test(col);

  const isNcmEmpty = (value: any) => {
    if (!value) return true;
    const s = String(value).trim();
    return s === '' || s === '99.99.9999' || s === '99999999' || s === '0';
  };

  return (
    <div className="space-y-3">
      {/* Table toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={allSelected ? onDeselectAll : onSelectAll}>
            {allSelected ? <CheckSquare className="h-4 w-4 mr-1" /> : <Square className="h-4 w-4 mr-1" />}
            {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
          </Button>
          {selectedRows.size > 0 && (
            <Badge variant="secondary">{selectedRows.size} selecionados</Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onShowColumnConfig} className="gap-1.5">
          <Settings2 className="h-4 w-4" />
          Colunas
        </Button>
      </div>

      {/* Table — single scroll container, sem shadcn Table wrapper que adiciona overflow-auto interno */}
      <div className="rounded-lg border bg-card" style={{ overflow: 'auto', maxHeight: '600px' }}>
        <table style={{ minWidth: '1200px' }} className="w-full caption-bottom text-sm border-collapse">
          <thead className="sticky top-0 z-10" style={{ background: 'hsl(var(--muted) / 0.9)', backdropFilter: 'blur(4px)' }}>
            <tr className="border-b">
              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={() => allSelected ? onDeselectAll() : onSelectAll()}
                />
              </th>
              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-10">#</th>
              {visibleColumns.map((col) => (
                <th
                  key={col}
                  className="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer select-none hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort(col)}
                >
                  <div className="flex items-center gap-1">
                    <span className="truncate max-w-[150px]">{col}</span>
                    {sortColumn === col && (
                      sortDirection === 'asc'
                        ? <ChevronUp className="h-3 w-3 shrink-0" />
                        : <ChevronDown className="h-3 w-3 shrink-0" />
                    )}
                  </div>
                </th>
              ))}
              <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground w-10">Ações</th>
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + 3} className="p-4 text-center py-12 text-muted-foreground">
                  Nenhum produto encontrado
                </td>
              </tr>
            ) : (
              sortedData.map((row, idx) => (
                <tr
                  key={idx}
                  className={cn(
                    "border-b transition-colors hover:bg-muted/50",
                    selectedRows.has(idx) && "bg-primary/5"
                  )}
                >
                  <td className="p-4 align-middle">
                    <Checkbox
                      checked={selectedRows.has(idx)}
                      onCheckedChange={() => onToggleRow(idx)}
                    />
                  </td>
                  <td className="p-4 align-middle text-muted-foreground text-xs">{idx + 1}</td>
                  {visibleColumns.map((col) => {
                    const value = row[col];
                    const isNcm = isNcmColumn(col);
                    const empty = isNcm && isNcmEmpty(value);

                    if (isNcm) {
                      const sku = String(row['SKU'] || row['sku'] || row['Código'] || idx);
                      const suggestions = ncmSuggestions?.[sku];

                      return (
                        <td key={col} className="p-4 align-middle">
                          <div className="flex items-center gap-1.5">
                            <HoverCard openDelay={200}>
                              <HoverCardTrigger asChild>
                                <span className={cn(
                                  "cursor-help border-b border-dashed",
                                  empty
                                    ? "text-destructive border-destructive/40"
                                    : "text-foreground border-muted-foreground/30"
                                )}>
                                  {empty ? '⚠️ Vazio' : String(value)}
                                </span>
                              </HoverCardTrigger>
                              <HoverCardContent className="w-80" side="top">
                                <div className="space-y-2">
                                  <p className="text-sm font-medium">
                                    {empty ? '⚠️ NCM não definido' : `NCM: ${value}`}
                                  </p>
                                  {suggestions && suggestions.length > 0 ? (
                                    <>
                                      <p className="text-xs text-muted-foreground">Sugestões baseadas na descrição:</p>
                                      {suggestions.slice(0, 3).map((s, i) => (
                                        <div key={i} className="text-xs p-2 rounded bg-muted">
                                          <span className="font-mono font-medium">{s.codigo}</span>
                                          <span className="text-muted-foreground ml-2">{s.descricao}</span>
                                        </div>
                                      ))}
                                    </>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">
                                      {empty
                                        ? 'Baseado na descrição do produto e na base SISCOMEX.'
                                        : 'NCM atribuído conforme base SISCOMEX e descrição do produto.'}
                                    </p>
                                  )}
                                </div>
                              </HoverCardContent>
                            </HoverCard>
                            {onCorrectNcm && (
                              <button
                                onClick={() => onCorrectNcm(idx)}
                                className="p-0.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                title="Corrigir NCM"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    }

                    const isLongField = /nome|descri|observa/i.test(col);
                    return (
                      <td key={col} className="p-4 align-middle">
                        <span
                          className={cn(
                            "text-sm",
                            isLongField
                              ? "block max-w-[300px] break-words whitespace-normal"
                              : "truncate block max-w-[200px]"
                          )}
                        >
                          {value != null ? String(value) : '—'}
                        </span>
                      </td>
                    );
                  })}
                  {/* Actions menu */}
                  <td className="p-4 align-middle text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onCorrectNcm?.(idx)}>
                          <Edit3 className="h-4 w-4 mr-2" />
                          Editar NCM
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            const id = String(row['ID'] || row['id'] || idx);
                            const name = String(row['Nome'] || row['nome'] || '');
                            onViewCanonicalTags?.(id, name);
                          }}
                        >
                          <Tags className="h-4 w-4 mr-2" />
                          Ver tags canônicas
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-muted-foreground">
                          <EyeOff className="h-4 w-4 mr-2" />
                          Ignorar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground text-right">
        {data.length} produto{data.length !== 1 ? 's' : ''} encontrado{data.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
