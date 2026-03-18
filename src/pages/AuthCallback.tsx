import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faCheckCircle, faExclamationTriangle, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { setAccessToken, getCurrentUser } from '../lib/auth';
import './AuthCallback.css';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, loading: authLoading, initialized } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string>('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const oauthHandled = useRef(false);

  // Generate confetti pieces for success animation
  const confettiPieces = Array.from({ length: 30 }, (_, i) => {
    const angle = (i / 30) * 2 * Math.PI;
    const distance = 150 + Math.random() * 100;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    return { x, y, delay: i * 0.02 };
  });

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const handleAuthCallback = async () => {
      try {
        // Check for URL error parameters
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));

        const urlError = urlParams.get('error') || hashParams.get('error');
        const errorDescription = urlParams.get('error_description') || hashParams.get('error_description');

        if (urlError) {
          let userFriendlyError = t('auth.loginFailed');

          if (errorDescription) {
            const decoded = decodeURIComponent(errorDescription);

            if (decoded.includes('access_denied')) {
              userFriendlyError = t('auth.accessDenied');
            } else if (decoded.includes('redirect_uri_mismatch')) {
              userFriendlyError = t('auth.oauthError');
            } else {
              userFriendlyError = t('auth.errorGeneric').replace('{error}', decoded);
            }
          }

          if (isMounted) {
            setError(userFriendlyError);
            setStatus('error');
          }

          window.history.replaceState({}, document.title, '/auth/callback');
          return;
        }

        // OAuth flow: přečti access token z URL hash fragmentu (#access_token=...)
        const hashAccessToken = hashParams.get('access_token');
        if (hashAccessToken && !oauthHandled.current) {
          oauthHandled.current = true;

          // Ulož access token do paměti
          setAccessToken(hashAccessToken);

          // Vyčisti URL (access token nesmí zůstat v URL)
          window.history.replaceState({}, document.title, '/auth/callback');

          // Načti uživatele s novým tokenem a přesměruj na dashboard
          const oauthUser = await getCurrentUser();
          if (oauthUser && isMounted) {
            setStatus('success');
            setCountdown(3);
            timeoutId = setTimeout(() => {
              navigate('/dashboard', { replace: true });
            }, 3000);
          } else if (isMounted) {
            setError('Nepodařilo se načíst profil po OAuth přihlášení.');
            setStatus('error');
          }
          return;
        }

        // Wait for auth to initialize
        if (!initialized) {
          return;
        }

        // If user is authenticated
        if (user) {
          if (isMounted) {
            setStatus('success');
            setCountdown(3);
            timeoutId = setTimeout(() => {
              navigate('/dashboard', { replace: true });
            }, 3000);
          }
        } else if (!authLoading) {
          // No user found after auth initialized
          if (isMounted) {
            setError('Nepodařilo se přihlásit. Zkuste to prosím znovu.');
            setStatus('error');
          }
        }
      } catch (err: any) {
        console.error('Auth callback error:', err);
        if (isMounted) {
          setError('Nastala chyba při ověřování.');
          setStatus('error');
        }
      }
    };

    handleAuthCallback();

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [navigate, user, authLoading, initialized, t]);

  // Countdown timer effect
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <FontAwesomeIcon icon={faSpinner} spin />;
      case 'success':
        return <FontAwesomeIcon icon={faCheckCircle} />;
      case 'error':
        return <FontAwesomeIcon icon={faExclamationTriangle} />;
      default:
        return <FontAwesomeIcon icon={faSpinner} spin />;
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'loading':
        return t('auth.processing');
      case 'success':
        return t('auth.success');
      case 'error':
        return t('auth.error');
      default:
        return t('auth.processing');
    }
  };

  const getStatusDescription = () => {
    switch (status) {
      case 'loading':
        return t('auth.waitMessage');
      case 'success':
        return t('auth.redirecting');
      case 'error':
        return error || t('auth.somethingWrong');
      default:
        return '';
    }
  };

  return (
    <div className="auth-callback-page">
      {/* Animated Background */}
      <div className="auth-callback-bg">
        <div className="auth-gradient-bg"></div>
        <div className="auth-grid"></div>
        <div className="auth-orb auth-orb-1"></div>
        <div className="auth-orb auth-orb-2"></div>
        <div className="auth-orb auth-orb-3"></div>
        <div className="auth-particles">
          {[...Array(15)].map((_, i) => (
            <span
              key={i}
              className="auth-particle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 6}s`,
                animationDuration: `${4 + Math.random() * 3}s`
              }}
            />
          ))}
        </div>
      </div>

      <div className="auth-callback-container">
        <motion.div
          className="auth-callback-card"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Success Confetti */}
          <AnimatePresence>
            {status === 'success' && (
              <div className="auth-confetti">
                {confettiPieces.map((piece, i) => (
                  <motion.div
                    key={i}
                    className="auth-confetti-piece"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
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

          {/* Brand Logo */}
          <motion.div
            className="auth-brand-logo"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
          >
            A
          </motion.div>

          {/* Status Icon with Custom Spinner */}
          <AnimatePresence mode="wait">
            <motion.div
              key={status}
              className={`auth-status-icon ${status}`}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{
                delay: 0.3,
                type: "spring",
                stiffness: 200,
                damping: 15
              }}
            >
              {status === 'loading' && (
                <>
                  <div className="icon-glow"></div>
                  <div className="spinner-rings">
                    <div className="spinner-ring"></div>
                    <div className="spinner-ring"></div>
                  </div>
                </>
              )}
              {status !== 'loading' && getStatusIcon()}
            </motion.div>
          </AnimatePresence>

          <motion.h1
            className={`auth-callback-title ${status === 'success' ? 'gradient' : ''}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            {getStatusMessage()}
          </motion.h1>

          <motion.p
            className={`auth-callback-description ${status}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            {getStatusDescription()}
          </motion.p>

          {/* Animated Loading Dots & Progress */}
          {status === 'loading' && (
            <>
              <motion.div
                className="auth-dots"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                <span className="auth-dot"></span>
                <span className="auth-dot"></span>
                <span className="auth-dot"></span>
              </motion.div>

              <motion.div
                className="auth-progress-bar-wrapper"
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ delay: 1, duration: 0.5 }}
              >
                <div className="auth-progress-bar">
                  <div className="auth-progress-fill"></div>
                </div>
              </motion.div>
            </>
          )}

          {/* Countdown indicator for success */}
          {status === 'success' && countdown !== null && countdown > 0 && (
            <motion.div
              className="auth-countdown"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <FontAwesomeIcon icon={faArrowRight} className="countdown-icon" />
              <span>Přesměrování za</span>
              <span className="auth-countdown-number">{countdown}</span>
              <span>sekund</span>
            </motion.div>
          )}

          {status === 'error' && (
            <motion.div
              className="auth-action-buttons"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
            >
              <motion.button
                className="auth-retry-btn"
                onClick={() => navigate('/register')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span>Zkusit registraci emailem</span>
              </motion.button>
              <motion.button
                className="auth-retry-btn secondary"
                onClick={() => navigate('/login')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span>Přihlásit se</span>
              </motion.button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default AuthCallback;