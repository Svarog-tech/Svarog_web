import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faArrowRight, faHeadset, faServer, faDatabase, faGlobe } from '@fortawesome/free-solid-svg-icons';
import { usePlanSelection } from '../hooks/usePlanSelection';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';

const Hero: React.FC = () => {
  const { plans, selectedPlan, selectPlan } = usePlanSelection();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const [currentPlanIndex, setCurrentPlanIndex] = useState(1); // Start with Business (index 1)

  // Auto-cycle through plans
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPlanIndex((prev) => {
        const nextIndex = (prev + 1) % plans.length;
        selectPlan(plans[nextIndex].id);
        return nextIndex;
      });
    }, 3000); // Change every 3 seconds

    return () => clearInterval(interval);
  }, [plans, selectPlan]);

  return (
    <section className="modern-hero">
      <div className="container">
        <div className="hero-content">
          <div className="hero-left">
            <motion.div
              className="hero-badge"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <span>{t('hero.badge')}</span>
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
                onClick={() => document.getElementById('hosting')?.scrollIntoView({ behavior: 'smooth' })}
              >
                {t('hero.startNow')}
                <FontAwesomeIcon icon={faArrowRight} />
              </button>
              <button className="secondary-btn">
                {t('hero.contactSales')}
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
                        onClick={() => selectPlan(plan.id)}
                        whileHover={{
                          scale: 1.02
                        }}
                        whileTap={{ scale: 0.98 }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 30
                        }}
                        style={{ position: 'relative' }}
                      >
                        {selectedPlan.id === plan.id && (
                          <motion.div
                            layoutId="activeTab"
                            className="active-tab-background"
                            initial={false}
                            transition={{
                              type: "spring",
                              stiffness: 500,
                              damping: 30
                            }}
                          />
                        )}
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
                        onClick={() => document.getElementById('hosting')?.scrollIntoView({ behavior: 'smooth' })}
                      >
                        {t('hero.showPlans')}
                        <FontAwesomeIcon icon={faArrowRight} />
                      </motion.button>
                    </motion.div>
                  </AnimatePresence>

                  <div className="performance-chart">
                    {/* Dynamic chart bars with smooth transitions */}
                    {Array.from({ length: 5 }).map((_, index) => {
                      let height = '0%';
                      let color = '#3B82F6';

                      if (selectedPlan.id === 'basic') {
                        height = ['40%', '50%', '65%', '45%', '55%'][index];
                        color = '#6366F1';
                      } else if (selectedPlan.id === 'standard') {
                        height = ['70%', '85%', '90%', '75%', '80%'][index];
                        color = '#3B82F6';
                      } else if (selectedPlan.id === 'premium') {
                        height = ['90%', '95%', '100%', '85%', '98%'][index];
                        color = '#F59E0B';
                      }

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