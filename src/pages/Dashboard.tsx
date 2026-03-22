import React, { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
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
  faCalendarAlt,
  faWallet
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { getUserOrders, getAllUserHostingServices, getCreditBalance, HostingService, Order as ApiOrder } from '../lib/api';
import Loading from '../components/Loading';
import './Dashboard.css';

// Animated counter hook (matching Hosting.tsx)
const useAnimatedValue = (end: number, duration: number = 2000) => {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setValue(end);
        clearInterval(timer);
      } else {
        setValue(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, end, duration]);

  return { value, ref };
};

// Animated Stat Component with circular progress (like Hosting.tsx)
const AnimatedStat: React.FC<{
  icon: any;
  value: number;
  label: string;
  delay?: number;
  isPrice?: boolean;
  formatPrice?: (value: number) => string;
}> = ({ icon, value, label, delay = 0, isPrice = false, formatPrice }) => {
  const { value: animatedValue, ref } = useAnimatedValue(value);

  return (
    <motion.div
      ref={ref}
      className="stat-card"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      viewport={{ once: true }}
    >
      <div className="stat-icon">
        <FontAwesomeIcon icon={icon} />
      </div>
      <div className="stat-content">
        <h3 className="stat-number">
          {isPrice && formatPrice ? formatPrice(animatedValue) : animatedValue}
        </h3>
        <p className="stat-label">{label}</p>
      </div>
    </motion.div>
  );
};

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
  hestia_username?: string;
  hestia_domain?: string;
  hestia_created?: boolean;
  cpanel_url?: string;
}

interface DashboardStats {
  totalOrders: number;
  activeServices: number;
  totalSpent: number;
}

// DEV MODE: mock data jen v development, v produkci vždy skutečná data
const DEV_MODE = import.meta.env.DEV;

const mockProfile = DEV_MODE ? {
  first_name: 'Jan',
  created_at: '2023-01-15'
} : null;

const mockOrders: Order[] = DEV_MODE ? [
  { id: 1, plan_name: 'Starter Hosting', price: 99, currency: 'CZK', status: 'active', payment_status: 'paid', domain_name: 'example.cz', created_at: '2024-01-15' },
  { id: 2, plan_name: 'Business Hosting', price: 299, currency: 'CZK', status: 'pending', payment_status: 'pending', domain_name: 'test-site.cz', created_at: '2024-02-10' },
  { id: 3, plan_name: 'Premium Hosting', price: 599, currency: 'CZK', status: 'active', payment_status: 'paid', domain_name: 'mywebsite.cz', created_at: '2024-03-01' },
] : [];

