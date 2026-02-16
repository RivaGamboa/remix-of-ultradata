import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TagFilterProps {
  tags: string[];
  onRemoveTag: (tag: string) => void;
  onClearAll: () => void;
}

const TAG_COLORS: Record<string, string> = {
  NCM: 'bg-primary/10 text-primary border-primary/20',
  CEST: 'bg-primary/10 text-primary border-primary/20',
  MARCA: 'bg-accent/10 text-accent-foreground border-accent/20',
  CATEGORIA: 'bg-accent/10 text-accent-foreground border-accent/20',
  SKU: 'bg-secondary text-secondary-foreground border-secondary',
};

function getTagColor(tag: string): string {
  const upper = tag.toUpperCase();
  return TAG_COLORS[upper] || 'bg-muted text-muted-foreground border-border';
}

export function TagFilter({ tags, onRemoveTag, onClearAll }: TagFilterProps) {
  if (tags.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {tags.map((tag) => (
        <Badge
          key={tag}
          variant="outline"
          className={cn(
            "pl-3 pr-1 py-1 gap-1 text-sm font-medium cursor-default transition-all hover:shadow-sm",
            getTagColor(tag)
          )}
        >
          {tag}
          <button
            onClick={() => onRemoveTag(tag)}
            className="ml-1 rounded-full p-0.5 hover:bg-foreground/10 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {tags.length > 1 && (
        <button
          onClick={onClearAll}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
        >
          Limpar todos
        </button>
      )}
    </div>
  );
}
