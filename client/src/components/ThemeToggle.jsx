import { useTheme } from '../context/ThemeContext';
import { SunIcon, MoonIcon } from './icons';

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
    >
      {isDark ? <SunIcon className="text-lg" /> : <MoonIcon className="text-lg" />}
    </button>
  );
}
