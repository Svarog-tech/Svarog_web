import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faServer,
  faGlobe,
  faTicket,
  faUser,
  faChartBar,
  faCog,
  faPlus,
  faExternalLinkAlt,
  faCreditCard,
  faCalendarAlt
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { getUserOrders, getAllUserHostingServices, HostingService } from '../lib/supabase';
import './Dashboard.css';

interface Order {
  id: number;
  plan_name: string;
  price: number;
  currency: string;
  status: string;
  payment_status: string;
  domain_name?: string;
  created_at: string;
  service_end_date?: string;
}

interface DashboardStats {
  totalOrders: number;
  activeServices: number;
  totalSpent: number;
}

const Dashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ totalOrders: 0, activeServices: 0, totalSpent: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch user orders
      const ordersData = await getUserOrders();
      // Fetch hosting services with HestiaCP data
      const hostingServices = await getAllUserHostingServices();
      
      // Merge data
      const mergedOrders = ordersData?.map((order: any) => {
        const service = hostingServices?.find((s: HostingService) => s.order_id === order.id);
        return {
          ...order,
          hestia_username: service?.hestia_username,
          hestia_domain: service?.hestia_domain,
          cpanel_url: service?.cpanel_url,
          hestia_created: service?.hestia_created
        };
      }) || [];
      
      setOrders(mergedOrders);

      // Calculate stats
      const totalOrders = mergedOrders.length;
      const activeServices = hostingServices?.filter((s: HostingService) => s.status === 'active' && s.hestia_created).length || 0;
      const totalSpent = mergedOrders.reduce((sum: number, order: Order) => sum + Number(order.price), 0);

      setStats({ totalOrders, activeServices, totalSpent });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>{t('dashboard.loading')}</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">
        {/* Header */}
        <motion.div
          className="dashboard-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="welcome-section">
            <h1 className="dashboard-title">
              {t('dashboard.welcomeBack').replace('{name}', profile?.first_name || 'User')}
            </h1>
            <p className="dashboard-subtitle">
              {t('dashboard.subtitle')}
            </p>
          </div>

          <motion.button
            className="new-service-btn"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/hosting')}
          >
            <FontAwesomeIcon icon={faPlus} />
            {t('dashboard.newService')}
          </motion.button>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          className="stats-grid"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="stat-card">
            <div className="stat-icon">
              <FontAwesomeIcon icon={faServer} />
            </div>
            <div className="stat-content">
              <h3 className="stat-number">{stats.activeServices}</h3>
              <p className="stat-label">{t('dashboard.activeServices')}</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <FontAwesomeIcon icon={faChartBar} />
            </div>
            <div className="stat-content">
              <h3 className="stat-number">{stats.totalOrders}</h3>
              <p className="stat-label">Celkem objednávek</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <FontAwesomeIcon icon={faCreditCard} />
            </div>
            <div className="stat-content">
              <h3 className="stat-number">{formatPrice(stats.totalSpent)}</h3>
              <p className="stat-label">Celkem utraceno</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <FontAwesomeIcon icon={faCalendarAlt} />
            </div>
            <div className="stat-content">
              <h3 className="stat-number">
                {profile?.created_at ? new Date(profile.created_at).getFullYear() : '2024'}
              </h3>
              <p className="stat-label">Zákazník od roku</p>
            </div>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          className="quick-actions"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <h2 className="section-title">Rychlé akce</h2>
          <div className="actions-grid">
            <button className="action-card" onClick={() => navigate('/hosting')}>
              <FontAwesomeIcon icon={faServer} />
              <span>Nový hosting</span>
            </button>
            <button className="action-card" onClick={() => navigate('/domains')}>
              <FontAwesomeIcon icon={faGlobe} />
              <span>Registrovat doménu</span>
            </button>
            <button className="action-card" onClick={() => navigate('/tickets')}>
              <FontAwesomeIcon icon={faTicket} />
              <span>Vytvořit tiket</span>
            </button>
            <button className="action-card" onClick={() => navigate('/profile')}>
              <FontAwesomeIcon icon={faUser} />
              <span>Upravit profil</span>
            </button>
          </div>
        </motion.div>

        {/* Recent Orders */}
        <motion.div
          className="recent-orders"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <div className="section-header">
            <h2 className="section-title">Nedávné objednávky</h2>
            <button className="view-all-btn" onClick={() => navigate('/services')}>
              Zobrazit vše
              <FontAwesomeIcon icon={faExternalLinkAlt} />
            </button>
          </div>

          {orders.length === 0 ? (
            <div className="empty-state">
              <FontAwesomeIcon icon={faServer} />
              <h3>Žádné objednávky</h3>
              <p>Zatím nemáš žádné hosting služby. Začni první objednávkou!</p>
              <button className="cta-button" onClick={() => navigate('/hosting')}>
                <FontAwesomeIcon icon={faPlus} />
                Objednat hosting
              </button>
            </div>
          ) : (
            <div className="orders-list">
              {orders.slice(0, 5).map((order) => (
                <div key={order.id} className="order-card">
                  <div className="order-info">
                    <h4 className="order-title">{order.plan_name}</h4>
                    <p className="order-domain">
                      {(order as any).hestia_domain || order.domain_name || 'Bez domény'}
                    </p>
                    {(order as any).hestia_created && (order as any).hestia_username && (
                      <p className="order-hestia">
                        HestiaCP: {(order as any).hestia_username}
                      </p>
                    )}
                  </div>

                  <div className="order-meta">
                    <span className={`status-badge status-${order.status}`}>
                      {order.status === 'active' ? 'Aktivní' :
                       order.status === 'pending' ? 'Čeká' :
                       order.status === 'cancelled' ? 'Zrušeno' : order.status}
                    </span>
                    <span className="order-price">
                      {formatPrice(order.price)}
                    </span>
                  </div>

                  <div className="order-actions">
                    <button className="action-btn" onClick={() => navigate('/services')}>
                      <FontAwesomeIcon icon={faCog} />
                    </button>
                    <button className="action-btn" onClick={() => navigate('/services')}>
                      <FontAwesomeIcon icon={faExternalLinkAlt} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;