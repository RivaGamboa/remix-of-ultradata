// =====================================================
// ULTRACLEAN - Taxonomy Management (Categories & Tags)
// =====================================================

import { supabase } from '@/integrations/supabase/client';
import type { CategoryNode, GeneratedTags, ProductData, TagGroup } from './types';

/**
 * Parse category tree from JSON/CSV data
 */
export const parseCategoryTree = (categories: string[]): CategoryNode[] => {
  const root: CategoryNode[] = [];
  const nodeMap = new Map<string, CategoryNode>();

  categories.forEach((fullPath, index) => {
    const parts = fullPath.split('>').map(p => p.trim());
    let currentLevel = root;
    let currentPath = '';

    parts.forEach((part, level) => {
      currentPath = currentPath ? `${currentPath} > ${part}` : part;
      
      if (!nodeMap.has(currentPath)) {
        const node: CategoryNode = {
          id: `cat_${index}_${level}`,
          name: part,
          fullPath: currentPath,
          children: [],
          level
        };
        nodeMap.set(currentPath, node);
        currentLevel.push(node);
      }
      
      currentLevel = nodeMap.get(currentPath)!.children;
    });
  });

  return root;
};

/**
 * Flatten category tree to list of full paths
 */
export const flattenCategoryTree = (nodes: CategoryNode[]): string[] => {
  const paths: string[] = [];
  
  const traverse = (node: CategoryNode) => {
    paths.push(node.fullPath);
    node.children.forEach(traverse);
  };
  
  nodes.forEach(traverse);
  return paths;
};

/**
 * Save category tree to database
 */
export const saveCategoryTree = async (
  userId: string,
  name: string,
  categories: string[]
): Promise<string> => {
  const { data, error } = await supabase
    .from('category_trees')
    .insert({
      user_id: userId,
      name,
      categories: categories
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to save category tree: ${error.message}`);
  }

  return data.id;
};

/**
 * Load user's category tree from database
 */
export const loadCategoryTree = async (userId: string): Promise<string[] | null> => {
  const { data, error } = await supabase
    .from('category_trees')
    .select('categories')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error loading category tree:', error);
    return null;
  }

  if (!data) return null;
  
  // Handle the categories as JSONB
  const categories = data.categories;
  if (Array.isArray(categories)) {
    return categories as string[];
  }
  
  return null;
};

/**
 * Parse existing tags from Bling format
 * Format: "GRUPO1:tag1, GRUPO1:tag2, GRUPO2:tag3"
 */
export const parseExistingTags = (tagsString: string): TagGroup[] => {
  if (!tagsString || typeof tagsString !== 'string') return [];
  
  const groups = new Map<string, string[]>();
  
  tagsString.split(',').forEach(pair => {
    const trimmed = pair.trim();
    if (!trimmed) return;
    
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0) {
      const group = trimmed.substring(0, colonIndex).trim();
      const tag = trimmed.substring(colonIndex + 1).trim();
      
      if (!groups.has(group)) {
        groups.set(group, []);
      }
      groups.get(group)!.push(tag);
    }
  });
  
  return Array.from(groups.entries()).map(([name, tags]) => ({ name, tags }));
};

/**
 * Format tags to Bling format
 */
export const formatTagsForBling = (tagGroups: TagGroup[]): string => {
  return tagGroups
    .flatMap(group => group.tags.map(tag => `${group.name}:${tag}`))
    .join(', ');
};

/**
 * Merge new tags with existing ones
 */
export const mergeTagsWithExisting = (
  existingTags: string,
  newTags: string[],
  groupName: string = 'ULTRACLEAN'
): string => {
  const existingGroups = parseExistingTags(existingTags);
  
  // Check if group already exists
  const existingGroup = existingGroups.find(g => g.name === groupName);
  if (existingGroup) {
    // Add only new tags
    const existingTagSet = new Set(existingGroup.tags.map(t => t.toLowerCase()));
    newTags.forEach(tag => {
      if (!existingTagSet.has(tag.toLowerCase())) {
        existingGroup.tags.push(tag);
      }
    });
  } else {
    // Create new group
    existingGroups.push({ name: groupName, tags: newTags });
  }
  
  return formatTagsForBling(existingGroups);
};

/**
 * Save generated tags to database
 */
export const saveGeneratedTags = async (
  userId: string,
  sessionId: string | null,
  productSku: string,
  productName: string,
  originalTags: string,
  generatedTags: string[],
  tagGroup: string,
  combinedTags: string,
  aiModel: string,
  promptUsed: string
): Promise<void> => {
  const { error } = await supabase
    .from('generated_tags')
    .insert({
      user_id: userId,
      session_id: sessionId,
      product_sku: productSku,
      product_name: productName,
      original_tags: originalTags,
      generated_tags: generatedTags,
      tag_group: tagGroup,
      combined_tags: combinedTags,
      ai_model: aiModel,
      prompt_used: promptUsed
    });

  if (error) {
    throw new Error(`Failed to save generated tags: ${error.message}`);
  }
};

/**
 * Get tag statistics for a session
 */
export const getTagStatistics = async (
  userId: string,
  sessionId?: string
): Promise<Map<string, number>> => {
  let query = supabase
    .from('generated_tags')
    .select('generated_tags')
    .eq('user_id', userId);

  if (sessionId) {
    query = query.eq('session_id', sessionId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching tag statistics:', error);
    return new Map();
  }

  const tagCounts = new Map<string, number>();
  
  data?.forEach(row => {
    const tags = row.generated_tags as string[];
    tags?.forEach(tag => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });

  return tagCounts;
};

/**
 * Update product data with new category
 */
export const updateProductCategory = (
  data: ProductData[],
  productSku: string,
  category: string,
  categoryColumn: string = 'Categoria do Produto',
  skuColumn: string = 'SKU'
): ProductData[] => {
  return data.map(row => {
    const rowSku = String(row[skuColumn] || '').trim();
    if (rowSku === productSku) {
      return {
        ...row,
        [categoryColumn]: category
      };
    }
    return row;
  });
};

/**
 * Update product data with new tags
 */
export const updateProductTags = (
  data: ProductData[],
  productSku: string,
  combinedTags: string,
  tagsColumn: string = 'Grupo de Tags/Tags',
  skuColumn: string = 'SKU'
): ProductData[] => {
  return data.map(row => {
    const rowSku = String(row[skuColumn] || '').trim();
    if (rowSku === productSku) {
      return {
        ...row,
        [tagsColumn]: combinedTags
      };
    }
    return row;
  });
};

/**
 * Validate category against allowed list
 */
export const validateCategory = (
  category: string,
  allowedCategories: string[]
): boolean => {
  return allowedCategories.includes(category);
};

/**
 * Find closest matching category (for suggestions)
 */
export const findClosestCategory = (
  input: string,
  allowedCategories: string[]
): string[] => {
  const inputLower = input.toLowerCase();
  
  return allowedCategories
    .filter(cat => cat.toLowerCase().includes(inputLower))
    .slice(0, 5);
};
