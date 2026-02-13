// =====================================================
// ULTRACLEAN - Core Types
// =====================================================

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
  isCrossFile?: boolean;
  sourceFiles?: string[];
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

// Product data with enrichment fields
export interface ProductData {
  [key: string]: unknown;
  __source_file?: string;
  __row_index?: number;
}

// Image-related types
export interface ProductImage {
  id: string;
  url: string;
  thumbnailUrl?: string;
  source: 'search' | 'ai_generated' | 'upload';
  width: number;
  height: number;
  format: string;
  isBackgroundRemoved: boolean;
  originalUrl?: string;
}

export interface ImageSearchResult {
  images: ProductImage[];
  query: string;
  source: string;
}

export interface ImageGenerationRequest {
  productName: string;
  productDescription?: string;
  style?: 'catalog' | 'lifestyle' | 'minimal';
}

// Taxonomy types
export interface CategoryNode {
  id: string;
  name: string;
  fullPath: string;
  children: CategoryNode[];
  level: number;
}

export interface TagGroup {
  name: string;
  tags: string[];
}

export interface GeneratedTags {
  productSku: string;
  originalTags: string;
  newTags: string[];
  tagGroup: string;
  combinedTags: string;
}

// Session types
export interface EnrichmentSession {
  id: string;
  userId: string;
  originalFilename: string;
  totalItems: number;
  itemsProcessed: number;
  duplicatesFound: number;
  imagesAdded: number;
  tagsGenerated: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// Bling-specific types
export interface BlingColumn {
  name: string;
  required: boolean;
  type: 'text' | 'number' | 'url' | 'category' | 'tags';
  description: string;
}

export const BLING_STANDARD_COLUMNS: BlingColumn[] = [
  { name: 'SKU', required: true, type: 'text', description: 'Código único do produto' },
  { name: 'Nome', required: true, type: 'text', description: 'Nome do produto' },
  { name: 'Descrição Curta', required: false, type: 'text', description: 'Descrição resumida' },
  { name: 'Descrição Completa', required: false, type: 'text', description: 'Descrição detalhada' },
  { name: 'Categoria do Produto', required: false, type: 'category', description: 'Categoria no Bling' },
  { name: 'Grupo de Tags/Tags', required: false, type: 'tags', description: 'Tags no formato GRUPO:tag' },
  { name: 'URL Imagens Externas', required: false, type: 'url', description: 'URLs de imagens separadas por vírgula ou pipe' },
  { name: 'Marca', required: false, type: 'text', description: 'Marca do produto' },
  { name: 'Preço', required: true, type: 'number', description: 'Preço de venda' },
  { name: 'Estoque', required: true, type: 'number', description: 'Quantidade em estoque' },
];

// Default abbreviations - loaded from JSON config
export const DEFAULT_ABBREVIATIONS: Record<string, string> = getAbbreviations();
