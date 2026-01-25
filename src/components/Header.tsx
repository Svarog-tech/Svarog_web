import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBars,
  faTimes,
  faUser,
  faChevronDown,
  faDashboard,
  faCog,
  faSignOutAlt,
  faServer,
  faTicket,
  faUserShield
} from '@fortawesome/free-solid-svg-icons';
import LanguageSwitcher from './LanguageSwitcher';
import CurrencySwitcher from './CurrencySwitcher';
import ThemeToggle from './ThemeToggle';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { t } = useLanguage();
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname === path;

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    const firstName = profile?.first_name || user?.user_metadata?.first_name;
    const lastName = profile?.last_name || user?.user_metadata?.last_name;

    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    } else if (firstName) {
      return firstName.substring(0, 2).toUpperCase();
    } else if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setIsProfileOpen(false);
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleLogin = () => {
    navigate('/login');
  };

  return (
    <header className="modern-header">
      <nav className="main-nav">
        <div className="container">
          <div className="nav-content">
            <motion.div
              className="logo"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Link to="/">
                <img
                  src="/alatyrlogo-removebg-preview.png"
                  alt="Alatyr Hosting"
                  className="logo-image"
                />
              </Link>
            </motion.div>

            <div className="desktop-menu">
              <nav className="nav-links">
                <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>{t('nav.home')}</Link>
                <Link to="/hosting" className={`nav-link ${isActive('/hosting') ? 'active' : ''}`}>{t('nav.hosting')}</Link>
                <Link to="/domains" className={`nav-link ${isActive('/domains') ? 'active' : ''}`}>{t('nav.domains')}</Link>
                <Link to="/support" className={`nav-link ${isActive('/support') ? 'active' : ''}`}>{t('nav.support')}</Link>
                <Link to="/about" className={`nav-link ${isActive('/about') ? 'active' : ''}`}>{t('nav.about')}</Link>
              </nav>
              <div className="nav-cta">
                {user ? (
                  <div className="user-profile-section">
                    <motion.div
                      className="profile-dropdown"
                      whileHover={{ scale: 1.02 }}
                    >
                      <button
                        className="profile-button"
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                      >
                        <div className="profile-avatar">
                          {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt="Avatar" />
                          ) : (
                            <div className="avatar-initials">
                              {getUserInitials()}
                            </div>
                          )}
                        </div>
                        <span className="profile-name">
                          {(profile?.first_name && profile.first_name.trim()) ||
                           (user?.user_metadata?.first_name && user.user_metadata.first_name.trim()) ||
                           (user?.email?.split('@')[0]) ||
                           'User'}
                          {profile?.is_admin && (
                            <span className="admin-badge" title="Administrátor">
                              <FontAwesomeIcon icon={faUserShield} />
                            </span>
                          )}
                        </span>
                        <FontAwesomeIcon
                          icon={faChevronDown}
                          className={`dropdown-arrow ${isProfileOpen ? 'open' : ''}`}
                        />
                      </button>

                      <AnimatePresence>
                        {isProfileOpen && (
                          <motion.div
                            className="profile-menu"
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                          >
                            <Link to="/dashboard" className="profile-menu-item">
                              <FontAwesomeIcon icon={faDashboard} />
                              Dashboard
                            </Link>
                            {profile?.is_admin && (
                              <Link to="/admin" className="profile-menu-item admin-link">
                                <FontAwesomeIcon icon={faUserShield} />
                                Administrace
                              </Link>
                            )}
                            <Link to="/services" className="profile-menu-item">
                              <FontAwesomeIcon icon={faServer} />
                              Moje služby
                            </Link>
                            <Link to="/tickets" className="profile-menu-item">
                              <FontAwesomeIcon icon={faTicket} />
                              Support tikety
                            </Link>
                            <Link to="/profile" className="profile-menu-item">
                              <FontAwesomeIcon icon={faCog} />
                              Nastavení
                            </Link>
                            <div className="menu-divider"></div>
                            <button
                              onClick={handleLogout}
                              className="profile-menu-item logout"
                            >
                              <FontAwesomeIcon icon={faSignOutAlt} />
                              Odhlásit se
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </div>
                ) : (
                  <>
                    <motion.button
                      className="login-button"
                      onClick={handleLogin}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {t('nav.login')}
                    </motion.button>
                    <Link to="/register">
                      <motion.button
                        className="cta-button"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        Registrace
                      </motion.button>
                    </Link>
                  </>
                )}
                <ThemeToggle />
                <CurrencySwitcher />
                <LanguageSwitcher />
              </div>
            </div>

            <div className="mobile-menu-toggle">
              <motion.button
                className="menu-button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <FontAwesomeIcon icon={isMenuOpen ? faTimes : faBars} />
              </motion.button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Backdrop */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            className="mobile-menu-backdrop open"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => setIsMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile Menu */}
      <motion.div
        className={`mobile-menu ${isMenuOpen ? 'open' : ''}`}
        initial={{ x: -300 }}
        animate={{
          x: isMenuOpen ? 0 : -300
        }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        <div className="mobile-menu-content">
          <nav className="mobile-nav-links">
            <Link to="/" className={`mobile-nav-link ${isActive('/') ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}>{t('nav.home')}</Link>
            <Link to="/hosting" className={`mobile-nav-link ${isActive('/hosting') ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}>{t('nav.hosting')}</Link>
            <Link to="/domains" className={`mobile-nav-link ${isActive('/domains') ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}>{t('nav.domains')}</Link>
            <Link to="/support" className={`mobile-nav-link ${isActive('/support') ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}>{t('nav.support')}</Link>
            <Link to="/about" className={`mobile-nav-link ${isActive('/about') ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}>{t('nav.about')}</Link>
          </nav>
          <div className="mobile-cta">
            <div className="mobile-controls">
              <ThemeToggle />
              <CurrencySwitcher />
              <LanguageSwitcher />
            </div>
            {user ? (
              <div className="mobile-user-section">
                <div className="mobile-profile-info">
                  <div className="mobile-profile-avatar">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="Avatar" />
                    ) : (
                      <div className="avatar-initials">
                        {getUserInitials()}
                      </div>
                    )}
                  </div>
                  <span className="mobile-profile-name">
                    {(profile?.first_name && profile.first_name.trim()) ||
                     (user?.user_metadata?.first_name && user.user_metadata.first_name.trim()) ||
                     (user?.email?.split('@')[0]) ||
                     'User'} {(profile?.last_name && profile.last_name.trim()) || (user?.user_metadata?.last_name && user.user_metadata.last_name.trim()) || ''}
                  </span>
                </div>
                <Link to="/dashboard" className="mobile-dashboard-link" onClick={() => setIsMenuOpen(false)}>
                  Dashboard
                </Link>
                <button onClick={handleLogout} className="mobile-logout-button">
                  Odhlásit se
                </button>
              </div>
            ) : (
              <>
                <button className="mobile-login-button" onClick={handleLogin}>
                  {t('nav.login')}
                </button>
                <Link
                  to="/register"
                  className="mobile-cta-button-link"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <button className="mobile-cta-button">
                    Registrace
                  </button>
                </Link>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </header>
  );
};

export default Header;