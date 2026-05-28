import { useEffect, useState, useRef } from "react";
import { gql } from "@apollo/client";
import { useLazyQuery } from "@apollo/client/react";
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Command, Network, GitMerge, Languages, Zap, Database } from 'lucide-react';
import { Input } from '@/components/ui/input.tsx';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import { stripLanguageTag, cn } from '@/lib/utils.ts';
import { useRateLimit } from '@/context/RateLimitContext';
const BackgroundNodes = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
    <div className="absolute top-[20%] left-[10%] w-72 h-72 rounded-full bg-[#004b87] opacity-20 blur-[100px] animate-pulse" style={{ animationDuration: '4s' }} />
    <div className="absolute top-[40%] right-[15%] w-96 h-96 rounded-full bg-[#00a99d] opacity-20 blur-[120px] animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />
    <div className="absolute bottom-[10%] left-[30%] w-64 h-64 rounded-full bg-[#004b87] opacity-15 blur-[90px] animate-pulse" style={{ animationDuration: '5s', animationDelay: '2s' }} />
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
const TRENDING_CONCEPTS = [
  { label: 'Umjetna inteligencija', query: 'umetna inteligenca' },
  { label: 'Blockchain', query: 'blockchain' },
  { label: 'Kvantno računalništvo', query: 'kvantno' },
  { label: 'Podnebne spremembe', query: 'podnebje' }
];
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
    <div className="relative min-h-screen w-full bg-slate-950 text-slate-50 overflow-hidden font-sans">
      <BackgroundNodes />
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 pb-32 flex flex-col items-center">
        {/* Hero Header */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center w-full max-w-3xl mb-12"
        >
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-sm font-medium mb-6">
            <Zap className="w-4 h-4" />
            <span>SGC Navigator 2.0</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-slate-500">
            {t('heroTitle', 'Explore the Semantic Web')}
          </h1>
          <p className="text-lg md:text-xl text-slate-400 font-light max-w-2xl mx-auto leading-relaxed">
            {t('heroSubtitle', 'Navigate through the vast interconnected network of the Slovenian Thesaurus with our powerful graphed ontology platform.')}
          </p>
        </motion.div>
        {/* Search Command Center */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-2xl relative z-50 mb-8"
        >
          <div className={cn(
            "relative flex items-center p-2 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-white/10 shadow-2xl transition-all duration-300",
            isFocused ? "border-teal-500/50 shadow-[#00a99d]/20 shadow-[0_0_30px_-5px]" : "hover:border-white/20"
          )}>
            <div className="pl-4 pr-2 text-slate-400">
              <Search className="w-6 h-6" />
            </div>
            <Input
              ref={inputRef}
              type="text"
              placeholder={t('searchPlaceholder', 'Search for concepts, taxonomies...')}
              value={searchQuery}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onChange={handleSearchChange}
              className="flex-1 border-0 bg-transparent text-lg md:text-xl h-14 text-white placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <div className="hidden sm:flex items-center space-x-1 pr-4 text-slate-500">
              <kbd className="px-2 py-1 bg-slate-800 rounded text-xs font-medium border border-slate-700 flex items-center space-x-1">
                <Command className="w-3 h-3" />
                <span>K</span>
              </kbd>
            </div>
          </div>
          {/* Autocomplete Overlay */}
          <AnimatePresence>
            {(loading || error || suggestions.length > 0) && (
              <motion.div 
                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 8, scale: 1 }}
                exit={{ opacity: 0, y: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="absolute top-full left-0 w-full z-50"
              >
                <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden text-left">
                  {loading && (
                    <div className="p-4 space-y-3">
                      <Skeleton className="h-5 w-3/4 bg-slate-800" />
                      <Skeleton className="h-5 w-1/2 bg-slate-800" />
                    </div>
                  )}
                  {error && <p className="p-4 text-red-400/90 text-sm">Error: {error.message}</p>}
                  {suggestions.length > 0 && (
                    <ul className="max-h-[350px] overflow-y-auto w-full py-2 custom-scrollbar">
                      {suggestions.map((concept, index) => (
                        <motion.li
                          key={concept.uri}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.02 }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSuggestionClick(concept.uri);
                          }}
                          className="px-5 py-3 cursor-pointer hover:bg-teal-500/10 flex items-center group transition-colors"
                        >
                          <Network className="w-4 h-4 mr-3 text-slate-500 group-hover:text-teal-400 transition-colors" />
                          <span className="font-medium text-slate-200 group-hover:text-white">{getSuggestionLabel(concept)}</span>
                        </motion.li>
                      ))}
                    </ul>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
         {/* Live Suggestions / Trends */}
         <motion.div
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           transition={{ duration: 0.8, delay: 0.4 }}
           className="flex flex-wrap items-center justify-center gap-2 max-w-3xl mb-16"
         >
           <span className="text-sm text-slate-500 mr-2">{t('trendingLabel', 'Trending:')}</span>
          {TRENDING_CONCEPTS.map((item, i) => (
            <button
              key={i}
              onClick={() => executeSearch(item.query)}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-800/50 text-slate-300 border border-slate-700/50 hover:bg-slate-800 hover:border-teal-500/30 hover:text-teal-300 transition-all"
            >
              {item.label}
            </button>
          ))}
        </motion.div>
        {/* Stats Banner */}
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mb-24">
           {[
             { icon: <Database className="w-5 h-5" />, label: t('statConceptsLabel', '700,000+'), desc: t('statConceptsDesc', 'Controlled Concepts') },
             { icon: <Network className="w-5 h-5" />, label: t('statRealtimeLabel', 'Real-time'), desc: t('statRealtimeDesc', 'Thesaurus Node Mapping') },
             { icon: <Languages className="w-5 h-5" />, label: t('statInstantLabel', 'Instant'), desc: t('statInstantDesc', 'Dual-Language Taxonomy') }
           ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 + (i * 0.1) }}
              className="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-900/30 border border-white/5 backdrop-blur-sm"
            >
              <div className="text-teal-400 mb-3">{stat.icon}</div>
              <h3 className="text-2xl font-bold text-white mb-1">{stat.label}</h3>
              <p className="text-sm text-slate-400 text-center">{stat.desc}</p>
            </motion.div>
          ))}
        </div>
        {/* Bento Grid */}
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6 mb-24">
          {/* Card 1: Interactive Graph Preview */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="md:col-span-2 group relative overflow-hidden rounded-3xl bg-slate-900/50 border border-white/10 p-8 hover:border-[#004b87]/50 hover:shadow-[0_0_40px_-10px_rgba(0,75,135,0.4)] transition-all duration-500"
          >
            <div className="relative z-10 flex flex-col h-full justify-between">
               <div>
                 <div className="w-12 h-12 rounded-xl bg-[#004b87]/30 flex items-center justify-center mb-6 border border-[#004b87]/50 group-hover:bg-[#004b87]/50 transition-colors">
                   <Network className="w-6 h-6 text-[#00a99d]" />
                 </div>
                 <h3 className="text-2xl font-bold text-white mb-3">{t('cardGraphTitle', 'Interactive Graph Views')}</h3>
                 <p className="text-slate-400 max-w-md">{t('cardGraphDesc', 'Experience relationships naturally. Our force-directed graph renderer smoothly animates connections between broader, narrower, and related concepts in real-time.')}</p>
               </div>
             </div>
            {/* Mock Graph Background Animation */}
            <div className="absolute right-0 bottom-0 w-2/3 h-full opacity-30 group-hover:opacity-60 transition-opacity duration-700 pointer-events-none">
              <svg className="w-full h-full" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                <motion.circle cx="100" cy="100" r="8" fill="#00a99d" animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }} />
                <motion.circle cx="150" cy="60" r="5" fill="#004b87" animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 2.5, delay: 0.5 }} />
                <motion.circle cx="160" cy="140" r="6" fill="#004b87" animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 2.2, delay: 1 }} />
                <motion.circle cx="50" cy="90" r="4" fill="#004b87" animate={{ scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 2.8, delay: 0.2 }} />
                <line x1="100" y1="100" x2="150" y2="60" stroke="#00a99d" strokeWidth="1" strokeDasharray="4 4" className="opacity-50" />
                <line x1="100" y1="100" x2="160" y2="140" stroke="#00a99d" strokeWidth="1" opacity="0.3" />
                <line x1="100" y1="100" x2="50" y2="90" stroke="#00a99d" strokeWidth="1" opacity="0.4" />
              </svg>
            </div>
          </motion.div>
          {/* Card 2: Hierarchy Trees */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="md:col-span-1 group rounded-3xl bg-slate-900/50 border border-white/10 p-8 hover:border-[#00a99d]/50 hover:shadow-[0_0_40px_-10px_rgba(0,169,157,0.3)] transition-all duration-500 flex flex-col justify-between overflow-hidden relative"
          >
            <div className="relative z-10">
               <div className="w-12 h-12 rounded-xl bg-teal-500/20 flex items-center justify-center mb-6 border border-teal-500/30">
                 <GitMerge className="w-6 h-6 text-teal-400" />
               </div>
               <h3 className="text-xl font-bold text-white mb-2">{t('cardHierarchyTitle', 'Hierarchical Taxonomy')}</h3>
               <p className="text-sm text-slate-400">{t('cardHierarchyDesc', 'Navigate strict vertical trees of taxonomical breadth intuitively.')}</p>
             </div>
            {/* CSS Tree Mock */}
            <div className="mt-8 flex flex-col items-center space-y-2 opacity-50 group-hover:opacity-100 transition-opacity">
              <div className="w-16 h-6 bg-slate-800 rounded-md border border-slate-700" />
              <div className="w-px h-4 bg-teal-500/50" />
              <div className="w-32 h-px bg-teal-500/50 flex justify-between">
                <div className="w-px h-4 bg-teal-500/50 translate-y-px" />
                <div className="w-px h-4 bg-teal-500/50 translate-y-px" />
              </div>
              <div className="flex justify-between w-32 px-1">
                <div className="w-12 h-6 bg-slate-800 rounded-md border border-slate-700" />
                <div className="w-12 h-6 bg-slate-800 rounded-md border border-[#00a99d]/50 border-b-2" />
              </div>
            </div>
          </motion.div>
          {/* Card 3: Bilingual Mapping */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="md:col-span-3 group rounded-3xl bg-gradient-to-r from-slate-900/80 to-[#004b87]/10 border border-white/10 p-8 hover:border-white/30 transition-all duration-500 flex flex-col md:flex-row items-center justify-between"
          >
            <div className="mb-6 md:mb-0 max-w-xl">
               <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center mb-4 border border-indigo-500/30">
                 <Languages className="w-6 h-6 text-indigo-400" />
               </div>
               <h3 className="text-2xl font-bold text-white mb-2">{t('cardBilingualTitle', 'Native Bilingual Mapping')}</h3>
               <p className="text-slate-400">{t('cardBilingualDesc', 'Seamlessly fluid translations mappings between Slovenian and English localized terms.')}</p>
             </div>
            {/* Interactive Pill Mock */}
            <div className="relative w-64 h-16 bg-slate-800/80 rounded-full border border-slate-700 flex items-center justify-between px-6 overflow-hidden shadow-inner group-hover:border-indigo-500/50 transition-colors">
              <motion.div 
                className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-transparent via-indigo-500/10 to-transparent"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
              />
              <span className="text-slate-300 font-medium z-10">Umetnost</span>
              <Network className="w-4 h-4 text-slate-500 z-10" />
              <span className="text-indigo-300 font-medium z-10">Art</span>
            </div>
          </motion.div>
        </div>
        {/* Polished Description & Context Block */}
         <motion.div 
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           transition={{ duration: 1, delay: 1 }}
           className="w-full max-w-4xl p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 border-l-2 border-l-teal-500"
         >
           <h4 className="text-lg font-semibold text-white mb-4">{t('aboutCardTitle', 'About SGC Navigator')}</h4>
           <p className="text-slate-400 leading-relaxed font-light mb-4">
             {t('aboutCardDesc', 'The SGC (Splošni geslovnik COBISS) Navigator provides an advanced semantic visual interface for the exhaustive Slovenian thesaurus. Leveraging graph technologies, it turns hundreds of thousands of controlled vocabulary entries into an explorer-friendly format, showcasing exactly how concepts interrelate structurally and linguistically.')}
           </p>
           <p className="text-slate-500 text-sm italic">
             {t('aboutCardNote', 'Developed to support researchers, indexers, and developers interacting with structured bibliographic data.')}
           </p>
         </motion.div>
      </div>
    </div>
  );
}
export default SearchPage;
