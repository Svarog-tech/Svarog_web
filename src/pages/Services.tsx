import React, { useState, useEffect } from 'react';
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
  faKey,
  faLink,
  faCheckCircle,
  faTimesCircle
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { getUserOrders, getAllUserHostingServices, HostingService } from '../lib/supabase';
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
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'pending' | 'expired'>('all');

  useEffect(() => {
    if (user) {
      fetchServices();
    }
  }, [user]);

  const fetchServices = async () => {
    try {
      setLoading(true);
      // Získej hosting služby s HestiaCP údaji
      const hostingServices = await getAllUserHostingServices();
      // Získej objednávky pro doplnění údajů
      const orders = await getUserOrders();
      
      // Spoj data - hosting služby mají HestiaCP údaje
      const servicesData = hostingServices.map(service => {
        const order = orders?.find((o: any) => o.id === service.order_id);
        return {
          ...service,
          currency: order?.currency || 'CZK',
          payment_status: order?.payment_status,
          domain_name: service.hestia_domain || order?.domain_name,
          service_start_date: service.activated_at,
          service_end_date: service.expires_at,
        };
      });
      
      setServices(servicesData || []);
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
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

  const filteredServices = services.filter(service => {
    if (filter === 'all') return true;
    return service.status === filter;
  });

  if (loading) {
    return (
      <div className="services-loading">
        <div className="loading-spinner"></div>
        <p>Načítání služeb...</p>
      </div>
    );
  }

  return (
    <div className="services-page">
      <div className="services-container">
        {/* Header */}
        <motion.div
          className="services-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div>
            <h1 className="services-title">Moje služby</h1>
            <p className="services-subtitle">
              Správa všech tvých hosting služeb na jednom místě
            </p>
          </div>
          <button className="refresh-btn" onClick={fetchServices}>
            <FontAwesomeIcon icon={faSync} />
            Obnovit
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
                            <a href={service.cpanel_url} target="_blank" rel="noopener noreferrer">
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

                  {service.auto_renewal && (
                    <div className="auto-renewal-badge">
                      <FontAwesomeIcon icon={faSync} />
                      Automatické prodloužení
                    </div>
                  )}
                </div>

                <div className="service-card-footer">
                  <button className="service-action-btn secondary">
                    <FontAwesomeIcon icon={faCog} />
                    Spravovat
                  </button>
                  {service.cpanel_url ? (
                    <a
                      href={service.cpanel_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="service-action-btn primary"
                    >
                      <FontAwesomeIcon icon={faExternalLinkAlt} />
                      Panel
                    </a>
                  ) : (
                    <button className="service-action-btn primary" disabled>
                      <FontAwesomeIcon icon={faExternalLinkAlt} />
                      Panel
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Services;
