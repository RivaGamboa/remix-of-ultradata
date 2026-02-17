import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CanonicalTagsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  productId: string;
  productName: string;
}

export function CanonicalTagsModal({ open, onOpenChange, connectionId, productId, productName }: CanonicalTagsModalProps) {
  const { toast } = useToast();
  const [tags, setTags] = useState<{ id: string; tag: string; tipo: string }[]>([]);
  const [newTag, setNewTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from('produto_tags')
      .select('id, tag, tipo')
      .eq('connection_id', connectionId)
      .eq('produto_id', productId)
      .then(({ data, error }) => {
        if (!error && data) setTags(data);
        setLoading(false);
      });
  }, [open, connectionId, productId]);

  const handleAddTag = async () => {
    if (!newTag.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('produto_tags')
      .insert({ connection_id: connectionId, produto_id: productId, tag: newTag.trim().toLowerCase(), user_id: user.id })
      .select('id, tag, tipo')
      .single();

    if (error) {
      toast({ title: 'Erro ao adicionar tag', description: error.message, variant: 'destructive' });
    } else if (data) {
      setTags(prev => [...prev, data]);
      setNewTag('');
    }
    setSaving(false);
  };

  const handleRemoveTag = async (tagId: string) => {
    const { error } = await supabase.from('produto_tags').delete().eq('id', tagId);
    if (!error) {
      setTags(prev => prev.filter(t => t.id !== tagId));
    }
  };

  const handleGenerateAI = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-tags', {
        body: { productName, existingTags: tags.map(t => t.tag).join(', '), count: 5 },
      });
      if (error) throw error;
      if (data?.tags) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        for (const tag of data.tags) {
          if (tags.some(t => t.tag === tag)) continue;
          const { data: inserted } = await supabase
            .from('produto_tags')
            .insert({ connection_id: connectionId, produto_id: productId, tag, user_id: user.id })
            .select('id, tag, tipo')
            .single();
          if (inserted) setTags(prev => [...prev, inserted]);
        }
        toast({ title: '✅ Tags geradas por IA', description: `${data.tags.length} tags sugeridas.` });
      }
    } catch (err: any) {
      toast({ title: 'Erro ao gerar tags', description: err.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tags canônicas</DialogTitle>
          <DialogDescription className="truncate">{productName}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-4">
            {/* Existing tags */}
            <div className="flex flex-wrap gap-2 min-h-[40px]">
              {tags.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma tag atribuída.</p>}
              {tags.map(t => (
                <Badge key={t.id} variant="secondary" className="pl-3 pr-1 py-1 gap-1">
                  {t.tag}
                  <button onClick={() => handleRemoveTag(t.id)} className="ml-1 rounded-full p-0.5 hover:bg-foreground/10">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>

            {/* Add tag */}
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                placeholder="Nova tag..."
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
              />
              <Button size="sm" onClick={handleAddTag} disabled={saving || !newTag.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* AI generate */}
            <Button variant="outline" size="sm" onClick={handleGenerateAI} disabled={generating} className="w-full gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Sugerir tags com IA
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
