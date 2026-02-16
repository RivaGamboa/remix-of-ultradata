import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface ColumnConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allColumns: string[];
  visibleColumns: string[];
  onToggleColumn: (col: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export function ColumnConfigModal({
  open,
  onOpenChange,
  allColumns,
  visibleColumns,
  onToggleColumn,
  onSelectAll,
  onDeselectAll,
}: ColumnConfigModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Colunas Visíveis</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 mb-4">
          <Button variant="outline" size="sm" onClick={onSelectAll}>Marcar todas</Button>
          <Button variant="outline" size="sm" onClick={onDeselectAll}>Desmarcar todas</Button>
        </div>
        <div className="space-y-3">
          {allColumns.map((col) => (
            <div key={col} className="flex items-center gap-3">
              <Checkbox
                id={`col-${col}`}
                checked={visibleColumns.includes(col)}
                onCheckedChange={() => onToggleColumn(col)}
              />
              <Label htmlFor={`col-${col}`} className="text-sm cursor-pointer">
                {col}
              </Label>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
