import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { usePlanSelection } from '../hooks/usePlanSelection';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';

// Code lines for the editor visualization
const codeLines = [
  { text: 'const', type: 'keyword' },
  { text: ' website ', type: 'variable' },
  { text: '= ', type: 'operator' },
  { text: 'await', type: 'keyword' },
  { text: ' deploy', type: 'function' },
  { text: '({', type: 'bracket' },
];

const Hero: React.FC = () => {
  const { plans, selectedPlan, selectPlan } = usePlanSelection();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();
  const [currentPlanIndex, setCurrentPlanIndex] = useState(1); // Start with Business (index 1)
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [autoPlayDuration, setAutoPlayDuration] = useState(0);

  // Auto-cycle through plans - stops after 10 seconds or user interaction
  useEffect(() => {
    if (hasUserInteracted) return; // Stop if user interacted

    const interval = setInterval(() => {
      setAutoPlayDuration((prev) => {
        const newDuration = prev + 3000;

        if (newDuration >= 10000) {
          // Stop after 10 seconds
          clearInterval(interval);
          return newDuration;
        }

        setCurrentPlanIndex((prevIndex) => {
          const nextIndex = (prevIndex + 1) % plans.length;
          selectPlan(plans[nextIndex].id);
          return nextIndex;
        });

        return newDuration;
      });
    }, 3000); // Change every 3 seconds

    return () => clearInterval(interval);
  }, [plans, selectPlan, hasUserInteracted]);

  return (
    <section className="modern-hero">
      <div className="container">
        <div className="hero-content">
          <div className="hero-left">
            <motion.h1
              className="hero-title"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              {t('hero.title')}
              <span className="highlight">{t('hero.titleHighlight')}</span>
            </motion.h1>

            <motion.p
              className="hero-description"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              {t('hero.description')}
            </motion.p>

            <motion.div
              className="hero-features"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <div className="feature">
                <FontAwesomeIcon icon={faCheck} />
                <span>{t('hero.feature1')}</span>
              </div>
              <div className="feature">
                <FontAwesomeIcon icon={faCheck} />
                <span>{t('hero.feature2')}</span>
              </div>
              <div className="feature">
                <FontAwesomeIcon icon={faCheck} />
                <span>{t('hero.feature3')}</span>
              </div>
            </motion.div>

            <motion.div
              className="hero-cta"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
            >
              <button
                className="primary-btn"
                onClick={() => {
                  const element = document.getElementById('hosting');
                  if (element) {
                    const offset = 0; // Adjust this value to show more of the section
                    const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
                    window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' });
                  }
                }}
              >
                <span>
                  {t('hero.startNow')}
                  <FontAwesomeIcon icon={faArrowRight} />
                </span>
              </button>
              <button
                className="secondary-btn"
                onClick={() => navigate('/support')}
              >
                <span>{t('hero.contactSales')}</span>
              </button>
            </motion.div>

          </div>

          <div className="hero-right">
            <motion.div
              className="hero-visual"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1, delay: 0.4 }}
            >
              <div className="hosting-preview">
                <div className="preview-header">
                  <div className="preview-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <div className="preview-title">hosting.alatyr.cz</div>
                </div>

                <div className="preview-content">
                  {/* Plan Selector with Smooth Tabs */}
                  <div className="plan-selector">
                    {plans.map((plan) => (
                      <motion.button
                        key={plan.id}
                        className={`plan-selector-btn ${selectedPlan.id === plan.id ? 'active' : ''}`}
                        onClick={() => {
                          setHasUserInteracted(true);
                          selectPlan(plan.id);
                        }}
                        aria-label={`Select ${t(`plans.${plan.id}.name`)} plan`}
                        aria-pressed={selectedPlan.id === plan.id}
                        role="tab"
                        whileHover={{
                          scale: 1.02
                        }}
                        whileTap={{ scale: 0.98 }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 30
                        }}
                      >
                        <span className="tab-text">{t(`plans.${plan.id}.name`)}</span>
                      </motion.button>
                    ))}
                  </div>

                  {/* Selected Plan Info with auto-cycling */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={selectedPlan.id}
                      className="selected-plan-display"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="plan-display-header">
                        <h4>{t(`plans.${selectedPlan.id}.name`)}</h4>
                        <div className="plan-price">
                          <span className="price">{formatPrice(selectedPlan.price)}</span>
                          <span className="currency">{t('plans.perMonth')}</span>
                        </div>
                      </div>

                      {/* Code Editor Visualization */}
                      <div className="code-editor-visual">
                        <div className="editor-window">
                          <div className="editor-tabs">
                            <div className="editor-tab active">
                              <span className="tab-icon">⚛</span>
                              <span>App.tsx</span>
                            </div>
                            <div className="editor-tab">
                              <span className="tab-icon">📄</span>
                              <span>styles.css</span>
                            </div>
                          </div>
                          <div className="editor-content">
                            <div className="line-numbers">
                              {[1, 2, 3, 4, 5, 6].map(n => (
                                <span key={n}>{n}</span>
                              ))}
                            </div>
                            <div className="code-area">
                              <motion.div className="code-line" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                                <span className="keyword">const</span> <span className="variable">app</span> <span className="operator">=</span> <span className="function">createApp</span><span className="bracket">()</span>
                              </motion.div>
                              <motion.div className="code-line" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                                <span className="keyword">await</span> <span className="variable">app</span><span className="operator">.</span><span className="function">deploy</span><span className="bracket">(</span><span className="string">'production'</span><span className="bracket">)</span>
                              </motion.div>
                              <motion.div className="code-line empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}></motion.div>
                              <motion.div className="code-line" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>
                                <span className="comment">// Your site is live! 🚀</span>
                              </motion.div>
                              <motion.div className="code-line" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}>
                                <span className="variable">console</span><span className="operator">.</span><span className="function">log</span><span className="bracket">(</span><span className="string">'Hello World'</span><span className="bracket">)</span>
                              </motion.div>
                              <motion.div className="code-line" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }}>
                                <motion.span
                                  className="cursor-line"
                                  animate={{ opacity: [1, 0] }}
                                  transition={{ duration: 0.6, repeat: Infinity }}
                                >|</motion.span>
                              </motion.div>
                            </div>
                          </div>
                        </div>
                        <div className="deploy-status">
                          <motion.div
                            className="status-pill success"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 1.5, type: "spring" }}
                          >
                            <span className="pulse-dot"></span>
                            <span>Deployed in 2.3s</span>
                          </motion.div>
                        </div>
                      </div>

                      <motion.button
                        className="preview-show-plans-btn"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          const element = document.getElementById('hosting');
                          if (element) {
                            const offset = 100;
                            const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
                            window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' });
                          }
                        }}
                      >
                        <span>
                          {t('hero.showPlans')}
                          <FontAwesomeIcon icon={faArrowRight} />
                        </span>
                      </motion.button>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;