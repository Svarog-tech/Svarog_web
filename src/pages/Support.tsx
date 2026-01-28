import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeadset, faClock, faEnvelope, faTicket, faSearch, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { useLanguage } from '../contexts/LanguageContext';
import TriangularBackground from '../components/TriangularBackground';

const Support: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const supportOptions = [
    {
      icon: faTicket,
      title: 'support.ticket.title',
      description: 'support.ticket.description',
      action: 'support.ticket.action',
      onClick: () => navigate('/tickets')
    },
    {
      icon: faHeadset,
      title: 'support.chat.title',
      description: 'support.chat.description',
      action: 'support.chat.action',
      onClick: () => {} // TODO: Implement live chat
    },
    {
      icon: faEnvelope,
      title: 'support.email.title',
      description: 'support.email.description',
      action: 'support.email.action',
      onClick: () => window.location.href = 'mailto:support@svarog.tech'
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
    <>
      <TriangularBackground opacity={0.12} />
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
              className="support-search-enhanced"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <div className="search-wrapper">
                <div className="search-glow"></div>
                <FontAwesomeIcon icon={faSearch} className="search-icon-enhanced" />
                <input
                  type="text"
                  placeholder={t('support.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input-enhanced"
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
            <h2 className="faq-title">{t('support.optionsTitle')}</h2>
          </motion.div>

          <div className="support-grid">
            {supportOptions.map((option, index) => (
              <motion.div
                key={index}
                className="support-card"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.15, ease: [0.25, 0.1, 0.25, 1] }}
                viewport={{ once: true, margin: "-50px" }}
                whileHover={{ y: -5, scale: 1.02, transition: { duration: 0.2 } }}
              >
                <div className="card-glow"></div>
                <div className="support-icon-wrapper">
                  <FontAwesomeIcon icon={option.icon} />
                </div>
                <h3 className="support-card-title">{t(option.title)}</h3>
                <p className="support-card-description">{t(option.description)}</p>
                <motion.button
                  className="support-action-btn"
                  onClick={option.onClick}
                  whileHover={{ scale: 1.05, translateY: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="btn-icon-wrapper">
                    <svg
                      viewBox="0 0 14 15"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="btn-icon-svg"
                      width="10"
                    >
                      <path
                        d="M13.376 11.552l-.264-10.44-10.44-.24.024 2.28 6.96-.048L.2 12.56l1.488 1.488 9.432-9.432-.048 6.912 2.304.024z"
                        fill="currentColor"
                      />
                    </svg>
                    <svg
                      viewBox="0 0 14 15"
                      fill="none"
                      width="10"
                      xmlns="http://www.w3.org/2000/svg"
                      className="btn-icon-svg btn-icon-svg--copy"
                    >
                      <path
                        d="M13.376 11.552l-.264-10.44-10.44-.24.024 2.28 6.96-.048L.2 12.56l1.488 1.488 9.432-9.432-.048 6.912 2.304.024z"
                        fill="currentColor"
                      />
                    </svg>
                  </span>
                  {t(option.action)}
                </motion.button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="support-hours">
        <div className="faq-container">
          <motion.div
            className="hours-content"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <div className="hours-icon-wrapper">
              <FontAwesomeIcon icon={faClock} />
            </div>
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
            <h2 className="faq-title">{t('support.faqDescription')}</h2>
          </motion.div>

          <div className="faq-list">
            {faqItems.map((item, index) => (
              <motion.div
                key={index}
                className="faq-item-enhanced"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <button
                  className={`faq-question-btn ${expandedFaq === index ? 'active' : ''}`}
                  onClick={() => toggleFaq(index)}
                  aria-expanded={expandedFaq === index}
                  aria-controls={`faq-answer-${index}`}
                >
                  <h3 className="faq-question-text">{t(item.question)}</h3>
                  <motion.div
                    className="faq-icon"
                    animate={{ rotate: expandedFaq === index ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <FontAwesomeIcon icon={faChevronDown} />
                  </motion.div>
                </button>

                <AnimatePresence initial={false}>
                  {expandedFaq === index && (
                    <motion.div
                      id={`faq-answer-${index}`}
                      role="region"
                      className="faq-answer-wrapper"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                      <p className="faq-answer-text">{t(item.answer)}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </main>
    </>
  );
};

export default Support;