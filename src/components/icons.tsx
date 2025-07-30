import { FileCode2, FileCss, Braces, FileText } from 'lucide-react';
import type { AppFile } from '@/lib/types';

export const getFileIcon = (language: AppFile['language']) => {
  switch (language) {
    case 'typescript':
      return <FileCode2 className="h-4 w-4 text-blue-400" />;
    case 'css':
      return <FileCss className="h-4 w-4 text-purple-400" />;
    case 'json':
      return <Braces className="h-4 w-4 text-orange-400" />;
    default:
      return <FileText className="h-4 w-4 text-gray-400" />;
  }
};
