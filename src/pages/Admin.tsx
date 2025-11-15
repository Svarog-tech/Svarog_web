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
  faArrowRight
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/auth';
import OrderDetailModal from '../components/OrderDetailModal';
import './Admin.css';

interface Order {
  id: number;
  user_id: string | null;
  plan_id: string;
  plan_name: string;
  price: number;
  customer_email: string;
  customer_name: string;
  status: string;
  payment_status?: string;
  payment_id?: string;
  payment_url?: string;
  created_at: string;
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

  useEffect(() => {
    // Kontrola, zda je uživatel admin
    if (!user || !profile?.is_admin) {
      navigate('/');
      return;
    }

    fetchOrders();
  }, [user, profile, navigate]);

  useEffect(() => {
    // Filtrování objednávek
    let filtered = orders;

    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.plan_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.id.toString().includes(searchTerm)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    setFilteredOrders(filtered);
  }, [searchTerm, statusFilter, orders]);

  const fetchOrders = async () => {
    try {
      setLoading(true);

      // Načtení všech objednávek (pouze pro adminy)
      const { data, error } = await supabase
        .from('user_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setOrders(data);
        setFilteredOrders(data);

        // Výpočet statistik
        const totalOrders = data.length;
        const totalRevenue = data.reduce((sum, order) => sum + parseFloat(order.price.toString()), 0);
        const pendingOrders = data.filter(order => order.status === 'pending').length;
        const activeOrders = data.filter(order => order.status === 'active').length;

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

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; icon: any; label: string }> = {
      pending: { color: '#f59e0b', icon: faClock, label: 'Čeká' },
      processing: { color: '#3b82f6', icon: faClock, label: 'Zpracovává se' },
      active: { color: '#10b981', icon: faCheckCircle, label: 'Aktivní' },
      cancelled: { color: '#ef4444', icon: faTimesCircle, label: 'Zrušeno' },
      expired: { color: '#6b7280', icon: faTimesCircle, label: 'Expirováno' }
    };

    const statusInfo = statusMap[status] || statusMap.pending;

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
                      <td className="customer-name">{order.customer_name}</td>
                      <td>{order.customer_email}</td>
                      <td className="plan-name">{order.plan_name}</td>
                      <td className="price">{formatPrice(order.price)}</td>
                      <td>{getStatusBadge(order.status)}</td>
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
                          <button className="action-btn delete" title="Smazat">
                            <FontAwesomeIcon icon={faTrash} />
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
