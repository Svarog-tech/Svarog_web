import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView, useAnimation } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRight,
  faCheck,
  faTerminal,
  faServer,
  faChartLine,
  faMicrochip,
  faMemory,
  faHdd,
  faShieldHalved,
  faGlobe,
  faClock,
  faLock,
  faRocket
} from '@fortawesome/free-solid-svg-icons';
import { useLanguage } from '../contexts/LanguageContext';
import HostingPlansNew from '../components/HostingPlansNew';
import PageMeta from '../components/PageMeta';
import './Home.css';

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 60 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

const fadeInLeft = {
  hidden: { opacity: 0, x: -60 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

const fadeInRight = {
  hidden: { opacity: 0, x: 60 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 }
  }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: "easeOut" } }
};

// Animated counter hook
const useCounter = (end: number, duration: number = 2000, suffix: string = '') => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  useEffect(() => {
    if (!isInView) return;
    let startTime: number;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [isInView, end, duration]);

  return { count: count + suffix, ref };
};

// Section wrapper with animation
const AnimatedSection: React.FC<{ children: React.ReactNode; className?: string; id?: string }> = ({
  children, className = '', id
}) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const controls = useAnimation();

  useEffect(() => {
    if (isInView) controls.start("visible");
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

// Terminal typing animation component
const commands = [
  'root@vps:~# sudo apt update',
  'root@vps:~# sudo systemctl status nginx',
  'root@vps:~# docker ps -a',
  'root@vps:~# htop'
];

const TerminalTyping: React.FC = () => {
  const [text, setText] = useState('');
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    const currentCommand = commands[lineIndex];
    let charIndex = 0;
    let timeoutId: NodeJS.Timeout;
    let isCancelled = false;

    const typeChar = () => {
      if (isCancelled) return;

      if (charIndex < currentCommand.length) {
        setText(currentCommand.slice(0, charIndex + 1));
        charIndex++;
        timeoutId = setTimeout(typeChar, 50 + Math.random() * 50);
      } else {
        timeoutId = setTimeout(() => {
          if (isCancelled) return;
          setLineIndex((prev) => (prev + 1) % commands.length);
          setText('');
        }, 2000);
      }
    };

    typeChar();

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [lineIndex]);

  return (
    <div className="terminal-line">
      <span className="terminal-text">{text}</span>
      <span className="terminal-cursor">|</span>
    </div>
  );
};

// Animated SVG Line Graph
const AnimatedGraph: React.FC = () => {
  return (
    <svg viewBox="0 0 400 100" className="analytics-graph">
      <defs>
        <linearGradient id="graphGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--primary-color)" />
          <stop offset="100%" stopColor="var(--accent-color)" />
        </linearGradient>
        <linearGradient id="graphFill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--primary-color)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--primary-color)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d="M0,80 Q50,60 100,65 T200,45 T300,55 T400,30"
        fill="none"
        stroke="url(#graphGradient)"
        strokeWidth="3"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2, ease: "easeOut" }}
      />
      <motion.path
        d="M0,80 Q50,60 100,65 T200,45 T300,55 T400,30 L400,100 L0,100 Z"
        fill="url(#graphFill)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.5 }}
      />
      {[
        { x: 0, y: 80 }, { x: 100, y: 65 }, { x: 200, y: 45 }, { x: 300, y: 55 }, { x: 400, y: 30 }
      ].map((point, i) => (
        <motion.circle
          key={i}
          cx={point.x}
          cy={point.y}
          r="5"
          fill="var(--primary-color)"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5 + i * 0.2 }}
        />
      ))}
    </svg>
  );
};

// Circular Progress Gauge
const CircularGauge: React.FC<{ value: number; label: string; color?: string }> = ({
  value, label, color = 'var(--primary-color)'
}) => {
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="circular-gauge">
      <svg viewBox="0 0 100 100" className="gauge-svg">
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="var(--border-light)"
          strokeWidth="8"
        />
        <motion.circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          whileInView={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          viewport={{ once: true }}
          style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
        />
      </svg>
      <div className="gauge-content">
        <span className="gauge-value">{value}%</span>
        <span className="gauge-label">{label}</span>
      </div>
    </div>
  );
};

