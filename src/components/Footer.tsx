import React from 'react';
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
        <motion.div
          className="footer-gradient-1"
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="footer-gradient-2"
          animate={{ rotate: [360, 0] }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        />
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
                />
              </motion.div>
              <p className="footer-description">
                {t('footer.description')}
              </p>
              <div className="footer-social">
                <motion.a
                  href="#"
                  className="social-link"
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FontAwesomeIcon icon={faFacebook} />
                </motion.a>
                <motion.a
                  href="#"
                  className="social-link"
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FontAwesomeIcon icon={faTwitter} />
                </motion.a>
                <motion.a
                  href="#"
                  className="social-link"
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
                  <li><a href="#hosting" className="footer-link">{t('nav.hosting')}</a></li>
                  <li><a href="#domains" className="footer-link">{t('nav.domains')}</a></li>
                  <li><a href="#ssl" className="footer-link">{t('footer.ssl')}</a></li>
                  <li><a href="#backup" className="footer-link">{t('footer.backup')}</a></li>
                </ul>
              </div>

              <div className="footer-column">
                <h4 className="footer-title">{t('footer.support')}</h4>
                <ul className="footer-list">
                  <li><a href="#docs" className="footer-link">{t('footer.documentation')}</a></li>
                  <li><a href="#faq" className="footer-link">{t('footer.faq')}</a></li>
                  <li><a href="#support" className="footer-link">{t('footer.liveSupport')}</a></li>
                  <li><a href="#status" className="footer-link">{t('footer.status')}</a></li>
                </ul>
              </div>

              <div className="footer-column">
                <h4 className="footer-title">{t('footer.company')}</h4>
                <ul className="footer-list">
                  <li><a href="#about" className="footer-link">{t('nav.about')}</a></li>
                  <li><a href="#careers" className="footer-link">{t('footer.careers')}</a></li>
                  <li><a href="#privacy" className="footer-link">{t('footer.privacy')}</a></li>
                  <li><a href="#terms" className="footer-link">{t('footer.terms')}</a></li>
                </ul>
              </div>

              <div className="footer-column">
                <h4 className="footer-title">{t('footer.contact')}</h4>
                <div className="footer-contact">
                  <div className="contact-item">
                    <FontAwesomeIcon icon={faEnvelope} className="contact-icon" />
                    <a href="mailto:info@alatyr.cz" className="contact-link">info@alatyr.cz</a>
                  </div>
                  <div className="contact-item">
                    <FontAwesomeIcon icon={faPhone} className="contact-icon" />
                    <a href="tel:+420123456789" className="contact-link">+420 123 456 789</a>
                  </div>
                  <div className="contact-item">
                    <FontAwesomeIcon icon={faMapMarkerAlt} className="contact-icon" />
                    <span className="contact-text">Praha, Česká republika</span>
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
              &copy; 2024 Alatyr Hosting. {t('footer.rights')}
            </p>
            <div className="footer-bottom-links">
              <a href="#privacy" className="footer-bottom-link">{t('footer.privacy')}</a>
              <span className="footer-divider">|</span>
              <a href="#terms" className="footer-bottom-link">{t('footer.terms')}</a>
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