import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faShieldHalved,
  faArrowLeft,
  faCheckCircle,
  faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';
import PageMeta from '../components/PageMeta';
import { useLanguage } from '../contexts/LanguageContext';
import './AMLPolicy.css';

const AMLPolicy: React.FC = () => {
  const { language } = useLanguage();
  const isCs = language === 'cs';

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const sections = isCs
    ? [
        { id: 'section-1', title: 'Účel politiky' },
        { id: 'section-2', title: 'Rozsah působnosti' },
        { id: 'section-3', title: 'Rizikové aktivity' },
        { id: 'section-4', title: 'Postupy při podezření na zneužití' },
        { id: 'section-5', title: 'Povinnosti Zákazníků' }
      ]
    : [
        { id: 'section-1', title: 'Purpose of this policy' },
        { id: 'section-2', title: 'Scope' },
        { id: 'section-3', title: 'Risk activities' },
        { id: 'section-4', title: 'Procedures in case of suspicion' },
        { id: 'section-5', title: 'Customer obligations' }
      ];

  return (
    <main className="aml-page">
      <PageMeta
        title={
          isCs
            ? 'Zásady proti praní špinavých peněz (AML) – Alatyr Hosting'
            : 'Anti-Money Laundering Policy (AML) – Alatyr Hosting'
        }
        description={
          isCs
            ? 'Zásady prevence praní špinavých peněz (AML) společnosti Alatyr Hosting.'
            : 'Anti-money laundering (AML) policy of Alatyr Hosting.'
        }
        path="/aml"
      />

      {/* Hero Section */}
      <section className="aml-hero">
        <div className="container">
          <motion.div
            className="aml-hero-content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="aml-icon-wrapper">
              <FontAwesomeIcon icon={faShieldHalved} className="aml-icon" />
            </div>

            <h1>
              {isCs ? (
                <>
                  <span className="gradient-text">Anti-Money Laundering</span>
                  <br />
                  Policy
                </>
              ) : (
                <>
                  <span className="gradient-text">Anti-Money Laundering</span>
                  <br />
                  Policy
                </>
              )}
            </h1>

            <p className="aml-subtitle">
              {isCs
                ? 'Náš závazek k transparentnosti a prevenci praní špinavých peněz'
                : 'Our commitment to transparency and prevention of money laundering'}
            </p>

            <p className="aml-updated">
              {isCs ? 'Naposledy aktualizováno: únor 2026' : 'Last updated: February 2026'}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Table of Contents */}
      <section className="aml-toc-section">
        <div className="container">
          <motion.div
            className="aml-toc"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2>{isCs ? 'Obsah' : 'Table of Contents'}</h2>
            <ul className="toc-list">
              {sections.map((section, index) => (
                <li
                  key={section.id}
                  className="toc-item"
                  onClick={() => scrollToSection(section.id)}
                >
                  <span className="toc-number">{String(index + 1).padStart(2, '0')}</span>
                  <span className="toc-title">{section.title}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </section>

      {/* Content Section */}
      <section className="aml-content-section">
        <div className="container">
          <div className="aml-content">
            {isCs ? (
              <>
                {/* Section 1 */}
                <motion.div
                  id="section-1"
                  className="content-section"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.5 }}
                >
                  <h2>1. Účel politiky</h2>
                  <p>
                    Tato AML politika stanovuje základní principy a postupy, kterými Alatyr Hosting, Náves 73,
                    664 08 Blažovice, Česká republika, ID: 09992961, Non-VAT payer (dále jen „Společnost")
                    předchází zneužití svých služeb k praní špinavých peněz, financování terorismu a dalším
                    nezákonným aktivitám.
                  </p>

                  <div className="highlight-card">
                    <FontAwesomeIcon icon={faCheckCircle} className="highlight-icon" />
                    <h3>Náš závazek</h3>
                    <p>
                      Zavazujeme se udržovat nejvyšší standardy prevence praní špinavých peněz a chránit
                      integritu finančního systému prostřednictvím odpovědného podnikání.
                    </p>
                  </div>
                </motion.div>

                {/* Section 2 */}
                <motion.div
                  id="section-2"
                  className="content-section"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.5 }}
                >
                  <h2>2. Rozsah působnosti</h2>
                  <p>
                    Politika se vztahuje na všechny služby poskytované Společností, zejména na webhostingové a
                    související služby, a na všechny uživatele těchto služeb. Zákazník souhlasem s podmínkami
                    používání potvrzuje, že tuto AML politiku respektuje.
                  </p>
                </motion.div>

                {/* Section 3 */}
                <motion.div
                  id="section-3"
                  className="content-section"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.5 }}
                >
                  <h2>3. Rizikové aktivity</h2>
                  <p>Za rizikové aktivity jsou považovány zejména:</p>
                  <ul className="risk-list">
                    <li>používání odcizených nebo anonymních platebních údajů</li>
                    <li>provozování podvodných nebo phishingových webů</li>
                    <li>zneužití služeb k distribuci nelegálního obsahu nebo k zakrývání původu finančních prostředků</li>
                  </ul>

                  <div className="warning-card">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="warning-icon" />
                    <h3>Důležité upozornění</h3>
                    <p>
                      Jakákoliv podezřelá aktivita může vést k okamžitému pozastavení služeb a spolupráci
                      s příslušnými orgány. Respektujte prosím tyto směrnice pro zajištění bezproblémového poskytování služeb.
                    </p>
                  </div>
                </motion.div>

                {/* Section 4 */}
                <motion.div
                  id="section-4"
                  className="content-section"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.5 }}
                >
                  <h2>4. Postupy při podezření na zneužití</h2>
                  <p>V případě důvodného podezření na zneužití služeb je Společnost oprávněna:</p>
                  <ul className="procedures-list">
                    <li>dočasně pozastavit nebo omezit poskytování služby</li>
                    <li>vyžádat si od Zákazníka doplňující informace</li>
                    <li>spolupracovat s příslušnými orgány veřejné moci dle platných právních předpisů</li>
                  </ul>
                </motion.div>

                {/* Section 5 */}
                <motion.div
                  id="section-5"
                  className="content-section"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.5 }}
                >
                  <h2>5. Povinnosti Zákazníků</h2>
                  <p>Zákazníci se zavazují:</p>
                  <ul className="obligations-list">
                    <li>využívat služby Společnosti výhradně k legálním účelům</li>
                    <li>na vyžádání poskytnout vysvětlení nebo podklady nezbytné k objasnění podezřelých transakcí nebo aktivit</li>
                  </ul>
                </motion.div>
              </>
            ) : (
              <>
                {/* Section 1 - English */}
                <motion.div
                  id="section-1"
                  className="content-section"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.5 }}
                >
                  <h2>1. Purpose of this policy</h2>
                  <p>
                    This AML Policy defines the basic principles and procedures by which Alatyr Hosting, Náves 73,
                    664 08 Blažovice, Czech Republic, ID: 09992961, Non-VAT payer (the "Company") prevents the misuse
                    of its services for money laundering, terrorist financing and other illegal activities.
                  </p>

                  <div className="highlight-card">
                    <FontAwesomeIcon icon={faCheckCircle} className="highlight-icon" />
                    <h3>Our Commitment</h3>
                    <p>
                      We are committed to maintaining the highest standards of anti-money laundering prevention and
                      protecting the integrity of the financial system through responsible business practices.
                    </p>
                  </div>
                </motion.div>

                {/* Section 2 - English */}
                <motion.div
                  id="section-2"
                  className="content-section"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.5 }}
                >
                  <h2>2. Scope</h2>
                  <p>
                    This policy applies to all services provided by the Company, in particular web hosting and related
                    services, and to all users of these services. By accepting the terms of use, the Customer confirms
                    that they respect this AML Policy.
                  </p>
                </motion.div>

                {/* Section 3 - English */}
                <motion.div
                  id="section-3"
                  className="content-section"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.5 }}
                >
                  <h2>3. Risk activities</h2>
                  <p>Risk activities include in particular:</p>
                  <ul className="risk-list">
                    <li>using stolen or anonymous payment details</li>
                    <li>operating fraudulent or phishing websites</li>
                    <li>abusing the services to distribute illegal content or to conceal the origin of funds</li>
                  </ul>

                  <div className="warning-card">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="warning-icon" />
                    <h3>Important Notice</h3>
                    <p>
                      Any suspicious activity may result in immediate service suspension and cooperation with
                      relevant authorities. Please respect these guidelines to ensure uninterrupted service delivery.
                    </p>
                  </div>
                </motion.div>

                {/* Section 4 - English */}
                <motion.div
                  id="section-4"
                  className="content-section"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.5 }}
                >
                  <h2>4. Procedures in case of suspicion</h2>
                  <p>In case of reasonable suspicion of misuse of the services, the Company may:</p>
                  <ul className="procedures-list">
                    <li>temporarily suspend or limit the service</li>
                    <li>request additional information from the Customer</li>
                    <li>cooperate with competent authorities in accordance with applicable law</li>
                  </ul>
                </motion.div>

                {/* Section 5 - English */}
                <motion.div
                  id="section-5"
                  className="content-section"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.5 }}
                >
                  <h2>5. Customer obligations</h2>
                  <p>Customers undertake to:</p>
                  <ul className="obligations-list">
                    <li>use the Company&apos;s services only for lawful purposes</li>
                    <li>upon request, provide explanations or documents necessary to clarify suspicious transactions or activities</li>
                  </ul>
                </motion.div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Company Info */}
      <section className="company-info-section">
        <div className="container">
          <div className="company-info">
            <h2>Alatyr Hosting</h2>
            <p>Náves 73, 664 08 Blažovice, Czech Republic</p>
            <p>ID: 09992961 | Non-VAT payer</p>
          </div>
        </div>
      </section>

      {/* Back Link */}
      <section className="aml-footer">
        <div className="container">
          <Link to="/" className="back-link">
            <FontAwesomeIcon icon={faArrowLeft} />
            {isCs ? 'Zpět na úvodní stránku' : 'Back to homepage'}
          </Link>
        </div>
      </section>
    </main>
  );
};

export default AMLPolicy;
