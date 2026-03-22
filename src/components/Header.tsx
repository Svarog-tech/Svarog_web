import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronDown,
  faDashboard,
  faCog,
  faSignOutAlt,
  faServer,
  faTicket,
  faUserShield,
  faHandshake
} from '@fortawesome/free-solid-svg-icons';
import LanguageSwitcher from './LanguageSwitcher';
import CurrencySwitcher from './CurrencySwitcher';
import ThemeToggle from './ThemeToggle';
import AlertBell from './AlertBell';
import './MobileMenu.css';
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

  // Close profile dropdown and mobile menu on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsProfileOpen(false);
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

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

    let rafId: number | null = null;

    const computePosition = () => {
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

    const updatePosition = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        computePosition();
      });
    };

    // Initial position computed synchronously (useLayoutEffect, before paint)
    computePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, { passive: true });
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
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
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMobileMenuOpen}
            >
              <span></span>
              <span></span>
              <span></span>
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
                        aria-expanded={isProfileOpen}
                        aria-haspopup="true"
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
                {user && <AlertBell />}
                <ThemeToggle />
                <CurrencySwitcher />
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>

    {/* Mobile navigation drawer - rendered via portal for proper stacking */}
    {createPortal(
      <div
        className="mobile-menu-container"
        data-open={isMobileMenuOpen}
        aria-hidden={!isMobileMenuOpen}
      >
        {/* Backdrop overlay */}
        <div
          className="mobile-menu-backdrop"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />

        {/* Drawer panel */}
        <nav
          className="mobile-menu-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
        >
          {/* Drawer header */}
          <div className="mobile-menu-header">
            <Link
              to="/"
              className="mobile-menu-logo"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <img
                src="/alatyrlogo-removebg-preview.png"
                alt="Alatyr Hosting"
                width="120"
                height="30"
              />
            </Link>
            <button
              type="button"
              className="mobile-menu-close"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label="Close menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable content */}
          <div className="mobile-menu-body">
            {/* User profile */}
            {user && (
              <div className="mobile-menu-profile">
                <div className="mobile-menu-avatar">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" />
                  ) : (
                    <span className="mobile-menu-initials">{getUserInitials()}</span>
                  )}
                </div>
                <div className="mobile-menu-user">
                  <span className="mobile-menu-name">
                    {(profile?.first_name && profile.first_name.trim()) ||
                     (user?.user_metadata?.first_name && user.user_metadata.first_name.trim()) ||
                     (user?.email?.split('@')[0]) ||
                     'User'}
                    {profile?.is_admin && (
                      <FontAwesomeIcon icon={faUserShield} className="mobile-menu-admin" title="Admin" />
                    )}
                  </span>
                  <span className="mobile-menu-email">{user?.email}</span>
                </div>
              </div>
            )}

            {/* Navigation links */}
            <ul className="mobile-menu-nav">
              <li>
                <Link to="/" className={isActive('/') ? 'active' : ''} onClick={() => setIsMobileMenuOpen(false)}>
                  {t('nav.home')}
                </Link>
              </li>
              <li>
                <Link to="/hosting" className={isActive('/hosting') ? 'active' : ''} onClick={() => setIsMobileMenuOpen(false)}>
                  {t('nav.hosting')}
                </Link>
              </li>
              <li>
                <Link to="/domains" className={isActive('/domains') ? 'active' : ''} onClick={() => setIsMobileMenuOpen(false)}>
                  {t('nav.domains')}
                </Link>
              </li>
              <li>
                <Link to="/support" className={isActive('/support') ? 'active' : ''} onClick={() => setIsMobileMenuOpen(false)}>
                  {t('nav.support')}
                </Link>
              </li>
              <li>
                <Link to="/about" className={isActive('/about') ? 'active' : ''} onClick={() => setIsMobileMenuOpen(false)}>
                  {t('nav.about')}
                </Link>
              </li>
            </ul>

            {/* User menu links */}
            {user && (
              <ul className="mobile-menu-nav mobile-menu-user-nav">
                <li>
                  <Link to="/dashboard" className={isActive('/dashboard') ? 'active' : ''} onClick={() => setIsMobileMenuOpen(false)}>
                    <FontAwesomeIcon icon={faDashboard} />
                    {t('header.dashboard')}
                  </Link>
                </li>
                {profile?.is_admin && (
                  <li>
                    <Link to="/admin" className={`admin-link ${isActive('/admin') ? 'active' : ''}`} onClick={() => setIsMobileMenuOpen(false)}>
                      <FontAwesomeIcon icon={faUserShield} />
                      {t('header.administration')}
                    </Link>
                  </li>
                )}
                <li>
                  <Link to="/services" className={isActive('/services') ? 'active' : ''} onClick={() => setIsMobileMenuOpen(false)}>
                    <FontAwesomeIcon icon={faServer} />
                    {t('header.myServices')}
                  </Link>
                </li>
                <li>
                  <Link to="/tickets" className={isActive('/tickets') ? 'active' : ''} onClick={() => setIsMobileMenuOpen(false)}>
                    <FontAwesomeIcon icon={faTicket} />
                    {t('header.supportTickets')}
                  </Link>
                </li>
                <li>
                  <Link to="/affiliate" className={isActive('/affiliate') ? 'active' : ''} onClick={() => setIsMobileMenuOpen(false)}>
                    <FontAwesomeIcon icon={faHandshake} />
                    Affiliate
                  </Link>
                </li>
                <li>
                  <Link to="/profile" className={isActive('/profile') ? 'active' : ''} onClick={() => setIsMobileMenuOpen(false)}>
                    <FontAwesomeIcon icon={faCog} />
                    {t('header.settings')}
                  </Link>
                </li>
              </ul>
            )}

            {/* Settings controls */}
            <div className="mobile-menu-settings">
              <span className="mobile-menu-settings-label">{t('header.settings') || 'Settings'}</span>
              <div className="mobile-menu-settings-row">
                <ThemeToggle />
                <CurrencySwitcher />
                <LanguageSwitcher />
              </div>
            </div>
          </div>

          {/* Footer with CTA */}
          <div className="mobile-menu-footer">
            {user ? (
              <button
                type="button"
                className="mobile-menu-logout"
                onClick={handleLogout}
              >
                <FontAwesomeIcon icon={faSignOutAlt} />
                {t('header.logout')}
              </button>
            ) : (
              <button
                type="button"
                className="mobile-menu-login"
                onClick={handleLogin}
              >
                {t('nav.login')}
              </button>
            )}
          </div>
        </nav>
      </div>,
      document.body
    )}

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
            <Link to="/affiliate" className="profile-menu-item" onClick={() => setIsProfileOpen(false)}>
              <FontAwesomeIcon icon={faHandshake} />
              Affiliate
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