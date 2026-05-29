import { useTranslation } from 'react-i18next';
export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="w-full border-t border-slate-900 mt-auto bg-slate-950 text-slate-400 py-8">
      <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="footer-content flex flex-col items-center md:items-start text-sm">
          <span id="privacy" hidden />
          <span id="terms" hidden />
          <span id="contact" hidden />
          <p className="font-medium text-slate-500">{t('footerCopyright', '© 2024 SGC Navigator')}</p>
        </div>
        <div className="flex gap-6 text-sm font-medium">
          <a href="#privacy" className="hover:text-teal-400 transition-colors">{t('footerPrivacy', 'Privacy')}</a>
          <a href="#terms" className="hover:text-teal-400 transition-colors">{t('footerTerms', 'Terms')}</a>
          <a href="#contact" className="hover:text-teal-400 transition-colors">{t('footerContact', 'Contact')}</a>
        </div>
      </div>
    </footer>
  );
}
