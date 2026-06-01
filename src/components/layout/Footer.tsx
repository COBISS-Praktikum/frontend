import { useTranslation } from 'react-i18next';
export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="w-full mt-auto bg-[#0d2436] text-[#9fb3c5] border-t-2 border-t-[#00a99d]">
      <div className="max-w-6xl mx-auto px-6 py-10 flex items-center justify-center md:justify-start gap-3 text-sm">
        {/* Institutional block mark */}
        <span className="flex items-center" aria-hidden="true">
          <span className="block w-1.5 h-5 bg-white/80" />
          <span className="block w-1.5 h-5 bg-[#00a99d]" />
        </span>
        <p className="font-semibold text-white tracking-tight">{t('footerCopyright', '© 2024 SGC Navigator')}</p>
      </div>
    </footer>
  );
}
