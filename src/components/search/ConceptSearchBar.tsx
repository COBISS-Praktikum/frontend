import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { gql } from '@apollo/client';
import { useLazyQuery } from '@apollo/client/react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Command, Network } from 'lucide-react';
import { Input } from '@/components/ui/input.tsx';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import { stripLanguageTag, cn } from '@/lib/utils.ts';
import { useRateLimit } from '@/context/RateLimitContext';

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
  query SearchConcepts($text: String!, $limit: Int!, $lang: String!) {
    searchConcepts(text: $text, limit: $limit, lang: $lang) {
      uri
      prefLabel
      prefLabelSl
      prefLabelEn
    }
  }
`;

export interface ConceptSearchBarHandle {
  /** Move focus into the input. */
  focus: () => void;
  /** Populate the input (e.g. from a trending chip) and open the dropdown. */
  setQuery: (q: string) => void;
}

interface ConceptSearchBarProps {
  /**
   * `hero`    – large landing-page search with optional ⌘K hint.
   * `compact` – toolbar-sized search (default), used inside the graph page.
   */
  variant?: 'hero' | 'compact';
  className?: string;
  placeholder?: string;
  /** Register a global ⌘/Ctrl+K shortcut that focuses this input. */
  enableShortcut?: boolean;
  /** Render the ⌘K hint badge inside the field (hero only). */
  showShortcutHint?: boolean;
}

/**
 * Concept search with debounced autocomplete, rate limiting and keyboard
 * navigation. Selecting a result navigates to that concept's graph route, so
 * it works both as the landing-page search and as an in-page "jump to another
 * concept" search on the graph page.
 */
export const ConceptSearchBar = forwardRef<ConceptSearchBarHandle, ConceptSearchBarProps>(
  function ConceptSearchBar(
    { variant = 'compact', className, placeholder, enableShortcut = false, showShortcutHint = false },
    ref,
  ) {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { checkRateLimit, recordRequest } = useRateLimit();
    const [searchConcepts, { loading, error }] = useLazyQuery<SearchConceptsResponse>(SEARCH_CONCEPTS);

    const [searchQuery, setSearchQuery] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [open, setOpen] = useState(false);
    const [suggestions, setSuggestions] = useState<ConceptSearchResult[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(-1);

    const listRef = useRef<HTMLUListElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const isHero = variant === 'hero';

    const selectedLanguage = i18n.resolvedLanguage ?? i18n.language ?? 'en';
    const searchLanguage = selectedLanguage.toLowerCase().startsWith('sl') ? 'sl' : 'en';

    useImperativeHandle(
      ref,
      () => ({
        focus: () => inputRef.current?.focus(),
        setQuery: (q: string) => {
          setSearchQuery(q);
          setOpen(true);
        },
      }),
      [],
    );

    const isAbortError = (err: unknown) => {
      if (err instanceof DOMException) return err.name === 'AbortError';
      if (err instanceof Error) return err.message.toLowerCase().includes('aborted');
      return false;
    };

    const getSuggestionLabel = (concept: ConceptSearchResult) => {
      if (searchLanguage === 'sl') {
        return stripLanguageTag(concept.prefLabelSl ?? concept.prefLabelEn ?? concept.prefLabel) || concept.uri;
      }
      return stripLanguageTag(concept.prefLabelEn ?? concept.prefLabelSl ?? concept.prefLabel) || concept.uri;
    };

    // ⌘/Ctrl+K focus shortcut
    useEffect(() => {
      if (!enableShortcut) return;
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault();
          inputRef.current?.focus();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [enableShortcut]);

    // Debounced search
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
              variables: { text: query, limit: 10, lang: searchLanguage },
              context: { headers: { 'Accept-Language': searchLanguage } },
            });
            if (active && data?.searchConcepts) {
              setSuggestions(data.searchConcepts);
            }
          } catch (err) {
            if (!isAbortError(err)) console.error('Search query failed:', err);
          }
        };
        void runSearch();
      }, 250);
      return () => {
        active = false;
        window.clearTimeout(timeoutId);
      };
    }, [searchConcepts, searchLanguage, searchQuery, checkRateLimit, recordRequest]);

    // Reset highlight when results change
    useEffect(() => {
      setSelectedIndex(-1);
    }, [suggestions]);

    // Keep the active suggestion in view
    useEffect(() => {
      if (selectedIndex >= 0 && listRef.current) {
        const activeItem = listRef.current.children[selectedIndex] as HTMLElement | undefined;
        activeItem?.scrollIntoView({ block: 'nearest' });
      }
    }, [selectedIndex]);

    const goToConcept = (uri: string) => {
      setOpen(false);
      setSearchQuery('');
      setSuggestions([]);
      inputRef.current?.blur();
      navigate(`/frontend/graph/${encodeURIComponent(uri)}`);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
        return;
      }
      if (suggestions.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          goToConcept(suggestions[selectedIndex].uri);
        } else if (suggestions.length > 0) {
          goToConcept(suggestions[0].uri);
        }
      }
    };

    const hasContent = loading || !!error || suggestions.length > 0;
    // Hero mirrors the original landing search (shows whenever there is content);
    // compact only opens while focused so it stays out of the way in the toolbar.
    const showDropdown = isHero ? hasContent : hasContent && open && isFocused;

    return (
      <div className={cn('relative', className)}>
        <div
          className={cn(
            'relative flex items-center rounded-sm bg-[var(--surface)] border transition-colors duration-150',
            isHero ? 'p-1.5 shadow-sm' : '',
            isFocused
              ? 'border-[var(--brand-teal)] ring-2 ring-[var(--brand-teal)]/25'
              : 'border-[var(--line-strong)] hover:border-[var(--line-hover)]',
          )}
        >
          <div className={cn('text-[var(--ink-faint)]', isHero ? 'pl-4 pr-2' : 'pl-3 pr-1')}>
            <Search className={isHero ? 'w-5 h-5' : 'w-4 h-4'} />
          </div>
          <Input
            ref={inputRef}
            type="text"
            placeholder={
              placeholder ?? t('searchPlaceholder', 'Search for concepts, taxonomies...')
            }
            value={searchQuery}
            onFocus={() => {
              setIsFocused(true);
              setOpen(true);
            }}
            onBlur={() => setIsFocused(false)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setOpen(true);
            }}
            onKeyDown={handleKeyDown}
            className={cn(
              'flex-1 border-0 bg-transparent h-12 text-[var(--ink)] placeholder:text-[var(--ink-faint-2)] focus-visible:ring-0 focus-visible:ring-offset-0',
              isHero ? 'text-lg' : 'text-sm',
            )}
          />
          {isHero && showShortcutHint && (
            <div className="hidden sm:flex items-center space-x-1 pr-3 text-[var(--ink-faint-2)]">
              <kbd className="px-2 py-1 bg-[var(--surface-muted)] rounded-sm text-xs font-medium border border-[var(--line)] flex items-center space-x-1">
                <Command className="w-3 h-3" />
                <span>K</span>
              </kbd>
            </div>
          )}
        </div>

        {showDropdown && (
          <div className="absolute top-full left-0 w-full z-50 mt-2">
            <div className="bg-[var(--surface)] border border-[var(--line)] rounded-sm shadow-lg shadow-[var(--brand-navy)]/5 overflow-hidden text-left">
              {loading && (
                <div className="p-4 space-y-3">
                  <Skeleton className="h-5 w-3/4 bg-[var(--surface-muted)]" />
                  <Skeleton className="h-5 w-1/2 bg-[var(--surface-muted)]" />
                </div>
              )}
              {error && (
                <p className="p-4 text-[var(--danger)] text-sm">
                  {t('searchErrorPrefix', 'Error:')} {error.message}
                </p>
              )}
              {suggestions.length > 0 && (
                <ul
                  ref={listRef}
                  className={cn(
                    'overflow-y-auto w-full py-2 custom-scrollbar',
                    isHero ? 'max-h-87.5' : 'max-h-80',
                  )}
                >
                  {suggestions.map((concept, index) => {
                    const isActive = index === selectedIndex;
                    return (
                      <li
                        key={concept.uri}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          goToConcept(concept.uri);
                        }}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={cn(
                          'cursor-pointer flex items-center group transition-colors border-l-2',
                          isHero ? 'px-5 py-3' : 'px-4 py-2.5',
                          isActive
                            ? 'bg-[var(--tint-navy)] border-[var(--brand-teal)]'
                            : 'border-transparent hover:bg-[var(--tint-navy)] hover:border-[var(--brand-teal)]',
                        )}
                      >
                        <Network
                          className={cn(
                            'w-4 h-4 mr-3 shrink-0 transition-colors',
                            isActive
                              ? 'text-[var(--brand-teal)]'
                              : 'text-[var(--ink-faint-2)] group-hover:text-[var(--brand-teal)]',
                          )}
                        />
                        <span
                          className={cn(
                            'font-medium',
                            isHero ? '' : 'text-sm truncate',
                            isActive
                              ? 'text-[var(--brand-navy)]'
                              : 'text-[var(--ink-soft)] group-hover:text-[var(--brand-navy)]',
                          )}
                        >
                          {getSuggestionLabel(concept)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    );
  },
);

export default ConceptSearchBar;
