import { useRef, useEffect, useState } from "react";
import { useTranslation } from 'react-i18next';
import { Network, GitMerge, Languages, Database } from 'lucide-react';
import { gql } from '@apollo/client';
import { useApolloClient } from '@apollo/client/react';
import { SEO } from '@/components/layout/SEO.tsx';
import { ConceptSearchBar, type ConceptSearchBarHandle } from '@/components/search/ConceptSearchBar.tsx';

// Subtle, on-brand backdrop: a faint navy node-grid fading from the top,
// plus two very low-opacity brand tints for depth. No neon, no glow, no motion.
const BackgroundField = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
    <div
      className="absolute inset-0"
      style={{
        backgroundImage:
          'radial-gradient(circle at center, color-mix(in srgb, var(--brand-navy) 12%, transparent) 1px, transparent 1.4px)',
        backgroundSize: '28px 28px',
        maskImage: 'radial-gradient(ellipse 75% 55% at 50% 0%, #000 35%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 75% 55% at 50% 0%, #000 35%, transparent 100%)',
      }}
    />
  </div>
);

const SEARCH_CONCEPTS = gql`
  query SearchConcepts($text: String!, $limit: Int!, $lang: String!) {
    searchConcepts(text: $text, limit: $limit, lang: $lang) {
      uri
      prefLabel
      prefLabelSl
      prefLabelEn
    }
  }
`;

interface ConceptSearchResult {
  uri: string;
  prefLabel?: string | null;
  prefLabelSl?: string | null;
  prefLabelEn?: string | null;
}

// Seed pools: short, common words that yield rich, varied results in each language.
// Each page load picks one at random, so the trending bar changes every visit.
const SEED_WORDS_SL = [
  'um', 'svet', 'čas', 'delo', 'voda', 'zemlja', 'umet', 'živ', 'prav',
  'druž', 'znan', 'kult', 'polit', 'narv', 'med', 'šol', 'gosp', 'rel',
];

