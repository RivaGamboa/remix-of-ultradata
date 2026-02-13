// =====================================================
// CONFIG LOADER - Single source of truth for all configs
// =====================================================

import type { ColumnConfig } from '@/utils/dataProcessors';
import columnsConfig from './columns.json';
import abbreviationsConfig from './abbreviations.json';
import promptsConfig from './prompts.json';
import imageQueriesConfig from './imageQueries.json';

// ---- Column Config ----

export interface ColumnRule {
  action: 'ignore' | 'analyze';
  isProtected: boolean;
}

/**
 * Flatten all column groups from the JSON config into a single Record
 */
export function getColumnConfig(): Record<string, ColumnConfig> {
  const preset = columnsConfig.bling_54;
  const result: Record<string, ColumnConfig> = {};

  const groups = [
    preset.identifiers,
    preset.text_fields,
    preset.classification,
    preset.attributes,
    preset.seo,
    preset.prices,
    preset.inventory,
    preset.dimensions,
    preset.images,
    preset.status,
    preset.observations,
  ];

  for (const group of groups) {
    for (const [key, rule] of Object.entries(group)) {
      result[key] = {
        action: (rule as ColumnRule).action === 'analyze' ? 'analyze' : 'ignore',
        defaultValue: '',
        isProtected: (rule as ColumnRule).isProtected,
      };
    }
  }

  return result;
}

/**
 * Get the regex pattern for detecting protected columns
 */
export function getProtectedColumnRegex(): RegExp {
  return new RegExp(columnsConfig.protected_column_regex, 'i');
}

/**
 * Get preset metadata
 */
export function getPresetMeta() {
  return columnsConfig.bling_54.meta;
}

// ---- Abbreviations ----

/**
 * Flatten all abbreviation groups into a single dictionary
 */
export function getAbbreviations(): Record<string, string> {
  const result: Record<string, string> = {};

  const groups = [
    abbreviationsConfig.measures,
    abbreviationsConfig.units,
    abbreviationsConfig.sizes,
    abbreviationsConfig.prepositions,
    abbreviationsConfig.materials,
    abbreviationsConfig.general,
  ];

  for (const group of groups) {
    Object.assign(result, group);
  }

  return result;
}

/**
 * Get abbreviation groups (for UI display)
 */
export function getAbbreviationGroups(): Record<string, Record<string, string>> {
  return {
    'Medidas': abbreviationsConfig.measures,
    'Unidades': abbreviationsConfig.units,
    'Tamanhos': abbreviationsConfig.sizes,
    'Preposições': abbreviationsConfig.prepositions,
    'Materiais': abbreviationsConfig.materials,
    'Geral': abbreviationsConfig.general,
  };
}

// ---- Prompts ----

export interface PromptConfig {
  system: string;
  temperature: number;
  model: string;
}

export function getEnrichmentPrompt(): PromptConfig {
  return promptsConfig.enriquecer_produto;
}

export function getTextCorrectionPrompt(): PromptConfig {
  return promptsConfig.corrigir_texto;
}

export function getTagGenerationPrompt(): PromptConfig {
  return promptsConfig.gerar_tags;
}

export function getImageGenerationConfig() {
  return promptsConfig.gerar_imagem;
}

// ---- Image Queries ----

export function getImageSearchTemplate(
  type: 'default' | 'with_brand' | 'with_category' | 'detailed' = 'default'
): string {
  return imageQueriesConfig.search_templates[type];
}

export function getImageStyles() {
  return imageQueriesConfig.generation_styles;
}

export function getImageDefaults() {
  return imageQueriesConfig.default_dimensions;
}

/**
 * Build a search query from template and product data
 */
export function buildImageSearchQuery(
  productName: string,
  brand?: string,
  category?: string
): string {
  let template: string;
  
  if (brand && category) {
    template = imageQueriesConfig.search_templates.detailed;
  } else if (brand) {
    template = imageQueriesConfig.search_templates.with_brand;
  } else if (category) {
    template = imageQueriesConfig.search_templates.with_category;
  } else {
    template = imageQueriesConfig.search_templates.default;
  }

  return template
    .replace('{productName}', productName)
    .replace('{brand}', brand || '')
    .replace('{category}', category || '')
    .trim();
}

// ---- Apply preset to detected columns ----

/**
 * Match detected spreadsheet columns to preset config
 */
export function applyPresetToColumns(
  detectedColumns: string[]
): Record<string, ColumnConfig> {
  const presetConfig = getColumnConfig();
  const protectedRegex = getProtectedColumnRegex();
  const result: Record<string, ColumnConfig> = {};

  detectedColumns.forEach(col => {
    // Exact match
    if (presetConfig[col]) {
      result[col] = presetConfig[col];
      return;
    }

    // Case-insensitive match
    const lowerCol = col.toLowerCase().trim();
    const matchedKey = Object.keys(presetConfig).find(
      k => k.toLowerCase().trim() === lowerCol
    );

    if (matchedKey) {
      result[col] = presetConfig[matchedKey];
      return;
    }

    // Partial match
    const partialMatch = Object.keys(presetConfig).find(k =>
      lowerCol.includes(k.toLowerCase()) || k.toLowerCase().includes(lowerCol)
    );

    if (partialMatch) {
      result[col] = presetConfig[partialMatch];
      return;
    }

    // Fallback: check if protected by regex
    const isProtected = protectedRegex.test(col);
    result[col] = {
      action: isProtected ? 'ignore' : 'analyze',
      defaultValue: '',
      isProtected,
    };
  });

  return result;
}
