import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUsers,
  faSearch,
  faFilter,
  faUserShield,
  faUser,
  faEnvelope,
  faCalendar,
  faCrown,
  faCheckCircle,
  faTimesCircle,
  faEdit,
  faServer
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { getAuthHeader } from '../lib/auth';
import { API_BASE_URL } from '../lib/api';
import './AdminUsers.css';

interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  is_admin: boolean;
  email_verified: boolean;
  created_at: string;
  last_login?: string;
}

interface Stats {
  total: number;
  admins: number;
  verified: number;
  lastWeek: number;
}

const AdminUsers: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    admins: 0,
    verified: 0,
    lastWeek: 0
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [createWebModal, setCreateWebModal] = useState<{ open: boolean; target: User | null }>({ open: false, target: null });
  const [createWebDomain, setCreateWebDomain] = useState('');
  const [createWebPackage, setCreateWebPackage] = useState('');
  const [hestiaPackages, setHestiaPackages] = useState<string[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [creatingWeb, setCreatingWeb] = useState(false);

  useEffect(() => {
    if (!user || !profile?.is_admin) {
      navigate('/');
      return;
    }
    fetchUsers();
  }, [user, profile, navigate]);

  useEffect(() => {
    let filtered = users;

    if (searchTerm) {
      filtered = filtered.filter(u =>
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterRole === 'admins') {
      filtered = filtered.filter(u => u.is_admin);
    } else if (filterRole === 'users') {
      filtered = filtered.filter(u => !u.is_admin);
    }

    setFilteredUsers(filtered);
  }, [searchTerm, filterRole, users]);

  const fetchUsers = async () => {
    try {
      setLoading(true);

      const response = await fetch(`${API_BASE_URL}/admin/users`, {
        method: 'GET',
        headers: {
          ...getAuthHeader()
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const result = await response.json();
      if (result.success && result.users) {
        setUsers(result.users);
        setFilteredUsers(result.users);

        // Calculate stats
        const total = result.users.length;
        const admins = result.users.filter((u: User) => u.is_admin).length;
        const verified = result.users.filter((u: User) => u.email_verified).length;
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const lastWeek = result.users.filter((u: User) => new Date(u.created_at) > weekAgo).length;

        setStats({ total, admins, verified, lastWeek });
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAdminRole = async (userId: string, currentIsAdmin: boolean) => {
    try {
      const response = await fetch(`${API_BASE_URL}/profile/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify({ is_admin: !currentIsAdmin })
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to update user role');
      }

      fetchUsers();
      setEditingUser(null);
    } catch (error) {
      console.error('Error updating user role:', error);
      showError('Chyba při změně role uživatele');
    }
  };

  const openCreateWebModal = async (target: User) => {
    setCreateWebModal({ open: true, target });
    setCreateWebDomain('');
    setCreateWebPackage('');
    setHestiaPackages([]);
    setLoadingPackages(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/hestiacp-packages`, { headers: getAuthHeader() });
      const data = await res.json();
      if (data.success && Array.isArray(data.packages) && data.packages.length > 0) {
        setHestiaPackages(data.packages);
        setCreateWebPackage(data.packages[0]);
      } else {
        setHestiaPackages(['default']);
        setCreateWebPackage('default');
      }
    } catch {
      setHestiaPackages(['default']);
      setCreateWebPackage('default');
    } finally {
      setLoadingPackages(false);
    }
  };

  const closeCreateWebModal = () => {
    setCreateWebModal({ open: false, target: null });
    setCreateWebDomain('');
    setCreatingWeb(false);
  };

  const createWebForUser = async () => {
    const target = createWebModal.target;
    if (!target) return;
    const trimmedDomain = createWebDomain.trim();
    if (!trimmedDomain) {
      showWarning('Zadej doménu (např. example.cz).');
      return;
    }

    setCreatingWeb(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/create-hosting-service`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify({
          userId: target.id,
          domain: trimmedDomain,
          planId: 'admin_custom',
          planName: 'Admin Webhosting',
          price: 0,
          hestiaPackage: createWebPackage || 'default'
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        showSuccess(`Webhosting pro ${target.email} byl vytvořen. HestiaCP uživatel: ${result.hestia?.username || 'neznámý'}`);
        closeCreateWebModal();
      } else {
        showWarning(`Služba byla částečně/nebyla vytvořena: ${result.error || result.warning || result.hestiaError || 'Neznámá chyba'}`);
      }
    } catch (error) {
      console.error('Error creating hosting service for user:', error);
      showError('Chyba při vytváření webu pro uživatele');
    } finally {
      setCreatingWeb(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('cs-CZ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="admin-users-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Načítání uživatelů...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-users-page">
      <div className="admin-users-container">
        {/* Header + Back link */}
        <motion.div
          className="admin-users-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="header-content">
            <div className="title-section">
              <div className="icon-wrapper">
                <FontAwesomeIcon icon={faUsers} />
              </div>
              <div>
                <h1>Správa Uživatelů</h1>
                <p>Správa účtů a oprávnění uživatelů</p>
              </div>
            </div>
            <button className="back-to-admin-btn" onClick={() => navigate('/admin')}>
              ← Zpět na administraci
            </button>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          className="stats-grid"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)' }}>
              <FontAwesomeIcon icon={faUsers} />
            </div>
            <div className="stat-content">
              <h3>{stats.total}</h3>
              <p>Celkem uživatelů</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
              <FontAwesomeIcon icon={faUserShield} />
            </div>
            <div className="stat-content">
              <h3>{stats.admins}</h3>
              <p>Administrátoři</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
              <FontAwesomeIcon icon={faCheckCircle} />
            </div>
            <div className="stat-content">
              <h3>{stats.verified}</h3>
              <p>Ověření uživatelé</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' }}>
              <FontAwesomeIcon icon={faCalendar} />
            </div>
            <div className="stat-content">
              <h3>{stats.lastWeek}</h3>
              <p>Noví za týden</p>
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
              placeholder="Hledat podle jména nebo emailu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="filter-buttons">
            <button
              className={`filter-btn ${filterRole === 'all' ? 'active' : ''}`}
              onClick={() => setFilterRole('all')}
            >
              <FontAwesomeIcon icon={faFilter} />
              Vše
            </button>
            <button
              className={`filter-btn ${filterRole === 'admins' ? 'active' : ''}`}
              onClick={() => setFilterRole('admins')}
            >
              <FontAwesomeIcon icon={faUserShield} />
              Admini
            </button>
            <button
              className={`filter-btn ${filterRole === 'users' ? 'active' : ''}`}
              onClick={() => setFilterRole('users')}
            >
              <FontAwesomeIcon icon={faUser} />
              Uživatelé
            </button>
          </div>
        </motion.div>

        {/* Users Table */}
        <motion.div
          className="users-table-container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <div className="table-header">
            <h2>
              <FontAwesomeIcon icon={faUsers} className="section-icon" />
              Uživatelé ({filteredUsers.length})
            </h2>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="no-users">
              <FontAwesomeIcon icon={faUsers} />
              <p>Žádní uživatelé</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Jméno</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Stav</th>
                    <th>Registrace</th>
                    <th>Poslední přihlášení</th>
                    <th>Akce</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <motion.tr
                      key={u.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <td className="user-name">
                        <FontAwesomeIcon icon={faUser} />
                        {u.first_name && u.last_name
                          ? `${u.first_name} ${u.last_name}`
                          : 'Neznámý'}
                      </td>
                      <td>
                        <div className="email-cell">
                          <FontAwesomeIcon icon={faEnvelope} />
                          {u.email}
                        </div>
                      </td>
                      <td>
                        {u.is_admin ? (
                          <span className="role-badge admin">
                            <FontAwesomeIcon icon={faCrown} />
                            Admin
                          </span>
                        ) : (
                          <span className="role-badge user">
                            <FontAwesomeIcon icon={faUser} />
                            Uživatel
                          </span>
                        )}
                      </td>
                      <td>
                        {u.email_verified ? (
                          <span className="status-badge verified">
                            <FontAwesomeIcon icon={faCheckCircle} />
                            Ověřen
                          </span>
                        ) : (
                          <span className="status-badge unverified">
                            <FontAwesomeIcon icon={faTimesCircle} />
                            Neověřen
                          </span>
                        )}
                      </td>
                      <td className="date">{formatDate(u.created_at)}</td>
                      <td className="date">
                        {u.last_login ? formatDate(u.last_login) : 'Nikdy'}
                      </td>
                      <td>
                        <div className="user-actions">
                          {editingUser === u.id ? (
                            <div className="edit-actions">
                              <button
                                className="confirm-btn"
                                onClick={() => toggleAdminRole(u.id, u.is_admin)}
                              >
                                <FontAwesomeIcon icon={faCheckCircle} />
                              </button>
                              <button
                                className="cancel-btn"
                                onClick={() => setEditingUser(null)}
                              >
                                <FontAwesomeIcon icon={faTimesCircle} />
                              </button>
                            </div>
                          ) : (
                            <button
                              className="action-btn edit"
                              title="Změnit roli"
                              onClick={() => setEditingUser(u.id)}
                            >
                              <FontAwesomeIcon icon={faEdit} />
                            </button>
                          )}
                          <button
                            className="action-btn create-web"
                            title="Vytvořit webhosting pro tohoto uživatele"
                            onClick={() => openCreateWebModal(u)}
                          >
                            <FontAwesomeIcon icon={faServer} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {/* Modal: Vytvořit webhosting */}
        {createWebModal.open && createWebModal.target && (
          <div className="admin-create-web-overlay" onClick={closeCreateWebModal}>
            <motion.div
              className="admin-create-web-modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="admin-create-web-modal-header">
                <h3>Vytvořit webhosting</h3>
                <p className="admin-create-web-user">{createWebModal.target.email}</p>
              </div>
              <div className="admin-create-web-modal-body">
                <label>
                  Doména
                  <input
                    type="text"
                    placeholder="example.cz"
                    value={createWebDomain}
                    onChange={e => setCreateWebDomain(e.target.value)}
                    autoFocus
                  />
                </label>
                <label>
                  HestiaCP balíček
                  <select
                    value={createWebPackage}
                    onChange={e => setCreateWebPackage(e.target.value)}
                    disabled={loadingPackages}
                  >
                    {loadingPackages ? (
                      <option>Načítám balíčky…</option>
                    ) : (
                      hestiaPackages.map(pkg => (
                        <option key={pkg} value={pkg}>{pkg}</option>
                      ))
                    )}
                  </select>
                </label>
              </div>
              <div className="admin-create-web-modal-footer">
                <button type="button" className="admin-create-web-cancel" onClick={closeCreateWebModal}>
                  Zrušit
                </button>
                <button
                  type="button"
                  className="admin-create-web-submit"
                  onClick={createWebForUser}
                  disabled={creatingWeb || !createWebDomain.trim()}
                >
                  {creatingWeb ? 'Vytvářím…' : 'Vytvořit web'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUsers;
