import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import PageMeta from '../components/PageMeta';
import StarfieldCanvas from '../components/about/StarfieldCanvas';
import './About.css';

// ============================================
// MARQUEE - Infinite scrolling text
// ============================================

const Marquee: React.FC<{ children: React.ReactNode; direction?: 'left' | 'right'; speed?: number }> = ({
  children,
  direction = 'left',
  speed = 30
}) => {
  return (
    <div className="marquee-wrapper">
      <div
        className="marquee-track"
        style={{
          animationDirection: direction === 'left' ? 'normal' : 'reverse',
          animationDuration: `${speed}s`
        }}
      >
        <span className="marquee-content">{children}</span>
        <span className="marquee-content">{children}</span>
        <span className="marquee-content">{children}</span>
      </div>
    </div>
  );
};

// ============================================
// SPLIT TEXT - Letter by letter animation
// ============================================

const SplitText: React.FC<{ text: string; className?: string; delay?: number }> = ({
  text,
  className = '',
  delay = 0
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <span ref={ref} className={`split-text ${className}`}>
      {text.split('').map((char, i) => (
        <motion.span
          key={i}
          className="split-char"
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{
            duration: 0.4,
            delay: delay + i * 0.03,
            ease: [0.215, 0.61, 0.355, 1]
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ))}
    </span>
  );
};

// ============================================
// PARALLAX TEXT - Text moving at different speeds
// ============================================

const ParallaxText: React.FC<{ children: React.ReactNode; speed?: number }> = ({ children, speed = 0.5 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start']
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, speed * 200]);

  return (
    <motion.div ref={ref} style={{ y }} className="parallax-text">
      {children}
    </motion.div>
  );
};

// ============================================
// COUNTER - Animated number
// ============================================

const Counter: React.FC<{ end: number; suffix?: string }> = ({ end, suffix = '' }) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const duration = 2000;
    const increment = end / (duration / 16);

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [isInView, end]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
};

// ============================================
// REVEAL LINE - Text that reveals on scroll
// ============================================

