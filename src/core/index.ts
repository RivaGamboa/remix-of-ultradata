// =====================================================
// ULTRACLEAN - Core Module Exports
// =====================================================

// Types
export * from './types';

// Data Processing
export {
  parseFile,
  detectDuplicates,
  correctAbbreviations,
  processData,
  exportToExcel,
  exportDuplicatesReport,
  getDefaultAbbreviations,
  findProductsWithoutImages,
  findProductsWithoutCategory,
  findProductsWithoutTags
} from './dataProcessor';

// Image Management
export {
  urlToBlob,
  uploadImageToStorage,
  saveImageMetadata,
  getProductImages,
  deleteProductImage,
  processAndSaveImages,
  updateProductImageUrls,
  searchProductImages,
  generateProductImage
} from './imageManager';

// Taxonomy Management
export {
  parseCategoryTree,
  flattenCategoryTree,
  saveCategoryTree,
  loadCategoryTree,
  parseExistingTags,
  formatTagsForBling,
  mergeTagsWithExisting,
  saveGeneratedTags,
  getTagStatistics,
  updateProductCategory,
  updateProductTags,
  validateCategory,
  findClosestCategory
} from './taxonomyManager';

// Session Management
export {
  createSession,
  updateSessionStatus,
  getSession,
  getUserSessions,
  deleteSession,
  getSessionStats
} from './sessionManager';
