import { useState } from 'react';
import { gql } from "@apollo/client";
import { useLazyQuery } from "@apollo/client/react";
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input.tsx';
import { Button } from '@/components/ui/button.tsx';
import './SearchPage.css';

const SEARCH_CONCEPTS = gql`
  query SearchConcepts($text: String!) {
    searchConcepts(text: $text) {
      uri
      prefLabel
    }
  }
`;

function SearchPage() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const navigate = useNavigate();
  const [searchConcepts, { loading, error }] = useLazyQuery<any>(SEARCH_CONCEPTS);

  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.length > 2) {
      const { data } = await searchConcepts({ variables: { text: query } });
      if (data?.searchConcepts) {
        setSuggestions(data.searchConcepts);
      }
    } else {
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = (uri: string) => {
    navigate(`/graph/${encodeURIComponent(uri)}`);
  };

  return (
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
                  {concept.prefLabel}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

export default SearchPage;