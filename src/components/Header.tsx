import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
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
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileMenuPosition, setProfileMenuPosition] = useState({ top: 0, left: 0 });
  const profileButtonRef = useRef<HTMLButtonElement>(null);
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

  // Calculate profile menu position when it opens
  useEffect(() => {
    if (isProfileOpen && profileButtonRef.current) {
      const rect = profileButtonRef.current.getBoundingClientRect();
      setProfileMenuPosition({
        top: rect.bottom + 8,
        left: rect.right - 200 // 200px is the min-width of the menu
      });
    }
  }, [isProfileOpen]);

  return (
    <>
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
                        ref={profileButtonRef}
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
                        {t('header.register')}
                      </motion.button>
                    </Link>
                  </>
                )}
                <ThemeToggle />
                <CurrencySwitcher />
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>

    {/* Render profile menu in a portal */}
    {user && createPortal(
      <AnimatePresence>
        {isProfileOpen && (
          <motion.div
            className="profile-menu"
            style={{
              top: `${profileMenuPosition.top}px`,
              left: `${profileMenuPosition.left}px`
            }}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <Link to="/dashboard" className="profile-menu-item" onClick={() => setIsProfileOpen(false)}>
              <FontAwesomeIcon icon={faDashboard} />
              {t('header.dashboard')}
            </Link>
            {profile?.is_admin && (
              <Link to="/admin" className="profile-menu-item admin-link" onClick={() => setIsProfileOpen(false)}>
                <FontAwesomeIcon icon={faUserShield} />
                {t('header.administration')}
              </Link>
            )}
            <Link to="/services" className="profile-menu-item" onClick={() => setIsProfileOpen(false)}>
              <FontAwesomeIcon icon={faServer} />
              {t('header.myServices')}
            </Link>
            <Link to="/tickets" className="profile-menu-item" onClick={() => setIsProfileOpen(false)}>
              <FontAwesomeIcon icon={faTicket} />
              {t('header.supportTickets')}
            </Link>
            <Link to="/profile" className="profile-menu-item" onClick={() => setIsProfileOpen(false)}>
              <FontAwesomeIcon icon={faCog} />
              {t('header.settings')}
            </Link>
            <div className="menu-divider"></div>
            <button
              onClick={handleLogout}
              className="profile-menu-item logout"
            >
              <FontAwesomeIcon icon={faSignOutAlt} />
              {t('header.logout')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    )}
    </>
  );
};

export default Header;