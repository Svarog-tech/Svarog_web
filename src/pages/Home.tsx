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
  faShieldHalved,
  faGlobe,
  faClock,
  faLock,
  faRocket
} from '@fortawesome/free-solid-svg-icons';
import { useLanguage } from '../contexts/LanguageContext';
import HostingPlansNew from '../components/HostingPlansNew';
import PageMeta from '../components/PageMeta';
import { JsonLd } from '../components/JsonLd';
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

// Server Visualization Component — Pure CSS 3D
const ServerVisualization: React.FC = () => (
  <div className="sv-scene">
    <div className="sv-tower">
      {/* Front face */}
      <div className="sv-face sv-front">
        <div className="sv-accent sv-accent-top"></div>
        {/* Glass window */}
        <div className="sv-glass">
          <div className="sv-traces">
            {[...Array(5)].map((_, i) => <div key={i} className="sv-trace" />)}
          </div>
          <div className="sv-chips">
            <div className="sv-chip" />
            <div className="sv-chip" />
            <div className="sv-chip sv-chip-lg" />
          </div>
          <div className="sv-glow-internal" />
        </div>
        {/* Drive bays */}
        <div className="sv-section">
          <div className="sv-sep" />
          <div className="sv-drives">
            {[...Array(8)].map((_, i) => (
              <div key={i} className={`sv-drive ${i < 6 ? 'active' : ''}`}>
                <div className="sv-drive-handle" />
                {i < 6 && <div className="sv-drive-led" />}
              </div>
            ))}
          </div>
        </div>
        {/* Network ports */}
        <div className="sv-section">
          <div className="sv-sep" />
          <div className="sv-ports">
            {[...Array(8)].map((_, i) => (
              <div key={i} className={`sv-port ${i < 5 ? 'linked' : ''}`}>
                <div className="sv-port-led" />
              </div>
            ))}
          </div>
        </div>
        {/* OLED display */}
        <div className="sv-section">
          <div className="sv-sep" />
          <div className="sv-oled">
            <div className="sv-oled-bars">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="sv-oled-bar" style={{ animationDelay: `${i * 0.12}s` }} />
              ))}
            </div>
            <div className="sv-oled-text">
              <div className="sv-oled-line w60" />
              <div className="sv-oled-line w40" />
              <div className="sv-oled-line w75" />
            </div>
          </div>
        </div>
        {/* Power area */}
        <div className="sv-section sv-power-area">
          <div className="sv-sep" />
          <div className="sv-power-row">
            <div className="sv-power-btn"><div className="sv-power-ring" /></div>
            <div className="sv-power-leds">
              {[...Array(6)].map((_, i) => (
                <div key={i} className={`sv-pwr-led ${i < 4 ? 'on' : ''}`} />
              ))}
            </div>
          </div>
        </div>
        <div className="sv-accent sv-accent-bottom"></div>
        <div className="sv-accent sv-accent-left"></div>
        <div className="sv-accent sv-accent-right"></div>
      </div>

      {/* Right face */}
      <div className="sv-face sv-right">
        <div className="sv-vents">
          {[...Array(18)].map((_, i) => <div key={i} className="sv-vent" />)}
        </div>
        <div className="sv-fans">
          <div className="sv-fan"><div className="sv-fan-inner" /></div>
          <div className="sv-fan"><div className="sv-fan-inner" /></div>
          <div className="sv-fan"><div className="sv-fan-inner" /></div>
        </div>
      </div>

      {/* Top face */}
      <div className="sv-face sv-top">
        <div className="sv-top-vents">
          {[...Array(6)].map((_, i) => <div key={i} className="sv-top-vent" />)}
        </div>
      </div>
    </div>
    {/* Orbit rings */}
    <div className="sv-ring sv-ring-1" />
    <div className="sv-ring sv-ring-2" />
    {/* Reflection */}
    <div className="sv-reflection" />
  </div>
);

