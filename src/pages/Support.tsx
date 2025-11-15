import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeadset, faClock, faEnvelope, faTicket, faSearch } from '@fortawesome/free-solid-svg-icons';
import { useLanguage } from '../contexts/LanguageContext';

const Support: React.FC = () => {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');

  const supportOptions = [
    {
      icon: faTicket,
      title: 'support.ticket.title',
      description: 'support.ticket.description',
      action: 'support.ticket.action'
    },
    {
      icon: faHeadset,
      title: 'support.chat.title',
      description: 'support.chat.description',
      action: 'support.chat.action'
    },
    {
      icon: faEnvelope,
      title: 'support.email.title',
      description: 'support.email.description',
      action: 'support.email.action'
    }
  ];

  const faqItems = [
    {
      question: 'support.faq.q1.question',
      answer: 'support.faq.q1.answer'
    },
    {
      question: 'support.faq.q2.question',
      answer: 'support.faq.q2.answer'
    },
    {
      question: 'support.faq.q3.question',
      answer: 'support.faq.q3.answer'
    },
    {
      question: 'support.faq.q4.question',
      answer: 'support.faq.q4.answer'
    }
  ];

  return (
    <main className="support-page">
      <motion.section
        className="support-hero"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="container">
          <div className="support-hero-content">
            <motion.h1
              className="support-title"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              {t('support.title')}<span className="gradient-text">{t('support.titleHighlight')}</span>
            </motion.h1>
            <motion.p
              className="support-description"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              {t('support.description')}
            </motion.p>

            <motion.div
              className="support-search"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <div className="search-container">
                <FontAwesomeIcon icon={faSearch} className="search-icon" />
                <input
                  type="text"
                  placeholder={t('support.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </motion.section>

      <section className="support-options">
        <div className="container">
          <motion.div
            className="section-header"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="section-title">{t('support.optionsTitle')}</h2>
            <p className="section-description">{t('support.optionsDescription')}</p>
          </motion.div>

          <div className="support-grid">
            {supportOptions.map((option, index) => (
              <motion.div
                key={index}
                className="support-card"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -5, scale: 1.02 }}
              >
                <div className="support-icon">
                  <FontAwesomeIcon icon={option.icon} />
                </div>
                <h3 className="support-card-title">{t(option.title)}</h3>
                <p className="support-card-description">{t(option.description)}</p>
                <motion.button
                  className="support-action"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {t(option.action)}
                </motion.button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="support-hours">
        <div className="container">
          <motion.div
            className="hours-content"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <FontAwesomeIcon icon={faClock} className="hours-icon" />
            <h2>{t('support.hours.title')}</h2>
            <p>{t('support.hours.description')}</p>
            <div className="hours-info">
              <div className="hours-item">
                <strong>{t('support.hours.chat')}</strong>
                <span>24/7</span>
              </div>
              <div className="hours-item">
                <strong>{t('support.hours.email')}</strong>
                <span>24/7</span>
              </div>
              <div className="hours-item">
                <strong>Ticket systém</strong>
                <span>24/7</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="support-faq">
        <div className="container">
          <motion.div
            className="section-header"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="section-title">{t('support.faqTitle')}</h2>
            <p className="section-description">{t('support.faqDescription')}</p>
          </motion.div>

          <div className="faq-list">
            {faqItems.map((item, index) => (
              <motion.div
                key={index}
                className="faq-item"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <h3 className="faq-question">{t(item.question)}</h3>
                <p className="faq-answer">{t(item.answer)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
};

export default Support;