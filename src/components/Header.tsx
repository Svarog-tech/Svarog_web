import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
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
  faUserShield,
  faBars,
  faTimes
} from '@fortawesome/free-solid-svg-icons';
import LanguageSwitcher from './LanguageSwitcher';
import CurrencySwitcher from './CurrencySwitcher';
import ThemeToggle from './ThemeToggle';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

const Header: React.FC = () => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [profileMenuPosition, setProfileMenuPosition] = useState({ top: 0, left: 0 });
  const [profileMenuPositionReady, setProfileMenuPositionReady] = useState(false);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const { t } = useLanguage();
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname === path;

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

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

  // Calculate profile menu position before paint; recalc on open, resize, and scroll (fixed position follows button)
  useLayoutEffect(() => {
    if (!isProfileOpen) {
      setProfileMenuPositionReady(false);
      return;
    }

    const updatePosition = () => {
      if (!profileButtonRef.current) return;
      const rect = profileButtonRef.current.getBoundingClientRect();
      const menuWidth = 200;
      const menuHeight = 280; // approximate height for vertical clamping
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const padding = 16;
      let left = rect.left;
      if (left + menuWidth > viewportWidth - padding) left = viewportWidth - menuWidth - padding;
      if (left < padding) left = padding;
      let top = rect.bottom + 8;
      if (top + menuHeight > viewportHeight - padding) top = viewportHeight - menuHeight - padding;
      if (top < padding) top = padding;
      setProfileMenuPosition({ top, left });
      setProfileMenuPositionReady(true);
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, { passive: true });
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
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
                  fetchPriority="high"
                  width="160"
                  height="40"
                />
              </Link>
            </motion.div>

            {/* Mobile hamburger button */}
            <button
              className={`hamburger mobile-nav ${isMobileMenuOpen ? 'open' : ''}`}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <FontAwesomeIcon icon={isMobileMenuOpen ? faTimes : faBars} />
            </button>

            {/* Desktop menu */}
            <div className="desktop-menu desktop-nav">
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
                            <img
                              src={profile.avatar_url}
                              alt="Avatar"
                              loading="lazy"
                              decoding="async"
                            />
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
                  <motion.button
                    className="primary-btn"
                    onClick={handleLogin}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span>{t('nav.login')}</span>
                  </motion.button>
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

    {/* Mobile navigation drawer */}
    <AnimatePresence>
      {isMobileMenuOpen && (
        <>
          <motion.div
            className="nav-overlay open"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <motion.div
            className="nav-drawer open"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="mobile-nav-content">
              {/* User profile section in mobile menu */}
              {user && (
                <div className="mobile-profile-section">
                  <div className="mobile-profile-info">
                    <div className="profile-avatar">
                      {profile?.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt="Avatar"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="avatar-initials">
                          {getUserInitials()}
                        </div>
                      )}
                    </div>
                    <div className="mobile-profile-text">
                      <div className="mobile-profile-name">
                        {(profile?.first_name && profile.first_name.trim()) ||
                         (user?.user_metadata?.first_name && user.user_metadata.first_name.trim()) ||
                         (user?.email?.split('@')[0]) ||
                         'User'}
                        {profile?.is_admin && (
                          <span className="admin-badge" title="Administrátor">
                            <FontAwesomeIcon icon={faUserShield} />
                          </span>
                        )}
                      </div>
                      <div className="mobile-profile-email">{user?.email}</div>
                    </div>
                  </div>
                  <div className="mobile-menu-divider"></div>
                </div>
              )}

              {/* Navigation links */}
              <nav className="mobile-nav-links">
                <Link to="/" className={`mobile-nav-link ${isActive('/') ? 'active' : ''}`}>
                  {t('nav.home')}
                </Link>
                <Link to="/hosting" className={`mobile-nav-link ${isActive('/hosting') ? 'active' : ''}`}>
                  {t('nav.hosting')}
                </Link>
                <Link to="/domains" className={`mobile-nav-link ${isActive('/domains') ? 'active' : ''}`}>
                  {t('nav.domains')}
                </Link>
                <Link to="/support" className={`mobile-nav-link ${isActive('/support') ? 'active' : ''}`}>
                  {t('nav.support')}
                </Link>
                <Link to="/about" className={`mobile-nav-link ${isActive('/about') ? 'active' : ''}`}>
                  {t('nav.about')}
                </Link>

                {user && (
                  <>
                    <div className="mobile-menu-divider"></div>
                    <Link to="/dashboard" className={`mobile-nav-link ${isActive('/dashboard') ? 'active' : ''}`}>
                      <FontAwesomeIcon icon={faDashboard} />
                      {t('header.dashboard')}
                    </Link>
                    {profile?.is_admin && (
                      <Link to="/admin" className={`mobile-nav-link admin-link ${isActive('/admin') ? 'active' : ''}`}>
                        <FontAwesomeIcon icon={faUserShield} />
                        {t('header.administration')}
                      </Link>
                    )}
                    <Link to="/services" className={`mobile-nav-link ${isActive('/services') ? 'active' : ''}`}>
                      <FontAwesomeIcon icon={faServer} />
                      {t('header.myServices')}
                    </Link>
                    <Link to="/tickets" className={`mobile-nav-link ${isActive('/tickets') ? 'active' : ''}`}>
                      <FontAwesomeIcon icon={faTicket} />
                      {t('header.supportTickets')}
                    </Link>
                    <Link to="/profile" className={`mobile-nav-link ${isActive('/profile') ? 'active' : ''}`}>
                      <FontAwesomeIcon icon={faCog} />
                      {t('header.settings')}
                    </Link>
                  </>
                )}
              </nav>

              {/* Settings section */}
              <div className="mobile-menu-divider"></div>
              <div className="mobile-settings">
                <div className="mobile-settings-label">{t('header.settings') || 'Settings'}</div>
                <div className="mobile-settings-controls">
                  <ThemeToggle />
                  <CurrencySwitcher />
                  <LanguageSwitcher />
                </div>
              </div>

              {/* CTA buttons */}
              <div className="mobile-cta">
                {user ? (
                  <motion.button
                    className="mobile-logout-button"
                    onClick={handleLogout}
                    whileTap={{ scale: 0.98 }}
                  >
                    <FontAwesomeIcon icon={faSignOutAlt} />
                    {t('header.logout')}
                  </motion.button>
                ) : (
                  <motion.button
                    className="primary-btn"
                    onClick={handleLogin}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span>{t('nav.login')}</span>
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>

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