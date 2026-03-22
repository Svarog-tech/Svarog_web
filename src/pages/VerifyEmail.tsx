import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheckCircle,
  faTimesCircle,
  faSpinner,
  faEnvelope,
  faArrowRight,
  faHome
} from '@fortawesome/free-solid-svg-icons';
import { API_BASE_URL } from '../lib/api';
import './VerifyEmail.css';

type VerifyState = 'idle' | 'loading' | 'success' | 'error';

const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<VerifyState>('idle');
  const [message, setMessage] = useState<string>('');
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setState('error');
      setMessage('Chybí verifikační token.');
      return;
    }

    const verify = async () => {
      setState('loading');
      try {
        const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Guard': '1',
          },
          credentials: 'include',
          body: JSON.stringify({ token }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          setState('success');
          setMessage(result.message || 'Email byl úspěšně ověřen. Můžete se přihlásit.');
          // Start countdown for auto-redirect
          setCountdown(5);
        } else {
          setState('error');
          setMessage(result.error || 'Ověření emailu se nezdařilo.');
        }
      } catch (error) {
        console.error('Verify email error:', error);
        setState('error');
        setMessage('Nastala neočekávaná chyba při ověřování emailu.');
      }
    };

    verify();
  }, [searchParams]);

  // Countdown effect for auto-redirect
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;

    const timer = setTimeout(() => {
      if (countdown === 1) {
        navigate('/login');
      } else {
        setCountdown(countdown - 1);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, navigate]);

  const handleGoToLogin = () => {
    navigate('/login');
  };

  const handleGoHome = () => {
    navigate('/');
  };

  // Generate random confetti pieces
  const confettiPieces = Array.from({ length: 30 }, (_, i) => {
    const angle = (i / 30) * 2 * Math.PI;
    const distance = 150 + Math.random() * 100;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    return { x, y, delay: i * 0.02 };
  });

  return (
    <div className="verify-email-page">
      {/* Animated Background */}
      <div className="verify-bg">
        <div className="verify-grid"></div>
        <div className="verify-orb verify-orb-1"></div>
        <div className="verify-orb verify-orb-2"></div>
        <div className="verify-orb verify-orb-3"></div>

        {/* Floating particles */}
        <div className="verify-particles">
          {[...Array(15)].map((_, i) => (
            <span
              key={i}
              className="verify-particle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${4 + Math.random() * 3}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Main Card */}
      <motion.div
        className="verify-email-card"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {/* Success Confetti */}
        <AnimatePresence>
          {state === 'success' && (
            <div className="verify-confetti">
              {confettiPieces.map((piece, i) => (
                <motion.div
                  key={i}
                  className="confetti-piece"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    '--x': `${piece.x}px`,
                    '--y': `${piece.y}px`,
                    animationDelay: `${piece.delay}s`,
                  } as React.CSSProperties}
                />
              ))}
            </div>
          )}
        </AnimatePresence>

        <div className="verify-email-header">
          {/* Icon with animations */}
          <div className="verify-icon-wrapper">
            <AnimatePresence mode="wait">
              {state === 'loading' && (
                <motion.div
                  key="loading"
                  className="verify-loading-state"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="verify-pulse-ring"></div>
                  <div className="verify-pulse-ring"></div>
                  <div className="verify-pulse-ring"></div>
                  <div className="verify-email-icon loading">
                    <FontAwesomeIcon icon={faSpinner} />
                  </div>
                </motion.div>
              )}

              {state === 'success' && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  transition={{
                    duration: 0.6,
                    type: 'spring',
                    stiffness: 200,
                    damping: 15
                  }}
                >
                  <div className="verify-email-icon success">
                    <FontAwesomeIcon icon={faCheckCircle} />
                  </div>
                </motion.div>
              )}

              {state === 'error' && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="verify-email-icon error">
                    <FontAwesomeIcon icon={faTimesCircle} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            {state === 'loading' && 'Ověřování emailu'}
            {state === 'success' && (
              <>
                Email <span className="gradient-text">ověřen</span>
              </>
            )}
            {state === 'error' && 'Chyba při ověření'}
          </motion.h1>
        </div>

        {/* Message */}
        <motion.div
          className="verify-email-message"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <AnimatePresence mode="wait">
            <motion.p
              key={state}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.3 }}
            >
              {state === 'loading' && (
                <>
                  Probíhá ověřování emailu…
                  <div className="verify-loading-dots">
                    <span className="verify-dot"></span>
                    <span className="verify-dot"></span>
                    <span className="verify-dot"></span>
                  </div>
                </>
              )}
              {(state === 'success' || state === 'error') && message}
            </motion.p>
          </AnimatePresence>
        </motion.div>

        {/* Countdown indicator */}
        {state === 'success' && countdown !== null && countdown > 0 && (
          <motion.div
            className="verify-countdown"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <FontAwesomeIcon icon={faArrowRight} />
            <span>Přesměrování za</span>
            <span className="verify-countdown-number">{countdown}</span>
            <span>sekund</span>
          </motion.div>
        )}

        {/* Actions */}
        <motion.div
          className="verify-email-actions"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          <AnimatePresence mode="wait">
            {state === 'success' && (
              <motion.button
                key="success-btn"
                className="primary-btn"
                onClick={handleGoToLogin}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span>Přihlásit se</span>
                <FontAwesomeIcon icon={faArrowRight} className="btn-icon" />
              </motion.button>
            )}

            {state === 'error' && (
              <motion.button
                key="error-btn"
                className="secondary-btn"
                onClick={handleGoHome}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <FontAwesomeIcon icon={faHome} className="btn-icon" />
                <span>Zpět na hlavní stránku</span>
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default VerifyEmail;

