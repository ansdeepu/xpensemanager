import { Code } from 'lucide-react';
import { SettingsDialog } from './settings-dialog';
import { ThemeToggle } from './theme-toggle';

export function Header() {
  return (
    <header className="flex items-center justify-between px-4 py-2 bg-card/80 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <Code className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-semibold tracking-tight">File Canvas</h1>
      </div>
      <div className="flex items-center gap-2">
        {/* SettingsDialog can be added here if needed */}
        {/* <SettingsDialog /> */}
        <ThemeToggle />
      </div>
    </header>
  );
}
