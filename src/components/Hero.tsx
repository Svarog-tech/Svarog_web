import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faArrowRight, faHeadset, faServer, faDatabase, faGlobe } from '@fortawesome/free-solid-svg-icons';
import { usePlanSelection } from '../hooks/usePlanSelection';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';

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
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="hero-badge-button"
            >
              <div className="hero-badge-blob1"></div>
              <div className="hero-badge-inner">
                {t('hero.badge')}
              </div>
            </motion.div>

            <motion.h1
              className="hero-title"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
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

            <motion.div
              className="hero-stats"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
            >
              <div className="stat">
                <span className="stat-number">99.9%</span>
                <span className="stat-label">{t('hero.uptime')}</span>
              </div>
              <div className="stat">
                <span className="stat-number">10k+</span>
                <span className="stat-label">{t('hero.customers')}</span>
              </div>
              <div className="stat">
                <span className="stat-number">24/7</span>
                <span className="stat-label">{t('hero.support')}</span>
              </div>
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

                      <div className="plan-specs">
                        <div className="spec-item">
                          <FontAwesomeIcon icon={faServer} />
                          <span>{t(`plans.${selectedPlan.id}.specs.storage`)}</span>
                        </div>
                        <div className="spec-item">
                          <FontAwesomeIcon icon={faGlobe} />
                          <span>{t(`plans.${selectedPlan.id}.specs.websites`)}</span>
                        </div>
                        <div className="spec-item">
                          <FontAwesomeIcon icon={faDatabase} />
                          <span>{t(`plans.${selectedPlan.id}.specs.bandwidth`)}</span>
                        </div>
                        <div className="spec-item">
                          <FontAwesomeIcon icon={faHeadset} />
                          <span>{t(`plans.${selectedPlan.id}.specs.support`)}</span>
                        </div>
                      </div>

                      <motion.button
                        className="preview-show-plans-btn"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          const element = document.getElementById('hosting');
                          if (element) {
                            const offset = 100; // Adjust this value to show more of the section
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

                  <div className="performance-chart">
                    {/* Dynamic chart bars with smooth transitions */}
                    {Array.from({ length: 5 }).map((_, index) => {
                      // Chart data for all 4 plans
                      const chartData: Record<string, { heights: string[], color: string }> = {
                        basic: {
                          heights: ['40%', '50%', '65%', '45%', '55%'],
                          color: '#6366F1'
                        },
                        standard: {
                          heights: ['70%', '85%', '90%', '75%', '80%'],
                          color: '#3B82F6'
                        },
                        pro: {
                          heights: ['85%', '92%', '95%', '88%', '90%'],
                          color: '#8B5CF6'
                        },
                        ultimate: {
                          heights: ['95%', '98%', '100%', '96%', '99%'],
                          color: '#F59E0B'
                        }
                      };

                      const currentData = chartData[selectedPlan.id] || chartData.standard;
                      const height = currentData.heights[index];
                      const color = currentData.color;

                      return (
                        <motion.div
                          key={`${selectedPlan.id}-${index}`}
                          className="chart-bar"
                          initial={{ height: '0%' }}
                          animate={{
                            height,
                            backgroundColor: color
                          }}
                          transition={{
                            duration: 0.8,
                            delay: 0.1 + (index * 0.1),
                            type: "spring",
                            stiffness: 200,
                            damping: 25
                          }}
                        />
                      );
                    })}
                  </div>
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