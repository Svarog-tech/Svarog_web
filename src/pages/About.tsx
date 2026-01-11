import React from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRocket, faUsers, faHeart, faShield, faBolt } from '@fortawesome/free-solid-svg-icons';
import { useLanguage } from '../contexts/LanguageContext';

const About: React.FC = () => {
  const { t } = useLanguage();

  const stats = [
    { number: '10,000+', label: 'about.stats.customers' },
    { number: '99.9%', label: 'about.stats.uptime' },
    { number: '24/7', label: 'about.stats.support' },
    { number: '5+', label: 'about.stats.years' }
  ];

  const values = [
    {
      icon: faRocket,
      title: 'about.values.innovation.title',
      description: 'about.values.innovation.description'
    },
    {
      icon: faShield,
      title: 'about.values.reliability.title',
      description: 'about.values.reliability.description'
    },
    {
      icon: faHeart,
      title: 'about.values.care.title',
      description: 'about.values.care.description'
    }
  ];

  const team = [
    {
      name: 'Jan Novák',
      role: 'about.team.ceo.role',
      description: 'about.team.ceo.description'
    },
    {
      name: 'Petra Svoboda',
      role: 'about.team.cto.role',
      description: 'about.team.cto.description'
    },
    {
      name: 'Tomáš Černý',
      role: 'about.team.support.role',
      description: 'about.team.support.description'
    }
  ];

  return (
    <main className="about-page">
      <motion.section
        className="about-hero"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="container">
          <div className="about-hero-content">
            <motion.h1
              className="about-title"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              {t('about.title')} <span className="gradient-text">{t('about.titleHighlight')}</span>
            </motion.h1>
            <motion.p
              className="about-description"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              {t('about.description')}
            </motion.p>
          </div>
        </div>
      </motion.section>

      <section className="about-stats">
        <div className="container">
          <div className="stats-grid">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                className="about-card"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -5, scale: 1.05 }}
              >
                <div className="stat-number">{stat.number}</div>
                <div className="stat-label">{t(stat.label)}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="about-story">
        <div className="container">
          <motion.div
            className="story-content"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="section-title">{t('about.story.title')}</h2>
            <div className="story-text">
              <p>{t('about.story.paragraph1')}</p>
              <p>{t('about.story.paragraph2')}</p>
              <p>{t('about.story.paragraph3')}</p>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="about-values">
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
              {t('about.valuesTitle')} {t('about.valuesDescription')}
            </h2>
          </motion.div>

          <div className="values-grid">
            {values.map((value, index) => (
              <motion.div
                key={index}
                className="value-card"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -5, scale: 1.02 }}
              >
                <div className="value-icon">
                  <FontAwesomeIcon icon={value.icon} />
                </div>
                <h3 className="value-title">{t(value.title)}</h3>
                <p className="value-description">{t(value.description)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="about-team">
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
              {t('about.teamTitle')} {t('about.teamDescription')}
            </h2>
          </motion.div>

          <div className="team-grid">
            {team.map((member, index) => (
              <motion.div
                key={index}
                className="team-card"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -5, scale: 1.02 }}
              >
                <div className="member-avatar">
                  <FontAwesomeIcon icon={faUsers} />
                </div>
                <h3 className="member-name">{member.name}</h3>
                <p className="member-role">{t(member.role)}</p>
                <p className="member-description">{t(member.description)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="about-cta">
        <div className="container">
          <motion.div
            className="cta-content"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2>{t('about.cta.title')}</h2>
            <p>{t('about.cta.description')}</p>
            <motion.button
              className="cta-button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {t('about.cta.button')}
            </motion.button>
          </motion.div>
        </div>
      </section>
    </main>
  );
};

export default About;