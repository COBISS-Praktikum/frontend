import { useState } from 'react'
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Globe } from 'lucide-react'
import './App.css'

function App() {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('')

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="app-header">
        <div className="header-container">
          <h1 className="header-title">{t('headerTitle')}</h1>
          <nav className="header-nav">
            <a href="#home">{t('navHome')}</a>
            <a href="#about">{t('navAbout')}</a>
            <a href="#features">{t('navFeatures')}</a>
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
      </header>

      {/* Main Content */}
      <main className="app-main">
        {/* Hero Section with Search */}
        <section className="hero-section">
          <div className="hero-content">
            <h2 className="hero-title">{t('heroTitle')}</h2>
            <p className="hero-subtitle">
              {t('heroSubtitle')}
            </p>

            {/* Search Bar */}
            <div className="search-container">
              <div className="search-wrapper">
                <Input
                  type="text"
                  placeholder={t('searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
                <Button className="search-button">{t('searchButton')}</Button>
              </div>
            </div>
          </div>
        </section>

        {/* Features / App Explanation */}
        <section className="features-section">
          <div className="features-container">
            <h3 className="section-title">{t('featuresTitle')}</h3>
            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-icon">🔍</div>
                <h4>{t('feature1Title')}</h4>
                <p>
                  {t('feature1Desc')}
                </p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">📊</div>
                <h4>{t('feature2Title')}</h4>
                <p>
                  {t('feature2Desc')}
                </p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">🌳</div>
                <h4>{t('feature3Title')}</h4>
                <p>
                  {t('feature3Desc')}
                </p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">🌐</div>
                <h4>{t('feature4Title')}</h4>
                <p>
                  {t('feature4Desc')}
                </p>
              </div>
            </div>

            <div className="description-box">
              <h4>{t('aboutTitle')}</h4>
              <p>
                {t('aboutDesc')}
              </p>
              <h5 className="description-subheading">{t('designedFor')}</h5>
              <ul className="description-list">
                <li>{t('designedFor1')}</li>
                <li>{t('designedFor2')}</li>
                <li>{t('designedFor3')}</li>
                <li>{t('designedFor4')}</li>
              </ul>
              <h5 className="description-subheading">{t('whatYouCan')}</h5>
              <ul className="description-list">
                <li>{t('whatYouCan1')}</li>
                <li>{t('whatYouCan2')}</li>
                <li>{t('whatYouCan3')}</li>
                <li>{t('whatYouCan4')}</li>
                <li>{t('whatYouCan5')}</li>
              </ul>
              <p className="description-cta">
                {t('ctaText')}
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-container">
          <div className="footer-content">
            <p>{t('footerCopyright')}</p>
            <div className="footer-links">
              <a href="#privacy">{t('footerPrivacy')}</a>
              <a href="#terms">{t('footerTerms')}</a>
              <a href="#contact">{t('footerContact')}</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
