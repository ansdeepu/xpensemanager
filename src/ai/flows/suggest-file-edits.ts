'use server';

/**
 * @fileOverview A file edit suggestion AI agent.
 *
 * - suggestFileEdits - A function that suggests edits to files based on user instructions.
 * - SuggestFileEditsInput - The input type for the suggestFileEdits function.
 * - SuggestFileEditsOutput - The return type for the suggestFileEdits function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestFileEditsInputSchema = z.object({
  fileContents: z.array(z.string()).describe('The contents of the files to edit.'),
  instructions: z.string().describe('The instructions for the edits.'),
});
export type SuggestFileEditsInput = z.infer<typeof SuggestFileEditsInputSchema>;

const SuggestFileEditsOutputSchema = z.object({
  diffs: z.array(z.string()).describe('The unified diffs for the suggested edits.'),
});
export type SuggestFileEditsOutput = z.infer<typeof SuggestFileEditsOutputSchema>;

export async function suggestFileEdits(input: SuggestFileEditsInput): Promise<SuggestFileEditsOutput> {
  return suggestFileEditsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestFileEditsPrompt',
  input: {schema: SuggestFileEditsInputSchema},
  output: {schema: SuggestFileEditsOutputSchema},
  prompt: `You are an AI expert at modifying code. You will receive the contents of one or more files, and a set of instructions on how to modify them. You will generate a set of unified diffs that represent the suggested edits. Do not include any explanation, just the unified diffs.\n\nFiles:\n{{#each fileContents}}- {{{this}}}\n{{/each}}\n\nInstructions: {{{instructions}}}`,
});

const suggestFileEditsFlow = ai.defineFlow(
  {
    name: 'suggestFileEditsFlow',
    inputSchema: SuggestFileEditsInputSchema,
    outputSchema: SuggestFileEditsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
