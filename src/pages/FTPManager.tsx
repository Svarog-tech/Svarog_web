import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faFolder,
  faPlus,
  faTrash,
  faKey,
  faSync,
  faTimes,
  faExclamationTriangle,
  faCheckCircle,
  faCircle,
  faServer,
  faGlobe,
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { getHostingService, HostingService } from '../lib/api';
import { getWebDomains } from '../services/domainService';
import { getFtpAccounts, createFtpAccount, deleteFtpAccount, changeFtpPassword, FtpAccount } from '../services/ftpService';
import Loading from '../components/Loading';
import './FTPManager.css';

const FTPManager: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const [service, setService] = useState<HostingService | null>(null);
  const [webDomains, setWebDomains] = useState<{ domain: string }[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [accounts, setAccounts] = useState<FtpAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<FtpAccount | null>(null);

  const [createForm, setCreateForm] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    path: 'public_html',
  });
  const [passwordForm, setPasswordForm] = useState({
    password: '',
    confirmPassword: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user && id) {
      (async () => {
        try {
          const data = await getHostingService(Number(id));
          setService(data);
          if (data.hestia_created && data.hestia_username) {
            const domains = await getWebDomains(Number(id));
            setWebDomains(domains.map((d) => ({ domain: d.domain })));
            const defaultDomain = data.hestia_domain || (domains[0]?.domain ?? '');
            setSelectedDomain(defaultDomain);
            if (defaultDomain) await fetchFtp(defaultDomain);
          }
        } catch {
          setPageError('Nepodařilo se načíst službu');
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [user, id]);

  const fetchFtp = useCallback(
    async (domain: string) => {
      if (!id || !domain) return;
      try {
        setError(null);
        const { accounts: list } = await getFtpAccounts(Number(id), domain);
        setAccounts(list);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Nepodařilo se načíst FTP účty');
      }
    },
    [id]
  );

  useEffect(() => {
    if (selectedDomain) fetchFtp(selectedDomain);
  }, [selectedDomain, fetchFtp]);

  const handleCreateFtp = async () => {
    if (!createForm.username || !createForm.password) {
      showError('Vyplňte uživatelské jméno a heslo');
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
    if (!selectedDomain) {
      showError('Vyberte doménu');
      return;
    }
    try {
      setIsSubmitting(true);
      await createFtpAccount(
        Number(id!),
        createForm.username,
        createForm.password,
        createForm.path,
        selectedDomain
      );
      showSuccess('FTP účet byl úspěšně vytvořen');
      setShowCreateModal(false);
      setCreateForm({ username: '', password: '', confirmPassword: '', path: 'public_html' });
      await fetchFtp(selectedDomain);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Nepodařilo se vytvořit FTP účet');
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
    if (!selectedAccount || !selectedDomain) return;
    try {
      setIsSubmitting(true);
      await changeFtpPassword(Number(id!), selectedDomain, selectedAccount.id, passwordForm.password);
      showSuccess('Heslo bylo úspěšně změněno');
      setShowPasswordModal(false);
      setSelectedAccount(null);
      setPasswordForm({ password: '', confirmPassword: '' });
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Nepodařilo se změnit heslo');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteFtp = async () => {
    if (!selectedAccount || !selectedDomain) return;
    try {
      setIsSubmitting(true);
      await deleteFtpAccount(Number(id!), selectedDomain, selectedAccount.id);
      showSuccess('FTP účet byl úspěšně smazán');
      setShowDeleteModal(false);
      setSelectedAccount(null);
      await fetchFtp(selectedDomain);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Nepodařilo se smazat FTP účet');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <Loading message="Načítání..." className="ftpm-loading" />;
  }

  if (pageError || !service) {
    return (
      <div className="ftpm-loading">
        <FontAwesomeIcon icon={faExclamationTriangle} style={{ fontSize: '2rem', color: '#ef4444' }} />
        <p>{pageError || 'Služba nenalezena'}</p>
        <Link to={`/services/${id}`} className="ftpm-back-btn">
          Zpět na službu
        </Link>
      </div>
    );
  }

  if (!service.hestia_created || !service.hestia_username) {
    return (
      <div className="ftpm-loading">
        <FontAwesomeIcon icon={faServer} style={{ fontSize: '2rem', color: 'var(--text-secondary)' }} />
        <p>HestiaCP účet ještě nebyl vytvořen</p>
        <Link to={`/services/${id}`} className="ftpm-back-btn">
          Zpět na službu
        </Link>
      </div>
    );
  }

  const availableDomains = webDomains.length > 0 ? webDomains : service.hestia_domain ? [{ domain: service.hestia_domain }] : [];

  return (
    <div className="ftpm-page">
      <div className="ftpm-topbar">
        <div className="ftpm-topbar-left">
          <Link to={`/services/${id}`} className="ftpm-back-btn">
            <FontAwesomeIcon icon={faArrowLeft} />
            Zpět
          </Link>
          <h1 className="ftpm-topbar-title">
            Správa FTP — {service.hestia_domain || service.plan_name}
          </h1>
        </div>
        <div className="ftpm-toolbar">
          {selectedDomain && (
            <>
              <button
                className="ftpm-toolbar-btn"
                onClick={() => {
                  setCreateForm({ username: '', password: '', confirmPassword: '', path: 'public_html' });
                  setShowCreateModal(true);
                }}
                title="Nový FTP účet"
              >
                <FontAwesomeIcon icon={faPlus} />
                <span>Nový FTP</span>
              </button>
              <div className="ftpm-toolbar-sep" />
            </>
          )}
          <button className="ftpm-toolbar-btn" onClick={() => selectedDomain && fetchFtp(selectedDomain)} title="Obnovit">
            <FontAwesomeIcon icon={faSync} />
          </button>
        </div>
      </div>

      {error && (
        <div className="ftpm-error-banner">
          <span>
            <FontAwesomeIcon icon={faExclamationTriangle} /> {error}
          </span>
          <button className="ftpm-error-close" onClick={() => setError(null)}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      )}

      <div className="ftpm-main">
        {availableDomains.length === 0 ? (
          <div className="ftpm-empty">
            <FontAwesomeIcon icon={faGlobe} />
            <p>Nemáte žádnou web doménu</p>
            <p className="ftpm-empty-hint">FTP účty jsou vázané na web doménu.</p>
          </div>
        ) : (
          <>
            <div className="ftpm-domain-selector">
              <label>Doména:</label>
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                className="ftpm-domain-select"
              >
                {availableDomains.map((d) => (
                  <option key={d.domain} value={d.domain}>
                    {d.domain}
                  </option>
                ))}
              </select>
            </div>

            {selectedDomain && (
              <>
                {accounts.length === 0 ? (
                  <div className="ftpm-empty">
                    <FontAwesomeIcon icon={faFolder} />
                    <p>Žádné FTP účty pro tuto doménu</p>
                    <button
                      className="ftpm-btn-primary"
                      onClick={() => {
                        setCreateForm({ username: '', password: '', confirmPassword: '', path: 'public_html' });
                        setShowCreateModal(true);
                      }}
                    >
                      <FontAwesomeIcon icon={faPlus} />
                      Vytvořit první FTP účet
                    </button>
                  </div>
                ) : (
                  <div className="ftpm-table-container table-responsive">
                    <table className="ftpm-table">
                      <thead>
                        <tr>
                          <th>Uživatel</th>
                          <th>Cesta</th>
                          <th>Stav</th>
                          <th>Akce</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accounts.map((acc) => (
                          <tr key={acc.id}>
                            <td>
                              <div className="ftpm-user-cell">
                                <FontAwesomeIcon icon={faFolder} className="ftpm-user-icon" />
                                <span>{acc.username}</span>
                              </div>
                            </td>
                            <td>
                              <span className="ftpm-path">{acc.path || 'public_html'}</span>
                            </td>
                            <td>
                              {acc.suspended ? (
                                <span className="ftpm-status ftpm-status-suspended">
                                  <FontAwesomeIcon icon={faCircle} />
                                  Pozastaveno
                                </span>
                              ) : (
                                <span className="ftpm-status ftpm-status-active">
                                  <FontAwesomeIcon icon={faCheckCircle} />
                                  Aktivní
                                </span>
                              )}
                            </td>
                            <td>
                              <div className="ftpm-actions">
                                <button
                                  className="ftpm-action-btn"
                                  onClick={() => {
                                    setSelectedAccount(acc);
                                    setPasswordForm({ password: '', confirmPassword: '' });
                                    setShowPasswordModal(true);
                                  }}
                                  title="Změnit heslo"
                                >
                                  <FontAwesomeIcon icon={faKey} />
                                </button>
                                <button
                                  className="ftpm-action-btn ftpm-action-danger"
                                  onClick={() => {
                                    setSelectedAccount(acc);
                                    setShowDeleteModal(true);
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
              </>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {showCreateModal && selectedDomain && (
          <>
            <motion.div className="ftpm-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !isSubmitting && setShowCreateModal(false)} />
            <motion.div className="ftpm-modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <div className="ftpm-modal-header">
                <h2>Vytvořit FTP účet</h2>
                <button className="ftpm-modal-close" onClick={() => !isSubmitting && setShowCreateModal(false)} disabled={isSubmitting}>
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
              <div className="ftpm-modal-body">
                <div className="ftpm-form-group">
                  <label>Doména</label>
                  <input type="text" value={selectedDomain} disabled className="ftpm-input-disabled" />
                </div>
                <div className="ftpm-form-group">
                  <label>Uživatelské jméno</label>
                  <input
                    type="text"
                    value={createForm.username}
                    onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                    placeholder="ftp_user"
                    disabled={isSubmitting}
                    required
                  />
                </div>
                <div className="ftpm-form-group">
                  <label>Cesta (path)</label>
                  <input
                    type="text"
                    value={createForm.path}
                    onChange={(e) => setCreateForm({ ...createForm, path: e.target.value })}
                    placeholder="public_html"
                    disabled={isSubmitting}
                  />
                  <div className="ftpm-form-hint">Např. public_html nebo public_html/uploads</div>
                </div>
                <div className="ftpm-form-group">
                  <label>Heslo</label>
                  <input
                    type="password"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    placeholder="Min. 8 znaků"
                    disabled={isSubmitting}
                    required
                  />
                </div>
                <div className="ftpm-form-group">
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
              <div className="ftpm-modal-footer">
                <button className="ftpm-btn-secondary" onClick={() => setShowCreateModal(false)} disabled={isSubmitting}>
                  Zrušit
                </button>
                <button className="ftpm-btn-primary" onClick={handleCreateFtp} disabled={isSubmitting}>
                  {isSubmitting ? 'Vytváření...' : 'Vytvořit'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPasswordModal && selectedAccount && (
          <>
            <motion.div className="ftpm-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !isSubmitting && setShowPasswordModal(false)} />
            <motion.div className="ftpm-modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <div className="ftpm-modal-header">
                <h2>Změnit heslo — {selectedAccount.username}</h2>
                <button className="ftpm-modal-close" onClick={() => !isSubmitting && setShowPasswordModal(false)} disabled={isSubmitting}>
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
              <div className="ftpm-modal-body">
                <div className="ftpm-form-group">
                  <label>Nové heslo</label>
                  <input
                    type="password"
                    value={passwordForm.password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
                    placeholder="Min. 8 znaků"
                    disabled={isSubmitting}
                    required
                  />
                </div>
                <div className="ftpm-form-group">
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
              <div className="ftpm-modal-footer">
                <button className="ftpm-btn-secondary" onClick={() => setShowPasswordModal(false)} disabled={isSubmitting}>
                  Zrušit
                </button>
                <button className="ftpm-btn-primary" onClick={handleChangePassword} disabled={isSubmitting}>
                  {isSubmitting ? 'Ukládání...' : 'Změnit heslo'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeleteModal && selectedAccount && (
          <>
            <motion.div className="ftpm-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !isSubmitting && setShowDeleteModal(false)} />
            <motion.div className="ftpm-modal ftpm-modal-danger" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <div className="ftpm-modal-header">
                <h2>Smazat FTP účet</h2>
                <button className="ftpm-modal-close" onClick={() => !isSubmitting && setShowDeleteModal(false)} disabled={isSubmitting}>
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
              <div className="ftpm-modal-body">
                <div className="ftpm-warning">
                  <FontAwesomeIcon icon={faExclamationTriangle} />
                  <p>
                    Opravdu chcete smazat FTP účet <strong>{selectedAccount.username}</strong>? Tato akce je nevratná.
                  </p>
                </div>
              </div>
              <div className="ftpm-modal-footer">
                <button className="ftpm-btn-secondary" onClick={() => setShowDeleteModal(false)} disabled={isSubmitting}>
                  Zrušit
                </button>
                <button className="ftpm-btn-danger" onClick={handleDeleteFtp} disabled={isSubmitting}>
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

export default FTPManager;
