import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, Outlet, useParams, Link, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChartBar,
  faEnvelope,
  faFolder,
  faDatabase,
  faGlobe,
  faNetworkWired,
  faUpload,
  faCloudDownloadAlt,
  faClock,
  faBars,
  faTimes,
  faServer,
  faCircle,
  faHdd,
  faExclamationTriangle,
  faArrowLeft
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext';
import { getHostingService, getHostingServiceStats, HostingService, HostingServiceStats } from '../lib/api';
import Loading from './Loading';
import './ControlPanel.css';

export interface ControlPanelContext {
  service: HostingService;
  stats: HostingServiceStats | null;
  statsLoading: boolean;
  refreshStats: () => void;
}

const navItems = [
  { path: '', icon: faChartBar, label: 'Přehled', end: true },
  { path: 'emails', icon: faEnvelope, label: 'Emaily' },
  { path: 'files', icon: faFolder, label: 'Soubory' },
  { path: 'databases', icon: faDatabase, label: 'Databáze' },
  { path: 'domains', icon: faGlobe, label: 'Domény' },
  { path: 'dns', icon: faNetworkWired, label: 'DNS' },
  { path: 'ftp', icon: faUpload, label: 'FTP' },
  { path: 'backups', icon: faCloudDownloadAlt, label: 'Zálohy' },
  { path: 'cron', icon: faClock, label: 'Cron' },
];

const ControlPanel: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const location = useLocation();
  const [service, setService] = useState<HostingService | null>(null);
  const [stats, setStats] = useState<HostingServiceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      // Stats selhaly, stránka funguje dál
    } finally {
      setStatsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (user && id) {
      fetchService();
    }
  }, [user, id, fetchService]);

  useEffect(() => {
    if (service?.hestia_created && service?.hestia_username) {
      fetchStats();
    } else if (service) {
      setStatsLoading(false);
    }
  }, [service, fetchStats]);

  // Close sidebar on navigation
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  if (loading) {
    return <Loading message="Načítání panelu..." minHeight="60vh" />;
  }

  if (error || !service) {
    return (
      <div className="cp-error-page">
        <FontAwesomeIcon icon={faExclamationTriangle} className="cp-error-icon" />
        <h3>{error || 'Služba nenalezena'}</h3>
        <p>Zkontrolujte, zda služba existuje a máte k ní přístup.</p>
        <Link to="/services" className="cp-error-back">
          <FontAwesomeIcon icon={faArrowLeft} />
          Zpět na služby
        </Link>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'pending': return 'warning';
      case 'cancelled': case 'suspended': return 'danger';
      default: return 'secondary';
    }
  };

  const diskPercent = stats && stats.disk_limit_mb !== 'unlimited' && stats.disk_limit_mb > 0
    ? Math.min(Math.round((stats.disk_used_mb / stats.disk_limit_mb) * 100), 100)
    : null;

  const contextValue: ControlPanelContext = {
    service,
    stats,
    statsLoading,
    refreshStats: fetchStats,
  };

  return (
    <div className="cp-layout">
      {/* Mobile toggle */}
      <button
        className="cp-sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label={sidebarOpen ? 'Zavřít menu' : 'Otevřít menu'}
      >
        <FontAwesomeIcon icon={sidebarOpen ? faTimes : faBars} />
      </button>

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div className="cp-sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`cp-sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Service info header */}
        <div className="cp-sidebar-header">
          <div className="cp-service-icon">
            <FontAwesomeIcon icon={faServer} />
          </div>
          <div className="cp-service-info">
            <h2 className="cp-service-name">{service.plan_name}</h2>
            <p className="cp-service-domain">{service.hestia_domain || 'Bez domény'}</p>
            <span className={`cp-status-dot status-${getStatusColor(service.status)}`}>
              <FontAwesomeIcon icon={faCircle} />
              {service.status === 'active' ? 'Aktivní' : service.status}
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="cp-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path === '' ? `/services/${id}` : `/services/${id}/${item.path}`}
              end={item.end}
              className={({ isActive }) => `cp-nav-item ${isActive ? 'active' : ''}`}
            >
              <FontAwesomeIcon icon={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Mini stats */}
        {stats && (
          <div className="cp-sidebar-stats">
            <div className="cp-mini-stat">
              <FontAwesomeIcon icon={faHdd} />
              <div className="cp-mini-stat-info">
                <span className="cp-mini-stat-label">Disk</span>
                <span className="cp-mini-stat-value">
                  {diskPercent !== null ? `${diskPercent}%` : 'N/A'}
                </span>
              </div>
              {diskPercent !== null && (
                <div className="cp-mini-progress">
                  <div
                    className="cp-mini-progress-fill"
                    style={{ width: `${diskPercent}%` }}
                    data-level={diskPercent > 90 ? 'danger' : diskPercent > 70 ? 'warning' : 'ok'}
                  />
                </div>
              )}
            </div>
            <div className="cp-mini-stat">
              <FontAwesomeIcon icon={faEnvelope} />
              <div className="cp-mini-stat-info">
                <span className="cp-mini-stat-label">Emaily</span>
                <span className="cp-mini-stat-value">
                  {stats.email_accounts_used}/{stats.email_accounts_limit === 'unlimited' ? '∞' : stats.email_accounts_limit}
                </span>
              </div>
            </div>
            <div className="cp-mini-stat">
              <FontAwesomeIcon icon={faDatabase} />
              <div className="cp-mini-stat-info">
                <span className="cp-mini-stat-label">Databáze</span>
                <span className="cp-mini-stat-value">
                  {stats.databases_used}/{stats.databases_limit === 'unlimited' ? '∞' : stats.databases_limit}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Back link */}
        <div className="cp-sidebar-footer">
          <Link to="/services" className="cp-back-link">
            <FontAwesomeIcon icon={faArrowLeft} />
            <span>Zpět na služby</span>
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="cp-content">
        <Outlet context={contextValue} />
      </main>
    </div>
  );
};

export default ControlPanel;
