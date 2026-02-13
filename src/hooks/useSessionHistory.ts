import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ProductRow, FieldConfig, ProcessedProduct } from '@/pages/UltraData';

export interface SessionData {
  id: string;
  userId: string;
  originalFilename: string;
  totalItems: number;
  itemsProcessed: number;
  status: 'pending' | 'processing' | 'paused' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  metadata: {
    rawData?: ProductRow[];
    columns?: string[];
    fieldConfigs?: FieldConfig[];
    processedProducts?: ProcessedProduct[];
    currentTab?: string;
  };
}

export const useSessionHistory = (userId: string | undefined) => {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch all sessions for user
  const fetchSessions = useCallback(async () => {
    if (!userId) {
      setSessions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_enrichment_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const mappedSessions: SessionData[] = (data || []).map(session => ({
        id: session.id,
        userId: session.user_id,
        originalFilename: session.original_filename,
        totalItems: session.total_items,
        itemsProcessed: session.items_processed,
        status: session.status as SessionData['status'],
        createdAt: session.created_at,
        updatedAt: session.updated_at,
        metadata: (session.metadata as SessionData['metadata']) || {},
      }));

      setSessions(mappedSessions);
    } catch (err) {
      console.error('Error fetching sessions:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Create new session
  const createSession = async (
    filename: string,
    rawData: ProductRow[],
    columns: string[]
  ): Promise<string | null> => {
    if (!userId) return null;

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('product_enrichment_sessions')
        .insert({
          user_id: userId,
          original_filename: filename,
          total_items: rawData.length,
          status: 'pending',
          metadata: {
            rawData,
            columns,
            currentTab: 'config',
          },
        })
        .select('id')
        .single();

      if (error) throw error;

      await fetchSessions();
      return data.id;
    } catch (err) {
      console.error('Error creating session:', err);
      return null;
    } finally {
      setSaving(false);
    }
  };

  // Update session state
  const updateSession = async (
    sessionId: string,
    updates: {
      status?: SessionData['status'];
      itemsProcessed?: number;
      fieldConfigs?: FieldConfig[];
      processedProducts?: ProcessedProduct[];
      currentTab?: string;
    }
  ): Promise<boolean> => {
    if (!userId) return false;

    setSaving(true);
    try {
      // First get current metadata
      const { data: current, error: fetchError } = await supabase
        .from('product_enrichment_sessions')
        .select('metadata')
        .eq('id', sessionId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const currentMetadata = (current?.metadata as SessionData['metadata']) || {};
      const newMetadata = { ...currentMetadata };

      if (updates.fieldConfigs) {
        newMetadata.fieldConfigs = updates.fieldConfigs;
      }
      if (updates.processedProducts) {
        newMetadata.processedProducts = updates.processedProducts;
      }
      if (updates.currentTab) {
        newMetadata.currentTab = updates.currentTab;
      }

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        metadata: newMetadata,
      };

      if (updates.status) {
        updateData.status = updates.status;
      }
      if (updates.itemsProcessed !== undefined) {
        updateData.items_processed = updates.itemsProcessed;
      }

      const { error } = await supabase
        .from('product_enrichment_sessions')
        .update(updateData)
        .eq('id', sessionId);

      if (error) throw error;

      await fetchSessions();
      return true;
    } catch (err) {
      console.error('Error updating session:', err);
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Delete session
  const deleteSession = async (sessionId: string): Promise<boolean> => {
    if (!userId) return false;

    try {
      const { error } = await supabase
        .from('product_enrichment_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      await fetchSessions();
      return true;
    } catch (err) {
      console.error('Error deleting session:', err);
      return false;
    }
  };

  // Get session by ID
  const getSession = async (sessionId: string): Promise<SessionData | null> => {
    try {
      const { data, error } = await supabase
        .from('product_enrichment_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();

      if (error || !data) return null;

      return {
        id: data.id,
        userId: data.user_id,
        originalFilename: data.original_filename,
        totalItems: data.total_items,
        itemsProcessed: data.items_processed,
        status: data.status as SessionData['status'],
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        metadata: (data.metadata as SessionData['metadata']) || {},
      };
    } catch (err) {
      console.error('Error fetching session:', err);
      return null;
    }
  };

  return {
    sessions,
    loading,
    saving,
    fetchSessions,
    createSession,
    updateSession,
    deleteSession,
    getSession,
  };
};
