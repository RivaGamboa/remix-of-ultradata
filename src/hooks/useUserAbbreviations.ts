import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { BLING_ABBREVIATIONS } from '@/data/blingPreset';
import type { Json } from '@/integrations/supabase/types';

export interface AbbreviationEntry {
  abbr: string;
  full: string;
}

export function useUserAbbreviations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [abbreviations, setAbbreviations] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Load user abbreviations from Supabase
  useEffect(() => {
    if (!user) {
      // Se não logado, usa o padrão BLING
      setAbbreviations(BLING_ABBREVIATIONS);
      setLoading(false);
      return;
    }

    const loadAbbreviations = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('user_configurations')
          .select('abbreviations')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Erro ao carregar abreviações:', error);
          setAbbreviations(BLING_ABBREVIATIONS);
        } else if (data?.abbreviations && typeof data.abbreviations === 'object') {
          const loadedAbbrs = data.abbreviations as Record<string, string>;
          // Se vazio, usa padrão BLING
          if (Object.keys(loadedAbbrs).length === 0) {
            setAbbreviations(BLING_ABBREVIATIONS);
          } else {
            setAbbreviations(loadedAbbrs);
          }
        } else {
          setAbbreviations(BLING_ABBREVIATIONS);
        }
      } catch (err) {
        console.error('Erro:', err);
        setAbbreviations(BLING_ABBREVIATIONS);
      }
      setLoading(false);
    };

    loadAbbreviations();
  }, [user]);

  // Save abbreviations to Supabase
  const saveAbbreviations = useCallback(async (newAbbreviations: Record<string, string>) => {
    if (!user) {
      toast({
        title: 'Login necessário',
        description: 'Faça login para salvar suas abreviações.',
        variant: 'destructive',
      });
      return false;
    }

    setSaving(true);
    try {
      // Check if config exists
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
            abbreviations: newAbbreviations as unknown as Json,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);
        error = result.error;
      } else {
        const result = await supabase
          .from('user_configurations')
          .insert({
            user_id: user.id,
            abbreviations: newAbbreviations as unknown as Json,
            column_config: {} as unknown as Json,
          });
        error = result.error;
      }

      if (error) {
        console.error('Erro ao salvar:', error);
        toast({
          title: 'Erro ao salvar',
          description: 'Não foi possível salvar as abreviações.',
          variant: 'destructive',
        });
        return false;
      }

      setAbbreviations(newAbbreviations);
      setHasChanges(false);
      toast({
        title: 'Abreviações salvas',
        description: `${Object.keys(newAbbreviations).length} abreviações sincronizadas na nuvem.`,
      });
      return true;
    } catch (err) {
      console.error('Erro:', err);
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro inesperado.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setSaving(false);
    }
  }, [user, toast]);

  // Add single abbreviation
  const addAbbreviation = useCallback((abbr: string, full: string) => {
    const normalizedAbbr = abbr.toLowerCase().trim();
    const normalizedFull = full.trim();
    
    if (!normalizedAbbr || !normalizedFull) return false;
    
    setAbbreviations(prev => ({
      ...prev,
      [normalizedAbbr]: normalizedFull,
    }));
    setHasChanges(true);
    return true;
  }, []);

  // Remove single abbreviation
  const removeAbbreviation = useCallback((abbr: string) => {
    setAbbreviations(prev => {
      const updated = { ...prev };
      delete updated[abbr];
      return updated;
    });
    setHasChanges(true);
  }, []);

  // Update single abbreviation
  const updateAbbreviation = useCallback((oldAbbr: string, newAbbr: string, full: string) => {
    setAbbreviations(prev => {
      const updated = { ...prev };
      if (oldAbbr !== newAbbr.toLowerCase().trim()) {
        delete updated[oldAbbr];
      }
      updated[newAbbr.toLowerCase().trim()] = full.trim();
      return updated;
    });
    setHasChanges(true);
  }, []);

  // Reset to BLING defaults
  const resetToDefaults = useCallback(() => {
    setAbbreviations(BLING_ABBREVIATIONS);
    setHasChanges(true);
  }, []);

  // Merge with BLING (add missing from BLING)
  const mergeWithDefaults = useCallback(() => {
    setAbbreviations(prev => ({
      ...BLING_ABBREVIATIONS,
      ...prev, // User's take precedence
    }));
    setHasChanges(true);
  }, []);

  // Import from JSON
  const importAbbreviations = useCallback((jsonData: Record<string, string>, replace: boolean = false) => {
    if (replace) {
      setAbbreviations(jsonData);
    } else {
      setAbbreviations(prev => ({
        ...prev,
        ...jsonData,
      }));
    }
    setHasChanges(true);
    return Object.keys(jsonData).length;
  }, []);

  // Export to JSON
  const exportAbbreviations = useCallback(() => {
    return abbreviations;
  }, [abbreviations]);

  return {
    abbreviations,
    loading,
    saving,
    hasChanges,
    isLoggedIn: !!user,
    addAbbreviation,
    removeAbbreviation,
    updateAbbreviation,
    saveAbbreviations,
    resetToDefaults,
    mergeWithDefaults,
    importAbbreviations,
    exportAbbreviations,
  };
}
