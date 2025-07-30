import type { AppFile } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { getFileIcon } from './icons';

interface FileExplorerProps {
  files: AppFile[];
  selectedFileIds: Set<string>;
  onOpenFile: (fileId: string) => void;
  onSelectFile: (fileId: string, isSelected: boolean) => void;
}

export function FileExplorer({ files, selectedFileIds, onOpenFile, onSelectFile }: FileExplorerProps) {
  return (
    <div className="h-full flex flex-col bg-card">
      <h2 className="text-lg font-semibold p-4 border-b">Files</h2>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {files.map((file) => (
            <div key={file.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50">
              <Checkbox
                id={`select-${file.id}`}
                checked={selectedFileIds.has(file.id)}
                onCheckedChange={(checked) => onSelectFile(file.id, !!checked)}
              />
              <div
                className="flex items-center gap-2 flex-1 cursor-pointer"
                onClick={() => onOpenFile(file.id)}
              >
                {getFileIcon(file.language)}
                <label htmlFor={`select-${file.id}`} className="text-sm cursor-pointer">
                  {file.name}
                </label>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
