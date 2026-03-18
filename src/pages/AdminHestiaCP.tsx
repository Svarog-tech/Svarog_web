import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faServer,
  faUser,
  faGlobe,
  faDatabase,
  faHdd,
  faSync,
  faChevronDown,
  faChevronUp,
  faLink,
  faEnvelope,
  faPause,
  faPlay,
  faSearch,
  faFilter
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getAuthHeader } from '../lib/auth';
import { API_BASE_URL } from '../lib/api';
import {
  getHestiaLiveUsers,
  getHestiaServerStats,
  getHestiaUserDetail,
  HestiaLiveUser,
  HestiaServerStats,
  HestiaUserDetail
} from '../services/hestiacpService';
import './AdminHestiaCP.css';

const AdminHestiaCP: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<HestiaLiveUser[]>([]);
  const [serverStats, setServerStats] = useState<HestiaServerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<HestiaUserDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!user || !profile?.is_admin) {
      navigate('/');
      return;
    }
    fetchData();
  }, [user, profile, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersResult, statsResult] = await Promise.all([
        getHestiaLiveUsers(),
        getHestiaServerStats()
      ]);

      if (usersResult.success && usersResult.users) {
        setUsers(usersResult.users);
      }
      if (statsResult) {
        setServerStats(statsResult);
      }
    } catch (error) {
      console.error('Error fetching HestiaCP data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleRowClick = async (username: string) => {
    if (expandedUser === username) {
      setExpandedUser(null);
      setUserDetail(null);
      return;
    }

    setExpandedUser(username);
    setLoadingDetail(true);
    try {
      const detail = await getHestiaUserDetail(username);
      setUserDetail(detail);
    } catch (error) {
      console.error('Error fetching user detail:', error);
      setUserDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const getFilteredUsers = (): HestiaLiveUser[] => {
    let filtered = users;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(u =>
        u.username.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        u.package.toLowerCase().includes(term)
      );
    }

    if (statusFilter === 'active') {
      filtered = filtered.filter(u => !u.suspended);
    } else if (statusFilter === 'suspended') {
      filtered = filtered.filter(u => u.suspended);
    }

    return filtered;
  };

  const formatDiskUsage = (usedMb: number, quotaMb: number | 'unlimited'): string => {
    if (usedMb >= 1024) {
      const usedGb = (usedMb / 1024).toFixed(1);
      if (quotaMb === 'unlimited') return `${usedGb} GB / Neomezeno`;
      const quotaGb = (quotaMb / 1024).toFixed(1);
      return `${usedGb} GB / ${quotaGb} GB`;
    }
    if (quotaMb === 'unlimited') return `${usedMb} MB / Neomezeno`;
    return `${usedMb} MB / ${quotaMb} MB`;
  };

  const getUsagePercent = (used: number, limit: number | 'unlimited'): number => {
    if (limit === 'unlimited' || limit === 0) return used > 0 ? Math.min((used / 10240) * 100, 100) : 0;
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percent: number): string => {
    if (percent >= 90) return 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)';
    if (percent >= 70) return 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)';
    return 'linear-gradient(90deg, #10b981 0%, #059669 100%)';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('cs-CZ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const filteredUsers = getFilteredUsers();

  if (loading) {
    return (
      <div className="hestiacp-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Načítání HestiaCP dat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="hestiacp-page">
      <div className="hestiacp-container">
        {/* Header */}
        <motion.div
          className="hestiacp-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="header-content">
            <div className="title-section">
              <div className="icon-wrapper">
                <FontAwesomeIcon icon={faServer} />
              </div>
              <div>
                <h1>HestiaCP Server</h1>
                <p>Přehled uživatelů a prostředků serveru</p>
              </div>
            </div>
            <div className="header-actions">
              <button
                className={`hestiacp-refresh-btn ${refreshing ? 'spinning' : ''}`}
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <FontAwesomeIcon icon={faSync} />
                {refreshing ? 'Obnovuji...' : 'Obnovit'}
              </button>
              <button className="back-to-admin-btn" onClick={() => navigate('/admin')}>
                ← Zpět na administraci
              </button>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          className="stats-grid"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)' }}>
              <FontAwesomeIcon icon={faUser} />
            </div>
            <div className="stat-content">
              <h3>{serverStats ? `${serverStats.active_users}/${serverStats.total_users}` : '—'}</h3>
              <p>Uživatelé (aktivní/celkem)</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
              <FontAwesomeIcon icon={faGlobe} />
            </div>
            <div className="stat-content">
              <h3>{serverStats?.total_web_domains ?? '—'}</h3>
              <p>Webové domény</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
              <FontAwesomeIcon icon={faDatabase} />
            </div>
            <div className="stat-content">
              <h3>{serverStats?.total_databases ?? '—'}</h3>
              <p>Databáze</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' }}>
              <FontAwesomeIcon icon={faHdd} />
            </div>
            <div className="stat-content">
              <h3>
                {serverStats
                  ? serverStats.total_disk_used_mb >= 1024
                    ? `${(serverStats.total_disk_used_mb / 1024).toFixed(1)} GB`
                    : `${serverStats.total_disk_used_mb} MB`
                  : '—'}
              </h3>
              <p>Disk celkem</p>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          className="filters-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="search-box">
            <FontAwesomeIcon icon={faSearch} />
            <input
              type="text"
              placeholder="Hledat podle uživatele, emailu nebo balíčku..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="filter-buttons">
            <button
              className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              <FontAwesomeIcon icon={faFilter} />
              Vše
            </button>
            <button
              className={`filter-btn ${statusFilter === 'active' ? 'active' : ''}`}
              onClick={() => setStatusFilter('active')}
            >
              <FontAwesomeIcon icon={faPlay} />
              Aktivní
            </button>
            <button
              className={`filter-btn ${statusFilter === 'suspended' ? 'active' : ''}`}
              onClick={() => setStatusFilter('suspended')}
            >
              <FontAwesomeIcon icon={faPause} />
              Pozastavení
            </button>
          </div>
        </motion.div>

        {/* Users Table */}
        <motion.div
          className="hestiacp-table-container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <div className="table-header">
            <h2>
              <FontAwesomeIcon icon={faServer} className="section-icon" />
              HestiaCP Uživatelé ({filteredUsers.length})
            </h2>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="no-users">
              <FontAwesomeIcon icon={faServer} />
              <p>Žádní uživatelé</p>
            </div>
          ) : (
            <div className="table-wrapper table-responsive">
              <table className="hestiacp-table">
                <thead>
                  <tr>
                    <th>Uživatel</th>
                    <th>Email</th>
                    <th>Paket</th>
                    <th>Domény</th>
                    <th>DB</th>
                    <th>Disk</th>
                    <th>Bandwidth</th>
                    <th>Status</th>
                    <th>Propojení</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <React.Fragment key={u.username}>
                      <motion.tr
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                        className={`hestiacp-row ${expandedUser === u.username ? 'expanded' : ''}`}
                        onClick={() => handleRowClick(u.username)}
                      >
                        <td className="user-name">
                          <FontAwesomeIcon icon={faUser} />
                          <span>{u.username}</span>
                          {u.is_system_admin && (
                            <span className="hestiacp-system-badge">Systémový admin</span>
                          )}
                        </td>
                        <td>
                          <div className="email-cell">
                            <FontAwesomeIcon icon={faEnvelope} />
                            {u.email}
                          </div>
                        </td>
                        <td className="plan-name">{u.package}</td>
                        <td>{u.web_domains}</td>
                        <td>{u.databases}</td>
                        <td>
                          <div className="hestiacp-usage-cell">
                            <span className="usage-text">
                              {formatDiskUsage(u.disk_used_mb, u.disk_quota_mb)}
                            </span>
                            <div className="hestiacp-usage-bar">
                              <div
                                className="hestiacp-usage-bar-fill"
                                style={{
                                  width: `${getUsagePercent(u.disk_used_mb, u.disk_quota_mb)}%`,
                                  background: getUsageColor(getUsagePercent(u.disk_used_mb, u.disk_quota_mb))
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="hestiacp-usage-cell">
                            <span className="usage-text">
                              {formatDiskUsage(u.bandwidth_used_mb, u.bandwidth_limit_mb)}
                            </span>
                            <div className="hestiacp-usage-bar">
                              <div
                                className="hestiacp-usage-bar-fill"
                                style={{
                                  width: `${getUsagePercent(u.bandwidth_used_mb, u.bandwidth_limit_mb)}%`,
                                  background: getUsageColor(getUsagePercent(u.bandwidth_used_mb, u.bandwidth_limit_mb))
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td>
                          {u.suspended ? (
                            <span className="status-badge suspended">
                              <FontAwesomeIcon icon={faPause} />
                              Pozastaven
                            </span>
                          ) : (
                            <span className="status-badge active">
                              <FontAwesomeIcon icon={faPlay} />
                              Aktivní
                            </span>
                          )}
                        </td>
                        <td>
                          {u.linked_local_user ? (
                            <span className="hestiacp-linked-badge">
                              <FontAwesomeIcon icon={faLink} />
                              {u.linked_local_user.name || u.linked_local_user.email}
                            </span>
                          ) : (
                            <span className="no-hestia">—</span>
                          )}
                        </td>
                      </motion.tr>

                      {/* Expanded Detail */}
                      {expandedUser === u.username && (
                        <tr className="hestiacp-detail-row">
                          <td colSpan={9}>
                            <motion.div
                              className="hestiacp-expanded-detail"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.3 }}
                            >
                              {loadingDetail ? (
                                <div className="detail-loading">
                                  <div className="spinner small"></div>
                                  <span>Načítání detailu...</span>
                                </div>
                              ) : userDetail ? (
                                <div className="detail-grid">
                                  {/* Domény */}
                                  <div className="detail-section">
                                    <h4>
                                      <FontAwesomeIcon icon={faGlobe} />
                                      Webové domény ({userDetail.domains.length})
                                    </h4>
                                    {userDetail.domains.length > 0 ? (
                                      <ul className="detail-list">
                                        {userDetail.domains.map((d, i) => (
                                          <li key={i}>
                                            <FontAwesomeIcon icon={faGlobe} />
                                            <span>{d.domain}</span>
                                            {d.ip && <span className="detail-meta">{d.ip}</span>}
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="detail-empty">Žádné domény</p>
                                    )}
                                  </div>

                                  {/* Databáze */}
                                  <div className="detail-section">
                                    <h4>
                                      <FontAwesomeIcon icon={faDatabase} />
                                      Databáze ({userDetail.databases.length})
                                    </h4>
                                    {userDetail.databases.length > 0 ? (
                                      <ul className="detail-list">
                                        {userDetail.databases.map((db, i) => (
                                          <li key={i}>
                                            <FontAwesomeIcon icon={faDatabase} />
                                            <span>{db.name}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="detail-empty">Žádné databáze</p>
                                    )}
                                  </div>

                                  {/* Mail domény */}
                                  <div className="detail-section">
                                    <h4>
                                      <FontAwesomeIcon icon={faEnvelope} />
                                      Mailové domény ({userDetail.mail_domains.length})
                                    </h4>
                                    {userDetail.mail_domains.length > 0 ? (
                                      <ul className="detail-list">
                                        {userDetail.mail_domains.map((md, i) => (
                                          <li key={i}>
                                            <FontAwesomeIcon icon={faEnvelope} />
                                            <span>{md}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="detail-empty">Žádné mailové domény</p>
                                    )}
                                  </div>

                                  {/* Propojení */}
                                  {userDetail.linked_local_user && (
                                    <div className="detail-section">
                                      <h4>
                                        <FontAwesomeIcon icon={faLink} />
                                        Propojený účet
                                      </h4>
                                      <div className="linked-user-info">
                                        <span className="hestiacp-linked-badge">
                                          <FontAwesomeIcon icon={faLink} />
                                          {userDetail.linked_local_user.first_name} {userDetail.linked_local_user.last_name}
                                        </span>
                                        <span className="detail-meta">{userDetail.linked_local_user.email}</span>
                                      </div>
                                    </div>
                                  )}

                                  {/* Info */}
                                  <div className="detail-section">
                                    <h4>
                                      <FontAwesomeIcon icon={faServer} />
                                      Informace
                                    </h4>
                                    <div className="detail-info-grid">
                                      <div className="info-item">
                                        <span className="info-label">Vytvořen</span>
                                        <span className="info-value">{formatDate(u.creation_date)}</span>
                                      </div>
                                      <div className="info-item">
                                        <span className="info-label">IP adresy</span>
                                        <span className="info-value">{u.ip_addresses || '—'}</span>
                                      </div>
                                      <div className="info-item">
                                        <span className="info-label">DNS domény</span>
                                        <span className="info-value">{u.dns_domains}</span>
                                      </div>
                                      <div className="info-item">
                                        <span className="info-label">Mail domény</span>
                                        <span className="info-value">{u.mail_domains}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="detail-error">
                                  <p>Nepodařilo se načíst detail uživatele.</p>
                                </div>
                              )}
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default AdminHestiaCP;
