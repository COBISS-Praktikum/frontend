import { useEffect, useMemo, useState, useRef } from "react";
import { gql } from "@apollo/client";
import { useLazyQuery } from "@apollo/client/react";
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Command, Network, GitMerge, Languages, Database } from 'lucide-react';
import { Input } from '@/components/ui/input.tsx';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import { SEO } from '@/components/layout/SEO.tsx';
import { stripLanguageTag, cn } from '@/lib/utils.ts';
import { useRateLimit } from '@/context/RateLimitContext';

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
interface ConceptSearchResult {
  uri: string;
  prefLabel?: string | null;
  prefLabelSl?: string | null;
  prefLabelEn?: string | null;
}
interface SearchConceptsResponse {
  searchConcepts: ConceptSearchResult[];
}
const SEARCH_CONCEPTS = gql`
  query SearchConcepts($text: String!, $limit: Int!) {
    searchConcepts(text: $text, limit: $limit) {
      uri
      prefLabel
      prefLabelSl
      prefLabelEn
    }
  }
`;
function SearchPage() {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<ConceptSearchResult[]>([]);
  const navigate = useNavigate();
  const [searchConcepts, { loading, error }] = useLazyQuery<SearchConceptsResponse>(SEARCH_CONCEPTS);
  const { checkRateLimit, recordRequest } = useRateLimit();
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedLanguage = i18n.resolvedLanguage ?? i18n.language ?? 'en';
  const searchLanguage = selectedLanguage.toLowerCase().startsWith('sl') ? 'sl' : 'en';
  const canonicalUrl = typeof window !== 'undefined' ? `${window.location.origin}/frontend/` : undefined;
  const trendingConcepts = useMemo(
    () => [
      { label: t('trendingConcept1Label', 'Artificial Intelligence'), query: 'umetna inteligenca' },
      { label: t('trendingConcept2Label', 'Blockchain'), query: 'blockchain' },
      { label: t('trendingConcept3Label', 'Quantum Computing'), query: 'kvantno' },
      { label: t('trendingConcept4Label', 'Climate Change'), query: 'podnebje' },
    ],
    [t],
  );
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  const isAbortError = (error: unknown) => {
    if (error instanceof DOMException) return error.name === 'AbortError';
    if (error instanceof Error) return error.message.toLowerCase().includes('aborted');
    return false;
  };
  const getSuggestionLabel = (concept: ConceptSearchResult) => {
    if (searchLanguage === 'sl') {
      return stripLanguageTag(concept.prefLabelSl ?? concept.prefLabelEn ?? concept.prefLabel) || concept.uri;
    }
    return stripLanguageTag(concept.prefLabelEn ?? concept.prefLabelSl ?? concept.prefLabel) || concept.uri;
  };
  useEffect(() => {
    let active = true;
    const timeoutId = window.setTimeout(() => {
      const runSearch = async () => {
        const query = searchQuery.trim();
        if (query.length <= 2) {
          setSuggestions([]);
          return;
        }
        if (!checkRateLimit()) return;
        recordRequest();
        try {
          const { data } = await searchConcepts({
            variables: { text: query, limit: 10 },
            context: { headers: { 'Accept-Language': searchLanguage } },
          });
          if (active && data?.searchConcepts) {
            setSuggestions(data.searchConcepts);
          }
        } catch (error) {
          if (!isAbortError(error)) {
            console.error('Search query failed:', error);
          }
        }
      };
      void runSearch();
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [searchConcepts, searchLanguage, searchQuery, checkRateLimit, recordRequest]);
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };
  const executeSearch = (query: string) => {
    setSearchQuery(query);
    inputRef.current?.focus();
  };
  const handleSuggestionClick = (uri: string) => {
    navigate(`/frontend/graph/${encodeURIComponent(uri)}`);
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
          <div className={cn(
            "relative flex items-center p-1.5 rounded-sm bg-[var(--surface)] border shadow-sm transition-colors duration-150",
            isFocused
              ? "border-[var(--brand-teal)] ring-2 ring-[var(--brand-teal)]/25"
              : "border-[var(--line-strong)] hover:border-[var(--line-hover)]"
          )}>
            <div className="pl-4 pr-2 text-[var(--ink-faint)]">
              <Search className="w-5 h-5" />
            </div>
            <Input
              ref={inputRef}
              type="text"
              placeholder={t('searchPlaceholder', 'Search for concepts, taxonomies...')}
              value={searchQuery}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onChange={handleSearchChange}
              className="flex-1 border-0 bg-transparent text-lg h-12 text-[var(--ink)] placeholder:text-[var(--ink-faint-2)] focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <div className="hidden sm:flex items-center space-x-1 pr-3 text-[var(--ink-faint-2)]">
              <kbd className="px-2 py-1 bg-[var(--surface-muted)] rounded-sm text-xs font-medium border border-[var(--line)] flex items-center space-x-1">
                <Command className="w-3 h-3" />
                <span>K</span>
              </kbd>
            </div>
          </div>
          {/* Autocomplete Overlay */}
          {(loading || error || suggestions.length > 0) && (
            <div className="absolute top-full left-0 w-full z-50 mt-2">
              <div className="bg-[var(--surface)] border border-[var(--line)] rounded-sm shadow-lg shadow-[var(--brand-navy)]/5 overflow-hidden text-left">
                {loading && (
                  <div className="p-4 space-y-3">
                    <Skeleton className="h-5 w-3/4 bg-[var(--surface-muted)]" />
                    <Skeleton className="h-5 w-1/2 bg-[var(--surface-muted)]" />
                  </div>
                )}
                {error && <p className="p-4 text-[var(--danger)] text-sm">{t('searchErrorPrefix', 'Error:')} {error.message}</p>}
                {suggestions.length > 0 && (
                  <ul className="max-h-87.5 overflow-y-auto w-full py-2 custom-scrollbar">
                    {suggestions.map((concept) => (
                      <li
                        key={concept.uri}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSuggestionClick(concept.uri);
                        }}
                        className="px-5 py-3 cursor-pointer hover:bg-[var(--tint-navy)] flex items-center group transition-colors border-l-2 border-transparent hover:border-[var(--brand-teal)]"
                      >
                        <Network className="w-4 h-4 mr-3 text-[var(--ink-faint-2)] group-hover:text-[var(--brand-teal)] transition-colors" />
                        <span className="font-medium text-[var(--ink-soft)] group-hover:text-[var(--brand-navy)]">{getSuggestionLabel(concept)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
         {/* Live Suggestions / Trends */}
         <div className="flex flex-wrap items-center justify-center gap-2 max-w-3xl mb-20">
           <span className="text-sm text-[var(--ink-faint)] mr-2">{t('trendingLabel', 'Trending:')}</span>
           {trendingConcepts.map((item, i) => (
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