const SEED_WORDS_EN = [
  'art', 'world', 'time', 'work', 'water', 'earth', 'life', 'law',
  'social', 'science', 'culture', 'polit', 'nature', 'med', 'school',
  'econ', 'relig', 'tech', 'hist', 'lang',
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sampleN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function stripLanguageTag(label: string | null | undefined): string {
  if (!label) return '';
  return label.replace(/@(sl|en)$/, '').trim();
}

function useTrendingConcepts(lang: string) {
  const client = useApolloClient();
  const [trending, setTrending] = useState<Array<{ label: string; query: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const searchLang = lang.toLowerCase().startsWith('sl') ? 'sl' : 'en';
    const seedPool = searchLang === 'sl' ? SEED_WORDS_SL : SEED_WORDS_EN;
    const seed = pickRandom(seedPool);

    const run = async () => {
      try {
        const { data } = await client.query<{ searchConcepts: ConceptSearchResult[] }>({
          query: SEARCH_CONCEPTS,
          variables: { text: seed, limit: 20, lang: searchLang },
          fetchPolicy: 'network-only',
        });
        if (cancelled) return;

        const results = data?.searchConcepts ?? [];
        const sampled = sampleN(results, 4);
        const items = sampled.map((c: any) => {
          const rawLabel =
            searchLang === 'sl'
              ? (c.prefLabelSl ?? c.prefLabelEn ?? c.prefLabel)
              : (c.prefLabelEn ?? c.prefLabelSl ?? c.prefLabel);
          const label = stripLanguageTag(rawLabel) || c.uri;
          return { label, query: label };
        });
        setTrending(items);
      } catch (err) {
        // Silently fall back to empty — the section simply won't render
        if (!cancelled) setTrending([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => { cancelled = true; };
    // Re-fetch whenever the UI language changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  return { trending, loading };
}

function SearchPage() {
  const { t, i18n } = useTranslation();
  const searchRef = useRef<ConceptSearchBarHandle>(null);
  const lang = i18n.resolvedLanguage ?? i18n.language ?? 'en';

  const { trending, loading: trendingLoading } = useTrendingConcepts(lang);

  const canonicalUrl = typeof window !== 'undefined' ? `${window.location.origin}/frontend/` : undefined;

  const executeSearch = (query: string) => {
    searchRef.current?.setQuery(query);
    searchRef.current?.focus();
  };

  return (
    <div className="relative min-h-screen w-full bg-background text-foreground overflow-hidden font-sans">
      <SEO
        title={t('seoSearchTitle', 'SGC Navigator | Search COBISS General Subject Headings')}
        description={t('seoSearchDescription', 'Search and explore COBISS subject headings through an interactive semantic graph and hierarchy.')}
        keywords={t('seoSearchKeywords', 'SGC Navigator, COBISS, subject headings, semantic search, thesaurus, graph')}
        canonicalUrl={canonicalUrl}
      />
      {/* COBISS accent band */}
      <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-[var(--brand-navy)] via-[var(--brand-navy-mid)] to-[var(--brand-teal)] z-20" />
      <BackgroundField />
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 pb-32 flex flex-col items-center">
        {/* Hero Header */}
        <div className="text-center w-full max-w-3xl mb-12">
          <h1 className="font-heading text-5xl md:text-6xl font-bold tracking-tight mb-5 text-[var(--ink-strong)] leading-[1.05]">
            {t('heroTitle', 'Explore the Semantic Web')}
          </h1>
          <p className="text-lg text-[var(--ink-muted)] max-w-2xl mx-auto leading-relaxed">
            {t('heroSubtitle', 'Navigate through the vast interconnected network of the Slovenian Thesaurus with our powerful graphed ontology platform.')}
          </p>
        </div>
        {/* Search Command Center */}
        <div className="w-full max-w-2xl relative z-50 mb-8">
          <ConceptSearchBar
            ref={searchRef}
            variant="hero"
            enableShortcut
            showShortcutHint
          />
        </div>

        {/* Live Suggestions / Trends */}
        <div className="flex flex-wrap items-center justify-center gap-2 max-w-3xl mb-20 min-h-[2rem]">
          {/* Always reserve space; show label only once we have items */}
          {(trendingLoading || trending.length > 0) && (
            <span className="text-sm text-[var(--ink-faint)] mr-2">{t('trendingLabel', 'Trending:')}</span>
          )}
          {trendingLoading
            ? /* Skeleton chips while fetching */
              Array.from({ length: 4 }).map((_, i) => (
                <span
                  key={i}
                  className="px-3.5 py-1.5 rounded-sm text-xs bg-[var(--surface)] border border-[var(--line)] animate-pulse"
                  style={{ width: `${60 + i * 14}px`, display: 'inline-block' }}
                  aria-hidden="true"
                />
              ))
            : trending.map((item, i) => (
                <button
                  key={i}
                  onClick={() => executeSearch(item.query)}
                  className="px-3.5 py-1.5 rounded-sm text-xs font-semibold bg-[var(--surface)] text-[var(--ink-soft)] border border-[var(--line)] hover:border-[var(--brand-teal)] hover:text-[var(--brand-navy)] hover:bg-[var(--tint-teal-soft)] transition-colors"
                >
                  {item.label}
                </button>
              ))}
        </div>

        {/* Stats Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl mb-24">
          {[
            { icon: <Database className="w-5 h-5" />, label: t('statConceptsLabel', '700,000+'), desc: t('statConceptsDesc', 'Controlled Concepts') },
            { icon: <Network className="w-5 h-5" />, label: t('statRealtimeLabel', 'Real-time'), desc: t('statRealtimeDesc', 'Thesaurus Node Mapping') },
            { icon: <Languages className="w-5 h-5" />, label: t('statInstantLabel', 'Instant'), desc: t('statInstantDesc', 'Dual-Language Taxonomy') }
          ].map((stat, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-5 rounded-sm bg-[var(--surface)] border border-[var(--line)] border-t-2 border-t-[var(--brand-navy)]"
            >
              <div className="shrink-0 w-11 h-11 rounded-sm bg-[var(--tint-navy)] text-[var(--brand-navy)] flex items-center justify-center">{stat.icon}</div>
              <div className="text-left">
                <h3 className="text-xl font-bold text-[var(--ink)] leading-tight font-heading">{stat.label}</h3>
                <p className="text-sm text-[var(--ink-muted)]">{stat.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Feature Grid */}
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-4 mb-24">
          {/* Card 1: Interactive Graph Preview */}
          <div className="md:col-span-2 group relative overflow-hidden rounded-sm bg-[var(--surface)] border border-[var(--line)] p-8 hover:border-[var(--brand-navy)]/40 transition-colors duration-200">
            <div className="relative z-10 flex flex-col h-full justify-between">
               <div>
                 <div className="w-12 h-12 rounded-sm bg-[var(--tint-navy)] flex items-center justify-center mb-6 border border-[var(--brand-navy)]/15 group-hover:bg-[var(--tint-navy-strong)] transition-colors">
                   <Network className="w-6 h-6 text-[var(--brand-navy)]" />
                 </div>
                 <h3 className="text-2xl font-bold text-[var(--ink)] mb-3 font-heading">{t('cardGraphTitle', 'Interactive Graph Views')}</h3>
                 <p className="text-[var(--ink-muted)] max-w-md leading-relaxed">{t('cardGraphDesc', 'Experience relationships naturally. Our force-directed graph renderer smoothly animates connections between broader, narrower, and related concepts in real-time.')}</p>
               </div>
             </div>
            {/* Static mock graph */}
            <div className="absolute right-0 bottom-0 w-2/3 h-full opacity-50 group-hover:opacity-80 transition-opacity duration-300 pointer-events-none">
              <svg className="w-full h-full" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                <line x1="100" y1="100" x2="150" y2="60" stroke="var(--brand-navy)" strokeWidth="1" opacity="0.35" />
                <line x1="100" y1="100" x2="160" y2="140" stroke="var(--brand-navy)" strokeWidth="1" opacity="0.25" />
                <line x1="100" y1="100" x2="50" y2="90" stroke="var(--brand-navy)" strokeWidth="1" opacity="0.3" />
                <circle cx="100" cy="100" r="8" fill="var(--brand-teal)" />
                <circle cx="150" cy="60" r="5" fill="var(--brand-navy)" />
                <circle cx="160" cy="140" r="6" fill="var(--brand-navy)" />
                <circle cx="50" cy="90" r="4" fill="var(--brand-navy-mid)" />
              </svg>
            </div>
          </div>
          {/* Card 2: Hierarchy Trees */}
          <div className="md:col-span-1 group rounded-sm bg-[var(--surface)] border border-[var(--line)] p-8 hover:border-[var(--brand-teal)]/40 transition-colors duration-200 flex flex-col justify-between overflow-hidden relative">
            <div className="relative z-10">
               <div className="w-12 h-12 rounded-sm bg-[var(--tint-teal)] flex items-center justify-center mb-6 border border-[var(--brand-teal)]/20">
                 <GitMerge className="w-6 h-6 text-[var(--brand-teal-strong)]" />
               </div>
               <h3 className="text-xl font-bold text-[var(--ink)] mb-2 font-heading">{t('cardHierarchyTitle', 'Hierarchical Taxonomy')}</h3>
               <p className="text-sm text-[var(--ink-muted)] leading-relaxed">{t('cardHierarchyDesc', 'Navigate strict vertical trees of taxonomical breadth intuitively.')}</p>
             </div>
            {/* CSS Tree Mock */}
            <div className="mt-8 flex flex-col items-center space-y-2 opacity-80 group-hover:opacity-100 transition-opacity">
              <div className="w-16 h-6 bg-[var(--tint-navy)] rounded-none border border-[var(--line-strong)]" />
              <div className="w-px h-4 bg-[var(--brand-teal)]/60" />
              <div className="w-32 h-px bg-[var(--brand-teal)]/60 flex justify-between">
                <div className="w-px h-4 bg-[var(--brand-teal)]/60 translate-y-px" />
                <div className="w-px h-4 bg-[var(--brand-teal)]/60 translate-y-px" />
              </div>
              <div className="flex justify-between w-32 px-1">
                <div className="w-12 h-6 bg-[var(--tint-navy)] rounded-none border border-[var(--line-strong)]" />
                <div className="w-12 h-6 bg-[var(--surface)] rounded-none border border-[var(--brand-teal)]/50 border-b-2" />
              </div>
            </div>
          </div>
          {/* Card 3: Bilingual Mapping */}
          <div className="md:col-span-3 group rounded-sm bg-linear-to-r from-[var(--surface)] to-[var(--tint-navy)] border border-[var(--line)] p-8 hover:border-[var(--brand-navy)]/30 transition-colors duration-200 flex flex-col md:flex-row items-center justify-between">
            <div className="mb-6 md:mb-0 max-w-xl">
               <div className="w-12 h-12 rounded-sm bg-[var(--surface)] flex items-center justify-center mb-4 border border-[var(--brand-navy)]/15 shadow-sm">
                 <Languages className="w-6 h-6 text-[var(--brand-navy)]" />
               </div>
               <h3 className="text-2xl font-bold text-[var(--ink)] mb-2 font-heading">{t('cardBilingualTitle', 'Native Bilingual Mapping')}</h3>
               <p className="text-[var(--ink-muted)] leading-relaxed">{t('cardBilingualDesc', 'Seamlessly fluid translations mappings between Slovenian and English localized terms.')}</p>
             </div>
            {/* Static bilingual mock */}
            <div className="relative w-64 h-16 bg-[var(--surface)] rounded-sm border border-[var(--line)] flex items-center justify-between px-6 overflow-hidden shadow-sm group-hover:border-[var(--brand-teal)]/50 transition-colors">
               <span className="text-[var(--ink-soft)] font-medium z-10">{t('searchExampleSl', 'Umetnost')}</span>
              <Network className="w-4 h-4 text-[var(--ink-faint-2)] z-10" />
               <span className="text-[var(--brand-teal-strong)] font-semibold z-10">{t('searchExampleEn', 'Art')}</span>
            </div>
          </div>
        </div>

        {/* About Block */}
        <div className="w-full max-w-4xl p-8 rounded-sm bg-[var(--surface-subtle)] border border-[var(--line)] border-l-4 border-l-[var(--brand-teal)]">
          <h4 className="text-lg font-semibold text-[var(--ink)] mb-4 font-heading">{t('aboutCardTitle', 'About SGC Navigator')}</h4>
          <p className="text-[var(--ink-soft)] leading-relaxed mb-4">
            {t('aboutCardDesc', 'The SGC (Splošni geslovnik COBISS) Navigator provides an advanced semantic visual interface for the exhaustive Slovenian thesaurus. Leveraging graph technologies, it turns hundreds of thousands of controlled vocabulary entries into an explorer-friendly format, showcasing exactly how concepts interrelate structurally and linguistically.')}
          </p>
          <p className="text-[var(--ink-faint)] text-sm italic">
            {t('aboutCardNote', 'Developed to support researchers, indexers, and developers interacting with structured bibliographic data.')}
          </p>
        </div>
      </div>
    </div>
  );
}

export default SearchPage;
