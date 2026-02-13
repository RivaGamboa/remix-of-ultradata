import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { getDefaultAbbreviations, type ColumnConfig } from '@/utils/dataProcessors';
import { useToast } from './use-toast';
import type { Json } from '@/integrations/supabase/types';

interface UserConfig {
  abbreviations: Record<string, string>;
  columnConfig: Record<string, ColumnConfig>;
}

export function useUserConfig() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<UserConfig>({
    abbreviations: getDefaultAbbreviations(),
    columnConfig: {}
  });

  // Load user configuration
  useEffect(() => {
    if (!user) {
      setConfig({
        abbreviations: getDefaultAbbreviations(),
        columnConfig: {}
      });
      setLoading(false);
      return;
    }

    const loadConfig = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_configurations')
        .select('abbreviations, column_config')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading config:', error);
      } else if (data) {
        setConfig({
          abbreviations: (data.abbreviations as unknown as Record<string, string>) || getDefaultAbbreviations(),
          columnConfig: (data.column_config as unknown as Record<string, ColumnConfig>) || {}
        });
      }
      setLoading(false);
    };

    loadConfig();
  }, [user]);

  // Save configuration
  const saveConfig = useCallback(async (
    abbreviations: Record<string, string>,
    columnConfig: Record<string, ColumnConfig>
  ) => {
    if (!user) return;

    setSaving(true);
    
    // Check if config exists first
    const { data: existing } = await supabase
      .from('user_configurations')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    let error;
    if (existing) {
      const result = await supabase
        .from('user_configurations')
        .update({
          abbreviations: abbreviations as unknown as Json,
          column_config: columnConfig as unknown as Json
        })
        .eq('user_id', user.id);
      error = result.error;
    } else {
      const result = await supabase
        .from('user_configurations')
        .insert([{
          user_id: user.id,
          abbreviations: abbreviations as unknown as Json,
          column_config: columnConfig as unknown as Json
        }]);
      error = result.error;
    }

    if (error) {
      console.error('Error saving config:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as configurações.',
        variant: 'destructive'
      });
    } else {
      setConfig({ abbreviations, columnConfig });
      toast({
        title: 'Configurações salvas',
        description: 'Suas preferências foram sincronizadas.'
      });
    }
    setSaving(false);
  }, [user, toast]);

  // Log processing
  const logProcessing = useCallback(async (
    filename: string,
    rowsProcessed: number,
    duplicatesFound: number,
    abbreviationsApplied: number,
    originalColumns: string[],
    processedColumns: string[]
  ) => {
    if (!user) return;

    await supabase
      .from('processing_logs')
      .insert([{
        user_id: user.id,
        filename,
        rows_processed: rowsProcessed,
        duplicates_found: duplicatesFound,
        abbreviations_applied: abbreviationsApplied,
        original_columns: originalColumns as unknown as Json,
        processed_columns: processedColumns as unknown as Json
      }]);
  }, [user]);

  return {
    config,
    loading,
    saving,
    saveConfig,
    logProcessing
  };
}
