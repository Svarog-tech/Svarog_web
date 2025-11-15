import React from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faServer, faRocket, faShield, faBolt } from '@fortawesome/free-solid-svg-icons';
import { useLanguage } from '../contexts/LanguageContext';
import HostingPlansNew from '../components/HostingPlansNew';

const Hosting: React.FC = () => {
  const { t } = useLanguage();

  const features = [
    {
      icon: faRocket,
      title: 'hosting.feature1.title',
      description: 'hosting.feature1.description'
    },
    {
      icon: faShield,
      title: 'hosting.feature2.title',
      description: 'hosting.feature2.description'
    },
    {
      icon: faBolt,
      title: 'hosting.feature3.title',
      description: 'hosting.feature3.description'
    },
    {
      icon: faServer,
      title: 'hosting.feature4.title',
      description: 'hosting.feature4.description'
    }
  ];

  return (
    <main className="hosting-page">
      <motion.section
        className="hosting-hero"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="container">
          <div className="hosting-hero-content">
            <motion.h1
              className="hosting-title"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              {t('hosting.title')} <span className="gradient-text">{t('hosting.titleHighlight')}</span>
            </motion.h1>
            <motion.p
              className="hosting-description"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              {t('hosting.description')}
            </motion.p>
          </div>
        </div>
      </motion.section>

      <section className="hosting-features">
        <div className="container">
          <motion.div
            className="section-header"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="section-title">{t('hosting.featuresTitle')}</h2>
            <p className="section-description">{t('hosting.featuresDescription')}</p>
          </motion.div>

          <div className="features-grid">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                className="feature-card"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -5, scale: 1.02 }}
              >
                <div className="feature-icon">
                  <FontAwesomeIcon icon={feature.icon} />
                </div>
                <h3 className="feature-title">{t(feature.title)}</h3>
                <p className="feature-description">{t(feature.description)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <HostingPlansNew />

      <section className="hosting-guarantee">
        <div className="container">
          <motion.div
            className="guarantee-content"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <FontAwesomeIcon icon={faShield} className="guarantee-icon" />
            <h2>{t('hosting.guarantee.title')}</h2>
            <p>{t('hosting.guarantee.description')}</p>
            <motion.button
              className="cta-button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {t('hosting.guarantee.cta')}
            </motion.button>
          </motion.div>
        </div>
      </section>
    </main>
  );
};

export default Hosting;