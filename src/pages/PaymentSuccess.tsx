import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheckCircle,
  faTimesCircle,
  faClock,
  faHome,
  faDashboard,
  faSpinner
} from '@fortawesome/free-solid-svg-icons';
import { checkPaymentStatus } from '../services/paymentService';
import './PaymentSuccess.css';

const PaymentSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<'success' | 'failed' | 'pending'>('pending');
  const [error, setError] = useState('');

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

  if (loading && !paymentStatus) {
    return (
      <div className="payment-result-page">
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
            <div className="result-icon success">
              <FontAwesomeIcon icon={faCheckCircle} />
            </div>
            <h1>Platba úspěšná!</h1>
            <p className="result-message">
              Děkujeme za vaši platbu. Vaše objednávka byla úspěšně zaplacena a bude brzy aktivována.
            </p>
            <div className="result-details">
              <div className="detail-item">
                <span className="detail-label">ID platby:</span>
                <span className="detail-value">#{paymentId}</span>
              </div>
            </div>
            <div className="result-actions">
              <button className="btn-primary" onClick={() => navigate('/dashboard')}>
                <FontAwesomeIcon icon={faDashboard} />
                Přejít do dashboardu
              </button>
              <button className="btn-secondary" onClick={() => navigate('/')}>
                <FontAwesomeIcon icon={faHome} />
                Hlavní stránka
              </button>
            </div>
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
