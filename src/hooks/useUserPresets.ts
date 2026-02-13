import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import type { ColumnConfig } from '@/utils/dataProcessors';
import type { Json } from '@/integrations/supabase/types';

export interface UserPreset {
  id: string;
  name: string;
  abbreviations: Record<string, string>;
  columnConfig: Record<string, ColumnConfig>;
  createdAt: string;
  updatedAt: string;
}

export function useUserPresets() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [presets, setPresets] = useState<UserPreset[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load presets from database
  const loadPresets = useCallback(async () => {
    if (!user) {
      setPresets([]);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('user_presets')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error loading presets:', error);
      toast({
        title: 'Erro ao carregar presets',
        description: 'Não foi possível carregar seus presets salvos.',
        variant: 'destructive'
      });
    } else if (data) {
      setPresets(data.map(p => ({
        id: p.id,
        name: p.name,
        abbreviations: (p.abbreviations as unknown as Record<string, string>) || {},
        columnConfig: (p.column_config as unknown as Record<string, ColumnConfig>) || {},
        createdAt: p.created_at,
        updatedAt: p.updated_at
      })));
    }
    setLoading(false);
  }, [user, toast]);

  // Load presets on mount and user change
  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  // Save a new preset
  const savePreset = useCallback(async (
    name: string,
    abbreviations: Record<string, string>,
    columnConfig: Record<string, ColumnConfig>
  ): Promise<boolean> => {
    if (!user) {
      toast({
        title: 'Faça login',
        description: 'Você precisa estar logado para salvar presets na nuvem.',
        variant: 'destructive'
      });
      return false;
    }

    setSaving(true);
    
    // Check if preset with same name exists
    const existing = presets.find(p => p.name.toLowerCase() === name.toLowerCase());
    
    let error;
    if (existing) {
      // Update existing preset
      const result = await supabase
        .from('user_presets')
        .update({
          abbreviations: abbreviations as unknown as Json,
          column_config: columnConfig as unknown as Json
        })
        .eq('id', existing.id);
      error = result.error;
    } else {
      // Create new preset
      const result = await supabase
        .from('user_presets')
        .insert([{
          user_id: user.id,
          name,
          abbreviations: abbreviations as unknown as Json,
          column_config: columnConfig as unknown as Json
        }]);
      error = result.error;
    }

    if (error) {
      console.error('Error saving preset:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message.includes('unique') 
          ? 'Já existe um preset com esse nome.' 
          : 'Não foi possível salvar o preset.',
        variant: 'destructive'
      });
      setSaving(false);
      return false;
    }

    toast({
      title: existing ? 'Preset atualizado' : 'Preset salvo',
      description: `"${name}" foi ${existing ? 'atualizado' : 'salvo'} na nuvem.`
    });
    
    await loadPresets();
    setSaving(false);
    return true;
  }, [user, presets, loadPresets, toast]);

  // Delete a preset
  const deletePreset = useCallback(async (presetId: string): Promise<boolean> => {
    if (!user) return false;

    const preset = presets.find(p => p.id === presetId);
    
    const { error } = await supabase
      .from('user_presets')
      .delete()
      .eq('id', presetId);

    if (error) {
      console.error('Error deleting preset:', error);
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir o preset.',
        variant: 'destructive'
      });
      return false;
    }

    toast({
      title: 'Preset excluído',
      description: `"${preset?.name}" foi removido.`
    });
    
    await loadPresets();
    return true;
  }, [user, presets, loadPresets, toast]);

  return {
    presets,
    loading,
    saving,
    savePreset,
    deletePreset,
    refreshPresets: loadPresets
  };
}
