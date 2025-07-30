'use client';
import { ScrollArea } from './ui/scroll-area';
import { AppFile } from '@/lib/types';
import { FileText, Copy, Check, WandSparkles } from 'lucide-react';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';

interface DiffViewerProps {
  diff?: string;
  file?: AppFile;
  onApplyDiff: (fileId: string) => void;
}

export function DiffViewer({ diff, file, onApplyDiff }: DiffViewerProps) {
  const { toast } = useToast();

  const handleCopy = () => {
    if (!diff) return;
    navigator.clipboard.writeText(diff);
    toast({
      title: 'Copied to clipboard',
      description: 'The diff has been copied to your clipboard.',
    });
  };

  const renderDiff = () => {
    if (!diff) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
          <WandSparkles className="h-10 w-10 mb-4" />
          <p className="font-semibold text-lg">AI Suggestions</p>
          <p className="text-sm">
            Select files and provide instructions in the panel above. AI-suggested changes will appear here.
          </p>
        </div>
      );
    }
    if (diff.startsWith('No changes')) {
       return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
          <Check className="h-10 w-10 mb-4 text-green-500" />
          <p className="font-semibold text-lg">No Changes Suggested</p>
          <p className="text-sm">The AI did not find any changes to suggest for this file.</p>
        </div>
      );
    }


    const lines = diff.split('\n');
    return (
      <pre className="p-4 text-xs font-code">
        <code>
          {lines.map((line, index) => {
            let colorClass = '';
            if (line.startsWith('+')) {
              colorClass = 'bg-success/20';
            } else if (line.startsWith('-')) {
              colorClass = 'bg-destructive/20';
            } else if (line.startsWith('@@')) {
              colorClass = 'text-muted-foreground';
            }
            return (
              <div key={index} className={`flex ${colorClass}`}>
                <span className="w-8 text-right pr-2 select-none opacity-50">{line.startsWith('+') ? '+' : line.startsWith('-') ? '-' : ' '}</span>
                <span>{line.substring(1)}</span>
              </div>
            );
          })}
        </code>
      </pre>
    );
  };

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="flex items-center justify-between p-3 border-b border-t">
        <h2 className="text-base font-semibold flex items-center gap-2 truncate">
          <FileText className="h-4 w-4" />
          <span className="truncate">
            Preview Changes {file && <span className="font-normal text-muted-foreground ml-1">{file.name}</span>}
          </span>
        </h2>
        {diff && file && !diff.startsWith('No changes') && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
              <Copy className="h-4 w-4" />
              <span className="sr-only">Copy diff</span>
            </Button>
            <Button size="sm" className="h-7" onClick={() => onApplyDiff(file.id)}>
              <Check className="mr-1 h-4 w-4" />
              Apply
            </Button>
          </div>
        )}
      </div>
      <ScrollArea className="flex-1">{renderDiff()}</ScrollArea>
    </div>
  );
}
