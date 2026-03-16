import React, { useEffect, useRef } from 'react';
import { motion, useInView, useAnimation } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRight,
  faShieldHalved,
  faBolt,
  faHeadset,
  faServer,
  faGlobe,
  faLock,
  faCloudArrowUp,
  faChartLine,
  faClock,
  faCheck,
  faStar,
  faQuoteLeft
} from '@fortawesome/free-solid-svg-icons';
import HostingPlansNew from '../components/HostingPlansNew';
import PageMeta from '../components/PageMeta';
import { useLanguage } from '../contexts/LanguageContext';
import './Home.css';

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 60 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" }
  }
};

const fadeInLeft = {
  hidden: { opacity: 0, x: -60 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: "easeOut" }
  }
};

const fadeInRight = {
  hidden: { opacity: 0, x: 60 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: "easeOut" }
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: "easeOut" }
  }
};

// Animated counter hook
const useCounter = (end: number, duration: number = 2000, suffix: string = '') => {
  const [count, setCount] = React.useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  useEffect(() => {
    if (!isInView) return;

    let startTime: number;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, [isInView, end, duration]);

  return { count: count + suffix, ref };
};

// Section wrapper with animation
const AnimatedSection: React.FC<{ children: React.ReactNode; className?: string; id?: string }> = ({
  children,
  className = '',
  id
}) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const controls = useAnimation();

  useEffect(() => {
    if (isInView) {
      controls.start("visible");
    }
  }, [isInView, controls]);

  return (
    <motion.section
      ref={ref}
      id={id}
      className={className}
      initial="hidden"
      animate={controls}
      variants={staggerContainer}
    >
      {children}
    </motion.section>
  );
};

