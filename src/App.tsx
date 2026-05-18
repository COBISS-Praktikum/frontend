import { useTranslation } from 'react-i18next';
import { Routes, Route, useLocation } from 'react-router-dom';
import SearchPage from './pages/SearchPage.tsx';
import GraphPage from './pages/GraphPage.tsx';
import { Header } from './components/layout/Header.tsx';
import { Footer } from './components/layout/Footer.tsx';
import './App.css'

function App() {
  const { t } = useTranslation();
  const location = useLocation();
  const isGraphRoute = location.pathname.startsWith('/frontend/graph/');

  return (
      <div className="app-layout">
        <Header />

        {/* Main Content */}
        <main className={`app-main ${isGraphRoute ? 'app-main--graph' : ''}`}>
          <Routes>
            <Route path="/frontend/" element={<SearchPage />} />
            <Route path="/frontend/graph/:uri" element={<GraphPage />} />
          </Routes>
        </main>

        {!isGraphRoute && (
          <section id="features" className="features-section">
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

              <div id="about" className="description-box">
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
        )}

        {!isGraphRoute && <Footer />}
      </div>
  )
}

export default App