import { useTranslation } from 'react-i18next';
export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="w-full mt-auto bg-[#0d2436] text-[#9fb3c5] border-t-2 border-t-[#00a99d]">
      <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row justify-between items-center gap-5">
        <div className="footer-content flex items-center gap-3 text-sm">
          <span id="privacy" hidden />
          <span id="terms" hidden />
          <span id="contact" hidden />
          {/* Institutional block mark */}
          <span className="flex items-center" aria-hidden="true">
            <span className="block w-1.5 h-5 bg-white/80" />
            <span className="block w-1.5 h-5 bg-[#00a99d]" />
          </span>
          <p className="font-semibold text-white tracking-tight">{t('footerCopyright', '© 2024 SGC Navigator')}</p>
        </div>
        <div className="flex gap-8 text-sm font-semibold">
          <a href="#privacy" className="text-[#9fb3c5] hover:text-white border-b-2 border-transparent hover:border-[#00a99d] pb-0.5 transition-colors">{t('footerPrivacy', 'Privacy')}</a>
          <a href="#terms" className="text-[#9fb3c5] hover:text-white border-b-2 border-transparent hover:border-[#00a99d] pb-0.5 transition-colors">{t('footerTerms', 'Terms')}</a>
          <a href="#contact" className="text-[#9fb3c5] hover:text-white border-b-2 border-transparent hover:border-[#00a99d] pb-0.5 transition-colors">{t('footerContact', 'Contact')}</a>
        </div>
      </div>
    </footer>
  );
}
