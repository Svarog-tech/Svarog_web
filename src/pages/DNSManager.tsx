import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGlobe,
  faPlus,
  faTrash,
  faSync,
  faTimes,
  faExclamationTriangle,
  faServer,
  faNetworkWired,
  faEdit,
  faCheckCircle,
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../components/Toast';
import { getHostingService, HostingService } from '../lib/api';
import { getDnsDomains, getDnsRecords, addDnsRecord, deleteDnsRecord, DnsDomain, DnsRecord } from '../services/dnsService';
import Loading from '../components/Loading';
import './DNSManager.css';

const DNSManager: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { showSuccess, showError } = useToast();
  
  const [service, setService] = useState<HostingService | null>(null);
  const [dnsDomains, setDnsDomains] = useState<DnsDomain[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordsLoading, setRecordsLoading] = useState(false);
  
  // Dialogs
  const [showAddRecordModal, setShowAddRecordModal] = useState(false);
  const [showDeleteRecordModal, setShowDeleteRecordModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<DnsRecord | null>(null);
  
  // Form states
  const [recordForm, setRecordForm] = useState({
    name: '',
    type: 'A',
    value: '',
    priority: '',
    ttl: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load service
  useEffect(() => {
    if (user && id) {
      (async () => {
        try {
          const data = await getHostingService(Number(id));
          setService(data);
          if (data.hestia_created && data.hestia_username) {
            await fetchDnsDomains();
          }
        } catch {
          setPageError('Nepodařilo se načíst službu');
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [user, id]);

  const fetchDnsDomains = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const data = await getDnsDomains(Number(id));
      setDnsDomains(data);
      if (data.length > 0 && !selectedDomain) {
        setSelectedDomain(data[0].domain);
        await fetchRecords(data[0].domain);
      }
    } catch (err: any) {
      setError(err.message || 'Nepodařilo se načíst DNS domény');
    }
  }, [id, selectedDomain]);

  const fetchRecords = useCallback(async (domain: string) => {
    if (!id || !domain) return;
    try {
      setRecordsLoading(true);
      setError(null);
      const data = await getDnsRecords(Number(id), domain);
      setRecords(data);
    } catch (err: any) {
      setError(err.message || 'Nepodařilo se načíst DNS záznamy');
    } finally {
      setRecordsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (selectedDomain) {
      fetchRecords(selectedDomain);
    }
  }, [selectedDomain, fetchRecords]);

  const handleAddRecord = async () => {
    if (!recordForm.name || !recordForm.type || !recordForm.value) {
      showError('Vyplňte všechna povinná pole');
      return;
    }

    if (!selectedDomain) {
      showError('Vyberte DNS doménu');
      return;
    }

    // Validace priority pro MX záznamy
    if (recordForm.type === 'MX' && !recordForm.priority) {
      showError('Priority je povinná pro MX záznamy');
      return;
    }

    try {
      setIsSubmitting(true);
      await addDnsRecord(
        Number(id!),
        selectedDomain,
        recordForm.name,
        recordForm.type,
        recordForm.value,
        recordForm.priority ? Number(recordForm.priority) : undefined,
        recordForm.ttl ? Number(recordForm.ttl) : undefined
      );
      showSuccess('DNS záznam byl úspěšně přidán');
      setShowAddRecordModal(false);
      setRecordForm({ name: '', type: 'A', value: '', priority: '', ttl: '' });
      await fetchRecords(selectedDomain);
    } catch (err: any) {
      showError(err.message || 'Nepodařilo se přidat DNS záznam');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRecord = async () => {
    if (!selectedRecord || !selectedDomain) return;

    try {
      setIsSubmitting(true);
      await deleteDnsRecord(Number(id!), selectedDomain, selectedRecord.id);
      showSuccess('DNS záznam byl úspěšně smazán');
      setShowDeleteRecordModal(false);
      setSelectedRecord(null);
      await fetchRecords(selectedDomain);
    } catch (err: any) {
      showError(err.message || 'Nepodařilo se smazat DNS záznam');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRecordTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      A: '#3b82f6',
      AAAA: '#8b5cf6',
      CNAME: '#10b981',
      MX: '#f59e0b',
      TXT: '#ef4444',
      NS: '#6366f1',
      SRV: '#ec4899',
      CAA: '#14b8a6',
    };
    return colors[type.toUpperCase()] || 'var(--text-secondary)';
  };

  if (loading) {
    return <Loading message="Načítání..." className="dnsm-loading" />;
  }

  if (pageError || !service) {
    return (
      <div className="dnsm-loading">
        <FontAwesomeIcon icon={faExclamationTriangle} style={{ fontSize: '2rem', color: '#ef4444' }} />
        <p>{pageError || 'Služba nenalezena'}</p>
        <Link to="/services" className="dnsm-back-btn">Zpět na službu</Link>
      </div>
    );
  }

  if (!service.hestia_created || !service.hestia_username) {
    return (
      <div className="dnsm-loading">
        <FontAwesomeIcon icon={faServer} style={{ fontSize: '2rem', color: 'var(--text-secondary)' }} />
        <p>HestiaCP účet ještě nebyl vytvořen</p>
        <Link to="/services" className="dnsm-back-btn">Zpět na službu</Link>
      </div>
    );
  }

  return (
    <div className="dnsm-page">
      {/* Top Bar */}
      <div className="dnsm-topbar">
        <h1 className="dnsm-topbar-title">Správa DNS</h1>
        <div className="dnsm-toolbar">
          {selectedDomain && (
            <>
              <button 
                className="dnsm-toolbar-btn" 
                onClick={() => {
                  setRecordForm({ name: '', type: 'A', value: '', priority: '', ttl: '' });
                  setShowAddRecordModal(true);
                }}
                title="Nový DNS záznam"
              >
                <FontAwesomeIcon icon={faPlus} />
                <span>Nový záznam</span>
              </button>
              <div className="dnsm-toolbar-sep" />
            </>
          )}
          <button className="dnsm-toolbar-btn" onClick={fetchDnsDomains} title="Obnovit">
            <FontAwesomeIcon icon={faSync} />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="dnsm-error-banner">
          <span><FontAwesomeIcon icon={faExclamationTriangle} /> {error}</span>
          <button className="dnsm-error-close" onClick={() => setError(null)}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="dnsm-main">
        {dnsDomains.length === 0 ? (
          <div className="dnsm-empty">
            <FontAwesomeIcon icon={faGlobe} />
            <p>Zatím nemáte žádné DNS domény</p>
            <p className="dnsm-empty-hint">
              DNS domény jsou automaticky vytvářeny při přidání web domény.
            </p>
          </div>
        ) : (
          <div className="dnsm-content">
            {/* Domain Selector */}
            <div className="dnsm-domain-selector">
              <label>DNS doména:</label>
              <select
                value={selectedDomain || ''}
                onChange={(e) => setSelectedDomain(e.target.value)}
                className="dnsm-domain-select"
              >
                {dnsDomains.map((dnsDomain) => (
                  <option key={dnsDomain.domain} value={dnsDomain.domain}>
                    {dnsDomain.domain}
                  </option>
                ))}
              </select>
            </div>

            {/* Records Table */}
            {selectedDomain && (
              <div className="dnsm-records-section">
                <div className="dnsm-section-header">
                  <h2>
                    <FontAwesomeIcon icon={faNetworkWired} />
                    DNS záznamy pro {selectedDomain}
                  </h2>
                  {recordsLoading && (
                    <div className="dnsm-spinner-small" />
                  )}
                </div>

                {records.length === 0 ? (
                  <div className="dnsm-empty-records">
                    <p>Žádné DNS záznamy</p>
                    <button
                      className="dnsm-btn-primary"
                      onClick={() => {
                        setRecordForm({ name: '', type: 'A', value: '', priority: '', ttl: '' });
                        setShowAddRecordModal(true);
                      }}
                    >
                      <FontAwesomeIcon icon={faPlus} />
                      Přidat první záznam
                    </button>
                  </div>
                ) : (
                  <div className="dnsm-table-container table-responsive">
                    <table className="dnsm-table">
                      <thead>
                        <tr>
                          <th>Název</th>
                          <th>Typ</th>
                          <th>Hodnota</th>
                          <th>Priority</th>
                          <th>TTL</th>
                          <th>Akce</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((record) => (
                          <tr key={record.id}>
                            <td>
                              <span className="dnsm-record-name">{record.name || '@'}</span>
                            </td>
                            <td>
                              <span
                                className="dnsm-type-badge"
                                style={{ backgroundColor: getRecordTypeColor(record.type) }}
                              >
                                {record.type}
                              </span>
                            </td>
                            <td>
                              <span className="dnsm-record-value">{record.value}</span>
                            </td>
                            <td>
                              {record.priority ? (
                                <span className="dnsm-priority">{record.priority}</span>
                              ) : (
                                <span className="dnsm-empty-field">—</span>
                              )}
                            </td>
                            <td>
                              {record.ttl ? (
                                <span className="dnsm-ttl">{record.ttl}s</span>
                              ) : (
                                <span className="dnsm-empty-field">—</span>
                              )}
                            </td>
                            <td>
                              <div className="dnsm-actions">
                                <button
                                  className="dnsm-action-btn dnsm-action-danger"
                                  onClick={() => {
                                    setSelectedRecord(record);
                                    setShowDeleteRecordModal(true);
                                  }}
                                  title="Smazat"
                                >
                                  <FontAwesomeIcon icon={faTrash} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Record Modal */}
      <AnimatePresence>
        {showAddRecordModal && selectedDomain && (
          <>
            <motion.div
              className="dnsm-modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setShowAddRecordModal(false)}
            />
            <motion.div
              className="dnsm-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="dnsm-modal-header">
                <h2>Přidat DNS záznam</h2>
                <button
                  className="dnsm-modal-close"
                  onClick={() => !isSubmitting && setShowAddRecordModal(false)}
                  disabled={isSubmitting}
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
              <div className="dnsm-modal-body">
                <div className="dnsm-form-group">
                  <label>Doména</label>
                  <input
                    type="text"
                    value={selectedDomain}
                    disabled
                    className="dnsm-input-disabled"
                  />
                </div>
                <div className="dnsm-form-group">
                  <label>Název (subdoména)</label>
                  <input
                    type="text"
                    value={recordForm.name}
                    onChange={(e) => setRecordForm({ ...recordForm, name: e.target.value })}
                    placeholder="např. www, mail, @ pro root"
                    disabled={isSubmitting}
                    required
                  />
                  <div className="dnsm-form-hint">
                    Použijte @ pro root doménu, nebo název subdomény
                  </div>
                </div>
                <div className="dnsm-form-group">
                  <label>Typ</label>
                  <select
                    value={recordForm.type}
                    onChange={(e) => setRecordForm({ ...recordForm, type: e.target.value, priority: e.target.value === 'MX' ? recordForm.priority : '' })}
                    disabled={isSubmitting}
                    required
                  >
                    <option value="A">A (IPv4 adresa)</option>
                    <option value="AAAA">AAAA (IPv6 adresa)</option>
                    <option value="CNAME">CNAME (alias)</option>
                    <option value="MX">MX (mail server)</option>
                    <option value="TXT">TXT (textový záznam)</option>
                    <option value="NS">NS (name server)</option>
                    <option value="SRV">SRV (service record)</option>
                    <option value="CAA">CAA (certificate authority)</option>
                  </select>
                </div>
                <div className="dnsm-form-group">
                  <label>Hodnota</label>
                  <input
                    type="text"
                    value={recordForm.value}
                    onChange={(e) => setRecordForm({ ...recordForm, value: e.target.value })}
                    placeholder={
                      recordForm.type === 'A' ? 'např. 192.168.1.1' :
                      recordForm.type === 'AAAA' ? 'např. 2001:0db8::1' :
                      recordForm.type === 'CNAME' ? 'např. example.com' :
                      recordForm.type === 'MX' ? 'např. mail.example.com' :
                      'Hodnota záznamu'
                    }
                    disabled={isSubmitting}
                    required
                  />
                </div>
                {recordForm.type === 'MX' && (
                  <div className="dnsm-form-group">
                    <label>Priority</label>
                    <input
                      type="number"
                      value={recordForm.priority}
                      onChange={(e) => setRecordForm({ ...recordForm, priority: e.target.value })}
                      placeholder="např. 10"
                      min="0"
                      max="65535"
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                )}
                <div className="dnsm-form-group">
                  <label>TTL (volitelné)</label>
                  <input
                    type="number"
                    value={recordForm.ttl}
                    onChange={(e) => setRecordForm({ ...recordForm, ttl: e.target.value })}
                    placeholder="např. 3600"
                    min="60"
                    disabled={isSubmitting}
                  />
                  <div className="dnsm-form-hint">
                    Time to live v sekundách (výchozí: 3600)
                  </div>
                </div>
              </div>
              <div className="dnsm-modal-footer">
                <button
                  className="dnsm-btn-secondary"
                  onClick={() => setShowAddRecordModal(false)}
                  disabled={isSubmitting}
                >
                  Zrušit
                </button>
                <button
                  className="dnsm-btn-primary"
                  onClick={handleAddRecord}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Přidávání...' : 'Přidat záznam'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteRecordModal && selectedRecord && (
          <>
            <motion.div
              className="dnsm-modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setShowDeleteRecordModal(false)}
            />
            <motion.div
              className="dnsm-modal dnsm-modal-danger"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="dnsm-modal-header">
                <h2>Smazat DNS záznam</h2>
                <button
                  className="dnsm-modal-close"
                  onClick={() => !isSubmitting && setShowDeleteRecordModal(false)}
                  disabled={isSubmitting}
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
              <div className="dnsm-modal-body">
                <div className="dnsm-warning">
                  <FontAwesomeIcon icon={faExclamationTriangle} />
                  <p>
                    Opravdu chcete smazat DNS záznam <strong>{selectedRecord.name || '@'} {selectedRecord.type}</strong>?
                    Tato akce je nevratná.
                  </p>
                </div>
              </div>
              <div className="dnsm-modal-footer">
                <button
                  className="dnsm-btn-secondary"
                  onClick={() => setShowDeleteRecordModal(false)}
                  disabled={isSubmitting}
                >
                  Zrušit
                </button>
                <button
                  className="dnsm-btn-danger"
                  onClick={handleDeleteRecord}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Mazání...' : 'Smazat'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DNSManager;
