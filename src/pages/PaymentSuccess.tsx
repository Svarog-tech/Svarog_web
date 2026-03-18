import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheckCircle,
  faTimesCircle,
  faClock,
  faHome,
  faDashboard,
  faSpinner,
  faRocket,
  faFileInvoice
} from '@fortawesome/free-solid-svg-icons';
import { checkPaymentStatus } from '../services/paymentService';
import './PaymentSuccess.css';

// Confetti Component - Enhanced
const Confetti: React.FC = () => {
  const confettiColors = [
    '#10b981', // success-color
    '#2563eb', // primary-color
    '#06b6d4', // accent-color
    '#f59e0b', // warning-color
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#34d399', // emerald
    '#60a5fa', // sky
  ];

  return (
    <div className="confetti-container">
      {[...Array(80)].map((_, i) => (
        <motion.div
          key={i}
          className="confetti"
          style={{
            left: `${Math.random() * 100}%`,
            backgroundColor: confettiColors[Math.floor(Math.random() * confettiColors.length)],
            animationDelay: `${Math.random() * 2.5}s`,
            animationDuration: `${3 + Math.random() * 2}s`,
            width: `${8 + Math.random() * 8}px`,
            height: `${8 + Math.random() * 8}px`,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: Math.random() * 0.5 }}
        />
      ))}
    </div>
  );
};

// Animated Checkmark Component
const AnimatedCheckmark: React.FC = () => {
  return (
    <div className="success-checkmark">
      <div className="checkmark-glow" />
      <svg viewBox="0 0 120 120">
        <circle
          className="checkmark-circle"
          cx="60"
          cy="60"
          r="54"
          strokeDasharray="339.292"
          strokeDashoffset="339.292"
        />
        <path
          className="checkmark-check"
          d="M40 60 L55 75 L80 45"
          strokeDasharray="70"
          strokeDashoffset="70"
        />
      </svg>
    </div>
  );
};

const PaymentSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<'success' | 'failed' | 'pending'>('pending');
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(10);
  const confettiTriggered = useRef(false);

  // Zkus získat payment ID z různých parametrů (id nebo payment_id)
  const paymentId = searchParams.get('payment_id') || searchParams.get('id');

  useEffect(() => {
    if (!paymentId) {
      setError('Chybí ID platby v URL. Zkontrolujte odkaz.');
      setLoading(false);
      return;
    }

    // Kontrola statusu platby
    const checkStatus = async () => {
      try {
        setLoading(true);
        const result = await checkPaymentStatus(paymentId);

        if (result.success) {
          // Úspěšné stavy - platba je zaplacená
          if (result.status === 'PAID') {
            setPaymentStatus('success');
          }
          // Neúspěšné stavy - platba selhala
          else if (
            result.status === 'CANCELED' ||
            result.status === 'TIMEOUTED' ||
            result.status === 'PAYMENT_METHOD_DISABLED' ||
            result.status === 'AUTHORIZATION_DECLINED' ||
            result.status === 'REFUNDED'
          ) {
            setPaymentStatus('failed');
          }
          // Čekající stavy - platba se zpracovává
          else if (
            result.status === 'CREATED' ||
            result.status === 'PAYMENT_METHOD_CHOSEN' ||
            result.status === 'AUTHORIZED' ||
            result.status === 'PARTIALLY_REFUNDED'
          ) {
            setPaymentStatus('pending');
          }
          // Neznámý stav - považuj za pending
          else {
            console.warn('Unknown payment status:', result.status);
            setPaymentStatus('pending');
          }
        } else {
          // Lepší zpracování error objektu
          let errorMsg = 'Nepodařilo se zkontrolovat status platby';
          if (typeof result.error === 'string') {
            errorMsg = result.error;
          } else if (result.error && typeof result.error === 'object') {
            errorMsg = JSON.stringify(result.error, null, 2);
          }
          setError(errorMsg);
        }
      } catch (err) {
        console.error('Error checking payment:', err);
        let errorMsg = 'Nastala chyba při kontrole platby';
        if (err instanceof Error) {
          errorMsg = err.message;
        }
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    checkStatus();

    // Automatická kontrola každých 5 sekund (pokud status není finální)
    const interval = setInterval(() => {
      if (paymentStatus === 'pending') {
        checkStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [paymentId]);

  // Auto-redirect countdown for success
  useEffect(() => {
    if (paymentStatus === 'success' && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (paymentStatus === 'success' && countdown === 0) {
      navigate('/dashboard');
    }
  }, [paymentStatus, countdown, navigate]);

  if (loading && !paymentStatus) {
    return (
      <div className="payment-result-page">
        {/* Animated Background Elements */}
        <div className="payment-bg-orb payment-bg-orb-1" />
        <div className="payment-bg-orb payment-bg-orb-2" />
        <div className="payment-bg-orb payment-bg-orb-3" />
        <div className="payment-gradient-mesh" />
        <div className="payment-grid" />

        <div className="payment-result-container">
          <div className="loading-box">
            <FontAwesomeIcon icon={faSpinner} spin className="loading-icon" />
            <h2>Kontroluji status platby...</h2>
            <p>Prosím vyčkejte</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-result-page">
      {/* Animated Background Elements */}
      <div className="payment-bg-orb payment-bg-orb-1" />
      <div className="payment-bg-orb payment-bg-orb-2" />
      <div className="payment-bg-orb payment-bg-orb-3" />
      <div className="payment-gradient-mesh" />
      <div className="payment-grid" />

      {/* Confetti for success */}
      {paymentStatus === 'success' && <Confetti />}

      <div className="payment-result-container">
        {error ? (
          <motion.div
            className="result-box error-box"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="result-icon error">
              <FontAwesomeIcon icon={faTimesCircle} />
            </div>
            <h1>Chyba</h1>
            <p className="result-message">{error}</p>
            <div className="result-actions">
              <button className="btn-primary" onClick={() => navigate('/')}>
                <FontAwesomeIcon icon={faHome} />
                Zpět na hlavní stránku
              </button>
            </div>
          </motion.div>
        ) : paymentStatus === 'success' ? (
          <motion.div
            className="result-box success-box"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <AnimatedCheckmark />

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              Platba úspěšná!
            </motion.h1>

            <motion.p
              className="result-message"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              Děkujeme za vaši platbu. Vaše objednávka byla úspěšně zaplacena a bude brzy aktivována.
            </motion.p>

            <motion.div
              className="order-summary"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              <h3>Přehled objednávky</h3>
              <div className="result-details">
                <div className="detail-item">
                  <span className="detail-label">ID platby:</span>
                  <span className="detail-value">#{paymentId}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Datum:</span>
                  <span className="detail-value">{new Date().toLocaleDateString('cs-CZ')}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Status:</span>
                  <span className="detail-value highlight">ZAPLACENO</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="next-steps"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
            >
              <h3>Co dál?</h3>
              <div className="action-cards">
                <div className="action-card">
                  <div className="action-card-icon">
                    <FontAwesomeIcon icon={faDashboard} />
                  </div>
                  <div className="action-card-content">
                    <h4>Dashboard</h4>
                    <p>Spravujte své služby a nastavení</p>
                  </div>
                </div>
                <div className="action-card">
                  <div className="action-card-icon">
                    <FontAwesomeIcon icon={faFileInvoice} />
                  </div>
                  <div className="action-card-content">
                    <h4>Faktura</h4>
                    <p>Stáhněte si fakturu za platbu</p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="result-actions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.5 }}
            >
              <button className="btn-primary" onClick={() => navigate('/dashboard')}>
                <FontAwesomeIcon icon={faDashboard} />
                Přejít do dashboardu
              </button>
              <button className="btn-secondary" onClick={() => navigate('/')}>
                <FontAwesomeIcon icon={faHome} />
                Hlavní stránka
              </button>
            </motion.div>

            <motion.div
              className="redirect-countdown"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
            >
              Automatické přesměrování do dashboardu za <span className="countdown-number">{countdown}</span> sekund...
            </motion.div>
          </motion.div>
        ) : paymentStatus === 'failed' ? (
          <motion.div
            className="result-box error-box"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="result-icon error">
              <FontAwesomeIcon icon={faTimesCircle} />
            </div>
            <h1>Platba se nezdařila</h1>
            <p className="result-message">
              Bohužel, vaše platba nebyla dokončena. Můžete to zkusit znovu nebo nás kontaktovat.
            </p>
            <div className="result-details">
              <div className="detail-item">
                <span className="detail-label">ID platby:</span>
                <span className="detail-value">#{paymentId}</span>
              </div>
            </div>
            <div className="result-actions">
              <button className="btn-primary" onClick={() => navigate('/hosting')}>
                Zkusit znovu
              </button>
              <button className="btn-secondary" onClick={() => navigate('/support')}>
                Kontaktovat support
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            className="result-box pending-box"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="result-icon pending">
              <FontAwesomeIcon icon={faClock} />
            </div>
            <h1>Platba se zpracovává...</h1>
            <p className="result-message">
              Vaše platba je aktuálně zpracovávána. Prosím vyčkejte.
            </p>
            {loading && (
              <div className="checking-status">
                <FontAwesomeIcon icon={faSpinner} spin />
                <span>Automaticky kontroluji status...</span>
              </div>
            )}
            <div className="result-actions">
              <button className="btn-secondary" onClick={() => navigate('/dashboard')}>
                <FontAwesomeIcon icon={faDashboard} />
                Přejít do dashboardu
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default PaymentSuccess;
