import {useEffect, useState} from 'react';
import {logger} from '@/utils';
import type {ImportFormatDefinition} from '@/types';
import {
    deleteFormat,
    duplicateFormat,
    exportFormatAsJSON,
    getAllFormats,
    importFormatFromJSON,
    renameFormat,
    setDefaultFormat
} from '@/services/formatManager.ts';
import FormatWizardMain from '../../ImportWizard/FormatWizard/FormatWizardMain';
import {useConfirm} from "@/components/ui/confirm-provider";
import {useToast} from "@/hooks/use-toast";
import {Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button.tsx";

export default function FormatManager() {
  const [formats, setFormats] = useState<ImportFormatDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit/Create state
  const [editingFormat, setEditingFormat] = useState<ImportFormatDefinition | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardFile, setWizardFile] = useState<File | null>(null);

  // Action states
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Duplicate state
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [duplicateName, setDuplicateName] = useState('');

  const { confirm } = useConfirm();
  const { toast } = useToast();

  useEffect(() => {
    loadFormats();
  }, []);

  const loadFormats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const allFormats = await getAllFormats();
      setFormats(allFormats);
    } catch (err) {
      logger.error('Load formats error:', err);
      setError('Failed to load formats');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (await confirm({
      title: 'Delete Format',
      description: 'Are you sure you want to delete this format?',
      confirmText: 'Delete',
      variant: 'destructive'
    })) {
      try {
        await deleteFormat(id);
        await loadFormats();
        toast({ title: "Success", description: "Format deleted successfully" });
      } catch (err) {
        toast({
          title: "Error",
          description: err instanceof Error ? err.message : 'Failed to delete format',
          variant: "destructive"
        });
      }
    }
  };

  const handleDuplicateClick = (id: string) => {
    const originalName = formats.find(f => f.id === id)?.name;
    setDuplicateId(id);
    setDuplicateName(`${originalName} (Copy)`);
  };

  const handleDuplicateSubmit = async () => {
    if (!duplicateId || !duplicateName) return;

    try {
      await duplicateFormat(duplicateId, duplicateName);
      await loadFormats();
      setDuplicateId(null);
      toast({ title: "Success", description: "Format duplicated successfully" });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to duplicate format',
        variant: "destructive"
      });
    }
  };

  const handleStartRename = (format: ImportFormatDefinition) => {
    setRenamingId(format.id);
    setRenameValue(format.name);
  };

  const handleFinishRename = async (id: string) => {
    if (!renameValue.trim() || renameValue === formats.find(f => f.id === id)?.name) {
      setRenamingId(null);
      return;
    }

    try {
      await renameFormat(id, renameValue.trim());
      await loadFormats();
      setRenamingId(null);
      toast({ title: "Success", description: "Format renamed successfully" });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to rename format',
        variant: "destructive"
      });
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await setDefaultFormat(id);
      await loadFormats();
      toast({ title: "Success", description: "Default format updated" });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to set default format',
        variant: "destructive"
      });
    }
  };

  const handleEdit = (format: ImportFormatDefinition) => {
    // For editing, we need a sample file - prompt user to upload one
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setEditingFormat(format);
        setWizardFile(file);
        setShowWizard(true);
      }
    };
    input.click();
  };

  const handleExport = (format: ImportFormatDefinition) => {
    const json = exportFormatAsJSON(format);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${format.name.replaceAll(/[^a-z0-9]/gi, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        await importFormatFromJSON(text);
        await loadFormats();
        toast({ title: "Success", description: "Format imported successfully" });
      } catch (err) {
        toast({
          title: "Error",
          description: err instanceof Error ? err.message : 'Failed to import format',
          variant: "destructive"
        });
      }
    };
    input.click();
  };

  const handleWizardComplete = async () => {
    setShowWizard(false);
    setEditingFormat(null);
    setWizardFile(null);
    await loadFormats();
  };

  if (showWizard && wizardFile) {
    return (
      <FormatWizardMain
        file={wizardFile}
        existingFormat={editingFormat || undefined}
        onComplete={handleWizardComplete}
        onCancel={() => {
          setShowWizard(false);
          setEditingFormat(null);
          setWizardFile(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Import Format Manager</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage your custom CSV import formats
          </p>
        </div>

        <button
          onClick={handleImport}
          className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-300 rounded-md hover:bg-blue-100"
        >
          Import Format (JSON)
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading formats...</p>
        </div>
      )}

      {/* Formats Table */}
      {!isLoading && formats.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Auto-Detect
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Default
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Built-in
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {formats.map((format) => (
                <tr key={format.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {renamingId === format.id ? (
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => handleFinishRename(format.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleFinishRename(format.id);
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        autoFocus
                        className="px-2 py-1 border border-blue-500 rounded focus:outline-none"
                      />
                    ) : (
                      format.name
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {format.description || <span className="text-gray-400 italic">No description</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {format.fileType.toUpperCase()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {format.detectionPattern ? (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">
                        Yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                        No
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {format.isDefault && (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                        Default
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {format.isBuiltIn && (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                        Built-in
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm space-x-2">
                    {!format.isBuiltIn && (
                      <>
                        <button
                          onClick={() => handleEdit(format)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleStartRename(format)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Rename"
                        >
                          Rename
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDuplicateClick(format.id)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Duplicate"
                    >
                      Duplicate
                    </button>
                    {!format.isDefault && (
                      <button
                        onClick={() => handleSetDefault(format.id)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Set as Default"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      onClick={() => handleExport(format)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Export as JSON"
                    >
                      Export
                    </button>
                    {!format.isBuiltIn && (
                      <button
                        onClick={() => handleDelete(format.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* No Formats */}
      {!isLoading && formats.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No import formats found</p>
          <p className="text-sm text-gray-500 mt-2">
            Formats will be created when you use the import wizard
          </p>
        </div>
      )}

      {/* Duplicate Dialog */}
      <Dialog open={!!duplicateId} onOpenChange={(open) => !open && setDuplicateId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate Format</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={duplicateName}
              onChange={(e) => setDuplicateName(e.target.value)}
              placeholder="Format Name"
              onKeyDown={(e) => e.key === 'Enter' && handleDuplicateSubmit()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateId(null)}>Cancel</Button>
            <Button onClick={handleDuplicateSubmit}>Duplicate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
