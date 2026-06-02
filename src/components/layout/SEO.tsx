import { useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';

const SITE_NAME = 'SGC Navigator';
const FALLBACK_OG_IMAGE = '/favicon.svg';

export interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string | string[];
  ogImage?: string;
  canonicalUrl?: string;
}

export function SEO({ title, description, keywords, ogImage = FALLBACK_OG_IMAGE, canonicalUrl }: SEOProps) {
  const { i18n } = useTranslation();
  const currentLanguage = (i18n.resolvedLanguage ?? i18n.language ?? 'en').toLowerCase().startsWith('sl') ? 'sl' : 'en';

  const resolvedTitle = useMemo(() => {
    if (!title) {
      return SITE_NAME;
    }

    return title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  }, [title]);

  const keywordContent = useMemo(() => {
    if (!keywords) {
      return undefined;
    }

    return Array.isArray(keywords) ? keywords.join(', ') : keywords;
  }, [keywords]);

  const canonicalHref = canonicalUrl ?? (typeof window !== 'undefined' ? window.location.href : undefined);
  const ogTitle = resolvedTitle;
  const ogDescription = description ?? '';

  return (
    <Helmet htmlAttributes={{ lang: currentLanguage }}>
      <title>{resolvedTitle}</title>
      {description ? <meta name="description" content={description} /> : null}
      {keywordContent ? <meta name="keywords" content={keywordContent} /> : null}
      {canonicalHref ? <link rel="canonical" href={canonicalHref} /> : null}

      <meta property="og:title" content={ogTitle} />
      {ogDescription ? <meta property="og:description" content={ogDescription} /> : null}
      <meta property="og:type" content="website" />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content={SITE_NAME} />
      {canonicalHref ? <meta property="og:url" content={canonicalHref} /> : null}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={ogTitle} />
      {ogDescription ? <meta name="twitter:description" content={ogDescription} /> : null}
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  );
}


