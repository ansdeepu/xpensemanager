'use client';

import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';

interface AiPanelProps {
  onGenerate: (instructions: string) => void;
  isLoading: boolean;
}

export function AiPanel({ onGenerate, isLoading }: AiPanelProps) {
  const [instructions, setInstructions] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate(instructions);
  };

  return (
    <div className="flex flex-col h-full bg-card">
      <h2 className="text-lg font-semibold p-4 border-b flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-accent" />
        AI Assisted Changes
      </h2>
      <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4 flex-1">
        <Textarea
          placeholder="e.g., 'Refactor this component to use Tailwind CSS classes instead of inline styles'"
          className="flex-1 text-sm bg-background"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={5}
        />
        <Button type="submit" disabled={isLoading || !instructions}>
          {isLoading ? 'Generating...' : 'Generate Suggestions'}
        </Button>
      </form>
    </div>
  );
}
