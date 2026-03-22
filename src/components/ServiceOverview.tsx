import React, { useCallback, useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
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
  faFolder,
  faShieldAlt,
  faExclamationTriangle,
  faExclamationCircle,
  faInfoCircle,
  faGlobe,
  faServer,
  faBell
} from '@fortawesome/free-solid-svg-icons';
import { useCurrency } from '../contexts/CurrencyContext';
import type { ControlPanelContext } from './ControlPanel';
import { getServiceAlerts, acknowledgeAlert, type ServiceAlert } from '../lib/api';
import UsageChart from './UsageChart';
import '../pages/ServiceDetail.css';

const ALERT_TYPE_LABELS: Record<string, string> = {
  disk_limit: 'Disk',
  bandwidth_limit: 'Přenos dat',
  email_limit: 'E-maily',
  database_limit: 'Databáze',
  domain_limit: 'Domény',
  cpu_high: 'CPU',
  memory_high: 'Paměť',
};

const ServiceOverview: React.FC = () => {
  const { service, stats, statsLoading, refreshStats } = useOutletContext<ControlPanelContext>();
  const { formatPrice } = useCurrency();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<ServiceAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);

  useEffect(() => {
    if (!service?.id) return;
    const controller = new AbortController();
    setAlertsLoading(true);
    getServiceAlerts(service.id)
      .then((result) => {
        if (!controller.signal.aborted) {
          setAlerts(result.filter((a) => !a.acknowledged));
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setAlerts([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setAlertsLoading(false);
      });
    return () => controller.abort();
  }, [service?.id]);

  const handleAcknowledgeAlert = async (alert: ServiceAlert) => {
    try {
      await acknowledgeAlert(service.id, alert.id);
      setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
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
            aria-label={`Kopírovat ${label}`}
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

  const baseUrl = getBaseUrl();

  return (
    <div className="so-page">
      {/* Suspended Banner */}
      {(service.status === 'suspended' || stats?.suspended) && (
        <motion.div
          className="sd-suspended-banner"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
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
        transition={{ duration: 0.5 }}
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
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className="so-section-header">
          <h2 className="sd-section-title">
            <FontAwesomeIcon icon={faHdd} />
            Využití zdrojů
          </h2>
          <button className="so-refresh-btn" onClick={refreshStats} title="Obnovit statistiky" aria-label="Obnovit statistiky">
            <FontAwesomeIcon icon={faSync} />
          </button>
        </div>
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

      {/* Usage Charts */}
      {stats && service.hestia_created && (
        <motion.div
          className="sd-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <h2 className="sd-section-title">
            <FontAwesomeIcon icon={faHdd} />
            Historie využití
          </h2>
          <div className="sd-stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            <UsageChart serviceId={service.id} metric="disk" title="Diskový prostor" />
            <UsageChart serviceId={service.id} metric="bandwidth" title="Přenos dat" />
          </div>
        </motion.div>
      )}

      {/* Service Alerts */}
      {alerts.length > 0 && (
        <motion.div
          className="sd-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.18 }}
        >
          <h2 className="sd-section-title">
            <FontAwesomeIcon icon={faBell} />
            Upozornění ({alerts.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {alerts.map((alert) => (
              <div
                key={alert.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  background: alert.severity === 'critical' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                  border: `1px solid ${alert.severity === 'critical' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                  borderRadius: '10px',
                }}
              >
                <FontAwesomeIcon
                  icon={alert.severity === 'critical' ? faExclamationCircle : faExclamationTriangle}
                  style={{ color: alert.severity === 'critical' ? 'var(--danger-color)' : 'var(--warning-color)', fontSize: '1.1rem' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    {ALERT_TYPE_LABELS[alert.alert_type] || alert.alert_type}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Aktuální: <strong>{alert.current_value}</strong> / Limit: {alert.threshold_value}
                  </div>
                </div>
                <button
                  onClick={() => handleAcknowledgeAlert(alert)}
                  style={{
                    background: 'none',
                    border: '1px solid var(--border-light)',
                    borderRadius: '6px',
                    padding: '4px 12px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  Potvrdit
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Access Credentials */}
      {service.hestia_created && (
        <motion.div
          className="sd-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h2 className="sd-section-title">
            <FontAwesomeIcon icon={faKey} />
            Přístupové údaje
          </h2>
          <div className="sd-credentials-grid">
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
          transition={{ duration: 0.5, delay: 0.3 }}
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

      {/* External Quick Actions */}
      {service.hestia_created && (
        <motion.div
          className="sd-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <h2 className="sd-section-title">
            <FontAwesomeIcon icon={faExternalLinkAlt} />
            Externí nástroje
          </h2>
          <div className="so-external-grid">
            {service.cpanel_url ? (
              <a href={service.cpanel_url} target="_blank" rel="noopener noreferrer" className="sd-action-card">
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
              <a href={`${baseUrl}:8083/list/mail/`} target="_blank" rel="noopener noreferrer" className="sd-action-card">
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
              <a href={`${baseUrl}/phpmyadmin/`} target="_blank" rel="noopener noreferrer" className="sd-action-card">
                <FontAwesomeIcon icon={faDatabase} />
                <span>phpMyAdmin</span>
              </a>
            ) : (
              <div className="sd-action-card disabled">
                <FontAwesomeIcon icon={faDatabase} />
                <span>phpMyAdmin</span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ServiceOverview;
