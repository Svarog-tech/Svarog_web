import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGlobe,
  faSync,
  faTimes,
  faExclamationTriangle,
  faCheckCircle,
  faCircle,
  faServer,
  faShieldAlt,
  faInfoCircle,
  faExternalLinkAlt,
  faLock,
  faUnlock,
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../components/Toast';
import { getHostingService, HostingService } from '../lib/api';
import { getWebDomains, getWebDomainInfo, WebDomain } from '../services/domainService';
import Loading from '../components/Loading';
import './DomainManager.css';

const DomainManager: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { showSuccess, showError } = useToast();
  
  const [service, setService] = useState<HostingService | null>(null);
  const [domains, setDomains] = useState<WebDomain[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<WebDomain | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingDomain, setLoadingDomain] = useState<string | null>(null);
  const [showDomainDetail, setShowDomainDetail] = useState(false);

  // Load service
  useEffect(() => {
    if (user && id) {
      (async () => {
        try {
          const data = await getHostingService(Number(id));
          setService(data);
          if (data.hestia_created && data.hestia_username) {
            await fetchDomains();
          }
        } catch {
          setPageError('Nepodařilo se načíst službu');
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [user, id]);

  const fetchDomains = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const data = await getWebDomains(Number(id));
      setDomains(data);
    } catch (err: any) {
      setError(err.message || 'Nepodařilo se načíst domény');
    }
  }, [id]);

  const handleViewDomain = async (domain: WebDomain) => {
    try {
      setLoadingDomain(domain.domain);
      const detail = await getWebDomainInfo(Number(id!), domain.domain);
      setSelectedDomain(detail);
      setShowDomainDetail(true);
    } catch (err: any) {
      showError(err.message || 'Nepodařilo se načíst detail domény');
    } finally {
      setLoadingDomain(null);
    }
  };

  const formatAliases = (aliases: string): string[] => {
    if (!aliases || aliases.trim() === '') return [];
    return aliases.split(',').map(a => a.trim()).filter(a => a.length > 0);
  };

  if (loading) {
    return <Loading message="Načítání..." className="dm-loading" />;
  }

  if (pageError || !service) {
    return (
      <div className="dm-loading">
        <FontAwesomeIcon icon={faExclamationTriangle} style={{ fontSize: '2rem', color: '#ef4444' }} />
        <p>{pageError || 'Služba nenalezena'}</p>
        <Link to="/services" className="dm-back-btn">Zpět na službu</Link>
      </div>
    );
  }

  if (!service.hestia_created || !service.hestia_username) {
    return (
      <div className="dm-loading">
        <FontAwesomeIcon icon={faServer} style={{ fontSize: '2rem', color: 'var(--text-secondary)' }} />
        <p>HestiaCP účet ještě nebyl vytvořen</p>
        <Link to="/services" className="dm-back-btn">Zpět na službu</Link>
      </div>
    );
  }

  return (
    <div className="dm-page">
      {/* Top Bar */}
      <div className="dm-topbar">
        <h1 className="dm-topbar-title">Správa Domén</h1>
        <div className="dm-toolbar">
          <button className="dm-toolbar-btn" onClick={fetchDomains} title="Obnovit">
            <FontAwesomeIcon icon={faSync} />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="dm-error-banner">
          <span><FontAwesomeIcon icon={faExclamationTriangle} /> {error}</span>
          <button className="dm-error-close" onClick={() => setError(null)}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      )}

      {/* Domain List */}
      <div className="dm-main">
        {domains.length === 0 ? (
          <div className="dm-empty">
            <FontAwesomeIcon icon={faGlobe} />
            <p>Zatím nemáte žádné web domény</p>
          </div>
        ) : (
          <div className="dm-grid">
            {domains.map((domain) => {
              const aliases = formatAliases(domain.aliases);
              
              return (
                <motion.div
                  key={domain.domain}
                  className="dm-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="dm-card-header">
                    <div className="dm-card-title">
                      <FontAwesomeIcon icon={faGlobe} />
                      <span>{domain.domain}</span>
                    </div>
                    {domain.suspended ? (
                      <span className="dm-status dm-status-suspended">
                        <FontAwesomeIcon icon={faCircle} />
                        Pozastaveno
                      </span>
                    ) : (
                      <span className="dm-status dm-status-active">
                        <FontAwesomeIcon icon={faCheckCircle} />
                        Aktivní
                      </span>
                    )}
                  </div>

                  <div className="dm-card-body">
                    <div className="dm-info-row">
                      <span className="dm-info-label">IP adresa:</span>
                      <span className="dm-info-value">{domain.ip || '—'}</span>
                    </div>
                    
                    <div className="dm-info-row">
                      <span className="dm-info-label">SSL:</span>
                      <span className={`dm-info-value dm-ssl-${domain.ssl ? 'active' : 'inactive'}`}>
                        {domain.ssl ? (
                          <>
                            <FontAwesomeIcon icon={faLock} />
                            Aktivní
                          </>
                        ) : (
                          <>
                            <FontAwesomeIcon icon={faUnlock} />
                            Neaktivní
                          </>
                        )}
                      </span>
                    </div>

                    {aliases.length > 0 && (
                      <div className="dm-info-row">
                        <span className="dm-info-label">Aliasy:</span>
                        <span className="dm-info-value">{aliases.length} aliasů</span>
                      </div>
                    )}

                    <div className="dm-info-row">
                      <span className="dm-info-label">Document root:</span>
                      <span className="dm-info-value dm-path">{domain.document_root || '—'}</span>
                    </div>
                  </div>

                  <div className="dm-card-footer">
                    <button
                      className="dm-btn-secondary"
                      onClick={() => handleViewDomain(domain)}
                      disabled={loadingDomain === domain.domain}
                    >
                      {loadingDomain === domain.domain ? (
                        <>
                          <div className="dm-spinner" />
                          Načítání...
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon icon={faInfoCircle} />
                          Detail
                        </>
                      )}
                    </button>
                    {domain.ssl && (
                      <a
                        href={`https://${domain.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="dm-btn-primary"
                      >
                        <FontAwesomeIcon icon={faExternalLinkAlt} />
                        Otevřít
                      </a>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Domain Detail Modal */}
      <AnimatePresence>
        {showDomainDetail && selectedDomain && (
          <>
            <motion.div
              className="dm-modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDomainDetail(false)}
            />
            <motion.div
              className="dm-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="dm-modal-header">
                <h2>
                  <FontAwesomeIcon icon={faGlobe} />
                  {selectedDomain.domain}
                </h2>
                <button
                  className="dm-modal-close"
                  onClick={() => setShowDomainDetail(false)}
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
              <div className="dm-modal-body">
                <div className="dm-detail-section">
                  <h3>Základní informace</h3>
                  <div className="dm-detail-grid">
                    <div className="dm-detail-item">
                      <span className="dm-detail-label">Doména</span>
                      <span className="dm-detail-value">{selectedDomain.domain}</span>
                    </div>
                    <div className="dm-detail-item">
                      <span className="dm-detail-label">IP adresa</span>
                      <span className="dm-detail-value">{selectedDomain.ip || '—'}</span>
                    </div>
                    <div className="dm-detail-item">
                      <span className="dm-detail-label">Stav</span>
                      <span className={`dm-status dm-status-${selectedDomain.suspended ? 'suspended' : 'active'}`}>
                        {selectedDomain.suspended ? (
                          <>
                            <FontAwesomeIcon icon={faCircle} />
                            Pozastaveno
                          </>
                        ) : (
                          <>
                            <FontAwesomeIcon icon={faCheckCircle} />
                            Aktivní
                          </>
                        )}
                      </span>
                    </div>
                    <div className="dm-detail-item">
                      <span className="dm-detail-label">Document root</span>
                      <span className="dm-detail-value dm-path">{selectedDomain.document_root || '—'}</span>
                    </div>
                  </div>
                </div>

                <div className="dm-detail-section">
                  <h3>
                    <FontAwesomeIcon icon={faShieldAlt} />
                    SSL certifikát
                  </h3>
                  <div className="dm-detail-grid">
                    <div className="dm-detail-item">
                      <span className="dm-detail-label">SSL status</span>
                      <span className={`dm-info-value dm-ssl-${selectedDomain.ssl ? 'active' : 'inactive'}`}>
                        {selectedDomain.ssl ? (
                          <>
                            <FontAwesomeIcon icon={faLock} />
                            Aktivní
                          </>
                        ) : (
                          <>
                            <FontAwesomeIcon icon={faUnlock} />
                            Neaktivní
                          </>
                        )}
                      </span>
                    </div>
                    {selectedDomain.ssl && (
                      <>
                        {selectedDomain.ssl_cert && (
                          <div className="dm-detail-item dm-detail-full">
                            <span className="dm-detail-label">SSL certifikát</span>
                            <span className="dm-detail-value dm-cert">{selectedDomain.ssl_cert.substring(0, 100)}...</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {formatAliases(selectedDomain.aliases).length > 0 && (
                  <div className="dm-detail-section">
                    <h3>Aliasy</h3>
                    <div className="dm-aliases-list">
                      {formatAliases(selectedDomain.aliases).map((alias, idx) => (
                        <div key={idx} className="dm-alias-item">
                          <FontAwesomeIcon icon={faGlobe} />
                          <span>{alias}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="dm-modal-footer">
                <button
                  className="dm-btn-secondary"
                  onClick={() => setShowDomainDetail(false)}
                >
                  Zavřít
                </button>
                {selectedDomain.ssl && (
                  <a
                    href={`https://${selectedDomain.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="dm-btn-primary"
                  >
                    <FontAwesomeIcon icon={faExternalLinkAlt} />
                    Otevřít web
                  </a>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DomainManager;
