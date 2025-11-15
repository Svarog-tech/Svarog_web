import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faLock, faEye, faEyeSlash, faSignInAlt } from '@fortawesome/free-solid-svg-icons';
import { faGoogle, faGithub } from '@fortawesome/free-brands-svg-icons';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoginData, OAuthProvider } from '../types/auth';
import { validateEmail } from '../lib/auth';
import './Login.css';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signInWithOAuth, loading, user } = useAuth();

  const [formData, setFormData] = useState<LoginData>({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      const state = location.state as { returnUrl?: string; plan?: any };
      if (state?.returnUrl && state?.plan) {
        // Redirect back to configurator with plan data
        navigate(state.returnUrl, { state: { plan: state.plan } });
      } else if (state?.returnUrl) {
        navigate(state.returnUrl);
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, navigate, location]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

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

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.email) {
      errors.email = 'Email je povinný';
    } else if (!validateEmail(formData.email)) {
      errors.email = 'Zadejte platnou emailovou adresu';
    }

    if (!formData.password) {
      errors.password = 'Heslo je povinné';
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
      const result = await signIn(formData);

      if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.error || 'Přihlášení se nezdařilo');
      }
    } catch (error: any) {
      setError('Nastala neočekávaná chyba');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOAuthLogin = async (provider: OAuthProvider) => {
    try {
      await signInWithOAuth(provider);
    } catch (error: any) {
      console.error(`OAuth ${provider} login failed:`, error);
      setError(`OAuth ${provider} přihlášení se nezdařilo. Zkuste to prosím znovu.`);
    }
  };

  const oauthProviders = [
    { name: 'Google', icon: faGoogle, color: '#DB4437', key: 'google' as OAuthProvider },
    { name: 'GitHub', icon: faGithub, color: '#333', key: 'github' as OAuthProvider }
  ];

  const isFormDisabled = loading || isSubmitting;

  return (
    <div className="login-page">
      <div className="login-container">
        <motion.div
          className="login-card"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="login-header">
            <motion.div
              className="login-icon"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring" }}
            >
              <FontAwesomeIcon icon={faSignInAlt} />
            </motion.div>
            <h1 className="login-title">Přihlášení</h1>
            <p className="login-subtitle">Vítejte zpět! Přihlaste se ke svému účtu.</p>
          </div>

          {/* OAuth Buttons */}
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

          {/* Error Message */}
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

          {/* Login Form */}
          <form className="login-form" onSubmit={handleSubmit}>
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
                  placeholder="Zadejte vaše heslo"
                  disabled={isFormDisabled}
                  autoComplete="current-password"
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

            <motion.button
              type="submit"
              className="login-button"
              disabled={isFormDisabled}
              whileHover={{ scale: isFormDisabled ? 1 : 1.02 }}
              whileTap={{ scale: isFormDisabled ? 1 : 0.98 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <FontAwesomeIcon icon={faSignInAlt} />
              {isSubmitting ? 'Přihlašuji...' : 'Přihlásit se'}
            </motion.button>
          </form>

          <motion.div
            className="login-footer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <p className="register-link">
              Nemáte účet? <Link to="/register">Zaregistrujte se</Link>
            </p>
            <p className="forgot-password">
              <Link to="/forgot-password">Zapomněli jste heslo?</Link>
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;