import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUp, faArrowLeft, faFileContract } from '@fortawesome/free-solid-svg-icons';
import PageMeta from '../components/PageMeta';
import { useLanguage } from '../contexts/LanguageContext';
import './Terms.css';

const Terms: React.FC = () => {
  const { language } = useLanguage();
  const isCs = language === 'cs';
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' });
    }
  };

  const sections = isCs
    ? [
        { id: 'section-1', number: '1', title: 'Úvodní ustanovení' },
        { id: 'section-2', number: '2', title: 'Uzavření smlouvy' },
        { id: 'section-3', number: '3', title: 'Cena a platby' },
        { id: 'section-4', number: '4', title: 'Práva a povinnosti Zákazníka' },
        { id: 'section-5', number: '5', title: 'Práva a povinnosti Poskytovatele' },
        { id: 'section-6', number: '6', title: 'Odpovědnost a omezení odpovědnosti' },
        { id: 'section-7', number: '7', title: 'Doba trvání a ukončení smlouvy' },
        { id: 'section-8', number: '8', title: 'Rozhodné právo a řešení sporů' },
      ]
    : [
        { id: 'section-1', number: '1', title: 'Introduction' },
        { id: 'section-2', number: '2', title: 'Formation of the contract' },
        { id: 'section-3', number: '3', title: 'Price and payments' },
        { id: 'section-4', number: '4', title: 'Customer rights and obligations' },
        { id: 'section-5', number: '5', title: 'Provider rights and obligations' },
        { id: 'section-6', number: '6', title: 'Liability and limitation of liability' },
        { id: 'section-7', number: '7', title: 'Term and termination' },
        { id: 'section-8', number: '8', title: 'Governing law and disputes' },
      ];

  return (
    <main className="terms-page">
      <PageMeta
        title={isCs ? 'Všeobecné smluvní podmínky – Alatyr Hosting' : 'General Terms and Conditions – Alatyr Hosting'}
        description={
          isCs
            ? 'Všeobecné smluvní podmínky poskytování služeb Alatyr Hosting.'
            : 'General terms and conditions for services provided by Alatyr Hosting.'
        }
        path="/terms"
      />

      {/* Hero Section */}
      <section className="terms-hero">
        <div className="container">
          <motion.div
            className="terms-hero-content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="terms-icon-wrapper">
              <FontAwesomeIcon icon={faFileContract} className="terms-icon" />
            </div>

            <h1>
              <span className="gradient-text">
                {isCs ? 'Všeobecné smluvní podmínky' : 'Terms of Service'}
              </span>
            </h1>

            <p className="terms-subtitle">
              {isCs
                ? 'Pravidla poskytování služeb Alatyr Hosting'
                : 'Rules for providing Alatyr Hosting services'}
            </p>

            <p className="terms-updated">
              {isCs ? 'Naposledy aktualizováno: únor 2026' : 'Last updated: February 2026'}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Table of Contents */}
      <section className="terms-toc-section">
        <div className="container">
          <motion.div
            className="terms-toc"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2>{isCs ? 'Obsah' : 'Table of Contents'}</h2>
            <ul className="terms-toc-list">
              {sections.map((section) => (
                <li key={section.id} className="terms-toc-item">
                  <a
                    href={`#${section.id}`}
                    className="terms-toc-link"
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToSection(section.id);
                    }}
                  >
                    <span className="terms-toc-number">{section.number}</span>
                    <span className="terms-toc-text">{section.title}</span>
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </section>

      {/* Content Sections */}
      <section className="terms-content-wrapper">
        <div className="container">
          <div className="terms-content">
            {isCs ? (
              <>
                <motion.section
                  id="section-1"
                  className="terms-section"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ duration: 0.5 }}
                >
                  <h2>1. Úvodní ustanovení</h2>
                  <p>
                    Tyto Všeobecné smluvní podmínky (dále jen „Podmínky") upravují práva a povinnosti mezi
                    poskytovatelem Alatyr Hosting, Náves 73, 664 08 Blažovice, Česká republika, ID: 09992961,
                    Non-VAT payer (dále jen „Poskytovatel") a zákazníkem (dále jen „Zákazník") při poskytování
                    hostingových a s nimi souvisejících služeb (dále jen „Služby").
                  </p>
                </motion.section>

                <motion.section
                  id="section-2"
                  className="terms-section"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ duration: 0.5 }}
                >
                  <h2>2. Uzavření smlouvy</h2>
                  <p>
                    Smlouva mezi Poskytovatelem a Zákazníkem je uzavřena okamžikem potvrzení objednávky
                    prostřednictvím webového rozhraní a přijetím platby za zvolenou Službu. Zákazník bere na vědomí,
                    že objednávku podává prostřednictvím svého zákaznického účtu a zavazuje se uvádět pravdivé a
                    aktuální údaje.
                  </p>
                </motion.section>

                <motion.section
                  id="section-3"
                  className="terms-section"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ duration: 0.5 }}
                >
                  <h2>3. Cena a platby</h2>
                  <p>
                    Ceny Služeb jsou uvedeny na webu Poskytovatele a jsou platné v okamžiku odeslání objednávky.
                    Úhrada probíhá bezhotovostně prostřednictvím dostupných platebních metod. Po připsání platby je
                    Zákazníkovi vystavena faktura, kterou může stáhnout ve svém zákaznickém účtu.
                  </p>
                </motion.section>

                <motion.section
                  id="section-4"
                  className="terms-section"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ duration: 0.5 }}
                >
                  <h2>4. Práva a povinnosti Zákazníka</h2>
                  <div className="terms-highlight">
                    <p>
                      Zákazník je povinen využívat Služby v souladu s těmito Podmínkami, právními předpisy a dobrými
                      mravy. Zákazník zejména nesmí prostřednictvím Služeb šířit škodlivý obsah, porušovat autorská
                      práva třetích osob, provozovat nevyžádanou poštu (spam) ani narušovat bezpečnost a stabilitu
                      infrastruktury Poskytovatele.
                    </p>
                  </div>
                </motion.section>

                <motion.section
                  id="section-5"
                  className="terms-section"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ duration: 0.5 }}
                >
                  <h2>5. Práva a povinnosti Poskytovatele</h2>
                  <p>
                    Poskytovatel se zavazuje vyvíjet přiměřené úsilí k zajištění vysoké dostupnosti Služeb a
                    provádět pravidelnou údržbu a aktualizace systémů. Poskytovatel je oprávněn přerušit nebo
                    omezit poskytování Služeb v případě nezbytné údržby, bezpečnostních incidentů nebo porušení
                    těchto Podmínek ze strany Zákazníka.
                  </p>
                </motion.section>

                <motion.section
                  id="section-6"
                  className="terms-section"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ duration: 0.5 }}
                >
                  <h2>6. Odpovědnost a omezení odpovědnosti</h2>
                  <div className="terms-highlight">
                    <p>
                      Zákazník odpovídá za obsah umístěný na svých webových stránkách a za veškeré aktivity prováděné
                      prostřednictvím jeho účtů. Poskytovatel neodpovídá za škody způsobené výpadky Služeb z důvodů
                      vyšší moci, útoků třetích stran nebo chyb na straně Zákazníka.
                    </p>
                  </div>
                </motion.section>

                <motion.section
                  id="section-7"
                  className="terms-section"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ duration: 0.5 }}
                >
                  <h2>7. Doba trvání a ukončení smlouvy</h2>
                  <p>
                    Smlouva se uzavírá na dobu určitou dle zvoleného fakturačního období. Zákazník může Službu
                    kdykoli ukončit nepokračováním v úhradě dalšího období. Poskytovatel je oprávněn smlouvu
                    vypovědět v případě závažného nebo opakovaného porušení těchto Podmínek.
                  </p>
                </motion.section>

                <motion.section
                  id="section-8"
                  className="terms-section"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ duration: 0.5 }}
                >
                  <h2>8. Rozhodné právo a řešení sporů</h2>
                  <p>
                    Tyto Podmínky se řídí právním řádem České republiky. Veškeré spory vzniklé v souvislosti se
                    Službami budou řešeny přednostně smírnou cestou, a nepodaří-li se spor vyřešit smírně, pak
                    u příslušných soudů České republiky.
                  </p>
                </motion.section>
              </>
            ) : (
              <>
                <motion.section
                  id="section-1"
                  className="terms-section"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ duration: 0.5 }}
                >
                  <h2>1. Introduction</h2>
                  <p>
                    These General Terms and Conditions (the "Terms") govern the relationship between Alatyr Hosting,
                    Náves 73, 664 08 Blažovice, Czech Republic, ID: 09992961, Non-VAT payer (the "Provider") and the
                    customer (the "Customer") for the provision of hosting and related services (the "Services").
                  </p>
                </motion.section>

                <motion.section
                  id="section-2"
                  className="terms-section"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ duration: 0.5 }}
                >
                  <h2>2. Formation of the contract</h2>
                  <p>
                    The contract between the Provider and the Customer is concluded at the moment the order is
                    confirmed via the Provider&apos;s website and the payment for the selected Service is received.
                    The Customer acknowledges that the order is placed from their customer account and undertakes
                    to provide true and up-to-date information.
                  </p>
                </motion.section>

                <motion.section
                  id="section-3"
                  className="terms-section"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ duration: 0.5 }}
                >
                  <h2>3. Price and payments</h2>
                  <p>
                    Service prices are listed on the Provider&apos;s website and are valid at the time the order is
                    submitted. Payment is made cashless using the available payment methods. After the payment is
                    received, an invoice is issued and made available in the Customer&apos;s account.
                  </p>
                </motion.section>

                <motion.section
                  id="section-4"
                  className="terms-section"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ duration: 0.5 }}
                >
                  <h2>4. Customer rights and obligations</h2>
                  <div className="terms-highlight">
                    <p>
                      The Customer shall use the Services in accordance with these Terms, applicable laws and good
                      practice. In particular, the Customer may not distribute harmful content, infringe the
                      intellectual property rights of third parties, operate unsolicited communication (spam) or
                      compromise the security and stability of the Provider&apos;s infrastructure.
                    </p>
                  </div>
                </motion.section>

                <motion.section
                  id="section-5"
                  className="terms-section"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ duration: 0.5 }}
                >
                  <h2>5. Provider rights and obligations</h2>
                  <p>
                    The Provider undertakes to use reasonable efforts to ensure high availability of the Services and
                    to perform regular maintenance and updates. The Provider may suspend or limit the Services in
                    case of necessary maintenance, security incidents or the Customer&apos;s breach of these Terms.
                  </p>
                </motion.section>

                <motion.section
                  id="section-6"
                  className="terms-section"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ duration: 0.5 }}
                >
                  <h2>6. Liability and limitation of liability</h2>
                  <div className="terms-highlight">
                    <p>
                      The Customer is responsible for the content hosted on their websites and for all activities
                      performed via their accounts. The Provider shall not be liable for damages caused by Service
                      outages due to force majeure, attacks by third parties or the Customer&apos;s own actions.
                    </p>
                  </div>
                </motion.section>

                <motion.section
                  id="section-7"
                  className="terms-section"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ duration: 0.5 }}
                >
                  <h2>7. Term and termination</h2>
                  <p>
                    The contract is concluded for a fixed term corresponding to the selected billing period. The
                    Customer may terminate the Service at any time by not paying for the next period. The Provider
                    may terminate the contract in case of serious or repeated breaches of these Terms by the
                    Customer.
                  </p>
                </motion.section>

                <motion.section
                  id="section-8"
                  className="terms-section"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ duration: 0.5 }}
                >
                  <h2>8. Governing law and disputes</h2>
                  <p>
                    These Terms are governed by the laws of the Czech Republic. Any disputes arising in connection
                    with the Services shall be resolved primarily amicably and, if no amicable solution is reached,
                    before the competent courts of the Czech Republic.
                  </p>
                </motion.section>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Footer Navigation */}
      <section className="terms-footer-nav">
        <div className="container">
          <Link to="/" className="back-link">
            <FontAwesomeIcon icon={faArrowLeft} />
            <span>{isCs ? 'Zpět na úvodní stránku' : 'Back to homepage'}</span>
          </Link>
        </div>
      </section>

      {/* Back to Top Button */}
      <button
        className={`terms-back-to-top ${showBackToTop ? 'visible' : ''}`}
        onClick={scrollToTop}
        aria-label={isCs ? 'Zpět nahoru' : 'Back to top'}
      >
        <FontAwesomeIcon icon={faArrowUp} />
      </button>
    </main>
  );
};

export default Terms;
