import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faSpinner, faTimes, faCheckCircle, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { searchDomains, DomainSearchResult, getExtensionGroups, getPopularExtensions, getAllExtensions } from '../services/domainService';
import PageMeta from '../components/PageMeta';

const DomainsSimple: React.FC = () => {
  const [searchDomain, setSearchDomain] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<DomainSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>('popular');
  const [showAllResults, setShowAllResults] = useState(false);
  const [showRegistrationInfo, setShowRegistrationInfo] = useState(false);

  const extensionGroups = getExtensionGroups();
  const popularExtensions = getPopularExtensions();

  const handleSearch = async () => {
    if (!searchDomain.trim()) {
      setError('Zadejte název domény');
      return;
    }

    setIsSearching(true);
    setError(null);
    setSearchResults(null);

    try {
      // Get extensions based on selected group
      let extensionsToCheck: string[] = [];

      if (selectedGroup === 'popular') {
        extensionsToCheck = popularExtensions;
      } else if (selectedGroup === 'all') {
        extensionsToCheck = getAllExtensions().slice(0, 10); // Limit to 10 for performance
      } else {
        extensionsToCheck = extensionGroups[selectedGroup] || popularExtensions;
        extensionsToCheck = extensionsToCheck.slice(0, 10); // Limit to 10
      }

      const results = await searchDomains(searchDomain, extensionsToCheck);
      setSearchResults(results);
    } catch (error: any) {
      setError(error.message || 'Došlo k chybě při vyhledávání domén');
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleRegistration = (domain: string) => {
    setShowRegistrationInfo(true);
    // Auto hide after 5 seconds
    setTimeout(() => {
      setShowRegistrationInfo(false);
    }, 5000);
  };

  return (
    <main className="domains-page">
      <PageMeta
        title="Domény – registrace a vyhledávání | Alatyr Hosting"
        description="Vyhledejte a zaregistrujte doménu .cz, .eu, .com a další. Jednoduchá správa DNS a přenos domén u Alatyr Hosting."
        path="/domains"
      />
      <div className="domains-animated-bg" />
      <motion.section
        className="domains-hero"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="container">
          <div className="domains-hero-content">
            <motion.h1
              className="domains-title"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Vyhledávání <span className="gradient-text">domén</span>
            </motion.h1>
            <motion.p
              className="domains-description"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              Zadejte název domény a zjistěte, zda je dostupná. Zkontrolujeme všechny populární přípony pomocí WHOIS databáze.
            </motion.p>

            <motion.div
              className="domain-search"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <div className="domain-search-grid"></div>
              <div className="domain-search-poda">
                <div className="domain-search-glow"></div>
                <div className="domain-search-darkBorderBg"></div>
                <div className="domain-search-darkBorderBg"></div>
                <div className="domain-search-darkBorderBg"></div>
                <div className="domain-search-white"></div>
                <div className="domain-search-border"></div>
                <div className="domain-search-main">
                  <input
                    placeholder="Zadejte název domény..."
                    type="text"
                    value={searchDomain}
                    onChange={(e) => setSearchDomain(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="domain-search-input"
                    disabled={isSearching}
                  />
                  <div className="domain-search-input-mask"></div>
                  <div className="domain-search-pink-mask"></div>
                  <motion.button
                    type="button"
                    className="domain-search-btn"
                    whileHover={{ scale: isSearching ? 1 : 1.02 }}
                    whileTap={{ scale: isSearching ? 1 : 0.98 }}
                    onClick={handleSearch}
                    disabled={isSearching}
                    aria-label={isSearching ? 'Vyhledávání...' : 'Vyhledat doménu'}
                  >
                    <span className="domain-search-btn__icon">
                      {isSearching ? (
                        <svg
                          className="domain-search-btn__spinner"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden="true"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="9"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeDasharray="45 15"
                          />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <circle
                            cx="11"
                            cy="11"
                            r="6"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          />
                          <path
                            d="M16 16L20 20"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                    </span>
                  </motion.button>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="extension-selector"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
            >
              <div className="selector-label">Vyberte kategorii přípon:</div>
              <div className="selector-buttons">
                <button
                  className={`selector-btn ${selectedGroup === 'popular' ? 'active' : ''}`}
                  onClick={() => setSelectedGroup('popular')}
                >
                  Populární
                </button>
                {Object.keys(extensionGroups).map(groupName => (
                  <button
                    key={groupName}
                    className={`selector-btn ${selectedGroup === groupName ? 'active' : ''}`}
                    onClick={() => setSelectedGroup(groupName)}
                  >
                    {groupName}
                  </button>
                ))}
                <button
                  className={`selector-btn ${selectedGroup === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedGroup('all')}
                >
                  Všechny
                </button>
              </div>
            </motion.div>

            {error && (
              <motion.div
                className="search-error"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <FontAwesomeIcon icon={faTimes} />
                <span>{error}</span>
              </motion.div>
            )}
          </div>
        </div>
      </motion.section>

      {searchResults && (
        <motion.section
          className="domain-results"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          aria-label="Výsledky vyhledávání domén"
        >
          <div className="container">
            <header className="domain-results__header">
              <h2 className="domain-results__title">
                Výsledky pro <span className="domain-results__query">{searchResults.searchedDomain}</span>
              </h2>
              <p className="domain-results__subtitle">
                Nalezeno {searchResults.results.filter(r => r.available && !r.error).length} dostupných z {searchResults.results.length} kontrolovaných přípon
              </p>
            </header>

            <div className="domain-results__summary" role="status" aria-live="polite">
              <div className="domain-results__stat domain-results__stat--available">
                <span className="domain-results__stat-number">{searchResults.results.filter(r => r.available && !r.error).length}</span>
                <span className="domain-results__stat-label">Dostupné</span>
              </div>
              <div className="domain-results__stat domain-results__stat--taken">
                <span className="domain-results__stat-number">{searchResults.results.filter(r => !r.available && !r.error).length}</span>
                <span className="domain-results__stat-label">Obsazené</span>
              </div>
              <div className="domain-results__stat domain-results__stat--error">
                <span className="domain-results__stat-number">{searchResults.results.filter(r => r.error).length}</span>
                <span className="domain-results__stat-label">Chyby</span>
              </div>
            </div>

            <ul className="domain-results__grid" role="list">
              {(showAllResults ? searchResults.results : searchResults.results.slice(0, 10)).map((result, index: number) => (
                <motion.li
                  key={result.domain}
                  className={`domain-card ${result.error ? 'domain-card--error' : result.available ? 'domain-card--available' : 'domain-card--taken'}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <div className="domain-card__status" aria-label={result.error ? 'Chyba při kontrole' : result.available ? 'Doména je dostupná' : 'Doména je obsazená'}>
                    <span className="domain-card__status-icon">
                      <FontAwesomeIcon
                        icon={result.error ? faExclamationTriangle : result.available ? faCheckCircle : faTimes}
                        aria-hidden="true"
                      />
                    </span>
                    <span className="domain-card__status-text">
                      {result.error ? 'Chyba' : result.available ? 'Dostupná' : 'Obsazená'}
                    </span>
                  </div>

                  <h3 className="domain-card__name">{result.domain}</h3>

                  {result.error ? (
                    <p className="domain-card__error">{result.error}</p>
                  ) : result.available ? (
                    <p className="domain-card__price">
                      <span className="domain-card__price-value">{result.price}</span>
                      <span className="domain-card__price-period">/rok</span>
                    </p>
                  ) : (
                    <p className="domain-card__taken-info">Tato doména je již registrována</p>
                  )}

                  <div className="domain-card__action">
                    {result.error ? (
                      <button
                        className="domain-card__btn domain-card__btn--disabled"
                        disabled
                        aria-disabled="true"
                      >
                        Nedostupné
                      </button>
                    ) : result.available ? (
                      <motion.button
                        className="domain-card__btn domain-card__btn--primary"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleRegistration(result.domain)}
                        aria-label={`Registrovat doménu ${result.domain}`}
                      >
                        Registrovat
                      </motion.button>
                    ) : (
                      <button
                        className="domain-card__btn domain-card__btn--disabled"
                        disabled
                        aria-disabled="true"
                      >
                        Nedostupná
                      </button>
                    )}
                  </div>
                </motion.li>
              ))}
            </ul>

            {searchResults.results.length > 10 && (
              <motion.div
                className="domain-results__more"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.3 }}
              >
                <button
                  className="domain-results__more-btn"
                  onClick={() => setShowAllResults(!showAllResults)}
                  aria-expanded={showAllResults}
                  aria-controls="domain-results-list"
                >
                  <span>{showAllResults ? 'Zobrazit méně' : `Zobrazit dalších ${searchResults.results.length - 10}`}</span>
                  <svg
                    className={`domain-results__more-icon ${showAllResults ? 'domain-results__more-icon--rotated' : ''}`}
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </motion.div>
            )}
          </div>
        </motion.section>
      )}

      {/* Registration info notification */}
      {showRegistrationInfo && (
        <motion.div
          className="registration-notification"
          initial={{ opacity: 0, y: 100, scale: 0.3 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.3 }}
          transition={{ duration: 0.5, ease: "backOut" }}
        >
          <div className="notification-content">
            <FontAwesomeIcon icon={faExclamationTriangle} className="notification-icon" />
            <div className="notification-text">
              <h3>Registrace domén</h3>
              <p>Zatím neděláme registrace domén. Pro registraci doporučujeme použít ověřené registrátory jako Wedos.cz nebo Forpsi.com.</p>
            </div>
            <button
              className="notification-close"
              onClick={() => setShowRegistrationInfo(false)}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
        </motion.div>
      )}
    </main>
  );
};

export default DomainsSimple;