const RevealLine: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 0 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  return (
    <div ref={ref} className="reveal-line-wrapper">
      <motion.div
        className="reveal-line"
        initial={{ y: '100%' }}
        animate={isInView ? { y: 0 } : {}}
        transition={{ duration: 0.8, delay, ease: [0.215, 0.61, 0.355, 1] }}
      >
        {children}
      </motion.div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

const About: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { scrollY } = useScroll();
  const [scrollValue, setScrollValue] = useState(0);

  // Add dark-page class to body for header styling
  useEffect(() => {
    document.body.classList.add('dark-page');
    return () => {
      document.body.classList.remove('dark-page');
    };
  }, []);

  useEffect(() => {
    return scrollY.on('change', (v) => setScrollValue(v));
  }, [scrollY]);

  const heroRef = useRef<HTMLElement>(null);
  const isHeroInView = useInView(heroRef, { once: true });

  return (
    <main className="about-page">
      <PageMeta
        title={`${t('about.title')} ${t('about.titleHighlight')} – Alatyr Hosting`}
        description="Poznejte tým Alatyr Hosting."
        path="/about"
      />

      <StarfieldCanvas scrollY={scrollValue} />

      {/* HERO - Big Typography */}
      <section className="about-hero" ref={heroRef}>
        <motion.div
          className="hero-text"
          initial={{ opacity: 0 }}
          animate={isHeroInView ? { opacity: 1 } : {}}
          transition={{ duration: 1 }}
        >
          <div className="hero-line">
            <SplitText text="Jsme" className="hero-word" />
          </div>
          <div className="hero-line">
            <SplitText text="ALATYR" className="hero-word hero-highlight" delay={0.3} />
          </div>
          <div className="hero-line hero-sub">
            <motion.span
              initial={{ opacity: 0 }}
              animate={isHeroInView ? { opacity: 1 } : {}}
              transition={{ duration: 1, delay: 1.2 }}
            >
              Hosting bez kompromisů
            </motion.span>
          </div>
        </motion.div>

        <motion.div
          className="scroll-hint"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
        >
          <span>Scroll</span>
          <div className="scroll-line" />
        </motion.div>
      </section>

      {/* MARQUEE SECTION */}
      <section className="about-marquee">
        <Marquee speed={25}>
          SPOLEHLIVOST • INOVACE • RYCHLOST • PODPORA • BEZPEČNOST • VÝKON •
        </Marquee>
        <Marquee direction="right" speed={30}>
          99.9% UPTIME • SSD DISKY • 24/7 SUPPORT • SSL ZDARMA • ČESKÉ SERVERY •
        </Marquee>
      </section>

      {/* MANIFESTO SECTION */}
      <section className="about-manifesto">
        <div className="manifesto-content">
          <RevealLine>
            <h2>Věříme, že každý projekt</h2>
          </RevealLine>
          <RevealLine delay={0.1}>
            <h2>si zaslouží <em>spolehlivý základ.</em></h2>
          </RevealLine>
          <RevealLine delay={0.2}>
            <p className="manifesto-body">
              Od roku 2019 pomáháme firmám a jednotlivcům
              realizovat jejich vize. Nejsme jen hosting —
              jsme váš technologický partner.
            </p>
          </RevealLine>
        </div>
      </section>

      {/* STATS - Big Numbers */}
      <section className="about-stats">
        <div className="stat-row">
          <div className="stat-big">
            <span className="stat-number"><Counter end={5000} />+</span>
            <span className="stat-label">spokojených klientů</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-big">
            <span className="stat-number"><Counter end={99} />.9%</span>
            <span className="stat-label">uptime</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-big">
            <span className="stat-number"><Counter end={24} />/7</span>
            <span className="stat-label">podpora</span>
          </div>
        </div>
      </section>

      {/* STORY - Parallax Layers */}
      <section className="about-story">
        <ParallaxText speed={-0.3}>
          <span className="story-year">2019</span>
        </ParallaxText>

        <div className="story-content">
          <RevealLine>
            <h3>Začali jsme s jedním serverem</h3>
          </RevealLine>
          <RevealLine delay={0.1}>
            <h3>a velkým snem.</h3>
          </RevealLine>
        </div>

        <ParallaxText speed={0.2}>
          <span className="story-year faded">2024</span>
        </ParallaxText>

        <div className="story-content">
          <RevealLine>
            <h3>Dnes provozujeme stovky serverů</h3>
          </RevealLine>
          <RevealLine delay={0.1}>
            <h3>a tisíce spokojených zákazníků.</h3>
          </RevealLine>
        </div>
      </section>

      {/* VALUES - Horizontal Scroll Text */}
      <section className="about-values">
        <div className="values-header">
          <RevealLine>
            <h2>Naše hodnoty</h2>
          </RevealLine>
        </div>

        <div className="values-list">
          <motion.div
            className="value-item"
            initial={{ opacity: 0, x: -100 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <span className="value-number">01</span>
            <div className="value-text">
              <h4>Spolehlivost</h4>
              <p>Vaše weby běží. Vždy. Garantujeme 99.9% uptime.</p>
            </div>
          </motion.div>

          <motion.div
            className="value-item"
            initial={{ opacity: 0, x: 100 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <span className="value-number">02</span>
            <div className="value-text">
              <h4>Rychlost</h4>
              <p>SSD disky, optimalizované servery, bleskové načítání.</p>
            </div>
          </motion.div>

          <motion.div
            className="value-item"
            initial={{ opacity: 0, x: -100 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <span className="value-number">03</span>
            <div className="value-text">
              <h4>Podpora</h4>
              <p>Skuteční lidé, kteří rozumí technologiím. 24/7.</p>
            </div>
          </motion.div>

          <motion.div
            className="value-item"
            initial={{ opacity: 0, x: 100 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <span className="value-number">04</span>
            <div className="value-text">
              <h4>Bezpečnost</h4>
              <p>SSL certifikáty, firewall, denní zálohy. Vaše data jsou v bezpečí.</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* TEAM - Minimalist */}
      <section className="about-team">
        <Marquee speed={40}>
          JAN NOVÁK / CEO • PETR SVOBODA / CTO • MARIE DVOŘÁKOVÁ / SUPPORT • ANNA KRÁLOVÁ / DEV •
        </Marquee>

        <div className="team-statement">
          <RevealLine>
            <h2>Malý tým.</h2>
          </RevealLine>
          <RevealLine delay={0.1}>
            <h2>Velké ambice.</h2>
          </RevealLine>
        </div>
      </section>

      {/* CTA - Full Screen */}
      <section className="about-cta">
        <div className="cta-content">
          <RevealLine>
            <h2>Připraveni</h2>
          </RevealLine>
          <RevealLine delay={0.1}>
            <h2>na lepší hosting?</h2>
          </RevealLine>

          <motion.button
            className="cta-btn"
            onClick={() => navigate('/configurator')}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Začít teď
          </motion.button>
        </div>
      </section>
    </main>
  );
};

export default About;
