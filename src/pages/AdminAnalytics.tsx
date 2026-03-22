import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChartLine,
  faArrowLeft,
  faMoneyBillWave,
  faUsers,
  faServer,
  faArrowUp,
  faArrowDown,
  faChartBar,
  faClock
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import {
  getRevenueAnalytics,
  getCustomerAnalytics,
  getServiceAnalytics,
  RevenueAnalytics,
  CustomerAnalytics,
  ServiceAnalytics
} from '../lib/api';
import './AdminAnalytics.css';

const PERIOD_OPTIONS = [
  { value: '30d', label: '30 dní' },
  { value: '90d', label: '90 dní' },
  { value: '12m', label: '12 měsíců' },
  { value: 'all', label: 'Vše' }
];

const AdminAnalytics: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { showError } = useToast();

  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [revenue, setRevenue] = useState<RevenueAnalytics | null>(null);
  const [customers, setCustomers] = useState<CustomerAnalytics | null>(null);
  const [services, setServices] = useState<ServiceAnalytics | null>(null);

  useEffect(() => {
    if (!user || !profile?.is_admin) {
      navigate('/');
      return;
    }
    fetchAllData();
  }, [user, profile, navigate]);

  useEffect(() => {
    fetchRevenue();
  }, [period]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [rev, cust, svc] = await Promise.all([
        getRevenueAnalytics(period),
        getCustomerAnalytics(),
        getServiceAnalytics()
      ]);
      setRevenue(rev);
      setCustomers(cust);
      setServices(svc);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      showError('Chyba při načítání analytiky');
    } finally {
      setLoading(false);
    }
  };

  const fetchRevenue = async () => {
    try {
      const rev = await getRevenueAnalytics(period);
      setRevenue(rev);
    } catch (error) {
      console.error('Error fetching revenue:', error);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(price);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getMaxValue = (data: { value: number }[]) => {
    return Math.max(...data.map(d => d.value), 1);
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Načítání analytiky...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-container">
        {/* Header */}
        <motion.div
          className="admin-header analytics-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="admin-header-content">
            <div className="admin-title-section">
              <div className="admin-icon-wrapper">
                <FontAwesomeIcon icon={faChartLine} />
              </div>
              <div>
                <h1>Analytika</h1>
                <p>Přehled příjmů, zákazníků a služeb</p>
              </div>
            </div>
            <div className="admin-quick-links">
              <button className="quick-link-btn" onClick={() => navigate('/admin')}>
                <FontAwesomeIcon icon={faArrowLeft} />
                <span>Zpět na administraci</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* Period Selector */}
        <motion.div
          className="filters-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="filter-buttons">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`filter-btn ${period === opt.value ? 'active' : ''}`}
                onClick={() => setPeriod(opt.value)}
              >
                <FontAwesomeIcon icon={faClock} />
                {opt.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* === REVENUE SECTION === */}
        {revenue && (
          <>
            <motion.div
              className="analytics-section-title"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
            >
              <FontAwesomeIcon icon={faMoneyBillWave} />
              <h2>Příjmy</h2>
            </motion.div>

            <motion.div
              className="stats-grid analytics-stats"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                  <FontAwesomeIcon icon={faMoneyBillWave} />
                </div>
                <div className="stat-content">
                  <h3>{formatPrice(revenue.total_revenue)}</h3>
                  <p>Celkový příjem</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)' }}>
                  <FontAwesomeIcon icon={faChartLine} />
                </div>
                <div className="stat-content">
                  <h3>{formatPrice(revenue.mrr)}</h3>
                  <p>MRR</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' }}>
                  <FontAwesomeIcon icon={faChartBar} />
                </div>
                <div className="stat-content">
                  <h3>{formatPrice(revenue.arr)}</h3>
                  <p>ARR</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
                  <FontAwesomeIcon icon={faMoneyBillWave} />
                </div>
                <div className="stat-content">
                  <h3>{formatPrice(revenue.avg_order_value)}</h3>
                  <p>Průměrná objednávka</p>
                </div>
              </div>
            </motion.div>

            {/* Revenue by month chart */}
            {revenue.revenue_by_month && revenue.revenue_by_month.length > 0 && (
              <motion.div
                className="charts-section"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.25 }}
              >
                <h2>
                  <FontAwesomeIcon icon={faChartBar} className="section-icon" />
                  Příjmy podle měsíce
                </h2>
                <div className="css-bar-chart">
                  {revenue.revenue_by_month.map((item, idx) => {
                    const maxRev = Math.max(...revenue.revenue_by_month.map(m => m.revenue), 1);
                    const pct = (item.revenue / maxRev) * 100;
                    return (
                      <div key={idx} className="bar-chart-item">
                        <div className="bar-chart-label">{item.month}</div>
                        <div className="bar-chart-bar-container">
                          <div
                            className="bar-chart-bar revenue-bar"
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                        <div className="bar-chart-value">{formatPrice(item.revenue)}</div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Revenue by plan & provider */}
            <motion.div
              className="analytics-grid-2col"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              {revenue.revenue_by_plan && revenue.revenue_by_plan.length > 0 && (
                <div className="charts-section compact">
                  <h2>
                    <FontAwesomeIcon icon={faChartBar} className="section-icon" />
                    Příjmy podle plánu
                  </h2>
                  <div className="breakdown-list">
                    {revenue.revenue_by_plan.map((item, idx) => {
                      const maxRev = Math.max(...revenue.revenue_by_plan.map(p => p.revenue), 1);
                      const pct = (item.revenue / maxRev) * 100;
                      return (
                        <div key={idx} className="breakdown-item">
                          <div className="breakdown-label">
                            <span className="breakdown-name">{item.plan_name}</span>
                            <span className="breakdown-count">{item.count}x</span>
                          </div>
                          <div className="bar-container">
                            <div className="bar-fill active" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="breakdown-value">{formatPrice(item.revenue)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {revenue.revenue_by_provider && revenue.revenue_by_provider.length > 0 && (
                <div className="charts-section compact">
                  <h2>
                    <FontAwesomeIcon icon={faChartBar} className="section-icon" />
                    Příjmy podle poskytovatele
                  </h2>
                  <div className="breakdown-list">
                    {revenue.revenue_by_provider.map((item, idx) => {
                      const maxRev = Math.max(...revenue.revenue_by_provider.map(p => p.revenue), 1);
                      const pct = (item.revenue / maxRev) * 100;
                      return (
                        <div key={idx} className="breakdown-item">
                          <div className="breakdown-label">
                            <span className="breakdown-name">{item.provider || 'Neznámý'}</span>
                            <span className="breakdown-count">{item.count}x</span>
                          </div>
                          <div className="bar-container">
                            <div className="bar-fill pending" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="breakdown-value">{formatPrice(item.revenue)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}

        {/* === CUSTOMERS SECTION === */}
        {customers && (
          <>
            <motion.div
              className="analytics-section-title"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35 }}
            >
              <FontAwesomeIcon icon={faUsers} />
              <h2>Zákazníci</h2>
            </motion.div>

            <motion.div
              className="stats-grid analytics-stats"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)' }}>
                  <FontAwesomeIcon icon={faUsers} />
                </div>
                <div className="stat-content">
                  <h3>{customers.total_customers}</h3>
                  <p>Celkem zákazníků</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                  <FontAwesomeIcon icon={faArrowUp} />
                </div>
                <div className="stat-content">
                  <h3>{customers.active_customers}</h3>
                  <p>Aktivních</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' }}>
                  <FontAwesomeIcon icon={faUsers} />
                </div>
                <div className="stat-content">
                  <h3>{customers.new_customers_this_month}</h3>
                  <p>Nových tento měsíc</p>
                </div>
              </div>
              <div className="stat-card churn-card">
                <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
                  <FontAwesomeIcon icon={faArrowDown} />
                </div>
                <div className="stat-content">
                  <h3>{formatPercent(customers.churn_rate)}</h3>
                  <p>Churn rate</p>
                </div>
              </div>
            </motion.div>

            {customers.customers_by_month && customers.customers_by_month.length > 0 && (
              <motion.div
                className="charts-section"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.45 }}
              >
                <h2>
                  <FontAwesomeIcon icon={faChartBar} className="section-icon" />
                  Zákazníci podle měsíce
                </h2>
                <div className="css-bar-chart">
                  {customers.customers_by_month.map((item, idx) => {
                    const maxCount = Math.max(...customers.customers_by_month.map(m => m.new_count), 1);
                    const pct = (item.new_count / maxCount) * 100;
                    return (
                      <div key={idx} className="bar-chart-item">
                        <div className="bar-chart-label">{item.month}</div>
                        <div className="bar-chart-bar-container">
                          <div
                            className="bar-chart-bar customers-bar"
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                        <div className="bar-chart-value">+{item.new_count}</div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </>
        )}

        {/* === SERVICES SECTION === */}
        {services && (
          <>
            <motion.div
              className="analytics-section-title"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <FontAwesomeIcon icon={faServer} />
              <h2>Služby</h2>
            </motion.div>

            <motion.div
              className="stats-grid analytics-stats"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.55 }}
            >
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)' }}>
                  <FontAwesomeIcon icon={faServer} />
                </div>
                <div className="stat-content">
                  <h3>{services.total_services}</h3>
                  <p>Celkem služeb</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                  <FontAwesomeIcon icon={faArrowUp} />
                </div>
                <div className="stat-content">
                  <h3>{services.active_services}</h3>
                  <p>Aktivních</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
                  <FontAwesomeIcon icon={faClock} />
                </div>
                <div className="stat-content">
                  <h3>{services.suspended_services}</h3>
                  <p>Pozastavených</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)' }}>
                  <FontAwesomeIcon icon={faArrowDown} />
                </div>
                <div className="stat-content">
                  <h3>{services.expired_services}</h3>
                  <p>Vypršených</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="analytics-grid-2col"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              {services.services_by_plan && services.services_by_plan.length > 0 && (
                <div className="charts-section compact">
                  <h2>
                    <FontAwesomeIcon icon={faChartBar} className="section-icon" />
                    Služby podle plánu
                  </h2>
                  <div className="breakdown-list">
                    {services.services_by_plan.map((item, idx) => {
                      const maxCount = Math.max(...services.services_by_plan.map(p => p.count), 1);
                      const pct = (item.count / maxCount) * 100;
                      return (
                        <div key={idx} className="breakdown-item">
                          <div className="breakdown-label">
                            <span className="breakdown-name">{item.plan_name}</span>
                          </div>
                          <div className="bar-container">
                            <div className="bar-fill active" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="breakdown-value">{item.count}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {services.services_by_status && services.services_by_status.length > 0 && (
                <div className="charts-section compact">
                  <h2>
                    <FontAwesomeIcon icon={faChartBar} className="section-icon" />
                    Služby podle stavu
                  </h2>
                  <div className="breakdown-list">
                    {services.services_by_status.map((item, idx) => {
                      const maxCount = Math.max(...services.services_by_status.map(s => s.count), 1);
                      const pct = (item.count / maxCount) * 100;
                      const statusLabels: Record<string, string> = {
                        active: 'Aktivní',
                        pending: 'Čekající',
                        suspended: 'Pozastaveno',
                        expired: 'Vypršelo',
                        cancelled: 'Zrušeno'
                      };
                      const barClass = item.status === 'active' ? 'active' : 'pending';
                      return (
                        <div key={idx} className="breakdown-item">
                          <div className="breakdown-label">
                            <span className="breakdown-name">{statusLabels[item.status] || item.status}</span>
                          </div>
                          <div className="bar-container">
                            <div className={`bar-fill ${barClass}`} style={{ width: `${pct}%` }} />
                          </div>
                          <div className="breakdown-value">{item.count}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminAnalytics;
