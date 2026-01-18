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
        style={{
          backgroundImage: `url(${process.env.PUBLIC_URL}/banner.png)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
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
            style={{ textAlign: 'center', marginBottom: '56px', width: '100%', display: 'block' }}
          >
            <h2
              style={{
                fontSize: '2.75rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                marginBottom: '16px',
                letterSpacing: '-0.02em',
                textAlign: 'center',
                display: 'block',
                width: '100%'
              }}
            >
              {t('hosting.featuresTitle')} {t('hosting.featuresDescription')}
            </h2>
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
            <button
              className="fancy-button"
              style={{
                position: 'relative',
                border: 'none',
                background: 'transparent',
                padding: 0,
                outline: 'none',
                cursor: 'pointer',
                fontFamily: 'monospace',
                fontWeight: 300,
                textTransform: 'uppercase',
                fontSize: '18px',
                transform: 'scale(1.3)',
              }}
            >
              <span
                className="button-shadow"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  backgroundColor: 'rgba(0, 0, 0, 0.25)',
                  borderRadius: '8px',
                  transform: 'translateY(2px)',
                  transition: 'transform 600ms cubic-bezier(0.3, 0.7, 0.4, 1)',
                }}
              ></span>

              <span
                className="button-edge"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  borderRadius: '8px',
                  background: 'linear-gradient(to left, hsl(217, 33%, 16%), hsl(217, 33%, 32%), hsl(217, 33%, 16%))',
                }}
              ></span>

              <div
                className="button-front"
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 24px',
                  fontSize: '18px',
                  color: 'white',
                  borderRadius: '8px',
                  transform: 'translateY(-4px)',
                  background: 'linear-gradient(135deg, #2563eb, #06b6d4, #2563eb)',
                  backgroundSize: '200% 200%',
                  backgroundPosition: '0% 50%',
                  gap: '12px',
                  transition: 'transform 600ms cubic-bezier(0.3, 0.7, 0.4, 1), background-position 800ms ease',
                }}
              >
                <span style={{ userSelect: 'none' }}>{t('hosting.guarantee.cta')}</span>

                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  style={{
                    width: '20px',
                    height: '20px',
                    marginLeft: '8px',
                    marginRight: '-4px',
                    transition: 'transform 250ms',
                  }}
                  className="button-arrow"
                >
                  <path
                    clipRule="evenodd"
                    d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                    fillRule="evenodd"
                  ></path>
                </svg>
              </div>
            </button>
          </motion.div>
        </div>
      </section>
    </main>
  );
};

export default Hosting;
