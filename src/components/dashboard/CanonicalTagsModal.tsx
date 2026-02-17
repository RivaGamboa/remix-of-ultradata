import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Plus, Loader2, Sparkles, Check, Tag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const TAG_TYPES = [
  { value: 'geral', label: 'Geral', color: 'bg-secondary text-secondary-foreground' },
  { value: 'categoria', label: 'Categoria', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  { value: 'marca', label: 'Marca', color: 'bg-purple-500/15 text-purple-700 dark:text-purple-400' },
  { value: 'material', label: 'Material', color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  { value: 'seo', label: 'SEO', color: 'bg-green-500/15 text-green-700 dark:text-green-400' },
];

interface CanonicalTag {
  id: string;
  tag: string;
  tipo: string;
}

interface CanonicalTagsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  productId: string;
  productName: string;
}

export function CanonicalTagsModal({ open, onOpenChange, connectionId, productId, productName }: CanonicalTagsModalProps) {
  const { toast } = useToast();
  const [tags, setTags] = useState<CanonicalTag[]>([]);
  const [newTag, setNewTag] = useState('');
  const [newTagType, setNewTagType] = useState('geral');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      setAiSuggestions([]);
      return;
    }
    setLoading(true);
    supabase
      .from('produto_tags')
      .select('id, tag, tipo')
      .eq('connection_id', connectionId)
      .eq('produto_id', productId)
      .then(({ data, error }) => {
        if (!error && data) setTags(data.map(d => ({ ...d, tipo: d.tipo || 'geral' })));
        setLoading(false);
      });
  }, [open, connectionId, productId]);

  const addTag = async (tagText: string, tipo: string) => {
    const normalized = tagText.trim().toLowerCase();
    if (!normalized || tags.some(t => t.tag === normalized)) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { data, error } = await supabase
      .from('produto_tags')
      .insert({ connection_id: connectionId, produto_id: productId, tag: normalized, tipo, user_id: user.id })
      .select('id, tag, tipo')
      .single();

    if (error) {
      toast({ title: 'Erro ao adicionar tag', description: error.message, variant: 'destructive' });
    } else if (data) {
      setTags(prev => [...prev, { ...data, tipo: data.tipo || 'geral' }]);
      setAiSuggestions(prev => prev.filter(s => s !== normalized));
    }
    setSaving(false);
  };

  const handleAddTag = async () => {
    await addTag(newTag, newTagType);
    setNewTag('');
  };

  const handleRemoveTag = async (tagId: string) => {
    const { error } = await supabase.from('produto_tags').delete().eq('id', tagId);
    if (!error) setTags(prev => prev.filter(t => t.id !== tagId));
  };

  const handleGenerateAI = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-tags', {
        body: { productName, existingTags: tags.map(t => t.tag).join(', '), count: 8 },
      });
      if (error) throw error;
      if (data?.tags) {
        const existing = new Set(tags.map(t => t.tag));
        const newSuggestions = (data.tags as string[]).filter(t => !existing.has(t));
        setAiSuggestions(newSuggestions);
        if (newSuggestions.length === 0) {
          toast({ title: 'Nenhuma sugestão nova', description: 'Todas as tags sugeridas já existem.' });
        }
      }
    } catch (err: any) {
      toast({ title: 'Erro ao gerar tags', description: err.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const getTypeConfig = (tipo: string) => TAG_TYPES.find(t => t.value === tipo) || TAG_TYPES[0];

  const groupedTags = TAG_TYPES.map(type => ({
    ...type,
    tags: tags.filter(t => t.tipo === type.value),
  })).filter(g => g.tags.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            Tags canônicas
          </DialogTitle>
          <DialogDescription className="truncate">{productName}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-4 overflow-y-auto flex-1 min-h-0">
            {/* Grouped tags */}
            {groupedTags.length === 0 && aiSuggestions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tag atribuída. Adicione manualmente ou use IA.</p>
            )}
            {groupedTags.map(group => (
              <div key={group.value} className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{group.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.tags.map(t => (
                    <Badge key={t.id} variant="outline" className={`pl-2.5 pr-1 py-1 gap-1 ${group.color}`}>
                      {t.tag}
                      <button onClick={() => handleRemoveTag(t.id)} className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            ))}

            {/* AI suggestions */}
            {aiSuggestions.length > 0 && (
              <div className="space-y-1.5 rounded-md border border-dashed border-primary/30 bg-primary/5 p-3">
                <p className="text-xs font-medium text-primary flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" /> Sugestões da IA
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {aiSuggestions.map(s => (
                    <Badge
                      key={s}
                      variant="outline"
                      className="pl-2.5 pr-1 py-1 gap-1 cursor-pointer border-primary/40 hover:bg-primary/10 transition-colors"
                      onClick={() => addTag(s, 'seo')}
                    >
                      {s}
                      <Check className="h-3 w-3 text-primary" />
                    </Badge>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 text-muted-foreground"
                  onClick={() => {
                    aiSuggestions.forEach(s => addTag(s, 'seo'));
                  }}
                  disabled={saving}
                >
                  Aceitar todas
                </Button>
              </div>
            )}

            {/* Add tag form */}
            <div className="flex gap-2 items-center">
              <Input
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                placeholder="Nova tag..."
                className="flex-1"
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
              />
              <Select value={newTagType} onValueChange={setNewTagType}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAG_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="icon" onClick={handleAddTag} disabled={saving || !newTag.trim()} className="shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={handleGenerateAI} disabled={generating} className="gap-2 w-full sm:w-auto">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Sugerir com IA
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Concluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
