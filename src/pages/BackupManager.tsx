import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faCloudDownload,
  faPlus,
  faTrash,
  faSync,
  faTimes,
  faExclamationTriangle,
  faServer,
  faClock,
  faHdd,
  faCheckCircle,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { getHostingService, HostingService } from '../lib/api';
import { getBackups, createBackup, restoreBackup, deleteBackup, formatBackupSize, Backup } from '../services/backupService';
import Loading from '../components/Loading';
import './BackupManager.css';

const BackupManager: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const [service, setService] = useState<HostingService | null>(null);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user && id) {
      (async () => {
        try {
          const data = await getHostingService(Number(id));
          setService(data);
          if (data.hestia_created && data.hestia_username) {
            await fetchBackups();
          }
        } catch {
          setPageError('Nepodařilo se načíst službu');
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [user, id]);

  const fetchBackups = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const data = await getBackups(Number(id));
      setBackups(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se načíst zálohy');
    }
  }, [id]);

  const handleCreateBackup = async () => {
    try {
      setIsSubmitting(true);
      setCreating(true);
      await createBackup(Number(id!));
      showSuccess('Záloha byla úspěšně spuštěna. Dokončení může trvat několik minut.');
      setShowCreateModal(false);
      // Počkej chvíli a pak obnov seznam
      setTimeout(() => {
        fetchBackups();
        setCreating(false);
      }, 2000);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Nepodařilo se vytvořit zálohu');
      setCreating(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!selectedBackup) return;
    try {
      setIsSubmitting(true);
      await restoreBackup(Number(id!), selectedBackup.id);
      showSuccess('Obnovení zálohy bylo úspěšně spuštěno. Dokončení může trvat několik minut.');
      setShowRestoreModal(false);
      setSelectedBackup(null);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Nepodařilo se obnovit zálohu');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBackup = async () => {
    if (!selectedBackup) return;
    try {
      setIsSubmitting(true);
      await deleteBackup(Number(id!), selectedBackup.id);
      showSuccess('Záloha byla úspěšně smazána');
      setShowDeleteModal(false);
      setSelectedBackup(null);
      await fetchBackups();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Nepodařilo se smazat zálohu');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('cs-CZ', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'ok':
        return '#10b981';
      case 'running':
      case 'in_progress':
        return '#3b82f6';
      case 'failed':
      case 'error':
        return '#ef4444';
      default:
        return 'var(--text-secondary)';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'ok':
        return 'Dokončeno';
      case 'running':
      case 'in_progress':
        return 'Probíhá';
      case 'failed':
      case 'error':
        return 'Chyba';
      default:
        return status || 'Neznámý';
    }
  };

  if (loading) {
    return <Loading message="Načítání..." className="bkm-loading" />;
  }

  if (pageError || !service) {
    return (
      <div className="bkm-loading">
        <FontAwesomeIcon icon={faExclamationTriangle} style={{ fontSize: '2rem', color: '#ef4444' }} />
        <p>{pageError || 'Služba nenalezena'}</p>
        <Link to={`/services/${id}`} className="bkm-back-btn">
          Zpět na službu
        </Link>
      </div>
    );
  }

  if (!service.hestia_created || !service.hestia_username) {
    return (
      <div className="bkm-loading">
        <FontAwesomeIcon icon={faServer} style={{ fontSize: '2rem', color: 'var(--text-secondary)' }} />
        <p>HestiaCP účet ještě nebyl vytvořen</p>
        <Link to={`/services/${id}`} className="bkm-back-btn">
          Zpět na službu
        </Link>
      </div>
    );
  }

  return (
    <div className="bkm-page">
      <div className="bkm-topbar">
        <div className="bkm-topbar-left">
          <Link to={`/services/${id}`} className="bkm-back-btn">
            <FontAwesomeIcon icon={faArrowLeft} />
            Zpět
          </Link>
          <h1 className="bkm-topbar-title">
            Správa Záloh — {service.hestia_domain || service.plan_name}
          </h1>
        </div>
        <div className="bkm-toolbar">
          <button
            className="bkm-toolbar-btn"
            onClick={() => setShowCreateModal(true)}
            title="Nová záloha"
            disabled={creating}
          >
            <FontAwesomeIcon icon={creating ? faSpinner : faPlus} className={creating ? 'bkm-spin' : ''} />
            <span>{creating ? 'Vytváření...' : 'Nová záloha'}</span>
          </button>
          <div className="bkm-toolbar-sep" />
          <button className="bkm-toolbar-btn" onClick={fetchBackups} title="Obnovit">
            <FontAwesomeIcon icon={faSync} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bkm-error-banner">
          <span>
            <FontAwesomeIcon icon={faExclamationTriangle} /> {error}
          </span>
          <button className="bkm-error-close" onClick={() => setError(null)}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      )}

      <div className="bkm-main">
        {backups.length === 0 ? (
          <div className="bkm-empty">
            <FontAwesomeIcon icon={faCloudDownload} />
            <p>Zatím nemáte žádné zálohy</p>
            <button className="bkm-btn-primary" onClick={() => setShowCreateModal(true)}>
              <FontAwesomeIcon icon={faPlus} />
              Vytvořit první zálohu
            </button>
          </div>
        ) : (
          <div className="bkm-table-container">
            <table className="bkm-table">
              <thead>
                <tr>
                  <th>Datum vytvoření</th>
                  <th>Velikost</th>
                  <th>Stav</th>
                  <th>Akce</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <tr key={backup.id}>
                    <td>
                      <div className="bkm-date-cell">
                        <FontAwesomeIcon icon={faClock} />
                        <span>{formatDate(backup.date)}</span>
                      </div>
                    </td>
                    <td>
                      <div className="bkm-size-cell">
                        <FontAwesomeIcon icon={faHdd} />
                        <span>{formatBackupSize(backup.size)}</span>
                      </div>
                    </td>
                    <td>
                      <span
                        className="bkm-status"
                        style={{ color: getStatusColor(backup.status) }}
                      >
                        {backup.status?.toLowerCase() === 'running' || backup.status?.toLowerCase() === 'in_progress' ? (
                          <>
                            <FontAwesomeIcon icon={faSpinner} className="bkm-spin" />
                            {getStatusLabel(backup.status)}
                          </>
                        ) : (
                          <>
                            <FontAwesomeIcon icon={faCheckCircle} />
                            {getStatusLabel(backup.status)}
                          </>
                        )}
                      </span>
                    </td>
                    <td>
                      <div className="bkm-actions">
                        <button
                          className="bkm-action-btn"
                          onClick={() => {
                            setSelectedBackup(backup);
                            setShowRestoreModal(true);
                          }}
                          title="Obnovit zálohu"
                          disabled={backup.status?.toLowerCase() === 'running' || backup.status?.toLowerCase() === 'in_progress'}
                        >
                          <FontAwesomeIcon icon={faSync} />
                        </button>
                        <button
                          className="bkm-action-btn bkm-action-danger"
                          onClick={() => {
                            setSelectedBackup(backup);
                            setShowDeleteModal(true);
                          }}
                          title="Smazat zálohu"
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

      <AnimatePresence>
        {showCreateModal && (
          <>
            <motion.div
              className="bkm-modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setShowCreateModal(false)}
            />
            <motion.div
              className="bkm-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="bkm-modal-header">
                <h2>Vytvořit zálohu</h2>
                <button
                  className="bkm-modal-close"
                  onClick={() => !isSubmitting && setShowCreateModal(false)}
                  disabled={isSubmitting}
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
              <div className="bkm-modal-body">
                <div className="bkm-info-box">
                  <FontAwesomeIcon icon={faCloudDownload} />
                  <p>
                    Vytvoření zálohy může trvat několik minut v závislosti na velikosti vašich dat.
                    Po dokončení budete upozorněni.
                  </p>
                </div>
              </div>
              <div className="bkm-modal-footer">
                <button
                  className="bkm-btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isSubmitting}
                >
                  Zrušit
                </button>
                <button
                  className="bkm-btn-primary"
                  onClick={handleCreateBackup}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Vytváření...' : 'Vytvořit zálohu'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRestoreModal && selectedBackup && (
          <>
            <motion.div
              className="bkm-modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setShowRestoreModal(false)}
            />
            <motion.div
              className="bkm-modal bkm-modal-warning"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="bkm-modal-header">
                <h2>Obnovit zálohu</h2>
                <button
                  className="bkm-modal-close"
                  onClick={() => !isSubmitting && setShowRestoreModal(false)}
                  disabled={isSubmitting}
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
              <div className="bkm-modal-body">
                <div className="bkm-warning">
                  <FontAwesomeIcon icon={faExclamationTriangle} />
                  <p>
                    Opravdu chcete obnovit zálohu z <strong>{formatDate(selectedBackup.date)}</strong>?
                    Tato akce přepíše všechna současná data a může trvat několik minut.
                    <strong> Tato akce je nevratná!</strong>
                  </p>
                </div>
              </div>
              <div className="bkm-modal-footer">
                <button
                  className="bkm-btn-secondary"
                  onClick={() => setShowRestoreModal(false)}
                  disabled={isSubmitting}
                >
                  Zrušit
                </button>
                <button
                  className="bkm-btn-warning"
                  onClick={handleRestoreBackup}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Obnovování...' : 'Obnovit zálohu'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeleteModal && selectedBackup && (
          <>
            <motion.div
              className="bkm-modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setShowDeleteModal(false)}
            />
            <motion.div
              className="bkm-modal bkm-modal-danger"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="bkm-modal-header">
                <h2>Smazat zálohu</h2>
                <button
                  className="bkm-modal-close"
                  onClick={() => !isSubmitting && setShowDeleteModal(false)}
                  disabled={isSubmitting}
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
              <div className="bkm-modal-body">
                <div className="bkm-warning">
                  <FontAwesomeIcon icon={faExclamationTriangle} />
                  <p>
                    Opravdu chcete smazat zálohu z <strong>{formatDate(selectedBackup.date)}</strong>?
                    Tato akce je nevratná.
                  </p>
                </div>
              </div>
              <div className="bkm-modal-footer">
                <button
                  className="bkm-btn-secondary"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isSubmitting}
                >
                  Zrušit
                </button>
                <button
                  className="bkm-btn-danger"
                  onClick={handleDeleteBackup}
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

export default BackupManager;
