import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import PageMeta from '../components/PageMeta';
import { useLanguage } from '../contexts/LanguageContext';
import './Privacy.css';

const Privacy: React.FC = () => {
  const { language } = useLanguage();
  const isCs = language === 'cs';

  return (
    <main className="privacy-page">
      <PageMeta
        title={isCs ? 'Zásady ochrany soukromí – Alatyr Hosting' : 'Privacy Policy – Alatyr Hosting'}
        description={
          isCs
            ? 'Zásady ochrany osobních údajů Alatyr Hosting. Jak zpracováváme vaše údaje, cookies a vaše práva podle GDPR.'
            : 'Privacy policy of Alatyr Hosting. How we process your personal data, use cookies and what rights you have under GDPR.'
        }
        path="/privacy"
      />
      <div className="container">
        <motion.article
          className="privacy-content"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1>Ochrana soukromí</h1>
          <p className="privacy-updated">Naposledy aktualizováno: únor 2026</p>

          {isCs ? (
            <>
              <h1>Zásady ochrany soukromí</h1>
              <p className="privacy-updated">Naposledy aktualizováno: únor 2026</p>

              <section>
                <h2>1. Správce údajů</h2>
                <p>
                  Správcem vašich osobních údajů je Alatyr Hosting, Náves 73, 664 08 Blažovice, Česká republika,
                  ID: 09992961, Non-VAT payer. Kontakt: info@alatyrhosting.eu.
                </p>
              </section>

              <section>
                <h2>2. Jaké údaje zpracováváme</h2>
                <p>
                  Zpracováváme zejména identifikační a kontaktní údaje (jméno, příjmení, e-mail, adresa),
                  fakturační údaje (údaje o platbách, vyfakturovaných službách) a technické údaje o využívání
                  našich služeb (např. logy přístupů do administrace).
                </p>
              </section>

              <section>
                <h2>3. Účely a právní základy zpracování</h2>
                <p>
                  Údaje zpracováváme především pro plnění smlouvy (poskytování hostingu a souvisejících služeb),
                  plnění zákonných povinností (účetnictví, daňové předpisy) a pro oprávněný zájem (zabezpečení
                  služeb, zlepšování funkcí, ochrana proti zneužití).
                </p>
              </section>

              <section>
                <h2>4. Doba uchování</h2>
                <p>
                  Osobní údaje uchováváme po dobu trvání smluvního vztahu a po nezbytnou dobu poté, zejména
                  z důvodu zákonných povinností (typicky 5–10 let u účetních dokladů) a ochrany našich právních
                  nároků.
                </p>
              </section>

              <section>
                <h2>5. Cookies</h2>
                <p>
                  Používáme technicky nezbytné cookies pro zajištění funkčnosti webu (přihlášení, jazykové
                  preference). Další kategorie cookies jsou používány pouze na základě vašeho souhlasu, který lze
                  kdykoliv změnit prostřednictvím cookie banneru.
                </p>
              </section>

              <section>
                <h2>6. Příjemci údajů</h2>
                <p>
                  Vaše údaje mohou být předávány pouze důvěryhodným zpracovatelům, kteří nám pomáhají s provozem
                  služeb (např. poskytovatelé hostingové infrastruktury, platební brány, e-mailové služby) a kteří
                  jsou smluvně vázáni k ochraně osobních údajů.
                </p>
              </section>

              <section>
                <h2>7. Vaše práva</h2>
                <p>
                  Máte právo na přístup k osobním údajům, jejich opravu nebo výmaz, omezení zpracování, námitku
                  proti zpracování a právo na přenositelnost údajů. Stížnost můžete podat u Úřadu pro ochranu
                  osobních údajů.
                </p>
              </section>
            </>
          ) : (
            <>
              <h1>Privacy Policy</h1>
              <p className="privacy-updated">Last updated: February 2026</p>

              <section>
                <h2>1. Data controller</h2>
                <p>
                  The controller of your personal data is Alatyr Hosting, Náves 73, 664 08 Blažovice, Czech
                  Republic, ID: 09992961, Non-VAT payer. Contact: info@alatyrhosting.eu.
                </p>
              </section>

              <section>
                <h2>2. Data we process</h2>
                <p>
                  We process in particular identification and contact details (name, surname, e-mail, address),
                  billing data (payments, invoiced services) and technical data related to the use of our services
                  (such as access logs to the control panel).
                </p>
              </section>

              <section>
                <h2>3. Purposes and legal bases</h2>
                <p>
                  We process your data mainly for the performance of a contract (provision of hosting and related
                  services), for compliance with legal obligations (accounting and tax regulations) and for our
                  legitimate interests (service security, service improvement, fraud prevention).
                </p>
              </section>

              <section>
                <h2>4. Retention period</h2>
                <p>
                  Personal data is stored for the duration of the contractual relationship and for the period
                  necessary afterwards, in particular due to statutory obligations (typically 5–10 years for
                  accounting documents) and to protect our legal claims.
                </p>
              </section>

              <section>
                <h2>5. Cookies</h2>
                <p>
                  We use strictly necessary cookies to ensure the proper functioning of the website (login, language
                  preferences). Other categories of cookies are used only based on your consent, which you can change
                  at any time via the cookie banner.
                </p>
              </section>

              <section>
                <h2>6. Data recipients</h2>
                <p>
                  Your data may be shared only with trusted processors helping us operate our services (for example
                  infrastructure providers, payment gateways, e-mail service providers) who are contractually bound
                  to protect personal data.
                </p>
              </section>

              <section>
                <h2>7. Your rights</h2>
                <p>
                  You have the right to access your personal data, request rectification or erasure, restriction of
                  processing, object to processing and the right to data portability. You may lodge a complaint with
                  the relevant data protection authority.
                </p>
              </section>
            </>
          )}

          <p className="privacy-back">
            <Link to="/">← Zpět na úvodní stránku</Link>
          </p>
        </motion.article>
      </div>
    </main>
  );
};

export default Privacy;
