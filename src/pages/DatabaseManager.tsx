import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faDatabase,
  faPlus,
  faTrash,
  faSync,
  faTimes,
  faExclamationTriangle,
  faCheckCircle,
  faCircle,
  faServer,
  faUser,
  faServer as faHost,
  faKey,
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../components/Toast';
import { getHostingService, HostingService } from '../lib/api';
import { getDatabases, createDatabase, deleteDatabase, Database } from '../services/databaseService';
import Loading from '../components/Loading';
import './DatabaseManager.css';

const DatabaseManager: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { showSuccess, showError } = useToast();
  
  const [service, setService] = useState<HostingService | null>(null);
  const [databases, setDatabases] = useState<Database[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Dialogs
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDatabase, setSelectedDatabase] = useState<Database | null>(null);
  
  // Form states
  const [createForm, setCreateForm] = useState({
    database: '',
    dbuser: '',
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
            await fetchDatabases();
          }
        } catch {
          setPageError('Nepodařilo se načíst službu');
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [user, id]);

  const fetchDatabases = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const data = await getDatabases(Number(id));
      setDatabases(data);
    } catch (err: any) {
      setError(err.message || 'Nepodařilo se načíst databáze');
    }
  }, [id]);

  const handleCreateDatabase = async () => {
    if (!createForm.database || !createForm.dbuser || !createForm.password) {
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

    // Validate database name (alphanumeric and underscore only)
    if (!/^[a-zA-Z0-9_]+$/.test(createForm.database)) {
      showError('Název databáze může obsahovat pouze písmena, čísla a podtržítka');
      return;
    }

    // Validate username (alphanumeric and underscore only)
    if (!/^[a-zA-Z0-9_]+$/.test(createForm.dbuser)) {
      showError('Uživatelské jméno může obsahovat pouze písmena, čísla a podtržítka');
      return;
    }

    try {
      setIsSubmitting(true);
      await createDatabase(
        Number(id!),
        createForm.database,
        createForm.dbuser,
        createForm.password
      );
      showSuccess('Databáze byla úspěšně vytvořena');
      setShowCreateModal(false);
      setCreateForm({ database: '', dbuser: '', password: '', confirmPassword: '' });
      await fetchDatabases();
    } catch (err: any) {
      showError(err.message || 'Nepodařilo se vytvořit databázi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDatabase = async () => {
    if (!selectedDatabase) return;

    try {
      setIsSubmitting(true);
      await deleteDatabase(Number(id!), selectedDatabase.name);
      showSuccess('Databáze byla úspěšně smazána');
      setShowDeleteModal(false);
      setSelectedDatabase(null);
      await fetchDatabases();
    } catch (err: any) {
      showError(err.message || 'Nepodařilo se smazat databázi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDatabaseTypeIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'mysql':
        return faDatabase;
      case 'postgresql':
      case 'postgres':
        return faDatabase;
      default:
        return faDatabase;
    }
  };

  const getDatabaseTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'mysql':
        return '#00758f';
      case 'postgresql':
      case 'postgres':
        return '#336791';
      default:
        return 'var(--text-secondary)';
    }
  };

  if (loading) {
    return <Loading message="Načítání..." className="dbm-loading" />;
  }

  if (pageError || !service) {
    return (
      <div className="dbm-loading">
        <FontAwesomeIcon icon={faExclamationTriangle} style={{ fontSize: '2rem', color: '#ef4444' }} />
        <p>{pageError || 'Služba nenalezena'}</p>
        <Link to={`/services/${id}`} className="dbm-back-btn">Zpět na službu</Link>
      </div>
    );
  }

  if (!service.hestia_created || !service.hestia_username) {
    return (
      <div className="dbm-loading">
        <FontAwesomeIcon icon={faServer} style={{ fontSize: '2rem', color: 'var(--text-secondary)' }} />
        <p>HestiaCP účet ještě nebyl vytvořen</p>
        <Link to={`/services/${id}`} className="dbm-back-btn">Zpět na službu</Link>
      </div>
    );
  }

  // Get database host from service
  const dbHost = service.db_host || 'localhost';

  return (
    <div className="dbm-page">
      {/* Top Bar */}
      <div className="dbm-topbar">
        <div className="dbm-topbar-left">
          <Link to={`/services/${id}`} className="dbm-back-btn">
            <FontAwesomeIcon icon={faArrowLeft} />
            Zpět
          </Link>
          <h1 className="dbm-topbar-title">
            Správa Databází — {service.hestia_domain || service.plan_name}
          </h1>
        </div>

        <div className="dbm-toolbar">
          <button 
            className="dbm-toolbar-btn" 
            onClick={() => {
              setCreateForm({ database: '', dbuser: '', password: '', confirmPassword: '' });
              setShowCreateModal(true);
            }}
            title="Nová databáze"
          >
            <FontAwesomeIcon icon={faPlus} />
            <span>Nová databáze</span>
          </button>
          <div className="dbm-toolbar-sep" />
          <button className="dbm-toolbar-btn" onClick={fetchDatabases} title="Obnovit">
            <FontAwesomeIcon icon={faSync} />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="dbm-error-banner">
          <span><FontAwesomeIcon icon={faExclamationTriangle} /> {error}</span>
          <button className="dbm-error-close" onClick={() => setError(null)}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      )}

      {/* Database List */}
      <div className="dbm-main">
        {databases.length === 0 ? (
          <div className="dbm-empty">
            <FontAwesomeIcon icon={faDatabase} />
            <p>Zatím nemáte žádné databáze</p>
            <button 
              className="dbm-btn-primary"
              onClick={() => {
                setCreateForm({ database: '', dbuser: '', password: '', confirmPassword: '' });
                setShowCreateModal(true);
              }}
            >
              <FontAwesomeIcon icon={faPlus} />
              Vytvořit první databázi
            </button>
          </div>
        ) : (
          <div className="dbm-table-container">
            <table className="dbm-table">
              <thead>
                <tr>
                  <th>Databáze</th>
                  <th>Typ</th>
                  <th>Host</th>
                  <th>Charset</th>
                  <th>Uživatelé</th>
                  <th>Akce</th>
                </tr>
              </thead>
              <tbody>
                {databases.map((db) => (
                  <tr key={db.name}>
                    <td>
                      <div className="dbm-db-cell">
                        <FontAwesomeIcon 
                          icon={getDatabaseTypeIcon(db.type)} 
                          className="dbm-db-icon"
                          style={{ color: getDatabaseTypeColor(db.type) }}
                        />
                        <span>{db.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="dbm-type-badge">{db.type || 'MySQL'}</span>
                    </td>
                    <td>
                      <div className="dbm-host-cell">
                        <FontAwesomeIcon icon={faHost} />
                        <span>{db.host || dbHost}</span>
                      </div>
                    </td>
                    <td>
                      <span className="dbm-charset">{db.charset || 'utf8mb4'}</span>
                    </td>
                    <td>
                      <div className="dbm-users-cell">
                        {db.users && db.users.length > 0 ? (
                          <>
                            <FontAwesomeIcon icon={faUser} />
                            <span>{db.users.length} {db.users.length === 1 ? 'uživatel' : 'uživatelů'}</span>
                          </>
                        ) : (
                          <span className="dbm-no-users">Žádní uživatelé</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="dbm-actions">
                        <button
                          className="dbm-action-btn dbm-action-danger"
                          onClick={() => {
                            setSelectedDatabase(db);
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

      {/* Create Database Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <>
            <motion.div
              className="dbm-modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setShowCreateModal(false)}
            />
            <motion.div
              className="dbm-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="dbm-modal-header">
                <h2>Vytvořit novou databázi</h2>
                <button
                  className="dbm-modal-close"
                  onClick={() => !isSubmitting && setShowCreateModal(false)}
                  disabled={isSubmitting}
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
              <div className="dbm-modal-body">
                <div className="dbm-form-group">
                  <label>Název databáze</label>
                  <input
                    type="text"
                    value={createForm.database}
                    onChange={(e) => setCreateForm({ ...createForm, database: e.target.value })}
                    placeholder="např. my_database"
                    disabled={isSubmitting}
                    required
                    pattern="[a-zA-Z0-9_]+"
                  />
                  <div className="dbm-form-hint">
                    Pouze písmena, čísla a podtržítka
                  </div>
                </div>
                <div className="dbm-form-group">
                  <label>Uživatelské jméno</label>
                  <input
                    type="text"
                    value={createForm.dbuser}
                    onChange={(e) => setCreateForm({ ...createForm, dbuser: e.target.value })}
                    placeholder="např. db_user"
                    disabled={isSubmitting}
                    required
                    pattern="[a-zA-Z0-9_]+"
                  />
                  <div className="dbm-form-hint">
                    Pouze písmena, čísla a podtržítka
                  </div>
                </div>
                <div className="dbm-form-group">
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
                <div className="dbm-form-group">
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
                <div className="dbm-info-box">
                  <FontAwesomeIcon icon={faInfoCircle} />
                  <p>
                    Databáze bude vytvořena na serveru <strong>{dbHost}</strong>.
                    Po vytvoření obdržíte přístupové údaje.
                  </p>
                </div>
              </div>
              <div className="dbm-modal-footer">
                <button
                  className="dbm-btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isSubmitting}
                >
                  Zrušit
                </button>
                <button
                  className="dbm-btn-primary"
                  onClick={handleCreateDatabase}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Vytváření...' : 'Vytvořit'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && selectedDatabase && (
          <>
            <motion.div
              className="dbm-modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setShowDeleteModal(false)}
            />
            <motion.div
              className="dbm-modal dbm-modal-danger"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="dbm-modal-header">
                <h2>Smazat databázi</h2>
                <button
                  className="dbm-modal-close"
                  onClick={() => !isSubmitting && setShowDeleteModal(false)}
                  disabled={isSubmitting}
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
              <div className="dbm-modal-body">
                <div className="dbm-warning">
                  <FontAwesomeIcon icon={faExclamationTriangle} />
                  <p>
                    Opravdu chcete smazat databázi <strong>{selectedDatabase.name}</strong>?
                    Tato akce je nevratná a všechna data v této databázi budou ztracena.
                  </p>
                </div>
              </div>
              <div className="dbm-modal-footer">
                <button
                  className="dbm-btn-secondary"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isSubmitting}
                >
                  Zrušit
                </button>
                <button
                  className="dbm-btn-danger"
                  onClick={handleDeleteDatabase}
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

export default DatabaseManager;
