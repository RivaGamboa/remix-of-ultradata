import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useUserPresets, type UserPreset } from '@/hooks/useUserPresets';
import { useAuth } from '@/hooks/useAuth';
import { Download, Upload, Settings2, Cloud, HardDrive, Trash2, Loader2, Check, Sparkles, Package } from 'lucide-react';
import type { ColumnConfig } from '@/utils/dataProcessors';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BUILTIN_PRESETS, applyPresetToColumns, type PresetDefinition } from '@/data/blingPreset';

interface ConfigPreset {
  name: string;
  version: string;
  exportedAt: string;
  abbreviations: Record<string, string>;
  columnConfig: Record<string, ColumnConfig>;
}

interface ConfigPresetManagerProps {
  abbreviations: Record<string, string>;
  columnConfig: Record<string, ColumnConfig>;
  onImport: (abbreviations: Record<string, string>, columnConfig: Record<string, ColumnConfig>) => void;
  detectedColumns?: string[]; // Para aplicar preset inteligente
}

export function ConfigPresetManager({ 
  abbreviations, 
  columnConfig, 
  onImport,
  detectedColumns = [],
}: ConfigPresetManagerProps) {
  const [open, setOpen] = useState(false);
  const [presetName, setPresetName] = useState('Minha Configuração');
  const [activeTab, setActiveTab] = useState('builtin');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { presets, loading, saving, savePreset, deletePreset } = useUserPresets();

  const handleExportFile = () => {
    const preset: ConfigPreset = {
      name: presetName || 'Configuração Exportada',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      abbreviations,
      columnConfig
    };

    const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${presetName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() || 'config'}_preset.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Arquivo exportado',
      description: `O preset "${presetName}" foi salvo como arquivo JSON.`
    });
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const preset = JSON.parse(content) as ConfigPreset;

        if (!preset.abbreviations || typeof preset.abbreviations !== 'object') {
          throw new Error('Arquivo inválido: abreviações não encontradas');
        }

        if (!preset.columnConfig || typeof preset.columnConfig !== 'object') {
          preset.columnConfig = {};
        }

        onImport(preset.abbreviations, preset.columnConfig);
        
        toast({
          title: 'Configuração aplicada',
          description: `O preset "${preset.name || 'Importado'}" foi aplicado com sucesso.`
        });

        setOpen(false);
      } catch (error) {
        toast({
          title: 'Erro ao importar',
          description: error instanceof Error ? error.message : 'Arquivo JSON inválido.',
          variant: 'destructive'
        });
      }
    };

    reader.readAsText(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveToCloud = async () => {
    if (!presetName.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Digite um nome para o preset.',
        variant: 'destructive'
      });
      return;
    }

    const success = await savePreset(presetName, abbreviations, columnConfig);
    if (success) {
      setPresetName('Minha Configuração');
    }
  };

  const handleLoadFromCloud = (preset: UserPreset) => {
    onImport(preset.abbreviations, preset.columnConfig);
    toast({
      title: 'Preset aplicado',
      description: `"${preset.name}" foi carregado com sucesso.`
    });
    setOpen(false);
  };

  const handleDeletePreset = async (preset: UserPreset) => {
    if (confirm(`Tem certeza que deseja excluir "${preset.name}"?`)) {
      await deletePreset(preset.id);
    }
  };

  // Aplicar preset pré-definido
  const handleApplyBuiltinPreset = (preset: PresetDefinition) => {
    // Se temos colunas detectadas, aplicar mapeamento inteligente
    if (detectedColumns.length > 0) {
      const mappedConfig = applyPresetToColumns(detectedColumns, preset);
      onImport(preset.abbreviations, mappedConfig);
    } else {
      onImport(preset.abbreviations, preset.columnConfig);
    }
    
    toast({
      title: 'Preset aplicado',
      description: `"${preset.name}" foi aplicado. ${detectedColumns.length > 0 ? `${detectedColumns.length} colunas mapeadas.` : ''}`
    });
    setOpen(false);
  };

  const abbreviationCount = Object.keys(abbreviations).length;
  const columnConfigCount = Object.keys(columnConfig).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          Presets
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Gerenciar Presets
          </DialogTitle>
          <DialogDescription>
            Carregue configurações prontas ou salve suas próprias.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="builtin" className="gap-2 text-xs sm:text-sm">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Prontos</span>
            </TabsTrigger>
            <TabsTrigger value="cloud" className="gap-2 text-xs sm:text-sm">
              <Cloud className="h-4 w-4" />
              <span className="hidden sm:inline">Nuvem</span>
            </TabsTrigger>
            <TabsTrigger value="file" className="gap-2 text-xs sm:text-sm">
              <HardDrive className="h-4 w-4" />
              <span className="hidden sm:inline">Arquivo</span>
            </TabsTrigger>
          </TabsList>

          {/* Built-in Presets Tab */}
          <TabsContent value="builtin" className="space-y-4 mt-4">
            <div className="space-y-3">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Presets Pré-definidos
              </h4>
              <p className="text-xs text-muted-foreground">
                Configurações otimizadas para planilhas comuns.
              </p>
              
              <div className="space-y-2">
                {BUILTIN_PRESETS.map((preset) => (
                  <div 
                    key={preset.id}
                    className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-lg hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <p className="font-semibold text-foreground">{preset.name}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {preset.description}
                        </p>
                        <div className="flex gap-2 mt-2">
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                            {Object.keys(preset.columnConfig).length} colunas
                          </span>
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                            {Object.keys(preset.abbreviations).length} abreviações
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleApplyBuiltinPreset(preset)}
                        className="flex-shrink-0"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Aplicar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              {detectedColumns.length > 0 && (
                <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
                  ✨ {detectedColumns.length} colunas detectadas na planilha. 
                  O preset será aplicado com mapeamento inteligente.
                </div>
              )}
            </div>
          </TabsContent>

          {/* Cloud Tab */}
          <TabsContent value="cloud" className="space-y-4 mt-4">
            {!user ? (
              <div className="text-center py-6 text-muted-foreground">
                <Cloud className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Faça login para usar presets na nuvem</p>
                <p className="text-sm">Seus presets ficam sincronizados em todos os dispositivos.</p>
              </div>
            ) : (
              <>
                {/* Save to Cloud */}
                <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Cloud className="h-4 w-4 text-primary" />
                    Salvar na Nuvem
                  </h4>
                  <div className="space-y-2">
                    <Label htmlFor="cloud-preset-name">Nome do Preset</Label>
                    <Input
                      id="cloud-preset-name"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      placeholder="Ex: Padrão Bling"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    📦 {abbreviationCount} abreviações, {columnConfigCount} configurações
                  </div>
                  <Button 
                    onClick={handleSaveToCloud} 
                    className="w-full gap-2" 
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Cloud className="h-4 w-4" />
                    )}
                    {saving ? 'Salvando...' : 'Salvar na Nuvem'}
                  </Button>
                </div>

                {/* Load from Cloud */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Seus Presets Salvos</h4>
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : presets.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      Nenhum preset salvo ainda.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {presets.map((preset) => (
                        <div 
                          key={preset.id} 
                          className="flex items-center justify-between p-3 bg-background border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{preset.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Atualizado {format(new Date(preset.updatedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleLoadFromCloud(preset)}
                              className="h-8 w-8 p-0"
                              title="Aplicar este preset"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeletePreset(preset)}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              title="Excluir preset"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </TabsContent>

          {/* File Tab */}
          <TabsContent value="file" className="space-y-4 mt-4">
            {/* Export to File */}
            <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Download className="h-4 w-4" />
                Exportar como Arquivo
              </h4>
              <div className="space-y-2">
                <Label htmlFor="file-preset-name">Nome do Preset</Label>
                <Input
                  id="file-preset-name"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Ex: Padrão Bling"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                📦 {abbreviationCount} abreviações, {columnConfigCount} configurações
              </div>
              <Button onClick={handleExportFile} variant="outline" className="w-full gap-2">
                <Download className="h-4 w-4" />
                Baixar Arquivo JSON
              </Button>
            </div>

            {/* Import from File */}
            <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Importar de Arquivo
              </h4>
              <p className="text-xs text-muted-foreground">
                Selecione um arquivo JSON salvo anteriormente.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportFile}
                className="hidden"
                id="preset-file"
              />
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                Selecionar Arquivo
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
