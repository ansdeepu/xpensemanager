// A simplified function to apply a unified diff.
// This implementation is for demonstration purposes and may have limitations
// with complex patches. It's designed to work with the diffs generated
// by the AI in this application.

export function applyDiff(original: string, patch: string): string | null {
  if (!patch || !patch.trim()) {
    return original;
  }
  
  if (!patch.startsWith('---') || !patch.includes('+++')) {
    console.error('Invalid patch format: header missing');
    return null; // Invalid patch format
  }

  const originalLines = original.split('\n');
  const patchLines = patch.split('\n');
  
  const newContentLines: string[] = [];
  let originalLineIndex = 0;
  let patchLineIndex = 0;

  // Skip header
  while (patchLineIndex < patchLines.length && !patchLines[patchLineIndex].startsWith('@@')) {
    patchLineIndex++;
  }

  while (patchLineIndex < patchLines.length) {
    const hunkHeader = patchLines[patchLineIndex];
    if (!hunkHeader.startsWith('@@')) {
        patchLineIndex++;
        continue;
    }
    
    const match = /@@ -(\d+),(\d+) \+(\d+),(\d+) @@/.exec(hunkHeader);
    if (!match) {
      console.error('Invalid hunk header:', hunkHeader);
      patchLineIndex++;
      continue;
    }

    const originalStartLine = parseInt(match[1], 10);

    // Add lines before the current hunk from the original file
    while (originalLineIndex < originalStartLine - 1) {
      if (originalLineIndex < originalLines.length) {
        newContentLines.push(originalLines[originalLineIndex]);
      }
      originalLineIndex++;
    }
    patchLineIndex++; // Move to the first line of the hunk content

    // Process hunk content
    while (patchLineIndex < patchLines.length && !patchLines[patchLineIndex].startsWith('@@')) {
      const line = patchLines[patchLineIndex];
      if (line.startsWith('+')) {
        newContentLines.push(line.substring(1));
      } else if (line.startsWith('-')) {
        originalLineIndex++;
      } else { // context line
        if (originalLineIndex < originalLines.length) {
          // In some cases, the context line from the patch might be what we want
          newContentLines.push(line.substring(1));
        }
        originalLineIndex++;
      }
      patchLineIndex++;
    }
  }

  // Add remaining lines from the original file
  while (originalLineIndex < originalLines.length) {
    newContentLines.push(originalLines[originalLineIndex]);
    originalLineIndex++;
  }

  return newContentLines.join('\n');
}
