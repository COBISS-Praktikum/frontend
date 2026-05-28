import { useTranslation } from 'react-i18next';
import { Routes, Route, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/frontend/" element={<SearchPage />} />
              <Route path="/frontend/graph/:uri" element={<GraphPage />} />
            </Routes>
          </AnimatePresence>
        </main>

        {!isGraphRoute && (
          <section id="features" className="features-section py-20 bg-background">
            <div className="features-container max-w-6xl mx-auto px-4">
              <motion.h3
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="section-title text-3xl font-bold text-center mb-12 text-foreground"
              >
                {t('featuresTitle')}
              </motion.h3>
              <div className="features-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { icon: '🔍', title: 'feature1Title', desc: 'feature1Desc', delay: 0.1 },
                  { icon: '📊', title: 'feature2Title', desc: 'feature2Desc', delay: 0.2 },
                  { icon: '🌳', title: 'feature3Title', desc: 'feature3Desc', delay: 0.3 },
                  { icon: '🌐', title: 'feature4Title', desc: 'feature4Desc', delay: 0.4 }
                ].map((feature, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: feature.delay }}
                    className="feature-card bg-card border border-border shadow-sm hover:shadow-md transition-shadow rounded-2xl p-6 text-center flex flex-col items-center"
                  >
                    <div className="feature-icon text-4xl mb-4 bg-muted w-16 h-16 rounded-full flex items-center justify-center">{feature.icon}</div>
                    <h4 className="text-xl font-semibold mb-2">{t(feature.title)}</h4>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {t(feature.desc)}
                    </p>
                  </motion.div>
                ))}
              </div>

              <motion.div
                id="about"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="description-box mt-20 bg-card border border-border shadow-sm rounded-2xl p-8 md:p-12"
              >
                <h4 className="text-2xl font-bold mb-6 text-primary">{t('aboutTitle')}</h4>
                <p className="text-muted-foreground mb-8 text-lg leading-relaxed">
                  {t('aboutDesc')}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h5 className="description-subheading font-semibold text-lg mb-4">{t('designedFor')}</h5>
                    <ul className="description-list space-y-2">
                      {[1, 2, 3, 4].map((num) => (
                        <li key={num} className="flex items-start">
                          <span className="text-primary mr-2">•</span>
                          <span className="text-muted-foreground">{t(`designedFor${num}`)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h5 className="description-subheading font-semibold text-lg mb-4">{t('whatYouCan')}</h5>
                    <ul className="description-list space-y-2">
                      {[1, 2, 3, 4, 5].map((num) => (
                        <li key={num} className="flex items-start">
                          <span className="text-primary mr-2">•</span>
                          <span className="text-muted-foreground">{t(`whatYouCan${num}`)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <p className="description-cta mt-8 pt-8 border-t border-border text-center font-medium text-foreground">
                  {t('ctaText')}
                </p>
              </motion.div>
            </div>
          </section>
        )}

        {!isGraphRoute && <Footer />}
      </div>
  )
}

export default App