// =====================================================
// ULTRACLEAN - Data Processing Core Logic
// =====================================================

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import type { 
  ColumnConfig, 
  DuplicateResult, 
  ProcessingResult, 
  ProcessingStats,
  ProductData 
} from './types';
import { DEFAULT_ABBREVIATIONS } from './types';

/**
 * Parse Excel/CSV file and extract data
 */
export const parseFile = (file: File): Promise<{ data: ProductData[]; columns: string[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet) as ProductData[];
        
        const columns = jsonData.length > 0 ? Object.keys(jsonData[0]).filter(k => !k.startsWith('__')) : [];
        
        resolve({ data: jsonData, columns });
      } catch (error) {
        reject(new Error('Erro ao ler o arquivo. Verifique se é um Excel/CSV válido.'));
      }
    };
    
    reader.onerror = () => reject(new Error('Erro na leitura do arquivo'));
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Detect duplicate entries in the dataset
 */
export const detectDuplicates = (
  data: ProductData[],
  columnConfig: Record<string, ColumnConfig>
): DuplicateResult[] => {
  const duplicates: DuplicateResult[] = [];
  
  // Find SKU column
  const skuColumn = Object.keys(columnConfig).find(col =>
    col.toLowerCase().includes('sku') || 
    col.toLowerCase().includes('código') || 
    col.toLowerCase().includes('codigo')
  );
  
  if (skuColumn) {
    const skuMap = new Map<string, { index: number; sourceFile?: string }[]>();
    
    data.forEach((row, index) => {
      const sku = String(row[skuColumn] || '').trim();
      if (sku) {
        const entry = { index, sourceFile: row.__source_file as string | undefined };
        if (!skuMap.has(sku)) {
          skuMap.set(sku, []);
        }
        skuMap.get(sku)!.push(entry);
      }
    });
    
    skuMap.forEach((entries, sku) => {
      if (entries.length > 1) {
        const sourceFiles = [...new Set(entries.map(e => e.sourceFile).filter(Boolean))] as string[];
        const isCrossFile = sourceFiles.length > 1;
        
        duplicates.push({
          tipo: 'SKU Duplicado',
          valor: sku,
          linhas: entries.map(e => e.index),
          similaridade: 1.0,
          isCrossFile,
          sourceFiles
        });
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
    const maxItemsForFullComparison = 500;
    const dataLength = data.length;
    
    if (dataLength <= maxItemsForFullComparison) {
      for (let i = 0; i < dataLength; i++) {
        if (duplicates.some(d => d.linhas.includes(i) && d.tipo === 'Descrição Similar')) continue;
        
        const desc1 = String(data[i][descColumn] || '').toLowerCase().trim();
        if (!desc1 || desc1.length < 5) continue;
        
        for (let j = i + 1; j < dataLength; j++) {
          const desc2 = String(data[j][descColumn] || '').toLowerCase().trim();
          if (!desc2 || desc2.length < 5) continue;
          
          const similarity = calculateSimilarity(desc1, desc2);
          if (similarity > 0.85) {
            const sourceFiles = [
              data[i].__source_file as string,
              data[j].__source_file as string
            ].filter(Boolean);
            const uniqueFiles = [...new Set(sourceFiles)];
            
            duplicates.push({
              tipo: 'Descrição Similar',
              valor: desc1.substring(0, 40) + (desc1.length > 40 ? '...' : ''),
              linhas: [i, j],
              similaridade: Math.round(similarity * 100) / 100,
              isCrossFile: uniqueFiles.length > 1,
              sourceFiles: uniqueFiles
            });
            break;
          }
        }
      }
    } else {
      // Use fingerprinting for large datasets
      const fingerprints = new Map<string, { index: number; sourceFile?: string }[]>();
      
      data.forEach((row, index) => {
        const desc = String(row[descColumn] || '').toLowerCase().trim();
        if (!desc || desc.length < 5) return;
        
        const words = desc.split(/\W+/).filter(w => w.length > 2).slice(0, 4);
        const fingerprint = words.sort().join('_');
        
        if (fingerprint) {
          if (!fingerprints.has(fingerprint)) {
            fingerprints.set(fingerprint, []);
          }
          fingerprints.get(fingerprint)!.push({ 
            index, 
            sourceFile: row.__source_file as string | undefined 
          });
        }
      });
      
      fingerprints.forEach((entries) => {
        if (entries.length > 1) {
          for (let i = 0; i < entries.length; i++) {
            for (let j = i + 1; j < entries.length; j++) {
              const idx1 = entries[i].index;
              const idx2 = entries[j].index;
              
              if (duplicates.some(d => 
                d.tipo === 'Descrição Similar' && 
                d.linhas.includes(idx1) && 
                d.linhas.includes(idx2)
              )) continue;
              
              const desc1 = String(data[idx1][descColumn] || '').toLowerCase().trim();
              const desc2 = String(data[idx2][descColumn] || '').toLowerCase().trim();
              
              const similarity = calculateSimilarity(desc1, desc2);
              if (similarity > 0.85) {
                const sourceFiles = [
                  entries[i].sourceFile,
                  entries[j].sourceFile
                ].filter(Boolean) as string[];
                const uniqueFiles = [...new Set(sourceFiles)];
                
                duplicates.push({
                  tipo: 'Descrição Similar',
                  valor: desc1.substring(0, 40) + (desc1.length > 40 ? '...' : ''),
                  linhas: [idx1, idx2],
                  similaridade: Math.round(similarity * 100) / 100,
                  isCrossFile: uniqueFiles.length > 1,
                  sourceFiles: uniqueFiles
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

/**
 * Calculate string similarity using Jaccard index
 */
const calculateSimilarity = (str1: string, str2: string): number => {
  const words1 = new Set(str1.split(/\W+/).filter(w => w.length > 2));
  const words2 = new Set(str2.split(/\W+/).filter(w => w.length > 2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
};

/**
 * Correct abbreviations in text
 */
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

/**
 * Main data processing function
 */
export const processData = (
  data: ProductData[],
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
      
      if (config.isProtected || config.action === 'ignore') {
        if (config.isProtected) stats.camposProtegidos++;
        if (config.action === 'ignore') stats.camposIgnorados++;
        return;
      }
      
      if (config.action === 'default_all' && config.defaultValue) {
        newValue = config.defaultValue;
        stats.camposPreenchidos++;
      } else if (config.action === 'default_empty') {
        if (!originalValue || String(originalValue).trim() === '') {
          newValue = config.defaultValue || '';
          if (newValue) stats.camposPreenchidos++;
        }
      } else if (config.action === 'analyze') {
        if (!originalValue || String(originalValue).trim() === '') {
          newValue = enrichField(column, row, data);
          if (newValue !== originalValue) {
            stats.camposPreenchidos++;
          }
        }
      }
      
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

/**
 * Enrich specific field based on context
 */
const enrichField = (
  column: string,
  row: ProductData,
  allData: ProductData[]
): unknown => {
  const columnLower = column.toLowerCase();
  
  if (columnLower.includes('descricao') || columnLower.includes('descrição') || columnLower.includes('nome')) {
    if (row.sku) return `Produto ${row.sku}`;
    if (row.codigo) return `Produto ${row.codigo}`;
    if (row.SKU) return `Produto ${row.SKU}`;
    if (row.Codigo) return `Produto ${row.Codigo}`;
  }
  
  if (columnLower.includes('categoria') || columnLower.includes('category')) {
    return 'Geral';
  }
  
  if (columnLower.includes('marca') || columnLower.includes('brand')) {
    return 'Sem Marca';
  }
  
  return row[column];
};

/**
 * Export data to Excel file
 */
export const exportToExcel = (
  data: Record<string, unknown>[],
  filename: string
): void => {
  // Clean internal metadata columns
  const cleanData = data.map(row => {
    const cleaned: Record<string, unknown> = {};
    Object.entries(row).forEach(([key, value]) => {
      if (!key.startsWith('__')) {
        cleaned[key] = value;
      }
    });
    return cleaned;
  });
  
  const ws = XLSX.utils.json_to_sheet(cleanData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
  saveAs(blob, `${filename}.xlsx`);
};

/**
 * Export duplicates report to Excel
 */
export const exportDuplicatesReport = (
  duplicates: DuplicateResult[],
  originalData: ProductData[]
): void => {
  const reportData = duplicates.flatMap(dup =>
    dup.linhas.map(line => ({
      ...Object.fromEntries(
        Object.entries(originalData[line] || {}).filter(([k]) => !k.startsWith('__'))
      ),
      'Tipo_Duplicidade': dup.tipo,
      'Valor_Duplicado': dup.valor,
      'Similaridade': `${Math.round(dup.similaridade * 100)}%`,
      'Entre_Arquivos': dup.isCrossFile ? 'Sim' : 'Não',
      'Arquivos_Origem': dup.sourceFiles?.join(', ') || '',
      'Linha_Original': line + 2
    }))
  );
  
  exportToExcel(reportData, `duplicidades_${new Date().toISOString().split('T')[0]}`);
};

/**
 * Get default abbreviations
 */
export const getDefaultAbbreviations = (): Record<string, string> => {
  return { ...DEFAULT_ABBREVIATIONS };
};

/**
 * Find products missing images
 */
export const findProductsWithoutImages = (
  data: ProductData[],
  imageColumn: string = 'URL Imagens Externas'
): ProductData[] => {
  return data.filter(row => {
    const imageUrl = row[imageColumn];
    return !imageUrl || String(imageUrl).trim() === '';
  });
};

/**
 * Find products missing categories
 */
export const findProductsWithoutCategory = (
  data: ProductData[],
  categoryColumn: string = 'Categoria do Produto'
): ProductData[] => {
  return data.filter(row => {
    const category = row[categoryColumn];
    return !category || String(category).trim() === '';
  });
};

/**
 * Find products missing tags
 */
export const findProductsWithoutTags = (
  data: ProductData[],
  tagsColumn: string = 'Grupo de Tags/Tags'
): ProductData[] => {
  return data.filter(row => {
    const tags = row[tagsColumn];
    return !tags || String(tags).trim() === '';
  });
};
