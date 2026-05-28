import { useEffect, useState } from 'react';
import { gql } from "@apollo/client";
import { useLazyQuery } from "@apollo/client/react";
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import { stripLanguageTag } from '@/lib/utils.ts';
import { useRateLimit } from '@/context/RateLimitContext';
import './SearchPage.css';

const MagneticButton = ({ children, className }: { children: React.ReactNode, className?: string }) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const handleMouse = (e: React.MouseEvent<HTMLDivElement>) => {
    const { clientX, clientY } = e;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (clientX - (rect.left + rect.width / 2)) * 0.2;
    const y = (clientY - (rect.top + rect.height / 2)) * 0.2;
    setPosition({ x, y });
  };
  return (
    <motion.div
      onPointerMove={handleMouse}
      onPointerLeave={() => setPosition({ x: 0, y: 0 })}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: "spring", stiffness: 300, damping: 20, mass: 0.5 }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

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

  const selectedLanguage = i18n.resolvedLanguage ?? i18n.language ?? 'en';
  const searchLanguage = selectedLanguage.toLowerCase().startsWith('sl') ? 'sl' : 'en';

  const isAbortError = (error: unknown) => {
    if (error instanceof DOMException) {
      return error.name === 'AbortError';
    }

    if (error instanceof Error) {
      return error.message.toLowerCase().includes('aborted');
    }

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

        // Check rate limit BEFORE executing query
        if (!checkRateLimit()) {
          return; // Modal will be shown by context
        }

        // Record this request
        recordRequest();

        try {
          const { data } = await searchConcepts({
            variables: {
              text: query,
              limit: 10,
            },
            context: {
              headers: {
                'Accept-Language': searchLanguage,
              },
            },
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

  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSuggestionClick = (uri: string) => {
    navigate(`/frontend/graph/${encodeURIComponent(uri)}`);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: 20 }}
      className="search-page-wrapper w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30"
    >
      <section className="hero-section w-full max-w-4xl px-4 py-20 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="hero-content w-full flex flex-col items-center"
        >
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="hero-title text-4xl md:text-5xl font-extrabold text-foreground mb-6"
          >
            {t('heroTitle')}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="hero-subtitle text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl"
          >
            {t('heroSubtitle')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="search-container relative w-full max-w-2xl"
          >
            <motion.div 
              animate={{ 
                scale: isFocused ? 1.02 : 1,
                boxShadow: isFocused ? "0 0 25px 5px rgba(0, 169, 157, 0.2)" : "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
              }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="search-wrapper relative flex items-center bg-card rounded-2xl border border-border p-2 z-10 transition-colors"
            >
              <Input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={searchQuery}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onChange={handleSearchChange}
                className="search-input flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-4 text-lg bg-transparent"
              />
              <MagneticButton>
                <Button className="search-button rounded-xl px-8 py-6 text-sm font-semibold transition-transform active:scale-95">{t('searchButton')}</Button>
              </MagneticButton>
            </motion.div>
            
            <AnimatePresence>
              {(loading || error || suggestions.length > 0) && (
                <motion.div 
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="absolute top-[80%] left-0 w-full pt-10 z-0"
                >
                  <div className="bg-card border border-border rounded-b-2xl rounded-t-sm shadow-xl overflow-hidden text-left">
                    {loading && (
                      <div className="px-6 py-4 space-y-3">
                        <Skeleton className="h-4 w-3/4 bg-primary/10" />
                        <Skeleton className="h-4 w-1/2 bg-primary/10" />
                        <Skeleton className="h-4 w-5/6 bg-primary/10" />
                      </div>
                    )}
                    {error && <p className="px-6 py-4 text-destructive">Error: {error.message}</p>}
                    {suggestions.length > 0 && (
                      <ul className="suggestions-list max-h-[300px] overflow-y-auto w-full">
                        {suggestions.map((concept, index) => (
                          <motion.li
                            key={concept.uri}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.03 }}
                            onClick={() => handleSuggestionClick(concept.uri)}
                            className="px-6 py-4 cursor-pointer hover:bg-muted/50 border-b border-border/50 last:border-0 transition-colors"
                          >
                            <span className="font-medium text-foreground">{getSuggestionLabel(concept)}</span>
                          </motion.li>
                        ))}
                      </ul>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </section>
    </motion.div>
  );
}

export default SearchPage;