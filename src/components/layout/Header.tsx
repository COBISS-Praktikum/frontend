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
    <header className="sticky top-0 z-50 w-full bg-white border-b border-[#dce4ec] py-3 px-6">
      <div className="flex justify-between items-center max-w-7xl mx-auto h-12">
        <button
          type="button"
          className="flex items-center gap-3 cursor-pointer group"
          onClick={handleTitleClick}
        >
          {/* Institutional block mark */}
          <span className="flex items-center" aria-hidden="true">
            <span className="block w-1.5 h-7 bg-[#004b87]" />
            <span className="block w-1.5 h-7 bg-[#00a99d]" />
          </span>
          <span className="font-heading text-2xl font-bold tracking-tight text-[#0d2436] group-hover:text-[#004b87] transition-colors">
            {t('headerTitle', 'SGC Navigator')}
          </span>
        </button>
        <div className="flex items-center gap-6">
          <nav className="hidden md:flex gap-7 text-sm font-semibold">
            <button
              type="button"
              onClick={() => handleSectionClick('about')}
              className="text-[#586a7b] hover:text-[#004b87] border-b-2 border-transparent hover:border-[#00a99d] pb-0.5 transition-colors"
            >
              {t('navAbout', 'About')}
            </button>
            <button
              type="button"
              onClick={() => handleSectionClick('features')}
              className="text-[#586a7b] hover:text-[#004b87] border-b-2 border-transparent hover:border-[#00a99d] pb-0.5 transition-colors"
            >
              {t('navFeatures', 'Features')}
            </button>
          </nav>
          <div className="language-selector pl-4 border-l border-[#dce4ec]">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-sm hover:bg-[#eaf1f8] w-10 h-10 border border-transparent hover:border-[#cdd9e5]">
                  <Globe className="h-5 w-5 text-[#004b87]" />
                  <span className="sr-only">Select language</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-sm shadow-lg border border-[#dce4ec] bg-white text-[#33485c] p-1">
                <DropdownMenuItem onClick={() => changeLanguage('en')} className="cursor-pointer rounded-sm font-medium hover:bg-[#eaf1f8] hover:text-[#004b87] focus:bg-[#eaf1f8] focus:text-[#004b87]">
                  English (En)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage('sl')} className="cursor-pointer rounded-sm font-medium hover:bg-[#eaf1f8] hover:text-[#004b87] focus:bg-[#eaf1f8] focus:text-[#004b87]">
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
