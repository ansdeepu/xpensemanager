import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import type { AppFile } from '@/lib/types';

interface EditorPaneProps {
  openFiles: AppFile[];
  activeFileId: string;
  onActiveFileChange: (fileId: string) => void;
  onCloseFile: (fileId: string) => void;
}

export function EditorPane({
  openFiles,
  activeFileId,
  onActiveFileChange,
  onCloseFile,
}: EditorPaneProps) {
  if (openFiles.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Open a file to start editing.
      </div>
    );
  }

  return (
    <Tabs value={activeFileId} onValueChange={onActiveFileChange} className="h-full flex flex-col">
      <TabsList className="flex-shrink-0 justify-start rounded-none border-b bg-transparent p-0">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex">
            {openFiles.map((file) => (
              <TabsTrigger
                key={file.id}
                value={file.id}
                className="data-[state=active]:bg-muted/50 data-[state=active]:shadow-none rounded-none border-r relative group"
              >
                {file.name}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 ml-2 hidden group-hover:inline-flex"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseFile(file.id);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </TabsTrigger>
            ))}
          </div>
        </ScrollArea>
      </TabsList>
      {openFiles.map((file) => (
        <TabsContent key={file.id} value={file.id} className="flex-1 overflow-auto mt-0">
          <pre className="p-4 text-sm font-code h-full w-full outline-none">
            <code>{file.content}</code>
          </pre>
        </TabsContent>
      ))}
    </Tabs>
  );
}
