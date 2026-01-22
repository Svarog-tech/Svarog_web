import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faSpinner, faTimes, faCheckCircle, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { searchDomains, DomainSearchResult, getExtensionGroups, getPopularExtensions, getAllExtensions } from '../services/domainService';

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
              <div className="search-container">
                <FontAwesomeIcon icon={faSearch} className="search-icon" />
                <input
                  type="text"
                  placeholder="Zadejte název domény (např. mojestranky)"
                  value={searchDomain}
                  onChange={(e) => setSearchDomain(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="search-input"
                  disabled={isSearching}
                />
                <motion.button
                  className="search-button"
                  whileHover={{ scale: isSearching ? 1 : 1.05 }}
                  whileTap={{ scale: isSearching ? 1 : 0.95 }}
                  onClick={handleSearch}
                  disabled={isSearching}
                >
                  {isSearching ? (
                    <FontAwesomeIcon icon={faSpinner} spin />
                  ) : (
                    'Hledat'
                  )}
                </motion.button>
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
          className="search-results"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="container">
            <div className="results-header">
              <h2>Výsledky hledání pro "{searchResults.searchedDomain}"</h2>
              <p>Zkontrolovali jsme dostupnost domény ve všech populárních doménových příponách.</p>
            </div>

            <div className="results-grid">
              {(showAllResults ? searchResults.results : searchResults.results.slice(0, 10)).map((result, index: number) => (
                <motion.div
                  key={result.domain}
                  className={`result-card ${result.error ? 'error' : result.available ? 'available' : 'taken'}`}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  whileHover={{ y: -3, scale: 1.02 }}
                >
                  <div className="result-status">
                    <FontAwesomeIcon
                      icon={result.error ? faExclamationTriangle : result.available ? faCheckCircle : faTimes}
                      className={result.error ? 'error-icon' : result.available ? 'available-icon' : 'taken-icon'}
                    />
                    <span className="status-text">
                      {result.error ? 'Chyba' : result.available ? 'Dostupná' : 'Obsazená'}
                    </span>
                  </div>

                  <div className="result-domain">{result.domain}</div>

                  {result.error && (
                    <div className="result-error">
                      <small>{result.error}</small>
                    </div>
                  )}

                  {result.available && !result.error && (
                    <div className="result-price">
                      <span className="price">{result.price}</span>
                    </div>
                  )}

                  {result.error ? (
                    <button className="result-action disabled" disabled>
                      Nedostupné
                    </button>
                  ) : result.available ? (
                    <motion.button
                      className="result-action"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleRegistration(result.domain)}
                    >
                      Registrovat
                    </motion.button>
                  ) : (
                    <button className="result-action disabled" disabled>
                      Nedostupná
                    </button>
                  )}
                </motion.div>
              ))}
            </div>

            {searchResults.results.length > 10 && (
              <motion.div
                className="show-more-section"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <button
                  className="show-more-btn"
                  onClick={() => setShowAllResults(!showAllResults)}
                >
                  {showAllResults ? 'Zobrazit méně' : `Zobrazit více (${searchResults.results.length - 10} dalších)`}
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