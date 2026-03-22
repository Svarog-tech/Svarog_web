import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faServer,
  faGlobe,
  faCog,
  faExternalLinkAlt,
  faCircle,
  faCalendarAlt,
  faMoneyBill,
  faSync,
  faUser,
  faLink,
  faCheckCircle,
  faTimesCircle,
  faToggleOn,
  faToggleOff,
  faLayerGroup,
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
import {
  getUserOrders,
  getAllUserHostingServices,
  HostingService,
  Order,
  API_BASE_URL,
  updateHostingServiceAutoRenewal,
  RenewalPeriod,
} from '../lib/api';
import { getAuthHeader } from '../lib/auth';
import { SkeletonList } from '../components/Skeleton';
import './Services.css';

interface Service extends HostingService {
  currency?: string;
  payment_status?: string;
  domain_name?: string;
  service_start_date?: string;
  service_end_date?: string;
  auto_renewal?: boolean;
}

const Services: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'pending' | 'expired'>('all');
  const [updatingServiceId, setUpdatingServiceId] = useState<number | null>(null);

  useEffect(() => {
    if (user) {
      fetchServices();
    }
  }, [user]);

  const fetchServices = async () => {
    try {
      setLoading(true);
      // Získej hosting služby a objednávky paralelně
      const [hostingResult, orders] = await Promise.all([
        getAllUserHostingServices({ limit: 100 }),
        getUserOrders(),
      ]);
      const hostingServices = hostingResult.data;

      // Spoj data - hosting služby mají HestiaCP údaje
      const servicesData = hostingServices.map((service: HostingService) => {
        const order = orders?.find((o: Order) => o.id === service.order_id);
        return {
          ...service,
          currency: order?.currency || 'CZK',
          payment_status: order?.payment_status,
          domain_name: service.hestia_domain || order?.domain_name,
          service_start_date: service.activated_at,
          service_end_date: service.expires_at,
          auto_renewal: Boolean((service as any).auto_renewal),
        };
      });
      
      setServices(servicesData || []);
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = async (orderId: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/orders/${orderId}/invoice`, {
        method: 'GET',
        headers: {
          'X-CSRF-Guard': '1',
          ...getAuthHeader(),
        },
        credentials: 'include',
      });

      const html = await response.text();

      // SECURITY: Blob URL místo document.write — zabraňuje XSS z nekontrolovaného HTML
      const blob = new Blob([html], { type: 'text/html' });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (error) {
      console.error('Error downloading invoice:', error);
    }
  };

  const handleDownloadPdfInvoice = async (orderId: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/orders/${orderId}/invoice?format=pdf`, {
        method: 'GET',
        headers: {
          'X-CSRF-Guard': '1',
          ...getAuthHeader(),
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to download PDF invoice');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `faktura-${orderId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF invoice:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'pending':
        return 'warning';
      case 'cancelled':
        return 'danger';
      case 'expired':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Aktivní';
      case 'pending':
        return 'Čeká';
      case 'cancelled':
        return 'Zrušeno';
      case 'expired':
        return 'Vypršelo';
      default:
        return status;
    }
  };

  const handleToggleAutoRenewal = async (service: Service) => {
    if (!user) return;
    setUpdatingServiceId(service.id);
    try {
      const newValue = !service.auto_renewal;
      const renewalPeriod: RenewalPeriod | undefined = (service as any).renewal_period || 'monthly';

      const updated = await updateHostingServiceAutoRenewal(service.id, newValue, renewalPeriod);

      setServices(prev =>
        prev.map(s => (s.id === service.id ? { ...s, auto_renewal: Boolean((updated as any).auto_renewal) } : s))
      );
    } catch (error) {
      console.error('Error updating auto renewal:', error);
    } finally {
      setUpdatingServiceId(null);
    }
  };

  const filteredServices = services.filter(service => {
    if (filter === 'all') return true;
    return service.status === filter;
  });

  if (loading) {
    return (
      <main className="services-page">
        <motion.section
          className="services-hero"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* Animated Background */}
          <div className="services-hero-bg">
            <div className="services-hero-grid"></div>
            <div className="services-hero-orb services-hero-orb-1"></div>
            <div className="services-hero-orb services-hero-orb-2"></div>
            <div className="services-hero-orb services-hero-orb-3"></div>
            <div className="services-hero-glow"></div>
            <div className="services-hero-particles">
              {[...Array(20)].map((_, i) => (
                <span
                  key={i}
                  className="services-particle"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 5}s`,
                    animationDuration: `${3 + Math.random() * 4}s`,
                  }}
                />
              ))}
            </div>
          </div>

          <div className="container">
            <div className="services-hero-content">
              <motion.h1
                className="services-title"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                Moje <span className="gradient-text">služby</span>
              </motion.h1>
              <motion.p
                className="services-description"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                Načítání...
              </motion.p>
            </div>
          </div>
        </motion.section>
        <section className="services-content">
          <div className="container">
            <SkeletonList count={3} type="card" />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="services-page">
      {/* Hero Section */}
      <motion.section
        className="services-hero"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        {/* Animated Background */}
        <div className="services-hero-bg">
          <div className="services-hero-grid"></div>
          <div className="services-hero-orb services-hero-orb-1"></div>
          <div className="services-hero-orb services-hero-orb-2"></div>
          <div className="services-hero-orb services-hero-orb-3"></div>
          <div className="services-hero-glow"></div>
          <div className="services-hero-particles">
            {[...Array(20)].map((_, i) => (
              <span
                key={i}
                className="services-particle"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 5}s`,
                  animationDuration: `${3 + Math.random() * 4}s`,
                }}
              />
            ))}
          </div>
        </div>

        <div className="container">
          <div className="services-hero-content">
            <motion.h1
              className="services-title"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Moje <span className="gradient-text">služby</span>
            </motion.h1>
            <motion.p
              className="services-description"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              Správa všech tvých hosting služeb na jednom místě
            </motion.p>
          </div>
        </div>
      </motion.section>

      {/* Services Content */}
      <section className="services-content">
        <div className="container">
          {/* Header with refresh */}
          <motion.div
            className="services-header"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <div className="services-header-content">
              <div className="services-header-icon">
                <FontAwesomeIcon icon={faLayerGroup} />
              </div>
              <h2 className="services-section-title">Přehled služeb</h2>
            </div>
            <button className="refresh-btn" onClick={fetchServices}>
              <FontAwesomeIcon icon={faSync} />
              <span>Obnovit</span>
            </button>
          </motion.div>

        {/* Filter Tabs */}
        <motion.div
          className="filter-tabs"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <button
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Vše ({services.length})
          </button>
          <button
            className={`filter-tab ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            Aktivní ({services.filter(s => s.status === 'active').length})
          </button>
          <button
            className={`filter-tab ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            Čeká ({services.filter(s => s.status === 'pending').length})
          </button>
          <button
            className={`filter-tab ${filter === 'expired' ? 'active' : ''}`}
            onClick={() => setFilter('expired')}
          >
            Vypršelo ({services.filter(s => s.status === 'expired').length})
          </button>
        </motion.div>

        {/* Services List */}
        {filteredServices.length === 0 ? (
          <motion.div
            className="empty-state"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <FontAwesomeIcon icon={faServer} className="empty-icon" />
            <h3>Žádné služby</h3>
            <p>
              {filter === 'all'
                ? 'Zatím nemáš žádné hosting služby.'
                : `Nemáš žádné služby se stavem "${getStatusLabel(filter)}".`}
            </p>
            <button className="cta-button">
              <FontAwesomeIcon icon={faServer} />
              Objednat hosting
            </button>
          </motion.div>
        ) : (
          <motion.div
            className="services-grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {filteredServices.map((service, index) => (
              <motion.div
                key={service.id}
                className="service-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <div className="service-card-header">
                  <div className="service-icon">
                    <FontAwesomeIcon icon={faServer} />
                  </div>
                  <div className="service-status">
                    <FontAwesomeIcon
                      icon={faCircle}
                      className={`status-dot status-${getStatusColor(service.status)}`}
                    />
                    <span className="status-text">{getStatusLabel(service.status)}</span>
                  </div>
                </div>

                <div className="service-card-body">
                  <h3 className="service-name">{service.plan_name}</h3>
                  <div className="service-domain">
                    <FontAwesomeIcon icon={faGlobe} />
                    <span>{service.hestia_domain || service.domain_name || 'Bez domény'}</span>
                  </div>

                  {/* HestiaCP údaje */}
                  {service.hestia_created && service.hestia_username && (
                    <div className="hestiacp-info">
                      <div className="hestiacp-badge">
                        <FontAwesomeIcon icon={faCheckCircle} />
                        <span>HestiaCP aktivní</span>
                      </div>
                      <div className="hestiacp-details">
                        <div className="hestiacp-detail">
                          <FontAwesomeIcon icon={faUser} />
                          <span>User: {service.hestia_username}</span>
                        </div>
                        {service.ftp_host && (
                          <div className="hestiacp-detail">
                            <FontAwesomeIcon icon={faServer} />
                            <span>FTP: {service.ftp_host}</span>
                          </div>
                        )}
                        {service.cpanel_url && (
                          <div className="hestiacp-detail">
                            <FontAwesomeIcon icon={faLink} />
                            <a
                              href="#"
                              onClick={(e) => { e.preventDefault(); navigate(`/services/${service.id}`); }}
                            >
                              Control Panel
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {service.hestia_error && (
                    <div className="hestiacp-error">
                      <FontAwesomeIcon icon={faTimesCircle} />
                      <span>Chyba: {service.hestia_error}</span>
                    </div>
                  )}

                  <div className="service-details">
                    <div className="service-detail">
                      <FontAwesomeIcon icon={faMoneyBill} />
                      <span>{formatPrice(service.price)}</span>
                    </div>
                    {service.service_end_date && (
                      <div className="service-detail">
                        <FontAwesomeIcon icon={faCalendarAlt} />
                        <span>
                          Platné do {new Date(service.service_end_date).toLocaleDateString('cs-CZ')}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="auto-renewal-toggle">
                    <button
                      type="button"
                      className={`auto-renewal-btn ${service.auto_renewal ? 'enabled' : 'disabled'}`}
                      onClick={() => handleToggleAutoRenewal(service)}
                      disabled={updatingServiceId === service.id}
                    >
                      <FontAwesomeIcon icon={service.auto_renewal ? faToggleOn : faToggleOff} />
                      <span>
                        Automatické prodloužení{' '}
                        {service.auto_renewal ? '(zapnuto)' : '(vypnuto)'}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="service-card-footer">
                  <button
                    className="service-action-btn secondary"
                    onClick={() => navigate(`/services/${service.id}`)}
                  >
                    <FontAwesomeIcon icon={faCog} />
                    Spravovat
                  </button>
                  {service.order_id && service.status === 'active' && (
                    <>
                      <button
                        className="service-action-btn secondary"
                        onClick={() => handleDownloadInvoice(service.order_id)}
                        title="Faktura (HTML)"
                      >
                        <FontAwesomeIcon icon={faMoneyBill} />
                        Faktura
                      </button>
                      <button
                        className="service-action-btn secondary"
                        onClick={() => handleDownloadPdfInvoice(service.order_id)}
                        title="Faktura (PDF)"
                      >
                        <FontAwesomeIcon icon={faMoneyBill} />
                        PDF
                      </button>
                    </>
                  )}
                  <button
                    className="service-action-btn primary"
                    onClick={() => navigate(`/services/${service.id}`)}
                  >
                    <span>
                      <FontAwesomeIcon icon={faExternalLinkAlt} />
                      Panel
                    </span>
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
        </div>
      </section>
    </main>
  );
};

export default Services;