const Home: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Stats counters
  const uptimeCounter = useCounter(99, 2000, '.9%');
  const customersCounter = useCounter(10, 2000, 'k+');
  const supportCounter = useCounter(24, 1500, '/7');
  const yearsCounter = useCounter(10, 2000, '+');

  const scrollToPlans = () => {
    const element = document.getElementById('hosting');
    if (element) {
      const offset = 80;
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' });
    }
  };

  const features = [
    {
      icon: faBolt,
      title: t('landing.features.speed.title'),
      description: t('landing.features.speed.description')
    },
    {
      icon: faShieldHalved,
      title: t('landing.features.security.title'),
      description: t('landing.features.security.description')
    },
    {
      icon: faHeadset,
      title: t('landing.features.support.title'),
      description: t('landing.features.support.description')
    },
    {
      icon: faCloudArrowUp,
      title: t('landing.features.backup.title'),
      description: t('landing.features.backup.description')
    },
    {
      icon: faChartLine,
      title: t('landing.features.scalability.title'),
      description: t('landing.features.scalability.description')
    },
    {
      icon: faGlobe,
      title: t('landing.features.global.title'),
      description: t('landing.features.global.description')
    }
  ];

  const testimonials = [
    {
      name: "Martin K.",
      role: t('landing.testimonials.role1'),
      content: t('landing.testimonials.content1'),
      rating: 5
    },
    {
      name: "Jana P.",
      role: t('landing.testimonials.role2'),
      content: t('landing.testimonials.content2'),
      rating: 5
    },
    {
      name: "Tomáš H.",
      role: t('landing.testimonials.role3'),
      content: t('landing.testimonials.content3'),
      rating: 5
    }
  ];

  return (
    <main className="landing-page">
      <PageMeta
        title="Alatyr Hosting – Webhosting, domény a serverová řešení"
        description="Alatyr Hosting – profesionální webhosting, domény a serverová řešení. SSL zdarma, podpora 24/7, HestiaCP panel. Vyberte si hosting nebo doménu."
        path="/"
      />

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="hero-background">
          <div className="hero-gradient-orb hero-gradient-orb-1"></div>
          <div className="hero-gradient-orb hero-gradient-orb-2"></div>
          <div className="hero-grid-pattern"></div>
        </div>

        <div className="container">
          <div className="hero-content-wrapper">
            <motion.div
              className="hero-text-content"
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
            >
              <motion.div className="hero-badge" variants={fadeInUp}>
                <span className="badge-dot"></span>
                <span>{t('landing.hero.badge')}</span>
              </motion.div>

              <motion.h1 className="hero-main-title" variants={fadeInUp}>
                {t('landing.hero.title')}
                <span className="gradient-text-animated">{t('landing.hero.titleHighlight')}</span>
              </motion.h1>

              <motion.p className="hero-main-description" variants={fadeInUp}>
                {t('landing.hero.description')}
              </motion.p>

              <motion.div className="hero-features-list" variants={fadeInUp}>
                <div className="hero-feature-item">
                  <FontAwesomeIcon icon={faCheck} />
                  <span>{t('landing.hero.feature1')}</span>
                </div>
                <div className="hero-feature-item">
                  <FontAwesomeIcon icon={faCheck} />
                  <span>{t('landing.hero.feature2')}</span>
                </div>
                <div className="hero-feature-item">
                  <FontAwesomeIcon icon={faCheck} />
                  <span>{t('landing.hero.feature3')}</span>
                </div>
              </motion.div>

              <motion.div className="hero-cta-group" variants={fadeInUp}>
                <button className="primary-btn" onClick={scrollToPlans}>
                  <span>
                    {t('landing.hero.cta')}
                    <FontAwesomeIcon icon={faArrowRight} />
                  </span>
                </button>
                <button className="secondary-btn" onClick={() => navigate('/support')}>
                  <span>{t('landing.hero.ctaSecondary')}</span>
                </button>
              </motion.div>
            </motion.div>

            <motion.div
              className="hero-visual-content"
              initial="hidden"
              animate="visible"
              variants={fadeInRight}
            >
              <div className="hero-dashboard-preview">
                <div className="preview-window">
                  <div className="preview-window-header">
                    <div className="window-dots">
                      <span className="dot red"></span>
                      <span className="dot yellow"></span>
                      <span className="dot green"></span>
                    </div>
                    <div className="window-title">alatyr.cz</div>
                  </div>
                  <div className="preview-window-content">
                    <div className="preview-stats-grid">
                      <div className="preview-stat-card">
                        <FontAwesomeIcon icon={faServer} className="stat-icon" />
                        <div className="stat-info">
                          <span className="stat-label">{t('landing.preview.server')}</span>
                          <span className="stat-value online">{t('landing.preview.online')}</span>
                        </div>
                      </div>
                      <div className="preview-stat-card">
                        <FontAwesomeIcon icon={faChartLine} className="stat-icon" />
                        <div className="stat-info">
                          <span className="stat-label">{t('landing.preview.uptime')}</span>
                          <span className="stat-value">99.9%</span>
                        </div>
                      </div>
                      <div className="preview-stat-card">
                        <FontAwesomeIcon icon={faLock} className="stat-icon" />
                        <div className="stat-info">
                          <span className="stat-label">SSL</span>
                          <span className="stat-value secure">{t('landing.preview.secure')}</span>
                        </div>
                      </div>
                      <div className="preview-stat-card">
                        <FontAwesomeIcon icon={faClock} className="stat-icon" />
                        <div className="stat-info">
                          <span className="stat-label">{t('landing.preview.response')}</span>
                          <span className="stat-value">45ms</span>
                        </div>
                      </div>
                    </div>
                    <div className="preview-performance-bar">
                      <div className="performance-label">{t('landing.preview.performance')}</div>
                      <div className="performance-track">
                        <motion.div
                          className="performance-fill"
                          initial={{ width: 0 }}
                          animate={{ width: "94%" }}
                          transition={{ delay: 1, duration: 1.5, ease: "easeOut" }}
                        ></motion.div>
                      </div>
                      <div className="performance-value">94%</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Trust Stats Section */}
      <AnimatedSection className="trust-stats-section">
        <div className="container">
          <div className="trust-stats-grid">
            <motion.div className="trust-stat" variants={scaleIn}>
              <span className="trust-stat-number" ref={uptimeCounter.ref}>{uptimeCounter.count}</span>
              <span className="trust-stat-label">{t('landing.stats.uptime')}</span>
            </motion.div>
            <motion.div className="trust-stat" variants={scaleIn}>
              <span className="trust-stat-number" ref={customersCounter.ref}>{customersCounter.count}</span>
              <span className="trust-stat-label">{t('landing.stats.customers')}</span>
            </motion.div>
            <motion.div className="trust-stat" variants={scaleIn}>
              <span className="trust-stat-number" ref={supportCounter.ref}>{supportCounter.count}</span>
              <span className="trust-stat-label">{t('landing.stats.support')}</span>
            </motion.div>
            <motion.div className="trust-stat" variants={scaleIn}>
              <span className="trust-stat-number" ref={yearsCounter.ref}>{yearsCounter.count}</span>
              <span className="trust-stat-label">{t('landing.stats.years')}</span>
            </motion.div>
          </div>
        </div>
      </AnimatedSection>

      {/* Features Section - Creative Layout */}
      <AnimatedSection className="features-section" id="features">
        <div className="container">
          <div className="features-layout">
            <motion.div className="features-intro" variants={fadeInLeft}>
              <span className="features-eyebrow">{t('landing.features.badge')}</span>
              <h2 className="features-headline">
                {t('landing.features.title')}
                <span className="gradient-text-animated">{t('landing.features.titleHighlight')}</span>
              </h2>
              <p className="features-lead">{t('landing.features.description')}</p>

              <div className="features-highlight-box">
                <div className="highlight-number">99.9%</div>
                <div className="highlight-text">
                  <strong>{t('landing.features.guaranteedUptime')}</strong>
                  <span>{t('landing.features.uptimeDescription')}</span>
                </div>
              </div>
            </motion.div>

            <div className="features-stack">
              {features.slice(0, 3).map((feature, index) => (
                <motion.div
                  key={index}
                  className="feature-row"
                  variants={fadeInRight}
                  custom={index}
                >
                  <div className="feature-row-icon">
                    <FontAwesomeIcon icon={feature.icon} />
                  </div>
                  <div className="feature-row-content">
                    <h3>{feature.title}</h3>
                    <p>{feature.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="features-stack">
              {features.slice(3, 6).map((feature, index) => (
                <motion.div
                  key={index + 3}
                  className="feature-row"
                  variants={fadeInRight}
                  custom={index + 3}
                >
                  <div className="feature-row-icon">
                    <FontAwesomeIcon icon={feature.icon} />
                  </div>
                  <div className="feature-row-content">
                    <h3>{feature.title}</h3>
                    <p>{feature.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </AnimatedSection>

      {/* Plans Section - Keep existing component */}
      <HostingPlansNew />

      {/* Testimonials Section */}
      <AnimatedSection className="testimonials-section">
        <div className="container">
          <motion.div className="section-header" variants={fadeInUp}>
            <span className="section-badge">{t('landing.testimonials.badge')}</span>
            <h2 className="section-title">
              {t('landing.testimonials.title')}
              <span className="gradient-text-animated">{t('landing.testimonials.titleHighlight')}</span>
            </h2>
          </motion.div>

          <div className="testimonials-grid">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                className="testimonial-card"
                variants={fadeInUp}
                whileHover={{ y: -5, transition: { duration: 0.3 } }}
              >
                <div className="testimonial-quote-icon">
                  <FontAwesomeIcon icon={faQuoteLeft} />
                </div>
                <p className="testimonial-content">{testimonial.content}</p>
                <div className="testimonial-rating">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <FontAwesomeIcon key={i} icon={faStar} />
                  ))}
                </div>
                <div className="testimonial-author">
                  <div className="author-avatar">
                    {testimonial.name.charAt(0)}
                  </div>
                  <div className="author-info">
                    <span className="author-name">{testimonial.name}</span>
                    <span className="author-role">{testimonial.role}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* Final CTA Section */}
      <AnimatedSection className="final-cta-section">
        <div className="container">
          <div className="final-cta-content">
            <motion.div className="cta-text" variants={fadeInLeft}>
              <h2 className="cta-title">{t('landing.cta.title')}</h2>
              <p className="cta-description">{t('landing.cta.description')}</p>
              <div className="cta-features">
                <div className="cta-feature">
                  <FontAwesomeIcon icon={faCheck} />
                  <span>{t('landing.cta.feature1')}</span>
                </div>
                <div className="cta-feature">
                  <FontAwesomeIcon icon={faCheck} />
                  <span>{t('landing.cta.feature2')}</span>
                </div>
                <div className="cta-feature">
                  <FontAwesomeIcon icon={faCheck} />
                  <span>{t('landing.cta.feature3')}</span>
                </div>
              </div>
            </motion.div>
            <motion.div className="cta-action" variants={fadeInRight}>
              <button className="primary-btn large" onClick={scrollToPlans}>
                <span>
                  {t('landing.cta.button')}
                  <FontAwesomeIcon icon={faArrowRight} />
                </span>
              </button>
              <p className="cta-guarantee">{t('landing.cta.guarantee')}</p>
            </motion.div>
          </div>
        </div>
      </AnimatedSection>
    </main>
  );
};

export default Home;
