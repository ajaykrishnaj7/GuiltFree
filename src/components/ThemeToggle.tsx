'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-10 h-10 p-2.5 rounded-2xl" />;
  }

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="p-2.5 rounded-2xl transition-all active:scale-95 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center justify-center relative overflow-hidden"
      title="Toggle theme"
    >
      <Sun className="h-5 w-5 transition-all dark:-rotate-90 dark:opacity-0" />
      <Moon className="absolute h-5 w-5 rotate-90 opacity-0 transition-all dark:rotate-0 dark:opacity-100" />
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}
