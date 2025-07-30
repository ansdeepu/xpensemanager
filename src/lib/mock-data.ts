import { AppFile } from './types';

export const mockFiles: AppFile[] = [
  {
    id: '1',
    name: 'button.tsx',
    language: 'typescript',
    content: `import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

const Button: React.FC<ButtonProps> = ({ children, onClick, variant = 'primary' }) => {
  const baseStyle = "px-4 py-2 rounded font-semibold";
  const variantStyle = variant === 'primary' 
    ? "bg-blue-500 text-white" 
    : "bg-gray-500 text-white";

  return (
    <button className={\`\${baseStyle} \${variantStyle}\`} onClick={onClick}>
      {children}
    </button>
  );
};

export default Button;
`,
  },
  {
    id: '2',
    name: 'styles.css',
    language: 'css',
    content: `body {
  font-family: sans-serif;
  margin: 0;
  padding: 20px;
  background-color: #f0f0f0;
}

.container {
  max-width: 800px;
  margin: 0 auto;
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
`,
  },
  {
    id: '3',
    name: 'package.json',
    language: 'json',
    content: `{
  "name": "file-canvas-demo",
  "version": "1.0.0",
  "description": "A demo for File Canvas",
  "main": "index.js",
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "react-scripts": "5.0.0"
  }
}
`,
  },
    {
    id: '4',
    name: 'README.md',
    language: 'plaintext',
    content: `# File Canvas Demo

This is a simple project to demonstrate the capabilities of File Canvas.

## Features
- View and edit files
- Get AI-assisted suggestions for changes
- Preview diffs

Enjoy using File Canvas!
`
  }
];
