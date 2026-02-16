// Shared types for UltraData components
export interface ProductRow {
  [key: string]: string | number | null;
}

export interface FieldConfig {
  column: string;
  action: 'ignore' | 'analyze' | 'fill_empty' | 'use_default';
  defaultValue?: string;
  isLocked: boolean;
}

export interface NcmSugerido {
  codigo: string;
  descricao: string;
  confianca: 'alta' | 'media' | 'baixa';
  observacao: string;
}

export interface ProcessedProduct {
  original: ProductRow;
  enriched: {
    nome_padronizado?: string;
    descricao_enriquecida?: string;
    categoria_inferida?: string;
    marca_inferida?: string;
    origem_inferida?: string;
    ncm_sugerido?: NcmSugerido;
  };
  necessita_revisao: boolean;
  razao_revisao?: string;
  validado: boolean;
  tempo_processamento_ms?: number;
}
