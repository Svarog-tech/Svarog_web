import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faClock,
  faPlus,
  faTrash,
  faSync,
  faTimes,
  faExclamationTriangle,
  faServer,
  faPause,
  faPlay,
  faCheckCircle,
  faSpinner,
  faCode,
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { getHostingService, HostingService } from '../lib/api';
import {
  getCronJobs,
  createCronJob,
  deleteCronJob,
  suspendCronJob,
  formatCronSchedule,
  validateCronSchedule,
  CronJob,
} from '../services/cronService';
import Loading from '../components/Loading';
import './CronJobsManager.css';

const CronJobsManager: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const [service, setService] = useState<HostingService | null>(null);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<CronJob | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState({
    min: '*',
    hour: '*',
    day: '*',
    month: '*',
    weekday: '*',
    command: '',
  });

  useEffect(() => {
    if (user && id) {
      (async () => {
        try {
          const data = await getHostingService(Number(id));
          setService(data);
          if (data.hestia_created && data.hestia_username) {
            await fetchCronJobs();
          }
        } catch {
          setPageError('Nepodařilo se načíst službu');
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [user, id]);

  const fetchCronJobs = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const data = await getCronJobs(Number(id));
      setCronJobs(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se načíst cron joby');
    }
  }, [id]);

  const handleCreateCronJob = async () => {
    const validation = validateCronSchedule(
      createForm.min,
      createForm.hour,
      createForm.day,
      createForm.month,
      createForm.weekday
    );

    if (!validation.valid) {
      showError(validation.error || 'Neplatný cron schedule');
      return;
    }

    if (!createForm.command.trim()) {
      showError('Zadejte příkaz');
      return;
    }

    try {
      setIsSubmitting(true);
      await createCronJob(
        Number(id!),
        createForm.min,
        createForm.hour,
        createForm.day,
        createForm.month,
        createForm.weekday,
        createForm.command.trim()
      );
      showSuccess('Cron job byl úspěšně vytvořen');
      setShowCreateModal(false);
      setCreateForm({
        min: '*',
        hour: '*',
        day: '*',
        month: '*',
        weekday: '*',
        command: '',
      });
      await fetchCronJobs();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Nepodařilo se vytvořit cron job');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCronJob = async () => {
    if (!selectedJob) return;
    try {
      setIsSubmitting(true);
      await deleteCronJob(Number(id!), selectedJob.id);
      showSuccess('Cron job byl úspěšně smazán');
      setShowDeleteModal(false);
      setSelectedJob(null);
      await fetchCronJobs();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Nepodařilo se smazat cron job');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleSuspend = async (job: CronJob) => {
    try {
      await suspendCronJob(Number(id!), job.id, !job.suspended);
      showSuccess(`Cron job byl ${job.suspended ? 'obnoven' : 'pozastaven'}`);
      await fetchCronJobs();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Nepodařilo se změnit stav cron jobu');
    }
  };

  if (loading) {
    return <Loading message="Načítání..." className="cjm-loading" />;
  }

  if (pageError || !service) {
    return (
      <div className="cjm-loading">
        <FontAwesomeIcon icon={faExclamationTriangle} style={{ fontSize: '2rem', color: '#ef4444' }} />
        <p>{pageError || 'Služba nenalezena'}</p>
        <Link to={`/services/${id}`} className="cjm-back-btn">
          Zpět na službu
        </Link>
      </div>
    );
  }

  if (!service.hestia_created || !service.hestia_username) {
    return (
      <div className="cjm-loading">
        <FontAwesomeIcon icon={faServer} style={{ fontSize: '2rem', color: 'var(--text-secondary)' }} />
        <p>HestiaCP účet ještě nebyl vytvořen</p>
        <Link to={`/services/${id}`} className="cjm-back-btn">
          Zpět na službu
        </Link>
      </div>
    );
  }

  return (
    <div className="cjm-page">
      <div className="cjm-topbar">
        <div className="cjm-topbar-left">
          <Link to={`/services/${id}`} className="cjm-back-btn">
            <FontAwesomeIcon icon={faArrowLeft} />
            Zpět
          </Link>
          <h1 className="cjm-topbar-title">
            Správa Cron Jobs — {service.hestia_domain || service.plan_name}
          </h1>
        </div>
        <div className="cjm-toolbar">
          <button
            className="cjm-toolbar-btn"
            onClick={() => setShowCreateModal(true)}
            title="Nový cron job"
          >
            <FontAwesomeIcon icon={faPlus} />
            <span>Nový cron job</span>
          </button>
          <div className="cjm-toolbar-sep" />
          <button className="cjm-toolbar-btn" onClick={fetchCronJobs} title="Obnovit">
            <FontAwesomeIcon icon={faSync} />
          </button>
        </div>
      </div>

      {error && (
        <div className="cjm-error-banner">
          <span>
            <FontAwesomeIcon icon={faExclamationTriangle} /> {error}
          </span>
          <button className="cjm-error-close" onClick={() => setError(null)}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      )}

      <div className="cjm-main">
        {cronJobs.length === 0 ? (
          <div className="cjm-empty">
            <FontAwesomeIcon icon={faClock} />
            <p>Zatím nemáte žádné cron joby</p>
            <button className="cjm-btn-primary" onClick={() => setShowCreateModal(true)}>
              <FontAwesomeIcon icon={faPlus} />
              Vytvořit první cron job
            </button>
          </div>
        ) : (
          <div className="cjm-table-container table-responsive">
            <table className="cjm-table">
              <thead>
                <tr>
                  <th>Schedule</th>
                  <th>Příkaz</th>
                  <th>Stav</th>
                  <th>Akce</th>
                </tr>
              </thead>
              <tbody>
                {cronJobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <div className="cjm-schedule-cell">
                        <FontAwesomeIcon icon={faClock} />
                        <code className="cjm-schedule-code">{formatCronSchedule(job)}</code>
                      </div>
                    </td>
                    <td>
                      <div className="cjm-command-cell">
                        <FontAwesomeIcon icon={faCode} />
                        <code className="cjm-command-code" title={job.command}>
                          {job.command.length > 50 ? `${job.command.substring(0, 50)}...` : job.command}
                        </code>
                      </div>
                    </td>
                    <td>
                      <span
                        className="cjm-status"
                        style={{ color: job.suspended ? '#ef4444' : '#10b981' }}
                      >
                        <FontAwesomeIcon icon={job.suspended ? faPause : faCheckCircle} />
                        {job.suspended ? 'Pozastaveno' : 'Aktivní'}
                      </span>
                    </td>
                    <td>
                      <div className="cjm-actions">
                        <button
                          className="cjm-action-btn"
                          onClick={() => handleToggleSuspend(job)}
                          title={job.suspended ? 'Obnovit' : 'Pozastavit'}
                        >
                          <FontAwesomeIcon icon={job.suspended ? faPlay : faPause} />
                        </button>
                        <button
                          className="cjm-action-btn cjm-action-danger"
                          onClick={() => {
                            setSelectedJob(job);
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
      </div>

      <AnimatePresence>
        {showCreateModal && (
          <>
            <motion.div
              className="cjm-modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setShowCreateModal(false)}
            />
            <motion.div
              className="cjm-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="cjm-modal-header">
                <h2>Vytvořit cron job</h2>
                <button
                  className="cjm-modal-close"
                  onClick={() => !isSubmitting && setShowCreateModal(false)}
                  disabled={isSubmitting}
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
              <div className="cjm-modal-body">
                <div className="cjm-form-group">
                  <label>
                    Minuta (0-59 nebo *)
                    <input
                      type="text"
                      value={createForm.min}
                      onChange={(e) => setCreateForm({ ...createForm, min: e.target.value })}
                      placeholder="*"
                      disabled={isSubmitting}
                    />
                  </label>
                </div>
                <div className="cjm-form-group">
                  <label>
                    Hodina (0-23 nebo *)
                    <input
                      type="text"
                      value={createForm.hour}
                      onChange={(e) => setCreateForm({ ...createForm, hour: e.target.value })}
                      placeholder="*"
                      disabled={isSubmitting}
                    />
                  </label>
                </div>
                <div className="cjm-form-group">
                  <label>
                    Den v měsíci (1-31 nebo *)
                    <input
                      type="text"
                      value={createForm.day}
                      onChange={(e) => setCreateForm({ ...createForm, day: e.target.value })}
                      placeholder="*"
                      disabled={isSubmitting}
                    />
                  </label>
                </div>
                <div className="cjm-form-group">
                  <label>
                    Měsíc (1-12 nebo *)
                    <input
                      type="text"
                      value={createForm.month}
                      onChange={(e) => setCreateForm({ ...createForm, month: e.target.value })}
                      placeholder="*"
                      disabled={isSubmitting}
                    />
                  </label>
                </div>
                <div className="cjm-form-group">
                  <label>
                    Den v týdnu (0-7 nebo *)
                    <input
                      type="text"
                      value={createForm.weekday}
                      onChange={(e) => setCreateForm({ ...createForm, weekday: e.target.value })}
                      placeholder="*"
                      disabled={isSubmitting}
                    />
                  </label>
                </div>
                <div className="cjm-form-group">
                  <label>
                    Příkaz
                    <textarea
                      value={createForm.command}
                      onChange={(e) => setCreateForm({ ...createForm, command: e.target.value })}
                      placeholder="/usr/bin/php /home/user/script.php"
                      rows={3}
                      disabled={isSubmitting}
                    />
                  </label>
                </div>
                <div className="cjm-info-box">
                  <FontAwesomeIcon icon={faClock} />
                  <p>
                    Použijte * pro libovolnou hodnotu. Např. "0 2 * * *" spustí příkaz každý den ve 2:00.
                  </p>
                </div>
              </div>
              <div className="cjm-modal-footer">
                <button
                  className="cjm-btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isSubmitting}
                >
                  Zrušit
                </button>
                <button
                  className="cjm-btn-primary"
                  onClick={handleCreateCronJob}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Vytváření...' : 'Vytvořit'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeleteModal && selectedJob && (
          <>
            <motion.div
              className="cjm-modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setShowDeleteModal(false)}
            />
            <motion.div
              className="cjm-modal cjm-modal-danger"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="cjm-modal-header">
                <h2>Smazat cron job</h2>
                <button
                  className="cjm-modal-close"
                  onClick={() => !isSubmitting && setShowDeleteModal(false)}
                  disabled={isSubmitting}
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
              <div className="cjm-modal-body">
                <div className="cjm-warning">
                  <FontAwesomeIcon icon={faExclamationTriangle} />
                  <p>
                    Opravdu chcete smazat cron job s příkazem <strong>{selectedJob.command}</strong>?
                    Tato akce je nevratná.
                  </p>
                </div>
              </div>
              <div className="cjm-modal-footer">
                <button
                  className="cjm-btn-secondary"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isSubmitting}
                >
                  Zrušit
                </button>
                <button
                  className="cjm-btn-danger"
                  onClick={handleDeleteCronJob}
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

export default CronJobsManager;
