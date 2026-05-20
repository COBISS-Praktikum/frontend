import { useEffect, useState } from 'react';
import { gql } from "@apollo/client";
import { useLazyQuery } from "@apollo/client/react";
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input.tsx';
import { Button } from '@/components/ui/button.tsx';
import { stripLanguageTag } from '@/lib/utils.ts';
import './SearchPage.css';

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
  const [suggestions, setSuggestions] = useState<ConceptSearchResult[]>([]);
  const navigate = useNavigate();
  const [searchConcepts, { loading, error }] = useLazyQuery<SearchConceptsResponse>(SEARCH_CONCEPTS);

  const selectedLanguage = i18n.resolvedLanguage ?? i18n.language ?? 'en';
  const searchLanguage = selectedLanguage.toLowerCase().startsWith('sl') ? 'sl' : 'en';

  const getSuggestionLabel = (concept: ConceptSearchResult) => {
    if (searchLanguage === 'sl') {
      return stripLanguageTag(concept.prefLabelSl ?? concept.prefLabelEn ?? concept.prefLabel) || concept.uri;
    }

    return stripLanguageTag(concept.prefLabelEn ?? concept.prefLabelSl ?? concept.prefLabel) || concept.uri;
  };

  useEffect(() => {
    let active = true;

    const runSearch = async () => {
      const query = searchQuery.trim();

      if (query.length <= 2) {
        setSuggestions([]);
        return;
      }

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
    };

    void runSearch();

    return () => {
      active = false;
    };
  }, [searchConcepts, searchLanguage, searchQuery]);

  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSuggestionClick = (uri: string) => {
    navigate(`/frontend/graph/${encodeURIComponent(uri)}`);
  };

  return (
      <div className="search-page-wrapper" style={{ width: '100%' }}>
      <section className="hero-section">
        <div className="hero-content">
          <h2 className="hero-title">{t('heroTitle')}</h2>
          <p className="hero-subtitle">{t('heroSubtitle')}</p>
          <div className="search-container">
            <div className="search-wrapper">
              <Input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={searchQuery}
                onChange={handleSearchChange}
                className="search-input"
              />
              <Button className="search-button">{t('searchButton')}</Button>
            </div>
            {loading && <p>Loading...</p>}
            {error && <p>Error: {error.message}</p>}
            {suggestions.length > 0 && (
              <ul className="suggestions-list">
                {suggestions.map((concept) => (
                  <li key={concept.uri} onClick={() => handleSuggestionClick(concept.uri)}>
                    {getSuggestionLabel(concept)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default SearchPage;