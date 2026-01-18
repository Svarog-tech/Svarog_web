import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faCheckCircle, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext';
import './AuthCallback.css';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, initialized } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string>('');

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
          let userFriendlyError = 'Přihlášení se nezdařilo';

          if (errorDescription) {
            const decoded = decodeURIComponent(errorDescription);

            if (decoded.includes('access_denied')) {
              userFriendlyError = 'Přístup byl odepřen. Zkuste to prosím znovu.';
            } else if (decoded.includes('redirect_uri_mismatch')) {
              userFriendlyError = 'OAuth není správně nakonfigurovaný. Zkontrolujte redirect URLs v Google Console a v backend konfiguraci.';
            } else {
              userFriendlyError = `Chyba: ${decoded}`;
            }
          }

          if (isMounted) {
            setError(userFriendlyError);
            setStatus('error');
          }

          window.history.replaceState({}, document.title, '/auth/callback');
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
            timeoutId = setTimeout(() => {
              navigate('/dashboard', { replace: true });
            }, 1500);
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
  }, [navigate, user, authLoading, initialized]);

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
        return 'Zpracovává se přihlášení...';
      case 'success':
        return 'Přihlášení úspěšné!';
      case 'error':
        return 'Chyba při přihlášení';
      default:
        return 'Zpracovává se...';
    }
  };

  const getStatusDescription = () => {
    switch (status) {
      case 'loading':
        return 'Prosím počkejte, ověřujeme vaše údaje.';
      case 'success':
        return 'Přesměrováváme vás na dashboard...';
      case 'error':
        return error || 'Něco se pokazilo. Zkuste to prosím znovu.';
      default:
        return '';
    }
  };

  return (
    <div className="auth-callback-page">
      <div className="auth-callback-container">
        <motion.div
          className="auth-callback-card"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            className={`auth-status-icon ${status}`}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
          >
            {getStatusIcon()}
          </motion.div>

          <motion.h1
            className="auth-callback-title"
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
                Zkusit registraci emailem
              </motion.button>
              <motion.button
                className="auth-retry-btn secondary"
                onClick={() => navigate('/login')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Přihlásit se
              </motion.button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default AuthCallback;