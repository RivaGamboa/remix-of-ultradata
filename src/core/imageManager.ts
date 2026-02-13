// =====================================================
// ULTRACLEAN - Image Management Core Logic
// =====================================================

import { supabase } from '@/integrations/supabase/client';
import type { ProductImage, ImageSearchResult, ProductData } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const BUCKET_NAME = 'product-images';

/**
 * Generate a unique filename for storage
 */
const generateStoragePath = (userId: string, productSku: string, index: number): string => {
  const timestamp = Date.now();
  const safeSku = productSku.replace(/[^a-zA-Z0-9-_]/g, '_');
  return `${userId}/${safeSku}/${timestamp}_${index}.webp`;
};

/**
 * Convert image URL to blob
 */
export const urlToBlob = async (url: string): Promise<Blob> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  return response.blob();
};

/**
 * Upload image to Supabase Storage
 */
export const uploadImageToStorage = async (
  imageBlob: Blob,
  storagePath: string
): Promise<{ publicUrl: string; storagePath: string }> => {
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, imageBlob, {
      contentType: 'image/webp',
      upsert: true
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(storagePath);

  return {
    publicUrl: urlData.publicUrl,
    storagePath
  };
};

/**
 * Save image metadata to database
 */
export const saveImageMetadata = async (
  userId: string,
  sessionId: string | null,
  productSku: string,
  productName: string,
  sourceType: 'search' | 'ai_generated' | 'upload',
  originalUrl: string | null,
  storagePath: string,
  publicUrl: string,
  isBackgroundRemoved: boolean = false
): Promise<void> => {
  const { error } = await supabase
    .from('processed_images')
    .insert({
      user_id: userId,
      session_id: sessionId,
      product_sku: productSku,
      product_name: productName,
      source_type: sourceType,
      original_url: originalUrl,
      storage_path: storagePath,
      public_url: publicUrl,
      is_background_removed: isBackgroundRemoved
    });

  if (error) {
    console.error('Error saving image metadata:', error);
    throw new Error(`Failed to save image metadata: ${error.message}`);
  }
};

/**
 * Get all images for a product
 */
export const getProductImages = async (
  userId: string,
  productSku: string
): Promise<ProductImage[]> => {
  const { data, error } = await supabase
    .from('processed_images')
    .select('*')
    .eq('user_id', userId)
    .eq('product_sku', productSku)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching product images:', error);
    return [];
  }

  return data.map(img => ({
    id: img.id,
    url: img.public_url,
    thumbnailUrl: img.public_url,
    source: img.source_type as 'search' | 'ai_generated' | 'upload',
    width: img.width || 1080,
    height: img.height || 1080,
    format: img.format || 'webp',
    isBackgroundRemoved: img.is_background_removed || false,
    originalUrl: img.original_url || undefined
  }));
};

/**
 * Delete image from storage and database
 */
export const deleteProductImage = async (
  imageId: string,
  storagePath: string
): Promise<void> => {
  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([storagePath]);

  if (storageError) {
    console.error('Error deleting from storage:', storageError);
  }

  // Delete from database
  const { error: dbError } = await supabase
    .from('processed_images')
    .delete()
    .eq('id', imageId);

  if (dbError) {
    throw new Error(`Failed to delete image: ${dbError.message}`);
  }
};

/**
 * Process and save multiple images for a product
 */
export const processAndSaveImages = async (
  userId: string,
  sessionId: string | null,
  productSku: string,
  productName: string,
  images: { url: string; source: 'search' | 'ai_generated' | 'upload' }[]
): Promise<string[]> => {
  const savedUrls: string[] = [];

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    try {
      // Convert URL to blob
      const blob = await urlToBlob(image.url);
      
      // Generate storage path
      const storagePath = generateStoragePath(userId, productSku, i);
      
      // Upload to storage
      const { publicUrl } = await uploadImageToStorage(blob, storagePath);
      
      // Save metadata
      await saveImageMetadata(
        userId,
        sessionId,
        productSku,
        productName,
        image.source,
        image.url,
        storagePath,
        publicUrl
      );
      
      savedUrls.push(publicUrl);
    } catch (error) {
      console.error(`Error processing image ${i}:`, error);
      // Continue with other images
    }
  }

  return savedUrls;
};

/**
 * Update product data with image URLs
 */
export const updateProductImageUrls = (
  data: ProductData[],
  productSku: string,
  imageUrls: string[],
  imageColumn: string = 'URL Imagens Externas',
  skuColumn: string = 'SKU'
): ProductData[] => {
  return data.map(row => {
    const rowSku = String(row[skuColumn] || '').trim();
    if (rowSku === productSku) {
      const existingUrls = String(row[imageColumn] || '').trim();
      const newUrls = imageUrls.join('|');
      return {
        ...row,
        [imageColumn]: existingUrls ? `${existingUrls}|${newUrls}` : newUrls
      };
    }
    return row;
  });
};

/**
 * Search product images using AI-generated suggestions
 * Uses the generate-image edge function as a search proxy
 */
export const searchProductImages = async (
  query: string,
  count: number = 6
): Promise<ImageSearchResult> => {
  // Use AI to generate product images since we don't have a search API
  // In production, this could be replaced with SerpAPI or Google Images API
  try {
    const { data, error } = await supabase.functions.invoke('generate-image', {
      body: {
        productName: query,
        style: 'catalog',
      },
    });

    if (error || !data?.imageUrl) {
      console.warn('Image search/generation failed:', error || 'No image URL');
      return { images: [], query, source: 'ai_generated' };
    }

    const image: ProductImage = {
      id: `ai_${Date.now()}`,
      url: data.imageUrl,
      thumbnailUrl: data.imageUrl,
      source: 'ai_generated',
      width: 1080,
      height: 1080,
      format: 'webp',
      isBackgroundRemoved: false,
    };

    return {
      images: [image],
      query,
      source: 'ai_generated',
    };
  } catch (err) {
    console.error('Error searching product images:', err);
    return { images: [], query, source: 'ai_generated' };
  }
};

/**
 * Generate product image using AI via edge function
 */
export const generateProductImage = async (
  productName: string,
  productDescription?: string,
  style: 'catalog' | 'lifestyle' | 'minimal' = 'catalog'
): Promise<ProductImage | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('generate-image', {
      body: {
        productName,
        productDescription,
        style,
      },
    });

    if (error || !data?.imageUrl) {
      console.error('Image generation failed:', error || 'No image returned');
      return null;
    }

    return {
      id: `gen_${Date.now()}`,
      url: data.imageUrl,
      thumbnailUrl: data.imageUrl,
      source: 'ai_generated',
      width: 1080,
      height: 1080,
      format: 'webp',
      isBackgroundRemoved: false,
    };
  } catch (err) {
    console.error('Error generating product image:', err);
    return null;
  }
};
