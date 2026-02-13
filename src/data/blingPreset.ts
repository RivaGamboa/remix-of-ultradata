// =====================================================
// PRESET ERP BLING - Thin wrapper over JSON configs
// =====================================================

import type { ColumnConfig } from '@/utils/dataProcessors';
import {
  getColumnConfig,
  getAbbreviations,
  getPresetMeta,
  applyPresetToColumns as applyPreset,
} from '@/config';

// Re-export from config for backward compatibility
export const BLING_COLUMN_CONFIG: Record<string, ColumnConfig> = getColumnConfig();
export const BLING_ABBREVIATIONS: Record<string, string> = getAbbreviations();

export interface PresetDefinition {
  id: string;
  name: string;
  description: string;
  columnConfig: Record<string, ColumnConfig>;
  abbreviations: Record<string, string>;
  isBuiltIn: boolean;
}

const meta = getPresetMeta();

export const BUILTIN_PRESETS: PresetDefinition[] = [
  {
    id: meta.id,
    name: meta.name,
    description: meta.description,
    columnConfig: BLING_COLUMN_CONFIG,
    abbreviations: BLING_ABBREVIATIONS,
    isBuiltIn: true,
  },
];

export function applyPresetToColumns(
  detectedColumns: string[],
  _preset?: PresetDefinition
): Record<string, ColumnConfig> {
  return applyPreset(detectedColumns);
}
