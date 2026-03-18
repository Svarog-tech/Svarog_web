import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faRocket,
  faShieldHalved,
  faHeadset,
  faServer,
  faGlobe,
  faBolt,
  faHeart,
  faLightbulb,
  faHandshake,
  faChartLine,
  faArrowDown,
  faArrowRight,
} from '@fortawesome/free-solid-svg-icons';
import { useLanguage } from '../contexts/LanguageContext';
import PageMeta from '../components/PageMeta';
import StarfieldCanvas from '../components/about/StarfieldCanvas';
import './About.css';

// ============================================
// CONSTELLATION MAP - Interactive Star Network
// ============================================

interface ConstellationNode {
  id: string;
  x: number;
  y: number;
  icon: typeof faHeart;
  title: string;
  description: string;
}

const ConstellationMap: React.FC<{ t: (key: string) => string }> = ({ t }) => {
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [expandedNode, setExpandedNode] = useState<string | null>(null);

  const nodes: ConstellationNode[] = [
    { id: 'innovation', x: 20, y: 25, icon: faLightbulb, title: t('about.values.innovation.title') || 'Inovace', description: t('about.values.innovation.desc') || 'Neustále hledáme nové způsoby, jak zlepšit naše služby.' },
    { id: 'reliability', x: 80, y: 20, icon: faShieldHalved, title: t('about.values.reliability.title') || 'Spolehlivost', description: t('about.values.reliability.desc') || '99.9% uptime garantováno.' },
    { id: 'care', x: 50, y: 50, icon: faHeart, title: t('about.values.care.title') || 'Péče', description: t('about.values.care.desc') || 'Každý zákazník je pro nás prioritou.' },
    { id: 'growth', x: 15, y: 75, icon: faChartLine, title: t('about.values.growth.title') || 'Růst', description: t('about.values.growth.desc') || 'Rosteme společně s našimi klienty.' },
    { id: 'trust', x: 85, y: 70, icon: faHandshake, title: t('about.values.trust.title') || 'Důvěra', description: t('about.values.trust.desc') || 'Budujeme dlouhodobé vztahy.' },
  ];

  // Connection lines between nodes
  const connections = [
    ['innovation', 'care'],
    ['care', 'reliability'],
    ['care', 'growth'],
    ['care', 'trust'],
    ['growth', 'trust'],
    ['innovation', 'growth'],
    ['reliability', 'trust'],
  ];

  const getNodeById = (id: string) => nodes.find(n => n.id === id);

  return (
    <div className="constellation-container">
      <svg className="constellation-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#a855f7" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.3" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="0.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {connections.map(([fromId, toId], i) => {
          const from = getNodeById(fromId);
          const to = getNodeById(toId);
          if (!from || !to) return null;
          const isActive = activeNode === fromId || activeNode === toId;
          return (
            <motion.line
              key={i}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={isActive ? '#38bdf8' : 'url(#lineGradient)'}
              strokeWidth={isActive ? 0.4 : 0.2}
              filter="url(#glow)"
              initial={{ pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.5, delay: i * 0.1 }}
              viewport={{ once: true }}
              className={isActive ? 'line-active' : ''}
            />
          );
        })}
      </svg>

      {nodes.map((node, index) => (
        <motion.div
          key={node.id}
          className={`constellation-node ${activeNode === node.id ? 'active' : ''} ${expandedNode === node.id ? 'expanded' : ''}`}
          style={{ left: `${node.x}%`, top: `${node.y}%` }}
          initial={{ scale: 0, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 + index * 0.15 }}
          viewport={{ once: true }}
          onMouseEnter={() => setActiveNode(node.id)}
          onMouseLeave={() => setActiveNode(null)}
          onClick={() => setExpandedNode(expandedNode === node.id ? null : node.id)}
        >
          <div className="node-glow" />
          <div className="node-core">
            <FontAwesomeIcon icon={node.icon} />
          </div>
          <div className="node-label">{node.title}</div>

          {expandedNode === node.id && (
            <motion.div
              className="node-expanded"
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <p>{node.description}</p>
            </motion.div>
          )}
        </motion.div>
      ))}
    </div>
  );
};

