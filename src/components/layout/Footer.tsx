import { useTranslation } from 'react-i18next';

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="app-footer">
      <div className="footer-container">
        <div className="footer-content">
          <span id="privacy" hidden />
          <span id="terms" hidden />
          <span id="contact" hidden />
          <p>{t('footerCopyright')}</p>
          <div className="footer-links">
            <a href="#privacy">{t('footerPrivacy')}</a>
            <a href="#terms">{t('footerTerms')}</a>
            <a href="#contact">{t('footerContact')}</a>
          </div>
        </div>
      </div>
    </footer>
  )
}

