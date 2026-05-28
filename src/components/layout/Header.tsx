import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Globe } from 'lucide-react'

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
      // Use setTimeout to allow navigation to complete before scrolling
      setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    } else {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <header style={{ backgroundColor: '#005f73' }} className="sticky top-0 z-50 w-full border-b border-white/20 shadow-sm py-3 px-6 transition-all duration-300">
      <div className="flex justify-between items-center max-w-7xl mx-auto h-12">
        <h1
          className="text-2xl font-bold text-white cursor-pointer hover:opacity-80 transition-opacity"
          onClick={handleTitleClick}
        >
          {t('headerTitle')}
        </h1>
        <div className="flex items-center gap-6">
          <nav className="hidden md:flex gap-6 text-sm font-medium">
            <button
              type="button"
              onClick={() => handleSectionClick('about')}
              className="text-white/70 hover:text-white transition-colors"
            >
              {t('navAbout')}
            </button>
            <button
              type="button"
              onClick={() => handleSectionClick('features')}
              className="text-white/70 hover:text-white transition-colors"
            >
              {t('navFeatures')}
            </button>
          </nav>
          <div className="language-selector pl-2 border-l border-white/20">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/10 w-10 h-10">
                  <Globe className="h-[1.2rem] w-[1.2rem] text-white" />
                  <span className="sr-only">Select language</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl shadow-lg border-border">
                <DropdownMenuItem onClick={() => changeLanguage('en')} className="cursor-pointer rounded-lg">
                  English (En)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage('sl')} className="cursor-pointer rounded-lg">
                  Slovenščina (SL)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  )
}
