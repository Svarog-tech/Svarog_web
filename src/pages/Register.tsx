import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faEnvelope, faLock, faEye, faEyeSlash, faUserPlus } from '@fortawesome/free-solid-svg-icons';
import { faGoogle, faGithub } from '@fortawesome/free-brands-svg-icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { RegistrationData, OAuthProvider } from '../types/auth';
import { validateRegistrationData } from '../lib/auth';
import './Register.css';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { signUp, signInWithOAuth, loading, user } = useAuth();

  const [step, setStep] = useState<'email' | 'details'>('email');
  const [formData, setFormData] = useState<RegistrationData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    agreeToTerms: false
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;

    if (name === 'confirmPassword') {
      setConfirmPassword(value);
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }

    // Clear field error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }

    // Clear general error
    if (error) {
      setError('');
    }
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const errors: Record<string, string> = {};

    if (!formData.email) {
      errors.email = 'Email je povinný';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setStep('details');
  };

  const validateForm = (): boolean => {
    const validation = validateRegistrationData(formData);
    const errors = { ...validation.errors };

    if (formData.password !== confirmPassword) {
      errors.confirmPassword = 'Hesla se neshodují';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const result = await signUp(formData);

      if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.error || 'Registrace se nezdařila');
      }
    } catch (error: any) {
      setError('Nastala neočekávaná chyba');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToEmail = () => {
    setStep('email');
    setFieldErrors({});
    setError('');
  };

  const handleOAuthLogin = async (provider: OAuthProvider) => {
    try {
      await signInWithOAuth(provider);
    } catch (error: any) {
      console.error(`OAuth ${provider} registration failed:`, error);
      setError(`OAuth ${provider} registrace se nezdařila. Zkuste to prosím znovu.`);
    }
  };

  const oauthProviders = [
    { name: 'Google', icon: faGoogle, color: '#DB4437', key: 'google' as OAuthProvider },
    { name: 'GitHub', icon: faGithub, color: '#333', key: 'github' as OAuthProvider }
  ];

  const isFormDisabled = loading || isSubmitting;

  return (
    <div className="register-page">
      <div className="register-container">
        <motion.div
          className="register-card"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="register-header">
            <motion.div
              className="register-icon"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring" }}
            >
              <FontAwesomeIcon icon={faUserPlus} />
            </motion.div>
            <h1 className="register-title">Registrace</h1>
            <p className="register-subtitle">Vytvořte si nový účet a začněte s námi.</p>
          </div>

          {step === 'email' && (
            <>
              <motion.div
                className="oauth-section"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="oauth-buttons">
                  {oauthProviders.map((provider, index) => (
                    <motion.button
                      key={provider.key}
                      className={`oauth-btn oauth-btn-${provider.key}`}
                      onClick={() => handleOAuthLogin(provider.key)}
                      disabled={isFormDisabled}
                      whileHover={{ scale: isFormDisabled ? 1 : 1.02, y: isFormDisabled ? 0 : -2 }}
                      whileTap={{ scale: isFormDisabled ? 1 : 0.98 }}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + (index * 0.1) }}
                      style={{ '--provider-color': provider.color } as React.CSSProperties}
                    >
                      <FontAwesomeIcon icon={provider.icon} className="oauth-icon" />
                      <span className="oauth-text">
                        Pokračovat s {provider.name}
                      </span>
                    </motion.button>
                  ))}
                </div>

                <motion.div
                  className="divider"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1 }}
                >
                  <span className="divider-text">nebo pokračovat s emailem</span>
                </motion.div>
              </motion.div>

              <form className="register-form email-step" onSubmit={handleEmailSubmit}>
                <motion.div
                  className="form-group"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <label htmlFor="email" className="form-label">
                    Email
                  </label>
                  <div className="input-wrapper">
                    <FontAwesomeIcon icon={faEnvelope} className="input-icon" />
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className={`form-input ${fieldErrors.email ? 'error' : ''}`}
                      placeholder="Zadejte váš email"
                      disabled={isFormDisabled}
                      autoFocus
                      autoComplete="email"
                    />
                  </div>
                  {fieldErrors.email && (
                    <span className="field-error">{fieldErrors.email}</span>
                  )}
                </motion.div>

                <motion.button
                  type="submit"
                  className="register-button"
                  disabled={isFormDisabled}
                  whileHover={{ scale: isFormDisabled ? 1 : 1.02 }}
                  whileTap={{ scale: isFormDisabled ? 1 : 0.98 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <FontAwesomeIcon icon={faUserPlus} />
                  Pokračovat s emailem
                </motion.button>
              </form>
            </>
          )}

          {step === 'details' && (
            <>
              <motion.button
                type="button"
                className="back-button"
                onClick={handleBackToEmail}
                disabled={isFormDisabled}
                whileHover={{ scale: isFormDisabled ? 1 : 1.05 }}
                whileTap={{ scale: isFormDisabled ? 1 : 0.95 }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                ← Zpět
              </motion.button>

              {error && (
                <motion.div
                  className="error-message"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  {error}
                </motion.div>
              )}

              <form className="register-form details-step" onSubmit={handleSubmit}>
                <div className="form-row">
                  <motion.div
                    className="form-group"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <label htmlFor="firstName" className="form-label">
                      Jméno
                    </label>
                    <div className="input-wrapper">
                      <FontAwesomeIcon icon={faUser} className="input-icon" />
                      <input
                        type="text"
                        id="firstName"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        className={`form-input ${fieldErrors.firstName ? 'error' : ''}`}
                        placeholder="Vaše jméno"
                        disabled={isFormDisabled}
                        autoComplete="given-name"
                      />
                    </div>
                    {fieldErrors.firstName && (
                      <span className="field-error">{fieldErrors.firstName}</span>
                    )}
                  </motion.div>

                  <motion.div
                    className="form-group"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <label htmlFor="lastName" className="form-label">
                      Příjmení
                    </label>
                    <div className="input-wrapper">
                      <FontAwesomeIcon icon={faUser} className="input-icon" />
                      <input
                        type="text"
                        id="lastName"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        className={`form-input ${fieldErrors.lastName ? 'error' : ''}`}
                        placeholder="Vaše příjmení"
                        disabled={isFormDisabled}
                        autoComplete="family-name"
                      />
                    </div>
                    {fieldErrors.lastName && (
                      <span className="field-error">{fieldErrors.lastName}</span>
                    )}
                  </motion.div>
                </div>

                <motion.div
                  className="form-group"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <label htmlFor="email" className="form-label">
                    Email
                  </label>
                  <div className="input-wrapper">
                    <FontAwesomeIcon icon={faEnvelope} className="input-icon" />
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className={`form-input ${fieldErrors.email ? 'error' : ''}`}
                      placeholder="Zadejte váš email"
                      disabled={isFormDisabled}
                      autoComplete="email"
                    />
                  </div>
                  {fieldErrors.email && (
                    <span className="field-error">{fieldErrors.email}</span>
                  )}
                </motion.div>

                <motion.div
                  className="form-group"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <label htmlFor="password" className="form-label">
                    Heslo
                  </label>
                  <div className="input-wrapper">
                    <FontAwesomeIcon icon={faLock} className="input-icon" />
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className={`form-input ${fieldErrors.password ? 'error' : ''}`}
                      placeholder="Vytvořte si heslo"
                      disabled={isFormDisabled}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isFormDisabled}
                    >
                      <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <span className="field-error">{fieldErrors.password}</span>
                  )}
                </motion.div>

                <motion.div
                  className="form-group"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <label htmlFor="confirmPassword" className="form-label">
                    Potvrdit heslo
                  </label>
                  <div className="input-wrapper">
                    <FontAwesomeIcon icon={faLock} className="input-icon" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      id="confirmPassword"
                      name="confirmPassword"
                      value={confirmPassword}
                      onChange={handleInputChange}
                      className={`form-input ${fieldErrors.confirmPassword ? 'error' : ''}`}
                      placeholder="Potvrďte vaše heslo"
                      disabled={isFormDisabled}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={isFormDisabled}
                    >
                      <FontAwesomeIcon icon={showConfirmPassword ? faEyeSlash : faEye} />
                    </button>
                  </div>
                  {fieldErrors.confirmPassword && (
                    <span className="field-error">{fieldErrors.confirmPassword}</span>
                  )}
                </motion.div>

                <motion.div
                  className="form-group checkbox-group"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="agreeToTerms"
                      checked={formData.agreeToTerms}
                      onChange={handleInputChange}
                      className="checkbox-input"
                      disabled={isFormDisabled}
                    />
                    <span className="checkbox-custom"></span>
                    <span className="checkbox-text">
                      Souhlasím s <Link to="/terms" className="terms-link">obchodními podmínkami</Link>
                    </span>
                  </label>
                  {fieldErrors.terms && (
                    <span className="field-error">{fieldErrors.terms}</span>
                  )}
                </motion.div>

                <motion.button
                  type="submit"
                  className="register-button"
                  disabled={!formData.agreeToTerms || isFormDisabled}
                  whileHover={{ scale: isFormDisabled ? 1 : 1.02 }}
                  whileTap={{ scale: isFormDisabled ? 1 : 0.98 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                >
                  <FontAwesomeIcon icon={faUserPlus} />
                  {isSubmitting ? 'Vytváří se...' : 'Vytvořit účet'}
                </motion.button>
              </form>

              <motion.div
                className="register-footer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                <p className="login-link">
                  Již máte účet? <Link to="/login">Přihlaste se</Link>
                </p>
              </motion.div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Register;