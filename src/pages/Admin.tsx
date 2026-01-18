import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUserShield,
  faShoppingCart,
  faUsers,
  faServer,
  faMoneyBillWave,
  faCheckCircle,
  faTimesCircle,
  faClock,
  faEye,
  faTrash,
  faFilter,
  faSearch,
  faChartLine,
  faChartBar,
  faTicket,
  faArrowRight,
  faBan,
  faCheck,
  faTrashAlt,
  faUser,
  faLink
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getAuthHeader } from '../lib/auth';
import { getAllUserHostingServices, HostingService } from '../lib/supabase';
import { suspendHostingAccount, unsuspendHostingAccount, deleteHostingAccount } from '../services/hestiacpService';
import OrderDetailModal from '../components/OrderDetailModal';
import './Admin.css';

interface Order {
  id: number;
  user_id: string | null;
  plan_id: string;
  plan_name: string;
  price: number;
  currency?: string;
  customer_email?: string;
  customer_name?: string;
  billing_email?: string;
  billing_name?: string;
  billing_company?: string;
  billing_address?: string;
  billing_phone?: string;
  status?: string;
  payment_status?: string;
  payment_id?: string;
  payment_url?: string;
  gopay_status?: string;
  payment_method?: string;
  transaction_id?: string;
  payment_date?: string | Date;
  domain_name?: string;
  service_start_date?: string | Date;
  service_end_date?: string | Date;
  auto_renewal?: boolean;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

interface Stats {
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  activeOrders: number;
}

const Admin: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    activeOrders: 0
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hostingServices, setHostingServices] = useState<HostingService[]>([]);
  const [loadingHestia, setLoadingHestia] = useState(false);

  useEffect(() => {
    // Kontrola, zda je uživatel admin
    if (!user || !profile?.is_admin) {
      navigate('/');
      return;
    }

    fetchOrders();
    fetchHostingServices();
  }, [user, profile, navigate]);

  const fetchHostingServices = async () => {
    try {
      // Získej všechny hosting služby (admin vidí všechny)
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_URL}/hosting-services`, {
        method: 'GET',
        headers: {
          ...getAuthHeader()
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch hosting services');
      }

      const result = await response.json();
      if (result.success && result.services) {
        setHostingServices(result.services);
      }
    } catch (error) {
      console.error('Error fetching hosting services:', error);
    }
  };

  const handleSuspendAccount = async (service: HostingService) => {
    if (!service.hestia_username) return;
    if (!window.confirm(`Opravdu chceš suspendovat HestiaCP účet ${service.hestia_username}?`)) return;

    try {
      setLoadingHestia(true);
      const result = await suspendHostingAccount(service.hestia_username);
      if (result.success) {
        const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
        await fetch(`${API_URL}/hosting-services/${service.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader()
          },
          body: JSON.stringify({ status: 'suspended' })
        });
        await fetchHostingServices();
        alert('HestiaCP účet byl suspendován');
      } else {
        alert(`Chyba: ${result.error}`);
      }
    } catch (error) {
      console.error('Error suspending account:', error);
      alert('Chyba při suspendování účtu');
    } finally {
      setLoadingHestia(false);
    }
  };

  const handleUnsuspendAccount = async (service: HostingService) => {
    if (!service.hestia_username) return;
    if (!window.confirm(`Opravdu chceš obnovit HestiaCP účet ${service.hestia_username}?`)) return;

    try {
      setLoadingHestia(true);
      const result = await unsuspendHostingAccount(service.hestia_username);
      if (result.success) {
        const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
        await fetch(`${API_URL}/hosting-services/${service.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader()
          },
          body: JSON.stringify({ status: 'active' })
        });
        await fetchHostingServices();
        alert('HestiaCP účet byl obnoven');
      } else {
        alert(`Chyba: ${result.error}`);
      }
    } catch (error) {
      console.error('Error unsuspending account:', error);
      alert('Chyba při obnovování účtu');
    } finally {
      setLoadingHestia(false);
    }
  };

  const handleDeleteAccount = async (service: HostingService) => {
    if (!service.hestia_username) return;
    if (!window.confirm(`POZOR! Opravdu chceš smazat HestiaCP účet ${service.hestia_username}? Tato akce je nevratná a smaže všechny data!`)) return;

    try {
      setLoadingHestia(true);
      const result = await deleteHostingAccount(service.hestia_username);
      if (result.success) {
        const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
        await fetch(`${API_URL}/hosting-services/${service.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader()
          },
          body: JSON.stringify({ status: 'cancelled', hestia_created: false })
        });
        await fetchHostingServices();
        alert('HestiaCP účet byl smazán');
      } else {
        alert(`Chyba: ${result.error}`);
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Chyba při mazání účtu');
    } finally {
      setLoadingHestia(false);
    }
  };

  useEffect(() => {
    // Filtrování objednávek
    let filtered = orders;

    if (searchTerm) {
      filtered = filtered.filter(order =>
        (order.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.customer_email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.plan_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.id.toString().includes(searchTerm)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => (order.status || 'pending') === statusFilter);
    }

    setFilteredOrders(filtered);
  }, [searchTerm, statusFilter, orders]);

  const fetchOrders = async () => {
    try {
      setLoading(true);

      // Načtení všech objednávek (pouze pro adminy)
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_URL}/orders`, {
        method: 'GET',
        headers: {
          ...getAuthHeader()
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }

      const result = await response.json();
      if (result.success && result.orders) {
        setOrders(result.orders);
        setFilteredOrders(result.orders);

        // Výpočet statistik
        const totalOrders = result.orders.length;
        const totalRevenue = result.orders.reduce((sum: number, order: Order) => sum + parseFloat(order.price.toString()), 0);
        const pendingOrders = result.orders.filter((order: Order) => (order.status || 'pending') === 'pending').length;
        const activeOrders = result.orders.filter((order: Order) => (order.status || 'pending') === 'active').length;

        setStats({
          totalOrders,
          totalRevenue,
          pendingOrders,
          activeOrders
        });
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    const statusMap: Record<string, { color: string; icon: any; label: string }> = {
      pending: { color: '#f59e0b', icon: faClock, label: 'Čeká' },
      processing: { color: '#3b82f6', icon: faClock, label: 'Zpracovává se' },
      active: { color: '#10b981', icon: faCheckCircle, label: 'Aktivní' },
      cancelled: { color: '#ef4444', icon: faTimesCircle, label: 'Zrušeno' },
      expired: { color: '#6b7280', icon: faTimesCircle, label: 'Expirováno' }
    };

    const statusInfo = statusMap[status || 'pending'] || statusMap.pending;

    return (
      <span
        className="status-badge"
        style={{ background: `${statusInfo.color}20`, color: statusInfo.color }}
      >
        <FontAwesomeIcon icon={statusInfo.icon} />
        {statusInfo.label}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('cs-CZ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: 'CZK'
    }).format(price);
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Načítání dat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-container">
        {/* Header */}
        <motion.div
          className="admin-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="admin-header-content">
            <div className="admin-title-section">
              <div className="admin-icon-wrapper">
                <FontAwesomeIcon icon={faUserShield} />
              </div>
              <div>
                <h1>Administrace</h1>
                <p>Správa objednávek a uživatelů</p>
              </div>
            </div>
            <div className="admin-quick-links">
              <button className="quick-link-btn" onClick={() => navigate('/admin/tickets')}>
                <FontAwesomeIcon icon={faTicket} />
                <span>Tickety</span>
                <FontAwesomeIcon icon={faArrowRight} className="arrow" />
              </button>
              <button className="quick-link-btn" onClick={() => navigate('/admin/users')}>
                <FontAwesomeIcon icon={faUsers} />
                <span>Uživatelé</span>
                <FontAwesomeIcon icon={faArrowRight} className="arrow" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Statistiky */}
        <motion.div
          className="stats-grid"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)' }}>
              <FontAwesomeIcon icon={faShoppingCart} />
            </div>
            <div className="stat-content">
              <h3>{stats.totalOrders}</h3>
              <p>Celkem objednávek</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
              <FontAwesomeIcon icon={faMoneyBillWave} />
            </div>
            <div className="stat-content">
              <h3>{formatPrice(stats.totalRevenue)}</h3>
              <p>Celkové tržby</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
              <FontAwesomeIcon icon={faClock} />
            </div>
            <div className="stat-content">
              <h3>{stats.pendingOrders}</h3>
              <p>Čekající objednávky</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' }}>
              <FontAwesomeIcon icon={faServer} />
            </div>
            <div className="stat-content">
              <h3>{stats.activeOrders}</h3>
              <p>Aktivní služby</p>
            </div>
          </div>
        </motion.div>

        {/* Trendy a Grafy */}
        <motion.div
          className="charts-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <h2>
            <FontAwesomeIcon icon={faChartLine} className="section-icon" />
            Trendy
          </h2>
          <div className="charts-grid">
            {/* Status rozdělení */}
            <div className="chart-card">
              <h3>Rozdělení objednávek podle statusu</h3>
              <div className="chart-bars">
                <div className="chart-bar-item">
                  <div className="bar-label">
                    <span>Čekající</span>
                    <span className="bar-value">{stats.pendingOrders}</span>
                  </div>
                  <div className="bar-container">
                    <div
                      className="bar-fill pending"
                      style={{
                        width: `${stats.totalOrders > 0 ? (stats.pendingOrders / stats.totalOrders) * 100 : 0}%`
                      }}
                    ></div>
                  </div>
                </div>
                <div className="chart-bar-item">
                  <div className="bar-label">
                    <span>Aktivní</span>
                    <span className="bar-value">{stats.activeOrders}</span>
                  </div>
                  <div className="bar-container">
                    <div
                      className="bar-fill active"
                      style={{
                        width: `${stats.totalOrders > 0 ? (stats.activeOrders / stats.totalOrders) * 100 : 0}%`
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tržby přehled */}
            <div className="chart-card">
              <h3>Finanční přehled</h3>
              <div className="financial-overview">
                <div className="financial-item">
                  <span className="financial-label">Celkové tržby</span>
                  <span className="financial-value primary">{formatPrice(stats.totalRevenue)}</span>
                </div>
                <div className="financial-item">
                  <span className="financial-label">Průměr na objednávku</span>
                  <span className="financial-value">
                    {formatPrice(stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0)}
                  </span>
                </div>
                <div className="financial-item">
                  <span className="financial-label">Aktivní služby</span>
                  <span className="financial-value success">{stats.activeOrders}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Filtry a Vyhledávání */}
        <motion.div
          className="filters-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <div className="search-box">
            <FontAwesomeIcon icon={faSearch} />
            <input
              type="text"
              placeholder="Hledat podle jména, emailu, plánu..."
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
              className={`filter-btn ${statusFilter === 'pending' ? 'active' : ''}`}
              onClick={() => setStatusFilter('pending')}
            >
              <FontAwesomeIcon icon={faClock} />
              Čekající
            </button>
            <button
              className={`filter-btn ${statusFilter === 'active' ? 'active' : ''}`}
              onClick={() => setStatusFilter('active')}
            >
              <FontAwesomeIcon icon={faCheckCircle} />
              Aktivní
            </button>
          </div>
        </motion.div>

        {/* Tabulka objednávek */}
        <motion.div
          className="orders-table-container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <div className="table-header">
            <h2>
              <FontAwesomeIcon icon={faChartBar} className="section-icon" />
              Objednávky ({filteredOrders.length})
            </h2>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="no-orders">
              <FontAwesomeIcon icon={faShoppingCart} />
              <p>Žádné objednávky</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Zákazník</th>
                    <th>Email</th>
                    <th>Plán</th>
                    <th>Cena</th>
                    <th>Status</th>
                    <th>HestiaCP</th>
                    <th>Datum</th>
                    <th>Akce</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <motion.tr
                      key={order.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <td>#{order.id}</td>
                      <td className="customer-name">{order.customer_name || order.billing_name || '-'}</td>
                      <td>{order.customer_email || order.billing_email || '-'}</td>
                      <td className="plan-name">{order.plan_name}</td>
                      <td className="price">{formatPrice(order.price)}</td>
                      <td>{getStatusBadge(order.status || 'pending')}</td>
                      <td>
                        {(() => {
                          const service = hostingServices.find(s => s.order_id === order.id);
                          if (service?.hestia_created && service.hestia_username) {
                            return (
                              <div className="hestiacp-info-cell">
                                <div className="hestiacp-badge-small">
                                  <FontAwesomeIcon icon={faCheckCircle} />
                                  <span>{service.hestia_username}</span>
                                </div>
                                {service.cpanel_url && (
                                  <a
                                    href={service.cpanel_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hestiacp-link"
                                    title="Otevřít Control Panel"
                                  >
                                    <FontAwesomeIcon icon={faLink} />
                                  </a>
                                )}
                              </div>
                            );
                          }
                          return <span className="no-hestia">-</span>;
                        })()}
                      </td>
                      <td className="date">{formatDate(order.created_at)}</td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="action-btn view"
                            title="Zobrazit detail"
                            onClick={() => {
                              setSelectedOrder(order);
                              setIsModalOpen(true);
                            }}
                          >
                            <FontAwesomeIcon icon={faEye} />
                          </button>
                          {(() => {
                            const service = hostingServices.find(s => s.order_id === order.id);
                            if (service?.hestia_username) {
                              return (
                                <>
                                  {service.status === 'active' ? (
                                    <button
                                      className="action-btn suspend"
                                      title="Suspendovat HestiaCP účet"
                                      onClick={() => handleSuspendAccount(service)}
                                      disabled={loadingHestia}
                                    >
                                      <FontAwesomeIcon icon={faBan} />
                                    </button>
                                  ) : (
                                    <button
                                      className="action-btn unsuspend"
                                      title="Obnovit HestiaCP účet"
                                      onClick={() => handleUnsuspendAccount(service)}
                                      disabled={loadingHestia}
                                    >
                                      <FontAwesomeIcon icon={faCheck} />
                                    </button>
                                  )}
                                  <button
                                    className="action-btn delete"
                                    title="Smazat HestiaCP účet"
                                    onClick={() => handleDeleteAccount(service)}
                                    disabled={loadingHestia}
                                  >
                                    <FontAwesomeIcon icon={faTrashAlt} />
                                  </button>
                                </>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>

      {/* Order Detail Modal */}
      <OrderDetailModal
        order={selectedOrder}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedOrder(null);
        }}
        onUpdate={() => {
          fetchOrders();
        }}
      />
    </div>
  );
};

export default Admin;
