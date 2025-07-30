'use server';

import { suggestFileEdits } from '@/ai/flows/suggest-file-edits';
import type { AppFile } from '@/lib/types';

export async function getAiSuggestions(
  selectedFiles: AppFile[],
  instructions: string
): Promise<{ diffs?: string[]; error?: string }> {
  if (!instructions.trim()) {
    return { error: 'Instructions cannot be empty.' };
  }
  if (selectedFiles.length === 0) {
    return { error: 'Please select at least one file.' };
  }

  try {
    const fileContents = selectedFiles.map((file) => `File: ${file.name}\n\n${file.content}`);
    const result = await suggestFileEdits({ fileContents, instructions });
    return { diffs: result.diffs };
  } catch (e) {
    console.error(e);
    // This is a generic error message. In a real application, you might
    // want to log the error and provide more specific feedback to the user.
    return { error: 'An unexpected error occurred while generating AI suggestions.' };
  }
}
