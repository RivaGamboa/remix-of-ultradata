// =====================================================
// ULTRACLEAN - Session Management
// =====================================================

import { supabase } from '@/integrations/supabase/client';
import type { EnrichmentSession } from './types';

/**
 * Create a new enrichment session
 */
export const createSession = async (
  userId: string,
  originalFilename: string,
  totalItems: number
): Promise<string> => {
  const { data, error } = await supabase
    .from('product_enrichment_sessions')
    .insert({
      user_id: userId,
      original_filename: originalFilename,
      total_items: totalItems,
      status: 'pending'
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create session: ${error.message}`);
  }

  return data.id;
};

/**
 * Update session status
 */
export const updateSessionStatus = async (
  sessionId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  updates?: Partial<{
    itemsProcessed: number;
    duplicatesFound: number;
    imagesAdded: number;
    tagsGenerated: number;
    metadata: Record<string, unknown>;
  }>
): Promise<void> => {
  const updateData: Record<string, unknown> = { status };
  
  if (updates?.itemsProcessed !== undefined) {
    updateData.items_processed = updates.itemsProcessed;
  }
  if (updates?.duplicatesFound !== undefined) {
    updateData.duplicates_found = updates.duplicatesFound;
  }
  if (updates?.imagesAdded !== undefined) {
    updateData.images_added = updates.imagesAdded;
  }
  if (updates?.tagsGenerated !== undefined) {
    updateData.tags_generated = updates.tagsGenerated;
  }
  if (updates?.metadata) {
    updateData.metadata = updates.metadata;
  }

  const { error } = await supabase
    .from('product_enrichment_sessions')
    .update(updateData)
    .eq('id', sessionId);

  if (error) {
    throw new Error(`Failed to update session: ${error.message}`);
  }
};

/**
 * Get session by ID
 */
export const getSession = async (sessionId: string): Promise<EnrichmentSession | null> => {
  const { data, error } = await supabase
    .from('product_enrichment_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error) {
    console.error('Error fetching session:', error);
    return null;
  }

  return {
    id: data.id,
    userId: data.user_id,
    originalFilename: data.original_filename,
    totalItems: data.total_items,
    itemsProcessed: data.items_processed,
    duplicatesFound: data.duplicates_found,
    imagesAdded: data.images_added,
    tagsGenerated: data.tags_generated,
    status: data.status as EnrichmentSession['status'],
    metadata: (data.metadata as Record<string, unknown>) || {},
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
};

/**
 * Get all sessions for a user
 */
export const getUserSessions = async (
  userId: string,
  limit: number = 20
): Promise<EnrichmentSession[]> => {
  const { data, error } = await supabase
    .from('product_enrichment_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching user sessions:', error);
    return [];
  }

  return data.map(session => ({
    id: session.id,
    userId: session.user_id,
    originalFilename: session.original_filename,
    totalItems: session.total_items,
    itemsProcessed: session.items_processed,
    duplicatesFound: session.duplicates_found,
    imagesAdded: session.images_added,
    tagsGenerated: session.tags_generated,
    status: session.status as EnrichmentSession['status'],
    metadata: (session.metadata as Record<string, unknown>) || {},
    createdAt: session.created_at,
    updatedAt: session.updated_at
  }));
};

/**
 * Delete a session and all related data
 */
export const deleteSession = async (sessionId: string): Promise<void> => {
  const { error } = await supabase
    .from('product_enrichment_sessions')
    .delete()
    .eq('id', sessionId);

  if (error) {
    throw new Error(`Failed to delete session: ${error.message}`);
  }
};

/**
 * Get session statistics summary
 */
export const getSessionStats = async (userId: string): Promise<{
  totalSessions: number;
  totalItemsProcessed: number;
  totalImagesAdded: number;
  totalTagsGenerated: number;
  completedSessions: number;
}> => {
  const { data, error } = await supabase
    .from('product_enrichment_sessions')
    .select('status, items_processed, images_added, tags_generated')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching session stats:', error);
    return {
      totalSessions: 0,
      totalItemsProcessed: 0,
      totalImagesAdded: 0,
      totalTagsGenerated: 0,
      completedSessions: 0
    };
  }

  return {
    totalSessions: data.length,
    totalItemsProcessed: data.reduce((sum, s) => sum + (s.items_processed || 0), 0),
    totalImagesAdded: data.reduce((sum, s) => sum + (s.images_added || 0), 0),
    totalTagsGenerated: data.reduce((sum, s) => sum + (s.tags_generated || 0), 0),
    completedSessions: data.filter(s => s.status === 'completed').length
  };
};
