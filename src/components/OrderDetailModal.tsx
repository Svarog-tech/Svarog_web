import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTimes,
  faUser,
  faEnvelope,
  faServer,
  faMoneyBillWave,
  faCalendar,
  faCheckCircle,
  faTimesCircle,
  faClock,
  faSave,
  faBox,
  faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';
import { getAuthHeader } from '../lib/auth';
import { useLanguage } from '../contexts/LanguageContext';
import './OrderDetailModal.css';

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

interface OrderDetailModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

const OrderDetailModal: React.FC<OrderDetailModalProps> = ({ order, isOpen, onClose, onUpdate }) => {
  const { t } = useLanguage();
  const [status, setStatus] = useState(order?.status || 'pending');
  const [paymentStatus, setPaymentStatus] = useState(order?.payment_status || 'unpaid');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!order) return null;

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');

      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_URL}/orders/${order.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify({
          status,
          payment_status: paymentStatus
        })
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to update order');
      }

      onUpdate();
      onClose();
    } catch (err) {
      console.error('Error updating order:', err);
      setError(t('order.error.save'));
    } finally {
      setSaving(false);
    }
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

  const getStatusBadge = (statusValue: string) => {
    const statusMap: Record<string, { color: string; icon: any; label: string }> = {
      pending: { color: '#f59e0b', icon: faClock, label: 'Čeká' },
      processing: { color: '#3b82f6', icon: faClock, label: t('order.status.processing') },
      active: { color: '#10b981', icon: faCheckCircle, label: 'Aktivní' },
      cancelled: { color: '#ef4444', icon: faTimesCircle, label: 'Zrušeno' },
      expired: { color: '#6b7280', icon: faTimesCircle, label: 'Expirováno' }
    };

    const statusInfo = statusMap[statusValue] || statusMap.pending;

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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="order-detail-modal"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>
                <FontAwesomeIcon icon={faBox} className="header-icon" />
                Detail objednávky #{order.id}
              </h2>
              <button className="close-btn" onClick={onClose}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            <div className="modal-body">
              {/* Základní informace */}
              <div className="detail-section">
                <h3>Základní informace</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <FontAwesomeIcon icon={faUser} className="detail-icon" />
                    <div>
                      <label>Zákazník</label>
                      <p>{order.customer_name}</p>
                    </div>
                  </div>
                  <div className="detail-item">
                    <FontAwesomeIcon icon={faEnvelope} className="detail-icon" />
                    <div>
                      <label>Email</label>
                      <p>{order.customer_email}</p>
                    </div>
                  </div>
                  <div className="detail-item">
                    <FontAwesomeIcon icon={faServer} className="detail-icon" />
                    <div>
                      <label>Hosting plán</label>
                      <p>{order.plan_name}</p>
                    </div>
                  </div>
                  <div className="detail-item">
                    <FontAwesomeIcon icon={faMoneyBillWave} className="detail-icon" />
                    <div>
                      <label>Cena</label>
                      <p className="price-value">{formatPrice(order.price)}</p>
                    </div>
                  </div>
                  <div className="detail-item">
                    <FontAwesomeIcon icon={faCalendar} className="detail-icon" />
                    <div>
                      <label>Datum vytvoření</label>
                      <p>{formatDate(order.created_at)}</p>
                    </div>
                  </div>
                  {order.payment_id && (
                    <div className="detail-item">
                      <div>
                        <label>Payment ID</label>
                        <p className="payment-id">{order.payment_id}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Změna statusu */}
              <div className="detail-section">
                <h3>Správa objednávky</h3>
                <div className="status-controls">
                  <div className="control-group">
                    <label>Status objednávky</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="status-select"
                    >
                      <option value="pending">Čeká</option>
                      <option value="processing">Zpracovává se</option>
                      <option value="active">Aktivní</option>
                      <option value="cancelled">Zrušeno</option>
                      <option value="expired">Expirováno</option>
                    </select>
                  </div>
                  <div className="control-group">
                    <label>Status platby</label>
                    <select
                      value={paymentStatus}
                      onChange={(e) => setPaymentStatus(e.target.value)}
                      className="status-select"
                    >
                      <option value="unpaid">Nezaplaceno</option>
                      <option value="paid">Zaplaceno</option>
                      <option value="failed">Selhalo</option>
                      <option value="refunded">Vráceno</option>
                    </select>
                  </div>
                </div>

                {order.gopay_status && (
                  <div className="gopay-status">
                    <label>GoPay status:</label>
                    <span className="gopay-badge">{order.gopay_status}</span>
                  </div>
                )}
              </div>

              {error && (
                <div className="error-message">
                  <FontAwesomeIcon icon={faExclamationTriangle} />
                  {error}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={onClose}>
                Zrušit
              </button>
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                <FontAwesomeIcon icon={faSave} />
                {saving ? 'Ukládám...' : 'Uložit změny'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OrderDetailModal;
