import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { getAbbreviations } from '@/config';

export interface ColumnConfig {
  action: 'ignore' | 'analyze' | 'default_all' | 'default_empty';
  defaultValue: string;
  isProtected: boolean;
}

export interface DuplicateResult {
  tipo: string;
  valor: string;
  linhas: number[];
  similaridade: number;
}

export interface ProcessingStats {
  camposPreenchidos: number;
  abreviaturasCorrigidas: number;
  camposProtegidos: number;
  camposIgnorados: number;
}

export interface ProcessingResult {
  enrichedData: Record<string, unknown>[];
  stats: ProcessingStats;
}

// Parse Excel/CSV file
export const parseFile = (file: File): Promise<{ data: Record<string, unknown>[]; columns: string[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet) as Record<string, unknown>[];
        
        const columns = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];
        
        resolve({ data: jsonData, columns });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Error reading file'));
    reader.readAsArrayBuffer(file);
  });
};

// Detect duplicates
export const detectDuplicates = (
  data: Record<string, unknown>[],
  columnConfig: Record<string, ColumnConfig>
): DuplicateResult[] => {
  const duplicates: DuplicateResult[] = [];
  
  // Find SKU column
  const skuColumn = Object.keys(columnConfig).find(col =>
    col.toLowerCase().includes('sku') || col.toLowerCase().includes('código') || col.toLowerCase().includes('codigo')
  );
  
  if (skuColumn) {
    const skuMap = new Map<string, number>();
    data.forEach((row, index) => {
      const sku = String(row[skuColumn] || '').trim();
      if (sku) {
        if (skuMap.has(sku)) {
          const existingIndex = skuMap.get(sku)!;
          const existingDup = duplicates.find(d => d.tipo === 'SKU Duplicado' && d.valor === sku);
          if (existingDup) {
            if (!existingDup.linhas.includes(index)) {
              existingDup.linhas.push(index);
            }
          } else {
            duplicates.push({
              tipo: 'SKU Duplicado',
              valor: sku,
              linhas: [existingIndex, index],
              similaridade: 1.0
            });
          }
        } else {
          skuMap.set(sku, index);
        }
      }
    });
  }
  
  // Find description column for similarity check
  const descColumn = Object.keys(columnConfig).find(col =>
    col.toLowerCase().includes('descricao') ||
    col.toLowerCase().includes('descrição') ||
    col.toLowerCase().includes('nome')
  );
  
  if (descColumn) {
    // For large datasets, use a more efficient approach with fingerprinting
    const maxItemsForFullComparison = 500;
    const dataLength = data.length;
    
    if (dataLength <= maxItemsForFullComparison) {
      // Full pairwise comparison for smaller datasets
      for (let i = 0; i < dataLength; i++) {
        if (duplicates.some(d => d.linhas.includes(i) && d.tipo === 'Descrição Similar')) continue;
        
        const desc1 = String(data[i][descColumn] || '').toLowerCase().trim();
        if (!desc1 || desc1.length < 5) continue;
        
        for (let j = i + 1; j < dataLength; j++) {
          const desc2 = String(data[j][descColumn] || '').toLowerCase().trim();
          if (!desc2 || desc2.length < 5) continue;
          
          const similarity = calculateSimilarity(desc1, desc2);
          if (similarity > 0.85) {
            duplicates.push({
              tipo: 'Descrição Similar',
              valor: desc1.substring(0, 40) + (desc1.length > 40 ? '...' : ''),
              linhas: [i, j],
              similaridade: Math.round(similarity * 100) / 100
            });
            break;
          }
        }
      }
    } else {
      // Use fingerprinting for large datasets
      const fingerprints = new Map<string, number[]>();
      
      data.forEach((row, index) => {
        const desc = String(row[descColumn] || '').toLowerCase().trim();
        if (!desc || desc.length < 5) return;
        
        // Create a simple fingerprint from the first few significant words
        const words = desc.split(/\W+/).filter(w => w.length > 2).slice(0, 4);
        const fingerprint = words.sort().join('_');
        
        if (fingerprint) {
          if (!fingerprints.has(fingerprint)) {
            fingerprints.set(fingerprint, []);
          }
          fingerprints.get(fingerprint)!.push(index);
        }
      });
      
      // Check items with same fingerprint
      fingerprints.forEach((indices) => {
        if (indices.length > 1) {
          // Do pairwise comparison within the group
          for (let i = 0; i < indices.length; i++) {
            for (let j = i + 1; j < indices.length; j++) {
              const idx1 = indices[i];
              const idx2 = indices[j];
              
              // Skip if already marked
              if (duplicates.some(d => 
                d.tipo === 'Descrição Similar' && 
                d.linhas.includes(idx1) && 
                d.linhas.includes(idx2)
              )) continue;
              
              const desc1 = String(data[idx1][descColumn] || '').toLowerCase().trim();
              const desc2 = String(data[idx2][descColumn] || '').toLowerCase().trim();
              
              const similarity = calculateSimilarity(desc1, desc2);
              if (similarity > 0.85) {
                duplicates.push({
                  tipo: 'Descrição Similar',
                  valor: desc1.substring(0, 40) + (desc1.length > 40 ? '...' : ''),
                  linhas: [idx1, idx2],
                  similaridade: Math.round(similarity * 100) / 100
                });
              }
            }
          }
        }
      });
    }
  }
  
  return duplicates;
};

