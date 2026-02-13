import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Upload, Settings2, Sparkles, CheckCircle, SpellCheck, BookA, History, Database, User, LogOut, Camera, Zap } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/toaster';
import { useAuth } from '@/hooks/useAuth';
import { useSessionHistory, type SessionData } from '@/hooks/useSessionHistory';
import { AuthModal } from '@/components/AuthModal';
import UltraDataUpload from '@/components/ultradata/UltraDataUpload';
import UltraDataFieldConfig from '@/components/ultradata/UltraDataFieldConfig';
import UltraDataProcessing from '@/components/ultradata/UltraDataProcessing';
import UltraDataValidation from '@/components/ultradata/UltraDataValidation';
import UltraDataTextCorrection from '@/components/ultradata/UltraDataTextCorrection';
import UltraDataAbbreviations from '@/components/ultradata/UltraDataAbbreviations';
import UltraDataSessionHistory from '@/components/ultradata/UltraDataSessionHistory';
import UltraDataImageSearch from '@/components/ultradata/UltraDataImageSearch';
import UltraDataEnrichmentModal from '@/components/ultradata/UltraDataEnrichmentModal';

export interface ProductRow {
  [key: string]: string | number | null;
}

export interface FieldConfig {
  column: string;
  action: 'ignore' | 'analyze' | 'fill_empty' | 'use_default';
  defaultValue?: string;
  isLocked: boolean;
}

export interface NcmSugerido {
  codigo: string;
  descricao: string;
  confianca: 'alta' | 'media' | 'baixa';
  observacao: string;
}

export interface ProcessedProduct {
  original: ProductRow;
  enriched: {
    nome_padronizado?: string;
    descricao_enriquecida?: string;
    categoria_inferida?: string;
    marca_inferida?: string;
    origem_inferida?: string;
    ncm_sugerido?: NcmSugerido;
  };
  necessita_revisao: boolean;
  razao_revisao?: string;
  validado: boolean;
  tempo_processamento_ms?: number;
}