const Dashboard: React.FC = () => {
  const { user, profile: authProfile } = useAuth();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>(DEV_MODE ? mockOrders : []);
  const [stats, setStats] = useState<DashboardStats>(DEV_MODE ? { totalOrders: 3, activeServices: 2, totalSpent: 997 } : { totalOrders: 0, activeServices: 0, totalSpent: 0 });
  const [loading, setLoading] = useState(DEV_MODE ? false : true);
  const [creditBalance, setCreditBalance] = useState<number>(DEV_MODE ? 250 : 0);

  const profile = DEV_MODE ? mockProfile : authProfile;

  useEffect(() => {
    if (user && !DEV_MODE) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch user orders, hosting services, and credit balance in parallel
      const [ordersData, hostingResult, creditResult] = await Promise.all([
        getUserOrders(),
        getAllUserHostingServices({ limit: 100 }),
        getCreditBalance().catch(() => ({ balance: 0, currency: 'CZK' })),
      ]);
      setCreditBalance(creditResult.balance || 0);
      const hostingServices = hostingResult.data;

      // Merge data
      const mergedOrders = ordersData?.map((order: ApiOrder): Order => {
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
    return <Loading message={t('dashboard.loading')} minHeight="60vh" />;
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

        {/* Stats Cards - Animated with staggered entrance */}
        <motion.div
          className="stats-grid"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <AnimatedStat
            icon={faServer}
            value={stats.activeServices}
            label={t('dashboard.activeServices')}
            delay={0.4}
          />

          <AnimatedStat
            icon={faChartBar}
            value={stats.totalOrders}
            label={t('dashboard.totalOrders')}
            delay={0.5}
          />

          <AnimatedStat
            icon={faCreditCard}
            value={stats.totalSpent}
            label={t('dashboard.totalSpent')}
            delay={0.6}
            isPrice={true}
            formatPrice={formatPrice}
          />

          {creditBalance > 0 && (
            <motion.div
              className="stat-card stat-card--credit"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              viewport={{ once: true }}
              onClick={() => navigate('/billing')}
              style={{ cursor: 'pointer' }}
            >
              <div className="stat-icon">
                <FontAwesomeIcon icon={faWallet} />
              </div>
              <div className="stat-content">
                <h3 className="stat-number" style={{ color: 'var(--success-color)' }}>
                  {formatPrice(creditBalance)}
                </h3>
                <p className="stat-label">Kredit na účtu</p>
              </div>
            </motion.div>
          )}

          <AnimatedStat
            icon={faCalendarAlt}
            value={profile?.created_at ? new Date(profile.created_at).getFullYear() : new Date().getFullYear()}
            label={t('dashboard.customerSince')}
            delay={creditBalance > 0 ? 0.8 : 0.7}
          />
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          className="quick-actions"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
        >
          <motion.h2
            className="section-title"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            viewport={{ once: true }}
          >
            {t('dashboard.quickActions')}
          </motion.h2>
          <div className="actions-grid">
            <motion.button
              className="action-card"
              onClick={() => navigate('/hosting')}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              viewport={{ once: true }}
              whileHover={{ y: -6 }}
              whileTap={{ scale: 0.95 }}
            >
              <FontAwesomeIcon icon={faServer} />
              <span>{t('dashboard.newHosting')}</span>
            </motion.button>
            <motion.button
              className="action-card"
              onClick={() => navigate('/domains')}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              viewport={{ once: true }}
              whileHover={{ y: -6 }}
              whileTap={{ scale: 0.95 }}
            >
              <FontAwesomeIcon icon={faGlobe} />
              <span>{t('dashboard.registerDomain')}</span>
            </motion.button>
            <motion.button
              className="action-card"
              onClick={() => navigate('/tickets')}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              viewport={{ once: true }}
              whileHover={{ y: -6 }}
              whileTap={{ scale: 0.95 }}
            >
              <FontAwesomeIcon icon={faTicket} />
              <span>{t('dashboard.createTicket')}</span>
            </motion.button>
            <motion.button
              className="action-card"
              onClick={() => navigate('/profile')}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              viewport={{ once: true }}
              whileHover={{ y: -6 }}
              whileTap={{ scale: 0.95 }}
            >
              <FontAwesomeIcon icon={faUser} />
              <span>{t('dashboard.editProfile')}</span>
            </motion.button>
          </div>
        </motion.div>

        {/* Recent Orders */}
        <motion.div
          className="recent-orders"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
        >
          <div className="section-header">
            <motion.h2
              className="section-title"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              viewport={{ once: true }}
            >
              {t('dashboard.recentOrders')}
            </motion.h2>
            <motion.button
              className="view-all-btn"
              onClick={() => navigate('/services')}
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              viewport={{ once: true }}
              whileHover={{ x: 3 }}
              whileTap={{ scale: 0.95 }}
            >
              {t('dashboard.viewAll')}
              <FontAwesomeIcon icon={faExternalLinkAlt} />
            </motion.button>
          </div>

          {orders.length === 0 ? (
            <motion.div
              className="empty-state"
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
            >
              <FontAwesomeIcon icon={faServer} />
              <h3>{t('dashboard.noOrders')}</h3>
              <p>{t('dashboard.noOrdersDescription')}</p>
              <motion.button
                className="cta-button"
                onClick={() => navigate('/hosting')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <FontAwesomeIcon icon={faPlus} />
                {t('dashboard.orderHosting')}
              </motion.button>
            </motion.div>
          ) : (
            <div className="orders-list">
              {orders.slice(0, 5).map((order, index) => (
                <motion.div
                  key={order.id}
                  className="order-card"
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.5,
                    delay: 0.5 + (index * 0.1),
                    type: "spring",
                    stiffness: 100
                  }}
                  viewport={{ once: true }}
                >
                  <div className="order-info">
                    <h4 className="order-title">{order.plan_name}</h4>
                    <p className="order-domain">
                      {order.hestia_domain || order.domain_name || t('dashboard.noDomain')}
                    </p>
                    {order.hestia_created && order.hestia_username && (
                      <p className="order-hestia">
                        HestiaCP: {order.hestia_username}
                      </p>
                    )}
                  </div>

                  <div className="order-meta">
                    <span className={`status-badge status-${order.status}`}>
                      {order.status === 'active' ? t('dashboard.status.active') :
                       order.status === 'pending' ? t('dashboard.status.pending') :
                       order.status === 'cancelled' ? t('dashboard.status.cancelled') : order.status}
                    </span>
                    <span className="order-price">
                      {formatPrice(order.price)}
                    </span>
                  </div>

                  <div className="order-actions">
                    <motion.button
                      className="action-btn"
                      onClick={() => navigate('/services')}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      aria-label={t('dashboard.manageService') || 'Spravovat službu'}
                    >
                      <FontAwesomeIcon icon={faCog} />
                    </motion.button>
                    <motion.button
                      className="action-btn"
                      onClick={() => navigate('/services')}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      aria-label={t('dashboard.openService') || 'Otevřít službu'}
                    >
                      <FontAwesomeIcon icon={faExternalLinkAlt} />
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;