const Home: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const scrollToPlans = () => {
    const element = document.getElementById('hosting');
    if (element) {
      const offset = 80;
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' });
    }
  };

  // Tech stack with code editor integration
  const techStack = [
    { id: 'docker', name: 'Docker', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-original.svg', color: '#2496ED', desc: 'Containers', lineNum: 3 },
    { id: 'nodejs', name: 'Node.js', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg', color: '#339933', desc: 'Runtime', lineNum: 4 },
    { id: 'python', name: 'Python', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg', color: '#3776AB', desc: 'Backend', lineNum: 5 },
    { id: 'php', name: 'PHP', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/php/php-original.svg', color: '#777BB4', desc: 'Web', lineNum: 6 },
    { id: 'mysql', name: 'MySQL', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mysql/mysql-original.svg', color: '#4479A1', desc: 'Database', lineNum: 7 },
    { id: 'redis', name: 'Redis', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/redis/redis-original.svg', color: '#DC382D', desc: 'Cache', lineNum: 8 },
    { id: 'nginx', name: 'Nginx', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nginx/nginx-original.svg', color: '#009639', desc: 'Server', lineNum: 9 },
    { id: 'git', name: 'Git', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/git/git-original.svg', color: '#F05032', desc: 'Version', lineNum: 10 }
  ];

  // Code lines for the editor
  const codeLines = [
    { num: 1, code: '// server.config.ts', type: 'comment' },
    { num: 2, code: '', type: 'empty' },
    { num: 3, code: "import { Container } from 'dockerode';", techId: 'docker' },
    { num: 4, code: "const express = require('express');", techId: 'nodejs' },
    { num: 5, code: "from flask import Flask, request", techId: 'python' },
    { num: 6, code: "use Illuminate\\Support\\Facades\\Route;", techId: 'php' },
    { num: 7, code: "import mysql from 'mysql2/promise';", techId: 'mysql' },
    { num: 8, code: "import Redis from 'ioredis';", techId: 'redis' },
    { num: 9, code: "server { listen 80; server_name _; }", techId: 'nginx' },
    { num: 10, code: "git clone https://github.com/you/app", techId: 'git' },
    { num: 11, code: '', type: 'empty' },
    { num: 12, code: '// Deploy on your VPS', type: 'comment' }
  ];

  // State for code editor interaction
  const [activeTech, setActiveTech] = useState<string | null>(null);
  const [visibleLines, setVisibleLines] = useState(0);
  const [isTypingDone, setIsTypingDone] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const isEditorInView = useInView(editorRef, { once: true, margin: "-100px" });

  // Typing animation effect
  useEffect(() => {
    if (!isEditorInView) return;

    let currentLine = 0;
    const totalLines = codeLines.length;

    const interval = setInterval(() => {
      currentLine++;
      setVisibleLines(currentLine);

      if (currentLine >= totalLines) {
        clearInterval(interval);
        setIsTypingDone(true);
      }
    }, 120);

    return () => clearInterval(interval);
  }, [isEditorInView]);

  return (
    <main className="landing-page">
      <PageMeta
        title="Alatyr Hosting – Webhosting, domény a serverová řešení"
        description="Alatyr Hosting – profesionální webhosting, domény a serverová řešení. SSL zdarma, podpora 24/7, HestiaCP panel."
        path="/"
        breadcrumbs={[
          { name: 'Alatyr Hosting', url: '/' }
        ]}
      />
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Alatyr Hosting',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://alatyrhosting.eu',
        logo: 'https://alatyrhosting.eu/alatyrlogo-removebg-preview.png',
        description: 'Profesionální webhosting s HestiaCP panelem. Rychlé SSD servery, SSL certifikáty zdarma, 24/7 podpora.',
        contactPoint: {
          '@type': 'ContactPoint',
          email: 'info@alatyrhosting.eu',
          contactType: 'customer service',
          availableLanguage: ['cs', 'en']
        }
      }} />
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Alatyr Hosting',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://alatyrhosting.eu',
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: 'https://alatyrhosting.eu/services?q={search_term_string}'
          },
          'query-input': 'required name=search_term_string'
        }
      }} />

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="hero-background">
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

      {/* Technology Stack Section - Interactive Code Editor */}
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

          <div className="code-editor-stack" ref={editorRef}>
            {/* Code Editor Window */}
            <motion.div
              className="editor-window"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              {/* Title Bar */}
              <div className="editor-titlebar">
                <div className="window-controls">
                  <span className="control close"></span>
                  <span className="control minimize"></span>
                  <span className="control maximize"></span>
                </div>
                <div className="editor-filename">
                  <span className="file-icon">📄</span>
                  <span>server.config.ts</span>
                </div>
                <div className="editor-tabs">
                  <span className="tab active">config</span>
                </div>
              </div>

              {/* Editor Body */}
              <div className="editor-body">
                <div className="line-numbers">
                  {codeLines.slice(0, visibleLines).map((line) => (
                    <span
                      key={line.num}
                      className={activeTech && line.techId === activeTech ? 'highlighted' : ''}
                    >
                      {line.num}
                    </span>
                  ))}
                </div>

                <div className="code-content">
                  {codeLines.slice(0, visibleLines).map((line) => (
                    <motion.div
                      key={line.num}
                      className={`code-line ${line.type || ''} ${activeTech && line.techId === activeTech ? 'highlighted' : ''}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.15 }}
                    >
                      {line.type === 'comment' && (
                        <span className="syntax-comment">{line.code}</span>
                      )}
                      {line.type === 'empty' && <span>&nbsp;</span>}
                      {line.techId && (
                        <span className="syntax-code">
                          {line.code.includes('import') && (
                            <>
                              <span className="syntax-keyword">import</span>
                              <span className="syntax-default">{line.code.replace('import', '')}</span>
                            </>
                          )}
                          {line.code.includes('const') && (
                            <>
                              <span className="syntax-keyword">const</span>
                              <span className="syntax-default">{line.code.replace('const', '')}</span>
                            </>
                          )}
                          {line.code.includes('from ') && !line.code.includes('import') && (
                            <>
                              <span className="syntax-keyword">from</span>
                              <span className="syntax-default">{line.code.replace('from', '')}</span>
                            </>
                          )}
                          {line.code.includes('use ') && (
                            <>
                              <span className="syntax-keyword">use</span>
                              <span className="syntax-default">{line.code.replace('use', '')}</span>
                            </>
                          )}
                          {line.code.includes('server {') && (
                            <>
                              <span className="syntax-keyword">server</span>
                              <span className="syntax-bracket">{' {'}</span>
                              <span className="syntax-default"> listen 80; server_name _; </span>
                              <span className="syntax-bracket">{'}'}</span>
                            </>
                          )}
                          {line.code.includes('git clone') && (
                            <>
                              <span className="syntax-function">git</span>
                              <span className="syntax-default"> clone </span>
                              <span className="syntax-string">https://github.com/you/app</span>
                            </>
                          )}
                        </span>
                      )}
                    </motion.div>
                  ))}
                  {!isTypingDone && (
                    <span className="editor-cursor">|</span>
                  )}
                </div>
              </div>

              {/* Status Bar */}
              <div className="editor-statusbar">
                <span className="status-item">TypeScript</span>
                <span className="status-item">UTF-8</span>
                <span className="status-item">Ln {visibleLines}, Col 1</span>
              </div>
            </motion.div>

            {/* Tech Cards Sidebar */}
            <motion.div
              className="tech-sidebar"
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              {techStack.map((tech, index) => (
                <motion.button
                  key={tech.id}
                  className={`tech-card ${activeTech === tech.id ? 'active' : ''}`}
                  onMouseEnter={() => setActiveTech(tech.id)}
                  onMouseLeave={() => setActiveTech(null)}
                  onClick={() => setActiveTech(activeTech === tech.id ? null : tech.id)}
                  style={{ '--tech-color': tech.color } as React.CSSProperties}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 + 0.3 }}
                  whileHover={{ x: -4 }}
                  aria-label={`${tech.name} - ${tech.desc}`}
                  aria-pressed={activeTech === tech.id}
                >
                  <div className="tech-icon">
                    <img src={tech.logo} alt={tech.name} loading="lazy" />
                  </div>
                  <div className="tech-info">
                    <span className="tech-name">{tech.name}</span>
                    <span className="tech-desc">{tech.desc}</span>
                  </div>
                </motion.button>
              ))}
            </motion.div>
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