// ============================================
// ORBITING SATELLITES - Services
// ============================================

interface Satellite {
  id: string;
  icon: typeof faServer;
  title: string;
  description: string;
  orbitRadius: number;
  orbitSpeed: number;
  startAngle: number;
}

const OrbitingServices: React.FC<{ t: (key: string) => string }> = ({ t }) => {
  const [selectedSatellite, setSelectedSatellite] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [angles, setAngles] = useState<Record<string, number>>({});

  const satellites: Satellite[] = [
    { id: 'hosting', icon: faServer, title: t('about.services.hosting') || 'Webhosting', description: t('about.services.hostingDesc') || 'Rychlý a spolehlivý hosting pro vaše projekty.', orbitRadius: 35, orbitSpeed: 0.3, startAngle: 0 },
    { id: 'security', icon: faShieldHalved, title: t('about.services.security') || 'Zabezpečení', description: t('about.services.securityDesc') || 'SSL certifikáty a ochrana před útoky.', orbitRadius: 35, orbitSpeed: 0.25, startAngle: 72 },
    { id: 'support', icon: faHeadset, title: t('about.services.support') || 'Podpora', description: t('about.services.supportDesc') || 'Technická podpora 24/7.', orbitRadius: 35, orbitSpeed: 0.35, startAngle: 144 },
    { id: 'domains', icon: faGlobe, title: t('about.services.domains') || 'Domény', description: t('about.services.domainsDesc') || 'Registrace a správa domén.', orbitRadius: 35, orbitSpeed: 0.28, startAngle: 216 },
    { id: 'performance', icon: faBolt, title: t('about.services.performance') || 'Výkon', description: t('about.services.performanceDesc') || 'SSD disky a optimalizovaný výkon.', orbitRadius: 35, orbitSpeed: 0.32, startAngle: 288 },
  ];

  // Initialize angles
  useEffect(() => {
    const initial: Record<string, number> = {};
    satellites.forEach(s => { initial[s.id] = s.startAngle; });
    setAngles(initial);
  }, []);

  // Animate orbits
  useEffect(() => {
    if (selectedSatellite) return; // Pause when something is selected

    const interval = setInterval(() => {
      setAngles(prev => {
        const next: Record<string, number> = {};
        satellites.forEach(s => {
          next[s.id] = (prev[s.id] || s.startAngle) + s.orbitSpeed;
        });
        return next;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [selectedSatellite]);

  return (
    <div className="orbit-container" ref={containerRef}>
      {/* Central planet */}
      <div className="central-planet">
        <div className="planet-glow" />
        <div className="planet-core">
          <span>Alatyr</span>
        </div>
        <div className="planet-ring" />
      </div>

      {/* Orbit paths */}
      <svg className="orbit-paths" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="35" fill="none" stroke="rgba(56, 189, 248, 0.1)" strokeWidth="0.3" strokeDasharray="2 2" />
      </svg>

      {/* Satellites */}
      {satellites.map((satellite) => {
        const angle = (angles[satellite.id] || satellite.startAngle) * (Math.PI / 180);
        const x = 50 + satellite.orbitRadius * Math.cos(angle);
        const y = 50 + satellite.orbitRadius * Math.sin(angle);
        const isSelected = selectedSatellite === satellite.id;

        return (
          <motion.div
            key={satellite.id}
            className={`satellite ${isSelected ? 'selected' : ''}`}
            style={{
              left: `${x}%`,
              top: `${y}%`,
            }}
            animate={isSelected ? { scale: 1.5, zIndex: 10 } : { scale: 1, zIndex: 1 }}
            onClick={() => setSelectedSatellite(isSelected ? null : satellite.id)}
          >
            <div className="satellite-trail" />
            <div className="satellite-body">
              <FontAwesomeIcon icon={satellite.icon} />
            </div>
            <span className="satellite-label">{satellite.title}</span>

            {isSelected && (
              <motion.div
                className="satellite-info"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <p>{satellite.description}</p>
              </motion.div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

// ============================================
// FLOATING CREW BADGES - Team
// ============================================

interface CrewMember {
  name: string;
  role: string;
  depth: number; // 0-1, affects parallax
}

const FloatingCrew: React.FC<{ scrollY: number; t: (key: string) => string }> = ({ scrollY, t }) => {
  const crew: CrewMember[] = [
    { name: t('about.team.member1.name') || 'Jan Novák', role: t('about.team.member1.role') || 'CEO', depth: 0.8 },
    { name: t('about.team.member2.name') || 'Petr Svoboda', role: t('about.team.member2.role') || 'CTO', depth: 0.5 },
    { name: t('about.team.member3.name') || 'Marie Dvořáková', role: t('about.team.member3.role') || 'Support Lead', depth: 0.3 },
    { name: t('about.team.member4.name') || 'Anna Králová', role: t('about.team.member4.role') || 'Developer', depth: 0.6 },
  ];

  const positions = [
    { x: 15, y: 30 },
    { x: 75, y: 25 },
    { x: 25, y: 70 },
    { x: 70, y: 65 },
  ];

  return (
    <div className="crew-container">
      {crew.map((member, index) => {
        const pos = positions[index];
        const parallaxY = scrollY * member.depth * 0.1;

        return (
          <motion.div
            key={index}
            className="crew-badge"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transform: `translateY(${-parallaxY}px)`,
            }}
            initial={{ opacity: 0, scale: 0 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: index * 0.15 }}
            viewport={{ once: true }}
            whileHover={{ rotateY: 15, scale: 1.1 }}
          >
            <div className="badge-glow" style={{ opacity: 0.3 + member.depth * 0.4 }} />
            <div className="badge-avatar">
              {member.name.charAt(0)}
            </div>
            <div className="badge-info">
              <span className="badge-name">{member.name}</span>
              <span className="badge-role">{member.role}</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

// ============================================
// WORMHOLE PORTAL - CTA
// ============================================

const WormholePortal: React.FC<{ onNavigate: (path: string) => void; t: (key: string) => string }> = ({ onNavigate, t }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

  const handleClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setRipples(prev => [...prev, { id: Date.now(), x, y }]);
    setTimeout(() => onNavigate('/configurator'), 400);
  };

  return (
    <div className="wormhole-container">
      <div className={`wormhole ${isHovered ? 'hovered' : ''}`}>
        <div className="wormhole-ring ring-1" />
        <div className="wormhole-ring ring-2" />
        <div className="wormhole-ring ring-3" />
        <div className="wormhole-core" />
        <div className="wormhole-particles" />
      </div>

      <motion.button
        className="portal-cta"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <span>{t('about.cta.button') || 'Začít cestu'}</span>
        <FontAwesomeIcon icon={faRocket} />
        {ripples.map(ripple => (
          <span
            key={ripple.id}
            className="ripple"
            style={{ left: ripple.x, top: ripple.y }}
            onAnimationEnd={() => setRipples(prev => prev.filter(r => r.id !== ripple.id))}
          />
        ))}
      </motion.button>

      <p className="portal-subtitle">{t('about.cta.description') || 'Připojte se k tisícům spokojených zákazníků'}</p>
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

  // Track scroll for parallax
  useEffect(() => {
    return scrollY.on('change', (v) => setScrollValue(v));
  }, [scrollY]);

  const heroRef = useRef<HTMLElement>(null);
  const heroInView = useInView(heroRef, { once: true });

  return (
    <main className="about-page cosmic">
      <PageMeta
        title={`${t('about.title')} ${t('about.titleHighlight')} – Alatyr Hosting`}
        description="Poznejte tým Alatyr Hosting. Profesionální webhosting s důrazem na spolehlivost, inovace a zákaznickou podporu."
        path="/about"
      />

      {/* Starfield Background */}
      <StarfieldCanvas scrollY={scrollValue} />

      {/* SECTION 1: Hero - Enter the Universe */}
      <section className="cosmic-section hero" ref={heroRef}>
        <motion.div
          className="hero-content"
          initial={{ opacity: 0 }}
          animate={heroInView ? { opacity: 1 } : {}}
          transition={{ duration: 1 }}
        >
          <motion.h1
            className="hero-title"
            initial={{ opacity: 0, y: 50 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <span className="glow-text">{t('about.title') || 'Poznejte'}</span>
            <span className="gradient-text"> {t('about.titleHighlight') || 'Alatyr'}</span>
          </motion.h1>

          <motion.p
            className="hero-tagline"
            initial={{ opacity: 0 }}
            animate={heroInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            {t('about.description') || 'Vaše cesta k dokonalému hostingu začíná zde'}
          </motion.p>

          <motion.div
            className="scroll-indicator"
            initial={{ opacity: 0 }}
            animate={heroInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.5, delay: 1.2 }}
          >
            <span>{t('about.scroll') || 'Prozkoumejte'}</span>
            <FontAwesomeIcon icon={faArrowDown} className="bounce" />
          </motion.div>
        </motion.div>
      </section>

      {/* SECTION 2: Origin Story - Timeline */}
      <section className="cosmic-section story">
        <div className="section-content">
          <motion.h2
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <span className="glow-text">{t('about.story.sectionTitle') || 'Náš příběh'}</span>
          </motion.h2>

          <div className="timeline-orbital">
            {[
              { year: '2019', title: t('about.timeline.2019.title') || 'Zrození', desc: t('about.timeline.2019.desc') || 'Alatyr byl založen s vizí změnit hosting.' },
              { year: '2021', title: t('about.timeline.2021.title') || 'Růst', desc: t('about.timeline.2021.desc') || 'Překonali jsme 1000 spokojených zákazníků.' },
              { year: '2024', title: t('about.timeline.2024.title') || 'Inovace', desc: t('about.timeline.2024.desc') || 'Spuštění nové generace služeb.' },
            ].map((milestone, index) => (
              <motion.div
                key={index}
                className="timeline-node"
                initial={{ opacity: 0, scale: 0 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
                viewport={{ once: true }}
              >
                <div className="node-year">{milestone.year}</div>
                <div className="node-planet" />
                <div className="node-content">
                  <h3>{milestone.title}</h3>
                  <p>{milestone.desc}</p>
                </div>
              </motion.div>
            ))}
            <svg className="timeline-path" viewBox="0 0 100 20">
              <motion.path
                d="M0,10 Q25,5 50,10 T100,10"
                fill="none"
                stroke="url(#timelineGradient)"
                strokeWidth="0.5"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                transition={{ duration: 1.5 }}
                viewport={{ once: true }}
              />
              <defs>
                <linearGradient id="timelineGradient">
                  <stop offset="0%" stopColor="#4c1d95" />
                  <stop offset="50%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </section>

      {/* SECTION 3: Values - Constellation */}
      <section className="cosmic-section values">
        <div className="section-content">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <span className="glow-text">{t('about.values.sectionTitle') || 'Naše hodnoty'}</span>
          </motion.h2>
          <motion.p
            className="section-subtitle"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
          >
            {t('about.values.subtitle') || 'Klikněte na hvězdu pro více informací'}
          </motion.p>

          <ConstellationMap t={t} />
        </div>
      </section>

      {/* SECTION 4: Services - Orbiting Satellites */}
      <section className="cosmic-section services">
        <div className="section-content">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <span className="glow-text">{t('about.services.sectionTitle') || 'Naše služby'}</span>
          </motion.h2>
          <motion.p
            className="section-subtitle"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
          >
            {t('about.services.subtitle') || 'Klikněte na satelit pro detaily'}
          </motion.p>

          <OrbitingServices t={t} />
        </div>
      </section>

      {/* SECTION 5: Team - Floating Crew */}
      <section className="cosmic-section team">
        <div className="section-content">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <span className="glow-text">{t('about.team.sectionTitle') || 'Náš tým'}</span>
          </motion.h2>

          <FloatingCrew scrollY={scrollValue} t={t} />
        </div>
      </section>

      {/* SECTION 6: CTA - Wormhole Portal */}
      <section className="cosmic-section cta">
        <div className="section-content">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <span className="glow-text">{t('about.cta.title') || 'Připraveni vstoupit?'}</span>
          </motion.h2>

          <WormholePortal onNavigate={navigate} t={t} />
        </div>
      </section>
    </main>
  );
};

export default About;
