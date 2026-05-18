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
    <header className="app-header">
      <div className="header-container">
        <h1 className="header-title" onClick={handleTitleClick} style={{ cursor: 'pointer' }}>{t('headerTitle')}</h1>
        <div className="header-right">
          <nav className="header-nav">
            <button type="button" onClick={() => handleSectionClick('about')}>
              {t('navAbout')}
            </button>
            <button type="button" onClick={() => handleSectionClick('features')}>
              {t('navFeatures')}
            </button>
          </nav>
          <div className="language-selector">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <Globe className="h-[1.2rem] w-[1.2rem]" />
                  <span className="sr-only">Select language</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => changeLanguage('en')}>
                  English (En)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage('sl')}>
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

