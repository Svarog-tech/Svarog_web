import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faServer,
  faGlobe,
  faArrowLeft,
  faHdd,
  faNetworkWired,
  faEnvelope,
  faDatabase,
  faCopy,
  faCheck,
  faSync,
  faCalendarAlt,
  faMoneyBill,
  faLock,
  faExternalLinkAlt,
  faKey,
  faUser,
  faCircle,
  faFolder,
  faShieldAlt,
  faExclamationTriangle,
  faInfoCircle,
  faCloudDownload,
  faClock
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { getHostingService, getHostingServiceStats, HostingService, HostingServiceStats } from '../lib/api';
import './ServiceDetail.css';

const ServiceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { formatPrice } = useCurrency();

  const [service, setService] = useState<HostingService | null>(null);
  const [stats, setStats] = useState<HostingServiceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const fetchService = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getHostingService(Number(id));
      setService(data);
    } catch {
      setError('Nepodařilo se načíst službu');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchStats = useCallback(async () => {
    if (!id) return;
    try {
      setStatsLoading(true);
      const data = await getHostingServiceStats(Number(id));
      setStats(data);
    } catch {
      // Stats selhaly, ale stránka dál funguje
    } finally {
      setStatsLoading(false);
    }
  }, [id]);

  // Fáze 1: Načti metadata (rychlé)
  useEffect(() => {
    if (user && id) {
      fetchService();
    }
  }, [user, id, fetchService]);

  // Fáze 2: Načti statistiky (pomalé) - až po načtení služby
  useEffect(() => {
    if (service && service.hestia_created && service.hestia_username) {
      fetchStats();
    } else if (service) {
      setStatsLoading(false);
    }
  }, [service, fetchStats]);

  const refreshAll = () => {
    fetchService();
    if (service?.hestia_created && service?.hestia_username) {
      fetchStats();
    }
  };

  const copyToClipboard = useCallback(async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  }, []);

  // Helpers
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'pending': return 'warning';
      case 'cancelled': return 'danger';
      case 'suspended': return 'danger';
      case 'expired': return 'secondary';
      default: return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Aktivní';
      case 'pending': return 'Čeká na aktivaci';
      case 'cancelled': return 'Zrušeno';
      case 'suspended': return 'Pozastaveno';
      case 'expired': return 'Vypršelo';
      default: return status;
    }
  };

  const formatBytes = (mb: number | 'unlimited') => {
    if (mb === 'unlimited') return 'Neomezeno';
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb} MB`;
  };

  const getUsagePercent = (used: number, limit: number | 'unlimited') => {
    if (limit === 'unlimited' || limit === 0) return 0;
    return Math.min(Math.round((used / limit) * 100), 100);
  };

  const getUsageLevel = (percent: number) => {
    if (percent > 90) return 'danger';
    if (percent > 70) return 'warning';
    return 'ok';
  };

  const getBaseUrl = () => {
    if (!service?.cpanel_url) return null;
    try {
      const url = new URL(service.cpanel_url);
      return `${url.protocol}//${url.hostname}`;
    } catch {
      return null;
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('cs-CZ', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const getBillingLabel = (period?: string) => {
    switch (period) {
      case 'monthly': return 'Měsíčně';
      case 'quarterly': return 'Čtvrtletně';
      case 'yearly': return 'Ročně';
      default: return period || '—';
    }
  };

  // Sub-components
  const CredentialRow = ({ label, value }: { label: string; value?: string }) => {
    if (!value) return null;
    return (
      <div className="sd-credential-row">
        <span className="sd-credential-label">{label}</span>
        <div className="sd-credential-value-wrap">
          <code className="sd-credential-value">{value}</code>
          <button
            className={`sd-copy-btn ${copiedField === label ? 'copied' : ''}`}
            onClick={() => copyToClipboard(value, label)}
            title="Kopírovat"
          >
            <FontAwesomeIcon icon={copiedField === label ? faCheck : faCopy} />
          </button>
        </div>
      </div>
    );
  };

  const StatCard = ({
    icon,
    label,
    used,
    limit,
    formatFn
  }: {
    icon: any;
    label: string;
    used: number;
    limit: number | 'unlimited';
    formatFn: (val: number | 'unlimited') => string;
  }) => {
    const percent = getUsagePercent(used, limit);
    const level = getUsageLevel(percent);
    return (
      <div className="sd-stat-card">
        <div className="sd-stat-header">
          <div className="sd-stat-icon">
            <FontAwesomeIcon icon={icon} />
          </div>
          <span className="sd-stat-label">{label}</span>
        </div>
        <div className="sd-stat-values">
          <span className="sd-stat-used">{formatFn(used)}</span>
          <span className="sd-stat-limit">/ {formatFn(limit)}</span>
        </div>
        {limit !== 'unlimited' && (
          <>
            <div className="sd-stat-percent">{percent}% využito</div>
            <div className="sd-progress-bar">
              <div
                className="sd-progress-fill"
                style={{ width: `${Math.max(percent, 2)}%` }}
                data-level={level}
              />
            </div>
          </>
        )}
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="sd-page">
        <div className="sd-container">
          <div className="sd-loading">
            <div className="loading-spinner"></div>
            <p>Načítání služby...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !service) {
    return (
      <div className="sd-page">
        <div className="sd-container">
          <div className="sd-error">
            <FontAwesomeIcon icon={faExclamationTriangle} className="sd-error-icon" />
            <h3>{error || 'Služba nenalezena'}</h3>
            <p>Zkontrolujte, zda služba existuje a máte k ní přístup.</p>
            <Link to="/services" className="sd-error-back">
              <FontAwesomeIcon icon={faArrowLeft} />
              Zpět na služby
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const baseUrl = getBaseUrl();

  return (
    <div className="sd-page">
      <div className="sd-container">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link to="/services" className="sd-back-btn">
            <FontAwesomeIcon icon={faArrowLeft} />
            Zpět na služby
          </Link>

          <div className="sd-header-info">
            <div className="sd-header-left">
              <div className="sd-service-icon">
                <FontAwesomeIcon icon={faServer} />
              </div>
              <div>
                <h1 className="sd-title">{service.plan_name}</h1>
                <p className="sd-domain">
                  <FontAwesomeIcon icon={faGlobe} />
                  {service.hestia_domain || 'Bez domény'}
                </p>
              </div>
            </div>
            <div className="sd-header-right">
              <div className={`sd-status-badge status-${getStatusColor(service.status)}`}>
                <FontAwesomeIcon icon={faCircle} className="sd-status-dot" />
                {getStatusLabel(service.status)}
              </div>
              <button className="sd-refresh-btn" onClick={refreshAll}>
                <FontAwesomeIcon icon={faSync} />
                Obnovit
              </button>
            </div>
          </div>
        </motion.div>

        {/* Suspended Banner */}
        {(service.status === 'suspended' || stats?.suspended) && (
          <motion.div
            className="sd-suspended-banner"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <FontAwesomeIcon icon={faExclamationTriangle} />
            Tato služba je pozastavena. Kontaktujte podporu pro více informací.
          </motion.div>
        )}

        {/* Overview */}
        <motion.div
          className="sd-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h2 className="sd-section-title">
            <FontAwesomeIcon icon={faInfoCircle} />
            Přehled služby
          </h2>
          <div className="sd-overview-grid">
            <div className="sd-overview-item">
              <FontAwesomeIcon icon={faMoneyBill} />
              <span className="sd-overview-label">Cena</span>
              <span className="sd-overview-value">
                {formatPrice(service.price)} / {getBillingLabel(service.billing_period)}
              </span>
            </div>
            <div className="sd-overview-item">
              <FontAwesomeIcon icon={faCalendarAlt} />
              <span className="sd-overview-label">Platné do</span>
              <span className="sd-overview-value">{formatDate(service.expires_at)}</span>
            </div>
            <div className="sd-overview-item">
              <FontAwesomeIcon icon={faCalendarAlt} />
              <span className="sd-overview-label">Aktivováno</span>
              <span className="sd-overview-value">{formatDate(service.activated_at)}</span>
            </div>
            <div className="sd-overview-item">
              <FontAwesomeIcon icon={faServer} />
              <span className="sd-overview-label">Balíček</span>
              <span className="sd-overview-value">{service.hestia_package || service.plan_name}</span>
            </div>
          </div>
        </motion.div>

        {/* Resource Usage Stats */}
        <motion.div
          className="sd-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h2 className="sd-section-title">
            <FontAwesomeIcon icon={faHdd} />
            Využití zdrojů
          </h2>
          {statsLoading ? (
            <div className="sd-stats-loading">
              <div className="loading-spinner"></div>
              <p>Načítání statistik z HestiaCP...</p>
            </div>
          ) : stats ? (
            <div className="sd-stats-grid">
              <StatCard
                icon={faHdd}
                label="Diskový prostor"
                used={stats.disk_used_mb}
                limit={stats.disk_limit_mb}
                formatFn={formatBytes}
              />
              <StatCard
                icon={faNetworkWired}
                label="Přenesená data"
                used={stats.bandwidth_used_mb}
                limit={stats.bandwidth_limit_mb}
                formatFn={formatBytes}
              />
              <StatCard
                icon={faEnvelope}
                label="Emailové schránky"
                used={stats.email_accounts_used}
                limit={stats.email_accounts_limit}
                formatFn={(val) => val === 'unlimited' ? 'Neomezeno' : String(val)}
              />
              <StatCard
                icon={faDatabase}
                label="Databáze"
                used={stats.databases_used}
                limit={stats.databases_limit}
                formatFn={(val) => val === 'unlimited' ? 'Neomezeno' : String(val)}
              />
            </div>
          ) : (
            <div className="sd-stats-unavailable">
              <FontAwesomeIcon icon={faInfoCircle} />{' '}
              {service.hestia_created
                ? 'Statistiky se nepodařilo načíst. Zkuste obnovit stránku.'
                : 'HestiaCP účet ještě nebyl vytvořen. Statistiky budou dostupné po aktivaci služby.'}
            </div>
          )}
        </motion.div>

        {/* Access Credentials */}
        {service.hestia_created && (
          <motion.div
            className="sd-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <h2 className="sd-section-title">
              <FontAwesomeIcon icon={faKey} />
              Přístupové údaje
            </h2>
            <div className="sd-credentials-grid">
              {/* FTP */}
              {(service.ftp_host || service.ftp_username) && (
                <div className="sd-credential-group">
                  <h3>
                    <FontAwesomeIcon icon={faFolder} />
                    FTP přístup
                  </h3>
                  <CredentialRow label="FTP server" value={service.ftp_host} />
                  <CredentialRow label="FTP uživatel" value={service.ftp_username} />
                  <div className="sd-credential-note">
                    <FontAwesomeIcon icon={faLock} />
                    Heslo bylo zasláno na váš email při aktivaci služby.
                  </div>
                </div>
              )}

              {/* Database */}
              {(service.db_host || service.db_name) && (
                <div className="sd-credential-group">
                  <h3>
                    <FontAwesomeIcon icon={faDatabase} />
                    Databáze
                  </h3>
                  <CredentialRow label="DB server" value={service.db_host} />
                  <CredentialRow label="DB název" value={service.db_name} />
                  <div className="sd-credential-note">
                    <FontAwesomeIcon icon={faLock} />
                    Heslo bylo zasláno na váš email při aktivaci služby.
                  </div>
                </div>
              )}

              {/* HestiaCP */}
              <div className="sd-credential-group">
                <h3>
                  <FontAwesomeIcon icon={faUser} />
                  HestiaCP účet
                </h3>
                <CredentialRow label="Uživatel" value={service.hestia_username} />
                <CredentialRow label="Doména" value={service.hestia_domain} />
                <CredentialRow label="Balíček" value={service.hestia_package} />
              </div>
            </div>
          </motion.div>
        )}

        {/* Domain Info */}
        {service.hestia_domain && (
          <motion.div
            className="sd-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <h2 className="sd-section-title">
              <FontAwesomeIcon icon={faGlobe} />
              Informace o doméně
            </h2>
            <div className="sd-domain-grid">
              <div className="sd-domain-item">
                <span className="sd-domain-label">Primární doména</span>
                <span className="sd-domain-value">{service.hestia_domain}</span>
              </div>
              <div className="sd-domain-item">
                <span className="sd-domain-label">SSL certifikát</span>
                <span className="sd-domain-value sd-ssl-active">
                  <FontAwesomeIcon icon={faShieldAlt} />
                  Let's Encrypt (automatický)
                </span>
              </div>
              {baseUrl && (
                <div className="sd-domain-item">
                  <span className="sd-domain-label">Server</span>
                  <span className="sd-domain-value">{new URL(baseUrl).hostname}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Quick Actions */}
        {service.hestia_created && (
          <motion.div
            className="sd-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <h2 className="sd-section-title">
              <FontAwesomeIcon icon={faExternalLinkAlt} />
              Rychlé akce
            </h2>
            <div className="sd-actions-grid">
              {service.cpanel_url ? (
                <a
                  href={service.cpanel_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sd-action-card"
                >
                  <FontAwesomeIcon icon={faExternalLinkAlt} />
                  <span>HestiaCP Admin</span>
                </a>
              ) : (
                <div className="sd-action-card disabled">
                  <FontAwesomeIcon icon={faExternalLinkAlt} />
                  <span>HestiaCP Admin</span>
                </div>
              )}

              {baseUrl ? (
                <a
                  href={`${baseUrl}:8083/list/mail/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sd-action-card"
                >
                  <FontAwesomeIcon icon={faEnvelope} />
                  <span>Webmail</span>
                </a>
              ) : (
                <div className="sd-action-card disabled">
                  <FontAwesomeIcon icon={faEnvelope} />
                  <span>Webmail</span>
                </div>
              )}

              {baseUrl ? (
                <a
                  href={`${baseUrl}/phpmyadmin/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sd-action-card"
                >
                  <FontAwesomeIcon icon={faDatabase} />
                  <span>phpMyAdmin</span>
                </a>
              ) : (
                <div className="sd-action-card disabled">
                  <FontAwesomeIcon icon={faDatabase} />
                  <span>phpMyAdmin</span>
                </div>
              )}

              <Link
                to={`/services/${id}/files`}
                className="sd-action-card"
              >
                <FontAwesomeIcon icon={faFolder} />
                <span>Správce souborů</span>
              </Link>

              <Link
                to={`/services/${id}/emails`}
                className="sd-action-card"
              >
                <FontAwesomeIcon icon={faEnvelope} />
                <span>Správa emailů</span>
              </Link>

              <Link
                to={`/services/${id}/domains`}
                className="sd-action-card"
              >
                <FontAwesomeIcon icon={faGlobe} />
                <span>Správa domén</span>
              </Link>

              <Link
                to={`/services/${id}/databases`}
                className="sd-action-card"
              >
                <FontAwesomeIcon icon={faDatabase} />
                <span>Správa databází</span>
              </Link>

              <Link
                to={`/services/${id}/dns`}
                className="sd-action-card"
              >
                <FontAwesomeIcon icon={faNetworkWired} />
                <span>Správa DNS</span>
              </Link>

              <Link
                to={`/services/${id}/ftp`}
                className="sd-action-card"
              >
                <FontAwesomeIcon icon={faFolder} />
                <span>Správa FTP</span>
              </Link>

              <Link
                to={`/services/${id}/backups`}
                className="sd-action-card"
              >
                <FontAwesomeIcon icon={faCloudDownload} />
                <span>Správa Záloh</span>
              </Link>

              <Link
                to={`/services/${id}/cron`}
                className="sd-action-card"
              >
                <FontAwesomeIcon icon={faClock} />
                <span>Správa Cron Jobs</span>
              </Link>

            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default ServiceDetail;