const UltraData = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showImageSearch, setShowImageSearch] = useState(false);
  const [showEnrichmentModal, setShowEnrichmentModal] = useState(false);
  
  // Session management
  const {
    sessions,
    loading: sessionsLoading,
    createSession,
    updateSession,
    deleteSession,
  } = useSessionHistory(user?.id);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentFilename, setCurrentFilename] = useState<string>('');
  
  // Data state
  const [rawData, setRawData] = useState<ProductRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [fieldConfigs, setFieldConfigs] = useState<FieldConfig[]>([]);
  const [processedProducts, setProcessedProducts] = useState<ProcessedProduct[]>([]);
  
  // UI state
  const [activeTab, setActiveTab] = useState('upload');
  const [isProcessing, setIsProcessing] = useState(false);

  // Auto-save session on tab change
  const handleTabChange = useCallback(async (newTab: string) => {
    setActiveTab(newTab);
    
    if (currentSessionId && user) {
      await updateSession(currentSessionId, {
        currentTab: newTab,
        fieldConfigs,
        processedProducts,
      });
    }
  }, [currentSessionId, user, fieldConfigs, processedProducts, updateSession]);

  const handleDataLoaded = async (data: ProductRow[], cols: string[], filename?: string) => {
    setRawData(data);
    setColumns(cols);
    setCurrentFilename(filename || 'planilha.xlsx');
    
    // Initialize field configs
    const configs: FieldConfig[] = cols.map(col => {
      const isLocked = /estoque|preço|preco|custo|price|stock|valor|quantidade/i.test(col);
      return {
        column: col,
        action: isLocked ? 'ignore' : 'analyze',
        isLocked,
      };
    });
    setFieldConfigs(configs);
    
    // Create new session
    if (user && filename) {
      const sessionId = await createSession(filename, data, cols);
      if (sessionId) {
        setCurrentSessionId(sessionId);
      }
    }
    
    setActiveTab('config');
  };

  const handleProcessingComplete = async (products: ProcessedProduct[]) => {
    setProcessedProducts(products);
    
    // Update session with processed products
    if (currentSessionId) {
      await updateSession(currentSessionId, {
        status: 'completed',
        itemsProcessed: products.length,
        processedProducts: products,
        currentTab: 'validation',
      });
    }
    
    setActiveTab('validation');
  };

  const handleValidationComplete = (validatedProducts: ProcessedProduct[]) => {
    setProcessedProducts(validatedProducts);
  };

  const handleDataUpdate = (updatedData: ProductRow[]) => {
    setRawData(updatedData);
  };

  // Resume session from history
  const handleResumeSession = (
    sessionRawData: ProductRow[],
    sessionColumns: string[],
    sessionFieldConfigs: FieldConfig[],
    sessionProcessedProducts: ProcessedProduct[],
    targetTab: string
  ) => {
    setRawData(sessionRawData);
    setColumns(sessionColumns);
    
    if (sessionFieldConfigs.length > 0) {
      setFieldConfigs(sessionFieldConfigs);
    } else {
      // Initialize field configs if not saved
      const configs: FieldConfig[] = sessionColumns.map(col => {
        const isLocked = /estoque|preço|preco|custo|price|stock|valor|quantidade/i.test(col);
        return {
          column: col,
          action: isLocked ? 'ignore' : 'analyze',
          isLocked,
        };
      });
      setFieldConfigs(configs);
    }
    
    if (sessionProcessedProducts.length > 0) {
      setProcessedProducts(sessionProcessedProducts);
    }
    
    setActiveTab(targetTab);
  };

  const canProceedToProcessing = rawData.length > 0 && fieldConfigs.some(f => f.action !== 'ignore');
  const canProceedToValidation = processedProducts.length > 0;

  // Require auth for processing
  const requireAuth = () => {
    if (!user) {
      setShowAuthModal(true);
      return false;
    }
    return true;
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
      <UltraDataImageSearch
        isOpen={showImageSearch}
        onClose={() => setShowImageSearch(false)}
      />
      <UltraDataEnrichmentModal
        isOpen={showEnrichmentModal}
        onClose={() => setShowEnrichmentModal(false)}
        userId={user?.id}
      />
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Database className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">UltraData</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  Enriquecimento inteligente com DeepSeek AI
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <Link to="/profile" className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <User className="h-4 w-4" />
                    <span>{user.email}</span>
                  </Link>
                  <Link to="/history">
                    <Button variant="outline" size="sm">
                      <History className="h-4 w-4" />
                      <span className="hidden sm:inline ml-2">Histórico</span>
                    </Button>
                  </Link>
                  <Button variant="ghost" size="sm" onClick={() => signOut()}>
                    <LogOut className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button onClick={() => setShowAuthModal(true)} variant="outline" size="sm">
                  <User className="h-4 w-4 mr-2" />
                  Entrar
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Quick Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => {
              if (!requireAuth()) return;
              setShowImageSearch(true);
            }}
            className="gap-2"
          >
            <Camera className="h-4 w-4" />
            Busca de Imagens
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (!requireAuth()) return;
              setShowEnrichmentModal(true);
            }}
            className="gap-2"
          >
            <Zap className="h-4 w-4" />
            Enriquecer Produto
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid w-full grid-cols-7 h-auto p-1">
            <TabsTrigger 
              value="upload" 
              className="flex items-center gap-2 py-3"
            >
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Upload</span>
            </TabsTrigger>
            <TabsTrigger 
              value="history" 
              className="flex items-center gap-2 py-3"
            >
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Histórico</span>
            </TabsTrigger>
            <TabsTrigger 
              value="config" 
              disabled={rawData.length === 0}
              className="flex items-center gap-2 py-3"
            >
              <Settings2 className="h-4 w-4" />
              <span className="hidden sm:inline">Configurar</span>
            </TabsTrigger>
            <TabsTrigger 
              value="abbreviations" 
              className="flex items-center gap-2 py-3"
            >
              <BookA className="h-4 w-4" />
              <span className="hidden sm:inline">Abreviações</span>
            </TabsTrigger>
            <TabsTrigger 
              value="text-correction" 
              disabled={!canProceedToProcessing}
              className="flex items-center gap-2 py-3"
            >
              <SpellCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Corrigir</span>
            </TabsTrigger>
            <TabsTrigger 
              value="processing" 
              disabled={!canProceedToProcessing}
              className="flex items-center gap-2 py-3"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Processar IA</span>
            </TabsTrigger>
            <TabsTrigger 
              value="validation" 
              disabled={!canProceedToValidation}
              className="flex items-center gap-2 py-3"
            >
              <CheckCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Validar</span>
            </TabsTrigger>
          </TabsList>

          <div className="bg-card rounded-2xl shadow-elevated border border-border p-6 md:p-8">
            <TabsContent value="upload" className="mt-0">
              <UltraDataUpload onDataLoaded={handleDataLoaded} />
            </TabsContent>

            <TabsContent value="history" className="mt-0">
              <UltraDataSessionHistory
                sessions={sessions}
                loading={sessionsLoading}
                onResumeSession={handleResumeSession}
                onDeleteSession={deleteSession}
              />
            </TabsContent>

            <TabsContent value="config" className="mt-0">
              <UltraDataFieldConfig
                columns={columns}
                fieldConfigs={fieldConfigs}
                onConfigChange={setFieldConfigs}
                sampleData={rawData.slice(0, 5)}
                onNext={() => {
                  if (requireAuth()) {
                    handleTabChange('text-correction');
                  }
                }}
              />
            </TabsContent>

            <TabsContent value="abbreviations" className="mt-0">
              <UltraDataAbbreviations />
            </TabsContent>

            <TabsContent value="text-correction" className="mt-0">
              <UltraDataTextCorrection
                rawData={rawData}
                columns={columns}
                fieldConfigs={fieldConfigs}
                onDataUpdate={handleDataUpdate}
              />
            </TabsContent>

            <TabsContent value="processing" className="mt-0">
              <UltraDataProcessing
                rawData={rawData}
                fieldConfigs={fieldConfigs}
                userId={user?.id}
                isProcessing={isProcessing}
                setIsProcessing={setIsProcessing}
                onComplete={handleProcessingComplete}
                onDataUpdate={handleDataUpdate}
                sessionId={currentSessionId}
                onSessionUpdate={updateSession}
              />
            </TabsContent>

            <TabsContent value="validation" className="mt-0">
              <UltraDataValidation
                processedProducts={processedProducts}
                columns={columns}
                onValidationChange={handleValidationComplete}
              />
            </TabsContent>
          </div>
        </Tabs>
      </main>
    </div>
  );
};

export default UltraData;
