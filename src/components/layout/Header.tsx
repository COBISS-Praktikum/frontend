import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe } from 'lucide-react';
export function Header() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };
  const handleTitleClick = () => {
    navigate('/frontend/');
  };
  const handleSectionClick = (sectionId: string) => {
    // If on graph page, navigate to home first, then scroll to section
    if (location.pathname.startsWith('/frontend/graph/')) {
      navigate('/frontend/');
      setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    } else {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-slate-900/40 border-b border-slate-800 py-3 px-6 transition-all duration-300">
      <div className="flex justify-between items-center max-w-7xl mx-auto h-12">
        <h1
          className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-blue-400 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={handleTitleClick}
        >
          {t('headerTitle', 'SGC Navigator')}
        </h1>
        <div className="flex items-center gap-6">
          <nav className="hidden md:flex gap-6 text-sm font-medium">
            <button
              type="button"
              onClick={() => handleSectionClick('about')}
              className="text-slate-400 hover:text-teal-400 transition-colors"
            >
              {t('navAbout', 'About')}
            </button>
            <button
              type="button"
              onClick={() => handleSectionClick('features')}
              className="text-slate-400 hover:text-teal-400 transition-colors"
            >
              {t('navFeatures', 'Features')}
            </button>
          </nav>
          <div className="language-selector pl-2 border-l border-slate-700">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-800/50 w-10 h-10 border border-transparent hover:border-slate-700/50">
                  <Globe className="h-5 w-5 text-slate-300" />
                  <span className="sr-only">Select language</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl shadow-lg border border-slate-800 bg-slate-950 text-slate-200">
                <DropdownMenuItem onClick={() => changeLanguage('en')} className="cursor-pointer rounded-lg hover:bg-teal-500/10 hover:text-teal-300 focus:bg-teal-500/10 focus:text-teal-300">
                  English (En)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage('sl')} className="cursor-pointer rounded-lg hover:bg-teal-500/10 hover:text-teal-300 focus:bg-teal-500/10 focus:text-teal-300">
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
