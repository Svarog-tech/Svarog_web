import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faSpinner, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { useLanguage } from '../contexts/LanguageContext';
import './MultiStateButton.css';

type ButtonState = 'idle' | 'loading' | 'success' | 'error';

interface MultiStateButtonProps {
  state: ButtonState;
  onClick?: () => void;
  disabled?: boolean;
  idleText?: string;
  loadingText?: string;
  successText?: string;
  errorText?: string;
  icon?: any;
}

const MultiStateButton: React.FC<MultiStateButtonProps> = ({
  state,
  onClick,
  disabled = false,
  idleText,
  loadingText,
  successText,
  errorText,
  icon
}) => {
  const { t } = useLanguage();

  // Use provided text or fallback to translated defaults
  const textIdle = idleText || t('button.completeOrder');
  const textLoading = loadingText || t('button.processing');
  const textSuccess = successText || t('button.orderSent');
  const textError = errorText || t('button.tryAgain');
  const getButtonContent = () => {
    switch (state) {
      case 'loading':
        return (
          <motion.div
            className="button-content"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <motion.div
              className="spinner"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <FontAwesomeIcon icon={faSpinner} />
            </motion.div>
            <span>{textLoading}</span>
          </motion.div>
        );

      case 'success':
        return (
          <motion.div
            className="button-content"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            <motion.div
              className="success-icon"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 10 }}
            >
              <FontAwesomeIcon icon={faCheck} />
            </motion.div>
            <span>{textSuccess}</span>
          </motion.div>
        );

      case 'error':
        return (
          <motion.div
            className="button-content"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
          >
            <motion.div
              className="error-icon"
              animate={{ rotate: [0, -10, 10, -10, 0] }}
              transition={{ duration: 0.5 }}
            >
              <FontAwesomeIcon icon={faExclamationTriangle} />
            </motion.div>
            <span>{textError}</span>
          </motion.div>
        );

      default:
        return (
          <motion.div
            className="button-content"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {icon && <FontAwesomeIcon icon={icon} />}
            <span>{textIdle}</span>
          </motion.div>
        );
    }
  };

  return (
    <motion.button
      className={`multi-state-button state-${state}`}
      onClick={onClick}
      disabled={disabled || state === 'loading'}
      whileHover={state === 'idle' ? { scale: 1.02 } : {}}
      whileTap={state === 'idle' ? { scale: 0.98 } : {}}
      layout
    >
      <AnimatePresence mode="wait">
        {getButtonContent()}
      </AnimatePresence>

      <motion.div
        className="button-background"
        initial={false}
        animate={{
          scale: state === 'success' ? [1, 1.2, 1] : 1,
          opacity: state === 'loading' ? 0.8 : 1
        }}
        transition={{ duration: 0.3 }}
      />
    </motion.button>
  );
};

export default MultiStateButton;
