import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme.ts';
export function Header() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };
  const handleTitleClick = () => {
    navigate('/frontend/');
  };
  return (
    <header className="sticky top-0 z-50 w-full bg-[var(--surface)] border-b border-[var(--line)] py-3 px-6">
      <div className="flex justify-between items-center max-w-7xl mx-auto h-12">
        <button
          type="button"
          className="flex items-center gap-3 cursor-pointer group"
          onClick={handleTitleClick}
        >
          {/* Institutional block mark */}
          <span className="flex items-center" aria-hidden="true">
            <span className="block w-1.5 h-7 bg-[var(--brand-navy)]" />
            <span className="block w-1.5 h-7 bg-[var(--brand-teal)]" />
          </span>
          <span className="font-heading text-2xl font-bold tracking-tight text-[var(--ink-strong)] group-hover:text-[var(--brand-navy)] transition-colors">
            {t('headerTitle', 'SGC Navigator')}
          </span>
        </button>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={isDark ? t('switchToLight', 'Switch to light mode') : t('switchToDark', 'Switch to dark mode')}
            title={isDark ? t('switchToLight', 'Switch to light mode') : t('switchToDark', 'Switch to dark mode')}
            className="rounded-sm hover:bg-[var(--tint-navy)] w-10 h-10 border border-transparent hover:border-[var(--line-strong)]"
          >
            {isDark ? (
              <Sun className="h-5 w-5 text-[var(--brand-teal-strong)]" />
            ) : (
              <Moon className="h-5 w-5 text-[var(--brand-navy)]" />
            )}
          </Button>
          <div className="language-selector pl-2 border-l border-[var(--line)]">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-sm hover:bg-[var(--tint-navy)] w-10 h-10 border border-transparent hover:border-[var(--line-strong)]">
                  <Globe className="h-5 w-5 text-[var(--brand-navy)]" />
                  <span className="sr-only">Select language</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-sm shadow-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)] p-1">
                <DropdownMenuItem onClick={() => changeLanguage('en')} className="cursor-pointer rounded-sm font-medium hover:bg-[var(--tint-navy)] hover:text-[var(--brand-navy)] focus:bg-[var(--tint-navy)] focus:text-[var(--brand-navy)]">
                  English (En)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage('sl')} className="cursor-pointer rounded-sm font-medium hover:bg-[var(--tint-navy)] hover:text-[var(--brand-navy)] focus:bg-[var(--tint-navy)] focus:text-[var(--brand-navy)]">
                  Slovenščina (SL)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
