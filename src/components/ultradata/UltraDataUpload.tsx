import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, AlertCircle, Check } from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ProductRow } from '@/pages/UltraData';

interface UltraDataUploadProps {
  onDataLoaded: (data: ProductRow[], columns: string[], filename?: string) => void;
}

const UltraDataUpload = ({ onDataLoaded }: UltraDataUploadProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<ProductRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const processFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      const jsonData = XLSX.utils.sheet_to_json<ProductRow>(worksheet, { 
        defval: '',
        raw: false 
      });

      if (jsonData.length === 0) {
        throw new Error('A planilha está vazia');
      }

      const cols = Object.keys(jsonData[0]);
      if (cols.length === 0) {
        throw new Error('Nenhuma coluna encontrada');
      }

      setFile(file);
      setColumns(cols);
      setPreviewData(jsonData.slice(0, 10));
      
      // Store full data for later
      (window as any).__ultradata_full_data = jsonData;

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar arquivo');
      setFile(null);
      setPreviewData([]);
      setColumns([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      processFile(acceptedFiles[0]);
    }
  }, [processFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
  });

  const handleConfirm = () => {
    const fullData = (window as any).__ultradata_full_data || previewData;
    onDataLoaded(fullData, columns, file?.name);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Upload de Planilha</h2>
        <p className="text-muted-foreground">
          Faça upload da sua planilha de produtos para iniciar o enriquecimento com IA.
        </p>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200",
          isDragActive 
            ? "border-primary bg-primary/5" 
            : file 
              ? "border-success bg-success/5" 
              : "border-border hover:border-primary/50 hover:bg-muted/50"
        )}
      >
        <input {...getInputProps()} />
        
        {isLoading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
            <p className="text-muted-foreground">Processando arquivo...</p>
          </div>
        ) : file ? (
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-success/10 rounded-full">
              <Check className="h-12 w-12 text-success" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {columns.length} colunas • {((window as any).__ultradata_full_data?.length || previewData.length).toLocaleString()} linhas
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Clique ou arraste para substituir
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-muted rounded-full">
              {isDragActive ? (
                <FileSpreadsheet className="h-12 w-12 text-primary" />
              ) : (
                <Upload className="h-12 w-12 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {isDragActive ? 'Solte o arquivo aqui' : 'Arraste sua planilha'}
              </p>
              <p className="text-sm text-muted-foreground">
                ou clique para selecionar
              </p>
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary">.xlsx</Badge>
              <Badge variant="secondary">.xls</Badge>
              <Badge variant="secondary">.csv</Badge>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Preview */}
      {previewData.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">
              Prévia dos dados (primeiras 10 linhas)
            </h3>
            <Badge variant="outline">{columns.length} colunas detectadas</Badge>
          </div>
          
          <div className="border rounded-lg overflow-auto max-h-[400px]">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  {columns.slice(0, 8).map((col) => (
                    <TableHead key={col} className="whitespace-nowrap">
                      {col}
                    </TableHead>
                  ))}
                  {columns.length > 8 && (
                    <TableHead className="text-muted-foreground">
                      +{columns.length - 8} mais
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData.map((row, idx) => (
                  <TableRow key={idx}>
                    {columns.slice(0, 8).map((col) => (
                      <TableCell key={col} className="max-w-[200px] truncate">
                        {row[col]?.toString() || '-'}
                      </TableCell>
                    ))}
                    {columns.length > 8 && (
                      <TableCell className="text-muted-foreground">...</TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleConfirm} size="lg">
              Continuar para Configuração
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UltraDataUpload;
