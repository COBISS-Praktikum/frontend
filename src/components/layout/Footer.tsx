import { useTranslation } from 'react-i18next';

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="w-full border-t border-border mt-auto bg-card text-muted-foreground py-8">
      <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="footer-content flex flex-col items-center md:items-start text-sm">
          <span id="privacy" hidden />
          <span id="terms" hidden />
          <span id="contact" hidden />
          <p className="font-medium">{t('footerCopyright')}</p>
        </div>
        <div className="flex gap-6 text-sm font-medium">
          <a href="#privacy" className="hover:text-primary transition-colors">{t('footerPrivacy')}</a>
          <a href="#terms" className="hover:text-primary transition-colors">{t('footerTerms')}</a>
          <a href="#contact" className="hover:text-primary transition-colors">{t('footerContact')}</a>
        </div>
      </div>
    </footer>
  )
}
