import { Lock, Unlock, Eye, Wand2, FileText, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { ConfigPresetManager } from '@/components/ConfigPresetManager';
import type { FieldConfig, ProductRow } from '@/pages/UltraData';
import type { ColumnConfig } from '@/utils/dataProcessors';

interface UltraDataFieldConfigProps {
  columns: string[];
  fieldConfigs: FieldConfig[];
  onConfigChange: (configs: FieldConfig[]) => void;
  sampleData: ProductRow[];
  onNext: () => void;
}

const UltraDataFieldConfig = ({
  columns,
  fieldConfigs,
  onConfigChange,
  sampleData,
  onNext,
}: UltraDataFieldConfigProps) => {
  const updateConfig = (column: string, updates: Partial<FieldConfig>) => {
    onConfigChange(
      fieldConfigs.map(fc =>
        fc.column === column ? { ...fc, ...updates } : fc
      )
    );
  };

  const getColumnStats = (column: string) => {
    const values = sampleData.map(row => row[column]?.toString() || '');
    const empty = values.filter(v => !v.trim()).length;
    const unique = new Set(values.filter(v => v.trim())).size;
    return { empty, unique, total: sampleData.length };
  };

  const actionLabels = {
    ignore: { label: 'Ignorar', icon: Eye, color: 'text-muted-foreground' },
    analyze: { label: 'Analisar com IA', icon: Wand2, color: 'text-primary' },
    fill_empty: { label: 'Preencher Vazios', icon: FileText, color: 'text-warning' },
    use_default: { label: 'Usar Padrão', icon: Hash, color: 'text-secondary' },
  };

  const activeConfigs = fieldConfigs.filter(fc => fc.action !== 'ignore');

  // Convert fieldConfigs to columnConfig format for preset manager
  const columnConfigForPreset: Record<string, ColumnConfig> = {};
  fieldConfigs.forEach(fc => {
    columnConfigForPreset[fc.column] = {
      action: fc.action === 'analyze' ? 'analyze' : fc.action === 'fill_empty' ? 'default_empty' : fc.action === 'use_default' ? 'default_all' : 'ignore',
      defaultValue: fc.defaultValue || '',
      isProtected: fc.isLocked,
    };
  });

  const handlePresetImport = (abbreviations: Record<string, string>, columnConfig: Record<string, ColumnConfig>) => {
    // Apply imported column config to field configs
    const updatedConfigs = fieldConfigs.map(fc => {
      const imported = columnConfig[fc.column];
      if (imported && !fc.isLocked) {
        let action: FieldConfig['action'] = 'ignore';
        if (imported.action === 'analyze') action = 'analyze';
        else if (imported.action === 'default_empty') action = 'fill_empty';
        else if (imported.action === 'default_all') action = 'use_default';
        
        return {
          ...fc,
          action,
          defaultValue: imported.defaultValue || fc.defaultValue,
        };
      }
      return fc;
    });
    onConfigChange(updatedConfigs);
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Configuração de Campos</h2>
            <p className="text-muted-foreground">
              Defina como cada coluna será tratada pelo enriquecimento com IA.
            </p>
          </div>
          <ConfigPresetManager
            abbreviations={{}}
            columnConfig={columnConfigForPreset}
            onImport={handlePresetImport}
            detectedColumns={columns}
          />
        </div>

        {/* Summary */}
        <div className="flex gap-4 flex-wrap">
          <Badge variant="secondary" className="text-sm py-1 px-3">
            {columns.length} colunas totais
          </Badge>
          <Badge variant="default" className="text-sm py-1 px-3">
            {activeConfigs.length} para processar
          </Badge>
          <Badge variant="outline" className="text-sm py-1 px-3">
            {fieldConfigs.filter(fc => fc.isLocked).length} protegidas
          </Badge>
        </div>

        {/* Config Table */}
        <div className="border rounded-lg overflow-auto max-h-[500px]">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Coluna</TableHead>
                <TableHead className="w-[180px]">Amostra</TableHead>
                <TableHead className="w-[200px]">Ação</TableHead>
                <TableHead className="w-[150px]">Valor Padrão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fieldConfigs.map((config) => {
                const stats = getColumnStats(config.column);
                const actionInfo = actionLabels[config.action];
                const ActionIcon = actionInfo.icon;
                
                return (
                  <TableRow key={config.column} className={config.isLocked ? 'bg-muted/30' : ''}>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger>
                          {config.isLocked ? (
                            <Lock className="h-4 w-4 text-warning" />
                          ) : (
                            <Unlock className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TooltipTrigger>
                        <TooltipContent>
                          {config.isLocked 
                            ? 'Campo protegido (estoque/preço)' 
                            : 'Campo editável'}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{config.column}</p>
                        <p className="text-xs text-muted-foreground">
                          {stats.empty}/{stats.total} vazios • {stats.unique} únicos
                        </p>
                      </div>
                    </TableCell>
                    
                    <TableCell className="max-w-[180px]">
                      <p className="truncate text-sm text-muted-foreground">
                        {sampleData[0]?.[config.column]?.toString() || '-'}
                      </p>
                    </TableCell>
                    
                    <TableCell>
                      <Select
                        value={config.action}
                        onValueChange={(value: FieldConfig['action']) => 
                          updateConfig(config.column, { action: value })
                        }
                        disabled={config.isLocked}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            <div className="flex items-center gap-2">
                              <ActionIcon className={`h-4 w-4 ${actionInfo.color}`} />
                              <span>{actionInfo.label}</span>
                            </div>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(actionLabels).map(([key, info]) => {
                            const Icon = info.icon;
                            return (
                              <SelectItem key={key} value={key}>
                                <div className="flex items-center gap-2">
                                  <Icon className={`h-4 w-4 ${info.color}`} />
                                  <span>{info.label}</span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    
                    <TableCell>
                      {config.action === 'use_default' && (
                        <Input
                          placeholder="Valor padrão"
                          value={config.defaultValue || ''}
                          onChange={(e) => 
                            updateConfig(config.column, { defaultValue: e.target.value })
                          }
                          className="h-9"
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            Campos com 🔒 são protegidos automaticamente (estoque, preço, custo).
          </p>
          <Button 
            onClick={onNext} 
            size="lg"
            disabled={activeConfigs.length === 0}
          >
            <Wand2 className="h-4 w-4 mr-2" />
            Iniciar Processamento IA
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default UltraDataFieldConfig;
