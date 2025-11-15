import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faShieldAlt, faLock } from '@fortawesome/free-solid-svg-icons';
import './TwoFactorModal.css';

interface TwoFactorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerify: (code: string) => Promise<boolean>;
  email: string;
}

const TwoFactorModal: React.FC<TwoFactorModalProps> = ({ isOpen, onClose, onVerify, email }) => {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRefs = useRef<HTMLInputElement[]>([]);

  useEffect(() => {
    if (isOpen && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [isOpen]);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value.slice(-1);
    }

    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all digits are entered
    if (index === 5 && value) {
      const fullCode = newCode.join('');
      if (fullCode.length === 6) {
        handleVerify(fullCode);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);

    if (!/^\d+$/.test(pastedData)) return;

    const newCode = pastedData.split('').concat(Array(6).fill('')).slice(0, 6);
    setCode(newCode);

    // Focus last filled input or first empty
    const nextIndex = Math.min(pastedData.length, 5);
    inputRefs.current[nextIndex]?.focus();

    // Auto-verify if complete
    if (pastedData.length === 6) {
      handleVerify(pastedData);
    }
  };

  const handleVerify = async (codeToVerify: string) => {
    setIsVerifying(true);
    setError('');

    try {
      const isValid = await onVerify(codeToVerify);

      if (!isValid) {
        setError('Neplatný kód. Zkuste to prosím znovu.');
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (err) {
      setError('Chyba při ověřování. Zkuste to prosím znovu.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = code.join('');

    if (fullCode.length === 6) {
      handleVerify(fullCode);
    } else {
      setError('Prosím zadejte kompletní 6-místný kód.');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="twofa-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="twofa-modal"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="twofa-close" onClick={onClose}>
              <FontAwesomeIcon icon={faTimes} />
            </button>

            <div className="twofa-header">
              <div className="twofa-icon">
                <FontAwesomeIcon icon={faShieldAlt} />
              </div>
              <h2>Dvou-faktorové ověření</h2>
              <p>Zadejte 6-místný kód z vaší authenticator aplikace</p>
              <p className="twofa-email">{email}</p>
            </div>

            <form onSubmit={handleSubmit} className="twofa-form">
              <div className="code-inputs" onPaste={handlePaste}>
                {code.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      if (el) inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className={`code-input ${error ? 'error' : ''}`}
                    disabled={isVerifying}
                  />
                ))}
              </div>

              {error && (
                <motion.div
                  className="twofa-error"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {error}
                </motion.div>
              )}

              <button
                type="submit"
                className="twofa-submit"
                disabled={isVerifying || code.join('').length !== 6}
              >
                {isVerifying ? 'Ověřování...' : 'Ověřit a pokračovat'}
                <FontAwesomeIcon icon={faLock} />
              </button>
            </form>

            <div className="twofa-footer">
              <p>Kód se obnovuje každých 30 sekund</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                Použijte Google Authenticator, Authy nebo jinou TOTP aplikaci
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TwoFactorModal;
