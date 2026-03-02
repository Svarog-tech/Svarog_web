import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faPhone, faMapMarkerAlt, faGlobe } from '@fortawesome/free-solid-svg-icons';
import { faFacebook, faTwitter, faLinkedin } from '@fortawesome/free-brands-svg-icons';
import { useLanguage } from '../contexts/LanguageContext';
import './Footer.css';

const Footer: React.FC = () => {
  const { t } = useLanguage();

  return (
    <footer className="modern-footer">
      <div className="footer-background">
        <div className="footer-gradient-1" />
        <div className="footer-gradient-2" />
      </div>

      <div className="container">
        <div className="footer-content">
          <div className="footer-main">
            <div className="footer-brand">
              <motion.div
                className="footer-logo"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <img
                  src="/alatyrlogo-removebg-preview.png"
                  alt="Alatyr Hosting"
                  className="footer-logo-image"
                  loading="lazy"
                  decoding="async"
                  width="160"
                  height="40"
                />
              </motion.div>
              <p className="footer-description">
                {t('footer.description')}
              </p>
              <div className="footer-social">
                <motion.a
                  href="#"
                  className="social-link"
                  aria-label="Facebook"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FontAwesomeIcon icon={faFacebook} />
                </motion.a>
                <motion.a
                  href="#"
                  className="social-link"
                  aria-label="Twitter"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FontAwesomeIcon icon={faTwitter} />
                </motion.a>
                <motion.a
                  href="#"
                  className="social-link"
                  aria-label="LinkedIn"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FontAwesomeIcon icon={faLinkedin} />
                </motion.a>
              </div>
            </div>

            <div className="footer-links">
              <div className="footer-column">
                <h4 className="footer-title">{t('footer.services')}</h4>
                <ul className="footer-list">
                  <li><Link to="/hosting" className="footer-link">{t('nav.hosting')}</Link></li>
                  <li><Link to="/domains" className="footer-link">{t('nav.domains')}</Link></li>
                  <li><Link to="/support" className="footer-link">{t('footer.liveSupport')}</Link></li>
                </ul>
              </div>

              <div className="footer-column">
                <h4 className="footer-title">{t('footer.company')}</h4>
                <ul className="footer-list">
                  <li><Link to="/about" className="footer-link">{t('nav.about')}</Link></li>
                  <li><Link to="/contact" className="footer-link">{t('footer.contact')}</Link></li>
                    <li><Link to="/privacy" className="footer-link">{t('footer.privacy')}</Link></li>
                    <li><Link to="/terms" className="footer-link">{t('footer.terms')}</Link></li>
                    <li><Link to="/aml" className="footer-link">{t('footer.aml')}</Link></li>
                    <li><Link to="/security-incidents" className="footer-link">{t('footer.securityIncidents')}</Link></li>
                </ul>
              </div>

              <div className="footer-column">
                <h4 className="footer-title">{t('footer.contact')}</h4>
                <div className="footer-contact">
                  <div className="contact-item">
                    <FontAwesomeIcon icon={faEnvelope} className="contact-icon" />
                        <a href="mailto:info@alatyrhosting.eu" className="contact-link">info@alatyrhosting.eu</a>
                  </div>
                  <div className="contact-item">
                    <FontAwesomeIcon icon={faPhone} className="contact-icon" />
                    <a href="tel:+420123456789" className="contact-link">+420 123 456 789</a>
                  </div>
                  <div className="contact-item">
                    <FontAwesomeIcon icon={faMapMarkerAlt} className="contact-icon" />
                        <span className="contact-text">Náves 73, 664 08 Blažovice, Česká republika</span>
                  </div>
                  <div className="contact-item">
                    <FontAwesomeIcon icon={faGlobe} className="contact-icon" />
                    <a href="https://alatyr.cz" className="contact-link">alatyr.cz</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <motion.div
          className="footer-bottom"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <div className="footer-bottom-content">
            <p className="footer-copyright">
              &copy; {new Date().getFullYear()} Alatyr Hosting. {t('footer.rights')}
            </p>
            <div className="footer-bottom-links">
              <Link to="/terms" className="footer-bottom-link">{t('footer.terms')}</Link>
              <span className="footer-divider">|</span>
              <Link to="/privacy" className="footer-bottom-link">{t('footer.privacy')}</Link>
              <span className="footer-divider">|</span>
              <Link to="/security-incidents" className="footer-bottom-link">{t('footer.securityIncidents')}</Link>
              <span className="footer-divider">|</span>
              <a href="#cookies" className="footer-bottom-link">{t('footer.cookies')}</a>
            </div>
          </div>
        </motion.div>
      </div>
    </footer>
  );
};

export default Footer;