// Server Visualization Component
const ServerVisualization: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="server-visual">
      <div className="server-rack">
        <div className="server-unit">
          <div className="server-leds">
            <span className="led led-green active"></span>
            <span className="led led-green active"></span>
            <span className="led led-blue"></span>
          </div>
          <div className="server-slots">
            <div className="slot"></div>
            <div className="slot"></div>
            <div className="slot active"></div>
          </div>
        </div>
        <div className="server-unit">
          <div className="server-leds">
            <span className="led led-green active"></span>
            <span className="led led-orange"></span>
            <span className="led led-blue active"></span>
          </div>
          <div className="server-slots">
            <div className="slot active"></div>
            <div className="slot"></div>
            <div className="slot active"></div>
          </div>
        </div>
        <div className="server-unit primary">
          <div className="server-leds">
            <span className="led led-green active pulse"></span>
            <span className="led led-green active"></span>
            <span className="led led-blue active"></span>
          </div>
          <div className="server-slots">
            <div className="slot active"></div>
            <div className="slot active"></div>
            <div className="slot active"></div>
          </div>
          <div className="server-label">{t('landing.server.yourVps')}</div>
        </div>
      </div>
      <div className="data-flow">
        <div className="flow-line"></div>
        <div className="flow-line"></div>
        <div className="flow-line"></div>
      </div>
      <div className="server-metrics">
        <div className="metric-bubble">
          <FontAwesomeIcon icon={faMicrochip} />
          <span>{t('landing.server.vcpu')}</span>
        </div>
        <div className="metric-bubble">
          <FontAwesomeIcon icon={faMemory} />
          <span>{t('landing.server.ram')}</span>
        </div>
        <div className="metric-bubble">
          <FontAwesomeIcon icon={faHdd} />
          <span>{t('landing.server.storage')}</span>
        </div>
      </div>
    </div>
  );
};

