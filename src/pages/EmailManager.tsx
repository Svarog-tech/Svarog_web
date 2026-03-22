import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faEnvelope,
  faPlus,
  faTrash,
  faKey,
  faSync,
  faTimes,
  faExclamationTriangle,
  faCheckCircle,
  faCircle,
  faServer,
  faExternalLinkAlt,
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../components/Toast';
import { getHostingService, HostingService } from '../lib/api';
import { getEmailAccounts, createEmailAccount, deleteEmailAccount, changeEmailPassword, EmailAccount } from '../services/emailService';
import Loading from '../components/Loading';
import './EmailManager.css';

const EmailManager: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { showSuccess, showError } = useToast();
  
  const [service, setService] = useState<HostingService | null>(null);
  const [emails, setEmails] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Dialogs
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailAccount | null>(null);
  
  // Form states
  const [createForm, setCreateForm] = useState({
    domain: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    password: '',
    confirmPassword: '',
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
            await fetchEmails();
          }
        } catch {
          setPageError('Nepodařilo se načíst službu');
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [user, id]);

  const fetchEmails = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const data = await getEmailAccounts(Number(id));
      setEmails(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se načíst emaily');
    }
  }, [id]);

  const handleCreateEmail = async () => {
    if (!createForm.domain || !createForm.email || !createForm.password) {
      showError('Vyplňte všechna pole');
      return;
    }

    if (createForm.password !== createForm.confirmPassword) {
      showError('Hesla se neshodují');
      return;
    }

    if (createForm.password.length < 8) {
      showError('Heslo musí mít alespoň 8 znaků');
      return;
    }

    try {
      setIsSubmitting(true);
      await createEmailAccount(
        Number(id!),
        createForm.domain,
        createForm.email,
        createForm.password
      );
      showSuccess('Email účet byl úspěšně vytvořen');
      setShowCreateModal(false);
      setCreateForm({ domain: '', email: '', password: '', confirmPassword: '' });
      await fetchEmails();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Nepodařilo se vytvořit email účet');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.password || passwordForm.password !== passwordForm.confirmPassword) {
      showError('Hesla se neshodují');
      return;
    }

    if (passwordForm.password.length < 8) {
      showError('Heslo musí mít alespoň 8 znaků');
      return;
    }

    if (!selectedEmail) return;

    try {
      setIsSubmitting(true);
      await changeEmailPassword(
        Number(id!),
        selectedEmail.id,
        passwordForm.password
      );
      showSuccess('Heslo bylo úspěšně změněno');
      setShowPasswordModal(false);
      setSelectedEmail(null);
      setPasswordForm({ password: '', confirmPassword: '' });
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Nepodařilo se změnit heslo');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEmail = async () => {
    if (!selectedEmail) return;

    try {
      setIsSubmitting(true);
      await deleteEmailAccount(Number(id!), selectedEmail.id);
      showSuccess('Email účet byl úspěšně smazán');
      setShowDeleteModal(false);
      setSelectedEmail(null);
      await fetchEmails();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Nepodařilo se smazat email účet');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatQuota = (used: number, limit: number): string => {
    if (limit === 0) return 'Neomezeno';
    const usedMB = (used / 1024).toFixed(2);
    const limitMB = (limit / 1024).toFixed(2);
    return `${usedMB} MB / ${limitMB} MB`;
  };

  const getQuotaPercent = (used: number, limit: number): number => {
    if (limit === 0) return 0;
    return Math.round((used / limit) * 100);
  };

  const getQuotaLevel = (percent: number): 'low' | 'medium' | 'high' | 'critical' => {
    if (percent >= 90) return 'critical';
    if (percent >= 75) return 'high';
    if (percent >= 50) return 'medium';
    return 'low';
  };

  if (loading) {
    return <Loading message="Načítání..." className="em-loading" />;
  }

  if (pageError || !service) {
    return (
      <div className="em-loading">
        <FontAwesomeIcon icon={faExclamationTriangle} style={{ fontSize: '2rem', color: '#ef4444' }} />
        <p>{pageError || 'Služba nenalezena'}</p>
        <Link to="/services" className="em-back-btn">Zpět na služby</Link>
      </div>
    );
  }

  if (!service.hestia_created || !service.hestia_username) {
    return (
      <div className="em-loading">
        <FontAwesomeIcon icon={faServer} style={{ fontSize: '2rem', color: 'var(--text-secondary)' }} />
        <p>HestiaCP účet ještě nebyl vytvořen</p>
        <Link to="/services" className="em-back-btn">Zpět na služby</Link>
      </div>
    );
  }

  // Get available domains from service
  const availableDomains = service.hestia_domain ? [service.hestia_domain] : [];

  return (
    <div className="em-page">
      {/* Top Bar */}
      <div className="em-topbar">
        <h1 className="em-topbar-title">Správa Emailů</h1>
        <div className="em-toolbar">
          <button 
            className="em-toolbar-btn" 
            onClick={() => {
              setCreateForm({ ...createForm, domain: availableDomains[0] || '' });
              setShowCreateModal(true);
            }}
            title="Nový email"
          >
            <FontAwesomeIcon icon={faPlus} />
            <span>Nový email</span>
          </button>
          <div className="em-toolbar-sep" />
          <button className="em-toolbar-btn" onClick={fetchEmails} title="Obnovit" aria-label="Obnovit emailové schránky">
            <FontAwesomeIcon icon={faSync} />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="em-error-banner">
          <span><FontAwesomeIcon icon={faExclamationTriangle} /> {error}</span>
          <button className="em-error-close" onClick={() => setError(null)}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      )}

      {/* Email List */}
      <div className="em-main">
        {emails.length === 0 ? (
          <div className="em-empty">
            <FontAwesomeIcon icon={faEnvelope} />
            <p>Zatím nemáte žádné email účty</p>
            <button 
              className="em-btn-primary"
              onClick={() => {
                setCreateForm({ ...createForm, domain: availableDomains[0] || '' });
                setShowCreateModal(true);
              }}
            >
              <FontAwesomeIcon icon={faPlus} />
              Vytvořit první email
            </button>
          </div>
        ) : (
          <div className="em-table-container table-responsive">
            <table className="em-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Doména</th>
                  <th>Quota</th>
                  <th>Stav</th>
                  <th>Akce</th>
                </tr>
              </thead>
              <tbody>
                {emails.map((email) => {
                  const quotaPercent = getQuotaPercent(email.quota_used, email.quota_limit);
                  const quotaLevel = getQuotaLevel(quotaPercent);
                  
                  return (
                    <tr key={email.id}>
                      <td>
                        <div className="em-email-cell">
                          <FontAwesomeIcon icon={faEnvelope} className="em-email-icon" />
                          <span>{email.email}</span>
                        </div>
                      </td>
                      <td>{email.domain}</td>
                      <td>
                        <div className="em-quota-cell">
                          <div className="em-quota-info">
                            <span>{formatQuota(email.quota_used, email.quota_limit)}</span>
                            {email.quota_limit > 0 && (
                              <span className="em-quota-percent">{quotaPercent}%</span>
                            )}
                          </div>
                          {email.quota_limit > 0 && (
                            <div className="em-quota-bar">
                              <div
                                className={`em-quota-fill em-quota-${quotaLevel}`}
                                style={{ width: `${Math.min(quotaPercent, 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        {email.suspended ? (
                          <span className="em-status em-status-suspended">
                            <FontAwesomeIcon icon={faCircle} />
                            Pozastaveno
                          </span>
                        ) : (
                          <span className="em-status em-status-active">
                            <FontAwesomeIcon icon={faCheckCircle} />
                            Aktivní
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="em-actions">
                          <button
                            className="em-action-btn"
                            onClick={() => {
                              setSelectedEmail(email);
                              setPasswordForm({ password: '', confirmPassword: '' });
                              setShowPasswordModal(true);
                            }}
                            title="Změnit heslo"
                          >
                            <FontAwesomeIcon icon={faKey} />
                          </button>
                          <button
                            className="em-action-btn em-action-danger"
                            onClick={() => {
                              setSelectedEmail(email);
                              setShowDeleteModal(true);
                            }}
                            title="Smazat"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Email Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <>
            <motion.div
              className="em-modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setShowCreateModal(false)}
            />
            <motion.div
              className="em-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="em-modal-header">
                <h2>Vytvořit nový email účet</h2>
                <button
                  className="em-modal-close"
                  onClick={() => !isSubmitting && setShowCreateModal(false)}
                  disabled={isSubmitting}
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
              <div className="em-modal-body">
                <div className="em-form-group">
                  <label>Doména</label>
                  <select
                    value={createForm.domain}
                    onChange={(e) => setCreateForm({ ...createForm, domain: e.target.value })}
                    disabled={isSubmitting}
                    required
                  >
                    <option value="">Vyberte doménu</option>
                    {availableDomains.map((domain) => (
                      <option key={domain} value={domain}>
                        {domain}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="em-form-group">
                  <label>Email (bez @doména)</label>
                  <input
                    type="text"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    placeholder="např. info"
                    disabled={isSubmitting}
                    required
                  />
                  {createForm.domain && (
                    <div className="em-form-hint">
                      Plná adresa: {createForm.email || '...'}@{createForm.domain}
                    </div>
                  )}
                </div>
                <div className="em-form-group">
                  <label>Heslo</label>
                  <input
                    type="password"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    placeholder="Minimálně 8 znaků"
                    disabled={isSubmitting}
                    required
                  />
                </div>
                <div className="em-form-group">
                  <label>Potvrzení hesla</label>
                  <input
                    type="password"
                    value={createForm.confirmPassword}
                    onChange={(e) => setCreateForm({ ...createForm, confirmPassword: e.target.value })}
                    placeholder="Zadejte heslo znovu"
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>
              <div className="em-modal-footer">
                <button
                  className="em-btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isSubmitting}
                >
                  Zrušit
                </button>
                <button
                  className="em-btn-primary"
                  onClick={handleCreateEmail}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Vytváření...' : 'Vytvořit'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Change Password Modal */}
      <AnimatePresence>
        {showPasswordModal && selectedEmail && (
          <>
            <motion.div
              className="em-modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setShowPasswordModal(false)}
            />
            <motion.div
              className="em-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="em-modal-header">
                <h2>Změnit heslo pro {selectedEmail.email}</h2>
                <button
                  className="em-modal-close"
                  onClick={() => !isSubmitting && setShowPasswordModal(false)}
                  disabled={isSubmitting}
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
              <div className="em-modal-body">
                <div className="em-form-group">
                  <label>Nové heslo</label>
                  <input
                    type="password"
                    value={passwordForm.password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
                    placeholder="Minimálně 8 znaků"
                    disabled={isSubmitting}
                    required
                  />
                </div>
                <div className="em-form-group">
                  <label>Potvrzení hesla</label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    placeholder="Zadejte heslo znovu"
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>
              <div className="em-modal-footer">
                <button
                  className="em-btn-secondary"
                  onClick={() => setShowPasswordModal(false)}
                  disabled={isSubmitting}
                >
                  Zrušit
                </button>
                <button
                  className="em-btn-primary"
                  onClick={handleChangePassword}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Ukládání...' : 'Změnit heslo'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && selectedEmail && (
          <>
            <motion.div
              className="em-modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setShowDeleteModal(false)}
            />
            <motion.div
              className="em-modal em-modal-danger"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="em-modal-header">
                <h2>Smazat email účet</h2>
                <button
                  className="em-modal-close"
                  onClick={() => !isSubmitting && setShowDeleteModal(false)}
                  disabled={isSubmitting}
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
              <div className="em-modal-body">
                <div className="em-warning">
                  <FontAwesomeIcon icon={faExclamationTriangle} />
                  <p>
                    Opravdu chcete smazat email účet <strong>{selectedEmail.email}</strong>?
                    Tato akce je nevratná a všechna data v této emailové schránce budou ztracena.
                  </p>
                </div>
              </div>
              <div className="em-modal-footer">
                <button
                  className="em-btn-secondary"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isSubmitting}
                >
                  Zrušit
                </button>
                <button
                  className="em-btn-danger"
                  onClick={handleDeleteEmail}
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

export default EmailManager;