// Calculate string similarity (Jaccard)
const calculateSimilarity = (str1: string, str2: string): number => {
  const words1 = new Set(str1.split(/\W+/).filter(w => w.length > 2));
  const words2 = new Set(str2.split(/\W+/).filter(w => w.length > 2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
};

// Correct abbreviations in text
export const correctAbbreviations = (
  text: string,
  abbreviations: Record<string, string>
): string => {
  if (!text || typeof text !== 'string') return text;
  
  let corrected = text;
  Object.entries(abbreviations).forEach(([abbr, full]) => {
    const pattern = new RegExp(`\\b${abbr}\\b`, 'gi');
    corrected = corrected.replace(pattern, full);
  });
  
  return corrected;
};

// Main data processing function
export const processData = (
  data: Record<string, unknown>[],
  columnConfig: Record<string, ColumnConfig>,
  abbreviations: Record<string, string>
): ProcessingResult => {
  const enrichedData = data.map(row => ({ ...row }));
  const stats: ProcessingStats = {
    camposPreenchidos: 0,
    abreviaturasCorrigidas: 0,
    camposProtegidos: 0,
    camposIgnorados: 0
  };
  
  enrichedData.forEach((row, rowIndex) => {
    Object.entries(columnConfig).forEach(([column, config]) => {
      const originalValue = row[column];
      let newValue = originalValue;
      
      // Skip protected columns
      if (config.isProtected || config.action === 'ignore') {
        if (config.isProtected) stats.camposProtegidos++;
        if (config.action === 'ignore') stats.camposIgnorados++;
        return;
      }
      
      // Apply default value
      if (config.action === 'default_all' && config.defaultValue) {
        newValue = config.defaultValue;
        stats.camposPreenchidos++;
      } else if (config.action === 'default_empty') {
        if (!originalValue || String(originalValue).trim() === '') {
          newValue = config.defaultValue || '';
          if (newValue) stats.camposPreenchidos++;
        }
      } else if (config.action === 'analyze') {
        // Enrich empty fields
        if (!originalValue || String(originalValue).trim() === '') {
          newValue = enrichField(column, row, data);
          if (newValue !== originalValue) {
            stats.camposPreenchidos++;
          }
        }
      }
      
      // Apply abbreviation corrections
      if (typeof newValue === 'string' && Object.keys(abbreviations).length > 0) {
        const corrected = correctAbbreviations(newValue, abbreviations);
        if (corrected !== newValue) {
          newValue = corrected;
          stats.abreviaturasCorrigidas++;
        }
      }
      
      enrichedData[rowIndex][column] = newValue;
    });
  });
  
  // Ensure protected fields are never altered
  Object.entries(columnConfig).forEach(([column, config]) => {
    if (config.isProtected) {
      enrichedData.forEach((row, index) => {
        row[column] = data[index][column];
      });
    }
  });
  
  return { enrichedData, stats };
};

// Enrich specific field
const enrichField = (
  column: string,
  row: Record<string, unknown>,
  allData: Record<string, unknown>[]
): unknown => {
  const columnLower = column.toLowerCase();
  
  // For description/name columns
  if (columnLower.includes('descricao') || columnLower.includes('descrição') || columnLower.includes('nome')) {
    if (row.sku) return `Produto ${row.sku}`;
    if (row.codigo) return `Produto ${row.codigo}`;
    if (row.SKU) return `Produto ${row.SKU}`;
    if (row.Codigo) return `Produto ${row.Codigo}`;
  }
  
  // For category columns
  if (columnLower.includes('categoria') || columnLower.includes('category')) {
    return 'Geral';
  }
  
  // For brand columns
  if (columnLower.includes('marca') || columnLower.includes('brand')) {
    return 'Sem Marca';
  }
  
  return row[column];
};

// Export to Excel
export const exportToExcel = (
  data: Record<string, unknown>[],
  filename: string
): void => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
  saveAs(blob, `${filename}.xlsx`);
};

// Export duplicates report
export const exportDuplicatesReport = (
  duplicates: DuplicateResult[],
  originalData: Record<string, unknown>[]
): void => {
  const reportData = duplicates.flatMap(dup =>
    dup.linhas.map(line => ({
      ...originalData[line],
      'Tipo_Duplicidade': dup.tipo,
      'Valor_Duplicado': dup.valor,
      'Similaridade': `${Math.round(dup.similaridade * 100)}%`,
      'Linha_Original': line + 2 // +2 because Excel starts at 1 and has header
    }))
  );
  
  exportToExcel(reportData, `duplicidades_${new Date().toISOString().split('T')[0]}`);
};

// Get default abbreviations - loaded from JSON config
export const getDefaultAbbreviations = (): Record<string, string> => {
  return getAbbreviations();
};