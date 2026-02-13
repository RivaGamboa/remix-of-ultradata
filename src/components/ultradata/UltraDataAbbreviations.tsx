import { useState, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Save, 
  RotateCcw, 
  Search, 
  Upload, 
  Download,
  Loader2,
  Cloud,
  CloudOff,
  Pencil,
  Check,
  X,
  Merge,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useUserAbbreviations } from '@/hooks/useUserAbbreviations';

const UltraDataAbbreviations = () => {
  const { toast } = useToast();
  const {
    abbreviations,
    loading,
    saving,
    hasChanges,
    isLoggedIn,
    addAbbreviation,
    removeAbbreviation,
    updateAbbreviation,
    saveAbbreviations,
    resetToDefaults,
    mergeWithDefaults,
    importAbbreviations,
    exportAbbreviations,
  } = useUserAbbreviations();

  const [newAbbr, setNewAbbr] = useState('');
  const [newFull, setNewFull] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editAbbr, setEditAbbr] = useState('');
  const [editFull, setEditFull] = useState('');
  const [importText, setImportText] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);

  // Filtered abbreviations
  const filteredAbbreviations = useMemo(() => {
    const entries = Object.entries(abbreviations);
    if (!searchTerm.trim()) return entries;
    
    const term = searchTerm.toLowerCase();
    return entries.filter(([abbr, full]) => 
      abbr.toLowerCase().includes(term) || 
      full.toLowerCase().includes(term)
    );
  }, [abbreviations, searchTerm]);

  // Sorted entries
  const sortedAbbreviations = useMemo(() => {
    return [...filteredAbbreviations].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredAbbreviations]);

  const handleAdd = () => {
    if (!newAbbr.trim() || !newFull.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha a abreviatura e o termo completo.",
        variant: "destructive"
      });
      return;
    }

    if (abbreviations[newAbbr.toLowerCase().trim()]) {
      toast({
        title: "Abreviatura já existe",
        description: `"${newAbbr}" já está cadastrada. Edite-a na lista.`,
        variant: "destructive"
      });
      return;
    }

    addAbbreviation(newAbbr, newFull);
    setNewAbbr('');
    setNewFull('');
    toast({
      title: "Abreviatura adicionada",
      description: `"${newAbbr}" → "${newFull}"`,
    });
  };

  const handleStartEdit = (abbr: string, full: string) => {
    setEditingKey(abbr);
    setEditAbbr(abbr);
    setEditFull(full);
  };

  const handleConfirmEdit = () => {
    if (!editAbbr.trim() || !editFull.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha a abreviatura e o termo completo.",
        variant: "destructive"
      });
      return;
    }

    updateAbbreviation(editingKey!, editAbbr, editFull);
    setEditingKey(null);
    toast({
      title: "Abreviatura atualizada",
    });
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
    setEditAbbr('');
    setEditFull('');
  };

  const handleSave = async () => {
    await saveAbbreviations(abbreviations);
  };

  const handleExport = () => {
    const data = exportAbbreviations();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `abreviacoes_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Exportação concluída",
      description: `${Object.keys(data).length} abreviações exportadas.`,
    });
  };

  const handleImport = () => {
    try {
      const data = JSON.parse(importText);
      
      if (typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Formato inválido');
      }

      // Validate all entries are string -> string
      for (const [key, value] of Object.entries(data)) {
        if (typeof key !== 'string' || typeof value !== 'string') {
          throw new Error(`Entrada inválida: ${key}`);
        }
      }

      const count = importAbbreviations(data as Record<string, string>, false);
      setShowImportDialog(false);
      setImportText('');
      
      toast({
        title: "Importação concluída",
        description: `${count} abreviações importadas e mescladas.`,
      });
    } catch (err) {
      toast({
        title: "Erro na importação",
        description: "JSON inválido. Use o formato: {\"abbr\": \"termo completo\"}",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Carregando abreviações...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Biblioteca de Abreviações</h2>
          <p className="text-muted-foreground">
            Gerencie suas substituições automáticas personalizadas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <Badge variant="outline" className="text-success border-success/50">
              <Cloud className="h-3 w-3 mr-1" />
              Sincronizado
            </Badge>
          ) : (
            <Badge variant="outline" className="text-warning border-warning/50">
              <CloudOff className="h-3 w-3 mr-1" />
              Local
            </Badge>
          )}
          <Badge variant="secondary">
            {Object.keys(abbreviations).length} itens
          </Badge>
        </div>
      </div>

      {/* Aviso de alterações não salvas */}
      {hasChanges && (
        <div className="flex items-center gap-3 p-3 bg-warning/10 border border-warning/30 rounded-lg">
          <AlertCircle className="h-4 w-4 text-warning" />
          <span className="text-sm text-warning flex-1">
            Você tem alterações não salvas.
          </span>
          <Button 
            size="sm" 
            onClick={handleSave} 
            disabled={saving || !isLoggedIn}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Salvar Agora
          </Button>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Adicionar nova */}
        <div className="space-y-4">
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 space-y-4">
            <h3 className="font-semibold text-foreground">Adicionar Nova</h3>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Abreviatura</label>
              <Input
                value={newAbbr}
                onChange={(e) => setNewAbbr(e.target.value)}
                placeholder="Ex: un, cx, pct"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Termo Completo</label>
              <Input
                value={newFull}
                onChange={(e) => setNewFull(e.target.value)}
                placeholder="Ex: unidade, caixa, pacote"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <Button onClick={handleAdd} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>

          {/* Ações */}
          <div className="p-4 bg-muted/50 rounded-lg border border-border space-y-3">
            <h3 className="font-semibold text-foreground">Ações</h3>
            
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={handleSave}
              disabled={saving || !hasChanges || !isLoggedIn}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar na Nuvem
            </Button>

            <Button variant="outline" className="w-full" onClick={mergeWithDefaults}>
              <Merge className="h-4 w-4 mr-2" />
              Mesclar com Padrão BLING
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restaurar Padrões
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Restaurar padrões?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso irá substituir todas as suas abreviações personalizadas 
                    pelos padrões do sistema BLING.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={resetToDefaults}>
                    Restaurar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div className="flex gap-2">
              <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex-1">
                    <Upload className="h-4 w-4 mr-1" />
                    Importar
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Importar Abreviações</DialogTitle>
                    <DialogDescription>
                      Cole o JSON com suas abreviações no formato: {`{"abbr": "termo"}`}
                    </DialogDescription>
                  </DialogHeader>
                  <Textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder='{"un": "unidade", "cx": "caixa"}'
                    className="min-h-[200px] font-mono text-sm"
                  />
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowImportDialog(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleImport}>
                      Importar e Mesclar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button variant="outline" className="flex-1" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" />
                Exportar
              </Button>
            </div>
          </div>

          {/* Info */}
          <div className="p-4 bg-muted/30 rounded-lg border border-border">
            <h4 className="font-medium text-foreground mb-2">💡 Como funciona?</h4>
            <p className="text-sm text-muted-foreground">
              As abreviações são usadas automaticamente na aba "Corrigir Texto" 
              para expandir termos abreviados em seus produtos.
            </p>
          </div>
        </div>

        {/* Lista de abreviações */}
        <div className="lg:col-span-2 space-y-4">
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar abreviatura ou termo..."
              className="pl-10"
            />
          </div>

          {/* Lista */}
          <ScrollArea className="h-[500px] border rounded-lg">
            <div className="divide-y">
              {sortedAbbreviations.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  {searchTerm ? (
                    <p>Nenhuma abreviatura encontrada para "{searchTerm}".</p>
                  ) : (
                    <>
                      <p>Nenhuma abreviatura cadastrada.</p>
                      <p className="text-sm mt-2">
                        Adicione uma nova ou restaure os padrões BLING.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                sortedAbbreviations.map(([abbr, full]) => (
                  <div
                    key={abbr}
                    className="p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors"
                  >
                    {editingKey === abbr ? (
                      // Modo edição
                      <>
                        <Input
                          value={editAbbr}
                          onChange={(e) => setEditAbbr(e.target.value)}
                          className="w-24 font-mono"
                          autoFocus
                        />
                        <span className="text-muted-foreground">→</span>
                        <Input
                          value={editFull}
                          onChange={(e) => setEditFull(e.target.value)}
                          className="flex-1"
                        />
                        <Button size="sm" onClick={handleConfirmEdit}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      // Modo visualização
                      <>
                        <Badge variant="secondary" className="font-mono min-w-[60px] justify-center">
                          {abbr}
                        </Badge>
                        <span className="text-muted-foreground">→</span>
                        <span className="flex-1 text-foreground">{full}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStartEdit(abbr, full)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removeAbbreviation(abbr)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Contador */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Mostrando {sortedAbbreviations.length} de {Object.keys(abbreviations).length} abreviações
            </span>
            {searchTerm && (
              <Button variant="ghost" size="sm" onClick={() => setSearchTerm('')}>
                Limpar busca
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UltraDataAbbreviations;
