import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faTimesCircle, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { API_BASE_URL } from '../lib/api';
import './VerifyEmail.css';

type VerifyState = 'idle' | 'loading' | 'success' | 'error';

const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<VerifyState>('idle');
  const [message, setMessage] = useState<string>('');

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
          },
          body: JSON.stringify({ token }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          setState('success');
          setMessage(result.message || 'Email byl úspěšně ověřen. Můžete se přihlásit.');
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

  const handleGoToLogin = () => {
    navigate('/login');
  };

  const handleGoHome = () => {
    navigate('/');
  };

  return (
    <div className="verify-email-page">
      <div className="verify-email-card">
        <div className="verify-email-header">
          {state === 'loading' && (
            <FontAwesomeIcon icon={faSpinner} className="verify-email-icon spinning" />
          )}
          {state === 'success' && (
            <FontAwesomeIcon icon={faCheckCircle} className="verify-email-icon success" />
          )}
          {state === 'error' && (
            <FontAwesomeIcon icon={faTimesCircle} className="verify-email-icon error" />
          )}
          <h1>Ověření emailu</h1>
        </div>

        <p className="verify-email-message">
          {state === 'loading' ? 'Probíhá ověřování emailu…' : message}
        </p>

        <div className="verify-email-actions">
          {state === 'success' && (
            <button className="primary-btn" onClick={handleGoToLogin}>
              Přihlásit se
            </button>
          )}
          {state === 'error' && (
            <button className="secondary-btn" onClick={handleGoHome}>
              Zpět na hlavní stránku
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;