const Home: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Stats counters
  const uptimeCounter = useCounter(99, 2000, '.9%');
  const responseCounter = useCounter(45, 1500, 'ms');
  const controlCounter = useCounter(100, 2000, '%');
  const supportCounter = useCounter(24, 1500, '/7');

  const scrollToPlans = () => {
    const element = document.getElementById('hosting');
    if (element) {
      const offset = 80;
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' });
    }
  };

  const techStack = [
    { name: 'Docker', icon: '🐳' },
    { name: 'Node.js', icon: '⬢' },
    { name: 'Python', icon: '🐍' },
    { name: 'PHP', icon: '🐘' },
    { name: 'MySQL', icon: '🗄️' },
    { name: 'Redis', icon: '⚡' },
    { name: 'Nginx', icon: '🌐' },
    { name: 'Git', icon: '📦' }
  ];

  return (
    <main className="landing-page">
      <PageMeta
        title="Alatyr Hosting – Webhosting, domény a serverová řešení"
        description="Alatyr Hosting – profesionální webhosting, domény a serverová řešení. SSL zdarma, podpora 24/7, HestiaCP panel."
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
                <span>{t('landing.hero.badgeVps')}</span>
              </motion.div>

              <motion.h1 className="hero-main-title" variants={fadeInUp}>
                {t('landing.hero.title')}{' '}
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
              <ServerVisualization />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <AnimatedSection className="landing-stats-section">
        <div className="container">
          <div className="stats-grid">
            <motion.div className="stat-card" variants={scaleIn}>
              <span className="stat-number" ref={uptimeCounter.ref}>{uptimeCounter.count}</span>
              <span className="stat-label">{t('landing.stats.uptime')}</span>
            </motion.div>
            <motion.div className="stat-card" variants={scaleIn}>
              <span className="stat-number" ref={responseCounter.ref}>{responseCounter.count}</span>
              <span className="stat-label">{t('landing.stats.responseTime')}</span>
            </motion.div>
            <motion.div className="stat-card" variants={scaleIn}>
              <span className="stat-number" ref={controlCounter.ref}>{controlCounter.count}</span>
              <span className="stat-label">{t('landing.stats.fullControl')}</span>
            </motion.div>
            <motion.div className="stat-card" variants={scaleIn}>
              <span className="stat-number" ref={supportCounter.ref}>{supportCounter.count}</span>
              <span className="stat-label">{t('landing.stats.support')}</span>
            </motion.div>
          </div>
        </div>
      </AnimatedSection>

      {/* Analytics Dashboard Section */}
      <AnimatedSection className="analytics-section">
        <div className="container">
          <div className="analytics-layout">
            <motion.div className="analytics-intro" variants={fadeInLeft}>
              <span className="section-eyebrow">{t('landing.analytics.eyebrow')}</span>
              <h2 className="section-headline">
                {t('landing.analytics.title')}{' '}
                <span className="gradient-text-animated">{t('landing.analytics.titleHighlight')}</span>
              </h2>
              <p className="section-lead">
                {t('landing.analytics.description')}
              </p>
            </motion.div>

            <motion.div className="analytics-dashboard" variants={fadeInRight}>
              <div className="dashboard-window">
                <div className="window-header">
                  <div className="window-dots">
                    <span className="dot red"></span>
                    <span className="dot yellow"></span>
                    <span className="dot green"></span>
                  </div>
                  <div className="window-title">{t('landing.analytics.windowTitle')}</div>
                </div>
                <div className="dashboard-content">
                  <div className="dashboard-graph">
                    <div className="graph-header">
                      <span className="graph-title">{t('landing.analytics.trafficOverview')}</span>
                      <span className="graph-period">{t('landing.analytics.last24h')}</span>
                    </div>
                    <AnimatedGraph />
                  </div>
                  <div className="dashboard-gauges">
                    <CircularGauge value={72} label={t('landing.analytics.cpu')} color="var(--primary-color)" />
                    <CircularGauge value={58} label={t('landing.analytics.ram')} color="var(--accent-color)" />
                    <CircularGauge value={34} label={t('landing.analytics.disk')} color="var(--success-color)" />
                  </div>
                  <div className="dashboard-stats">
                    <div className="mini-stat">
                      <FontAwesomeIcon icon={faGlobe} />
                      <div className="mini-stat-info">
                        <span className="mini-stat-value">2,847</span>
                        <span className="mini-stat-label">{t('landing.analytics.activeVisitors')}</span>
                      </div>
                    </div>
                    <div className="mini-stat">
                      <FontAwesomeIcon icon={faChartLine} />
                      <div className="mini-stat-info">
                        <span className="mini-stat-value">1.2TB</span>
                        <span className="mini-stat-label">{t('landing.analytics.bandwidthUsed')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </AnimatedSection>

      {/* Terminal/Control Section */}
      <AnimatedSection className="terminal-section">
        <div className="container">
          <div className="terminal-layout">
            <motion.div className="terminal-visual" variants={fadeInLeft}>
              <div className="terminal-window">
                <div className="terminal-header">
                  <div className="window-dots">
                    <span className="dot red"></span>
                    <span className="dot yellow"></span>
                    <span className="dot green"></span>
                  </div>
                  <div className="terminal-title">
                    <FontAwesomeIcon icon={faTerminal} />
                    <span>root@your-vps ~ </span>
                  </div>
                </div>
                <div className="terminal-body">
                  <div className="terminal-output">
                    <span className="output-line success">{t('landing.terminal.connected')}</span>
                    <span className="output-line">{t('landing.terminal.welcome')}</span>
                    <span className="output-line muted">{t('landing.terminal.lastLogin')}</span>
                  </div>
                  <TerminalTyping />
                </div>
              </div>
            </motion.div>

            <motion.div className="terminal-info" variants={fadeInRight}>
              <span className="section-eyebrow">{t('landing.terminal.eyebrow')}</span>
              <h2 className="section-headline">
                {t('landing.terminal.title')}{' '}
                <span className="gradient-text-animated">{t('landing.terminal.titleHighlight')}</span>
              </h2>
              <p className="section-lead">
                {t('landing.terminal.description')}
              </p>
              <ul className="control-features">
                <li>
                  <FontAwesomeIcon icon={faTerminal} />
                  <div>
                    <strong>{t('landing.terminal.sshTitle')}</strong>
                    <span>{t('landing.terminal.sshDesc')}</span>
                  </div>
                </li>
                <li>
                  <FontAwesomeIcon icon={faLock} />
                  <div>
                    <strong>{t('landing.terminal.sudoTitle')}</strong>
                    <span>{t('landing.terminal.sudoDesc')}</span>
                  </div>
                </li>
                <li>
                  <FontAwesomeIcon icon={faServer} />
                  <div>
                    <strong>{t('landing.terminal.dedicatedTitle')}</strong>
                    <span>{t('landing.terminal.dedicatedDesc')}</span>
                  </div>
                </li>
              </ul>
            </motion.div>
          </div>
        </div>
      </AnimatedSection>

      {/* Technology Stack Section */}
      <AnimatedSection className="tech-stack-section">
        <div className="container">
          <motion.div className="tech-header" variants={fadeInUp}>
            <span className="section-eyebrow">{t('landing.techStack.eyebrow')}</span>
            <h2 className="section-headline">
              {t('landing.techStack.title')}{' '}
              <span className="gradient-text-animated">{t('landing.techStack.titleHighlight')}</span>
            </h2>
            <p className="section-lead">
              {t('landing.techStack.description')}
            </p>
          </motion.div>

          <div className="tech-orbit">
            {techStack.map((tech, index) => (
              <motion.div
                key={tech.name}
                className="tech-item"
                style={{
                  '--orbit-delay': `${index * -2}s`,
                  '--orbit-index': index
                } as React.CSSProperties}
                variants={scaleIn}
              >
                <span className="tech-icon">{tech.icon}</span>
                <span className="tech-name">{tech.name}</span>
              </motion.div>
            ))}
            <div className="tech-center">
              <FontAwesomeIcon icon={faRocket} />
              <span>{t('landing.techStack.center')}</span>
            </div>
          </div>
        </div>
      </AnimatedSection>

      {/* Hosting Plans */}
      <HostingPlansNew />

      {/* Trust/CTA Section */}
      <AnimatedSection className="landing-cta-section">
        <div className="container">
          <div className="cta-content">
            <motion.div className="cta-text" variants={fadeInLeft}>
              <FontAwesomeIcon icon={faShieldHalved} className="cta-shield" />
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
              <p className="cta-guarantee">
                <FontAwesomeIcon icon={faClock} />
                {t('landing.cta.guarantee')}
              </p>
            </motion.div>
          </div>
        </div>
      </AnimatedSection>
    </main>
  );
};

export default Home;
