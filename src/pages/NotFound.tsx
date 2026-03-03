import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome, faServer, faHeadset, faEnvelope, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { useLanguage } from '../contexts/LanguageContext';
import PageMeta from '../components/PageMeta';
import './NotFound.css';

const NotFound: React.FC = () => {
  const { t } = useLanguage();

  const quickLinks = [
    {
      icon: faHome,
      label: t('notFound.backHome') || 'Hlavní stránka',
      to: '/'
    },
    {
      icon: faServer,
      label: 'Webhosting',
      to: '/hosting'
    },
    {
      icon: faHeadset,
      label: 'Podpora',
      to: '/support'
    },
    {
      icon: faEnvelope,
      label: 'Kontakt',
      to: '/contact'
    }
  ];

  return (
    <main className="notfound-page">
      <PageMeta
        title="404 - Stránka nenalezena"
        description="Tato stránka neexistuje."
        path="/404"
        noindex
      />

      {/* Hero Section */}
      <motion.section
        className="notfound-hero"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="container">
          <div className="notfound-hero-content">
            <motion.div
              className="notfound-icon"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <FontAwesomeIcon icon={faExclamationTriangle} />
            </motion.div>
            <motion.h1
              className="notfound-code"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              404
            </motion.h1>
            <motion.h2
              className="notfound-title"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              {t('notFound.title') || 'Stránka nenalezena'}
            </motion.h2>
            <motion.p
              className="notfound-description"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              {t('notFound.description') || 'Stránka, kterou hledáte, neexistuje nebo byla přesunuta.'}
            </motion.p>
          </div>
        </div>
      </motion.section>

      {/* Quick Links Section */}
      <section className="notfound-links-section">
        <div className="container">
          <motion.div
            className="notfound-links-header"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h3 className="notfound-links-title">Kam dál?</h3>
            <p className="notfound-links-subtitle">Vyberte si z rychlých odkazů níže</p>
          </motion.div>

          <div className="notfound-links-grid">
            {quickLinks.map((link, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Link to={link.to} className="notfound-link-card">
                  <div className="notfound-link-icon">
                    <FontAwesomeIcon icon={link.icon} />
                  </div>
                  <span className="notfound-link-label">{link.label}</span>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
};

export default NotFound;
