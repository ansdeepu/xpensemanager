'use client';

import { useState } from 'react';
import { AppFile } from '@/lib/types';
import { mockFiles } from '@/lib/mock-data';
import { FileExplorer } from '@/components/file-explorer';
import { EditorPane } from '@/components/editor-pane';
import { AiPanel } from '@/components/ai-panel';
import { DiffViewer } from '@/components/diff-viewer';
import { getAiSuggestions } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Header } from '@/components/header';
import { Separator } from '@/components/ui/separator';
import { applyDiff } from '@/lib/apply-diff';

export default function Home() {
  const [files, setFiles] = useState<AppFile[]>(mockFiles);
  const [openFileIds, setOpenFileIds] = useState<string[]>([mockFiles[0].id]);
  const [activeFileId, setActiveFileId] = useState<string>(mockFiles[0].id);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [diffs, setDiffs] = useState<{ fileId: string; diff: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const { toast } = useToast();

  const openFiles = openFileIds
    .map((id) => files.find((f) => f.id === id))
    .filter((f): f is AppFile => !!f);

  const handleOpenFile = (fileId: string) => {
    if (!openFileIds.includes(fileId)) {
      setOpenFileIds([...openFileIds, fileId]);
    }
    setActiveFileId(fileId);
  };

  const handleCloseFile = (fileId: string) => {
    const newOpenFileIds = openFileIds.filter((id) => id !== fileId);
    setOpenFileIds(newOpenFileIds);
    if (activeFileId === fileId) {
      setActiveFileId(newOpenFileIds[0] || '');
    }
  };

  const handleSelectFile = (fileId: string, isSelected: boolean) => {
    const newSelectedFileIds = new Set(selectedFileIds);
    if (isSelected) {
      newSelectedFileIds.add(fileId);
    } else {
      newSelectedFileIds.delete(fileId);
    }
    setSelectedFileIds(newSelectedFileIds);
  };

  const handleGenerateDiffs = async (instructions: string) => {
    const selectedFiles = files.filter((file) => selectedFileIds.has(file.id));
    if (selectedFiles.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No files selected',
        description: 'Please select at least one file to get AI suggestions.',
      });
      return;
    }
    
    setIsLoading(true);
    setDiffs([]);
    const result = await getAiSuggestions(selectedFiles, instructions);
    setIsLoading(false);

    if (result.error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.error,
      });
    } else if (result.diffs) {
      const newDiffs = selectedFiles.map((file, index) => ({
        fileId: file.id,
        diff: result.diffs![index] || 'No changes suggested for this file.',
      }));
      setDiffs(newDiffs);
      toast({
        title: 'Success',
        description: 'AI suggestions have been generated.',
      });
    }
  };
  
  const handleApplyDiff = (fileId: string) => {
    const fileToUpdate = files.find((f) => f.id === fileId);
    const diffInfo = diffs.find((d) => d.fileId === fileId);

    if (!fileToUpdate || !diffInfo?.diff) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not find file or diff to apply.',
      });
      return;
    }

    const newContent = applyDiff(fileToUpdate.content, diffInfo.diff);

    if (newContent === null) {
      toast({
        variant: 'destructive',
        title: 'Failed to apply changes',
        description: 'The generated diff could not be applied automatically.',
      });
      return;
    }

    setFiles(
      files.map((f) => (f.id === fileId ? { ...f, content: newContent } : f))
    );
    
    // Remove the diff after applying
    setDiffs(diffs.filter(d => d.fileId !== fileId));

    toast({
      title: 'Changes Applied',
      description: `The suggested changes have been applied to ${fileToUpdate.name}.`,
    });
  };

  const activeDiff = diffs.find((d) => d.fileId === activeFileId);
  const activeFile = files.find((f) => f.id === activeFileId);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground font-sans">
      <Header />
      <Separator />
      <ResizablePanelGroup direction="horizontal" className="flex-grow">
        <ResizablePanel defaultSize={15} minSize={10} className="min-w-[200px]">
          <FileExplorer
            files={files}
            selectedFileIds={selectedFileIds}
            onOpenFile={handleOpenFile}
            onSelectFile={handleSelectFile}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={55} minSize={30}>
          <EditorPane
            openFiles={openFiles}
            activeFileId={activeFileId}
            onActiveFileChange={setActiveFileId}
            onCloseFile={handleCloseFile}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={30} minSize={20} className="min-w-[300px]">
          <ResizablePanelGroup direction="vertical">
            <ResizablePanel defaultSize={40} minSize={20}>
              <AiPanel onGenerate={handleGenerateDiffs} isLoading={isLoading} />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={60} minSize={20}>
              <DiffViewer diff={activeDiff?.diff} file={activeFile} onApplyDiff={handleApplyDiff} />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
