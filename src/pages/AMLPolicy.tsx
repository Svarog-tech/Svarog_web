import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import PageMeta from '../components/PageMeta';
import { useLanguage } from '../contexts/LanguageContext';
import './Privacy.css';

const AMLPolicy: React.FC = () => {
  const { language } = useLanguage();
  const isCs = language === 'cs';

  return (
    <main className="privacy-page">
      <PageMeta
        title={
          isCs
            ? 'ANTI-MONEY LAUNDERING POLICY (AML) – Alatyr Hosting'
            : 'ANTI-MONEY LAUNDERING POLICY (AML) – Alatyr Hosting'
        }
        description={
          isCs
            ? 'Zásady prevence praní špinavých peněz (AML) společnosti Alatyr Hosting.'
            : 'Anti-money laundering (AML) policy of Alatyr Hosting.'
        }
        path="/aml"
      />
      <div className="container">
        <motion.article
          className="privacy-content"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {isCs ? (
            <>
              <h1>ANTI-MONEY LAUNDERING POLICY (AML)</h1>
              <p className="privacy-updated">Naposledy aktualizováno: únor 2026</p>

              <section>
                <h2>1. Účel politiky</h2>
                <p>
                  Tato AML politika stanovuje základní principy a postupy, kterými Alatyr Hosting, Náves 73,
                  664 08 Blažovice, Česká republika, ID: 09992961, Non-VAT payer (dále jen „Společnost“)
                  předchází zneužití svých služeb k praní špinavých peněz, financování terorismu a dalším
                  nezákonným aktivitám.
                </p>
              </section>

              <section>
                <h2>2. Rozsah působnosti</h2>
                <p>
                  Politika se vztahuje na všechny služby poskytované Společností, zejména na webhostingové a
                  související služby, a na všechny uživatele těchto služeb. Zákazník souhlasem s podmínkami
                  používání potvrzuje, že tuto AML politiku respektuje.
                </p>
              </section>

              <section>
                <h2>3. Rizikové aktivity</h2>
                <p>Za rizikové aktivity jsou považovány zejména:</p>
                <p>
                  • používání odcizených nebo anonymních platebních údajů,{' '}
                  • provozování podvodných nebo phishingových webů,{' '}
                  • zneužití služeb k distribuci nelegálního obsahu nebo k zakrývání původu finančních prostředků.
                </p>
              </section>

              <section>
                <h2>4. Postupy při podezření na zneužití</h2>
                <p>
                  V případě důvodného podezření na zneužití služeb je Společnost oprávněna:
                  dočasně pozastavit nebo omezit poskytování služby, vyžádat si od Zákazníka doplňující informace
                  a spolupracovat s příslušnými orgány veřejné moci dle platných právních předpisů.
                </p>
              </section>

              <section>
                <h2>5. Povinnosti Zákazníků</h2>
                <p>
                  Zákazníci se zavazují využívat služby Společnosti výhradně k legálním účelům a na vyžádání
                  poskytnout vysvětlení nebo podklady nezbytné k objasnění podezřelých transakcí nebo aktivit.
                </p>
              </section>
            </>
          ) : (
            <>
              <h1>ANTI-MONEY LAUNDERING POLICY (AML)</h1>
              <p className="privacy-updated">Last updated: February 2026</p>

              <section>
                <h2>1. Purpose of this policy</h2>
                <p>
                  This AML Policy defines the basic principles and procedures by which Alatyr Hosting, Náves 73,
                  664 08 Blažovice, Czech Republic, ID: 09992961, Non-VAT payer (the “Company”) prevents the misuse
                  of its services for money laundering, terrorist financing and other illegal activities.
                </p>
              </section>

              <section>
                <h2>2. Scope</h2>
                <p>
                  This policy applies to all services provided by the Company, in particular web hosting and related
                  services, and to all users of these services. By accepting the terms of use, the Customer confirms
                  that they respect this AML Policy.
                </p>
              </section>

              <section>
                <h2>3. Risk activities</h2>
                <p>Risk activities include in particular:</p>
                <p>
                  • using stolen or anonymous payment details,{' '}
                  • operating fraudulent or phishing websites,{' '}
                  • abusing the services to distribute illegal content or to conceal the origin of funds.
                </p>
              </section>

              <section>
                <h2>4. Procedures in case of suspicion</h2>
                <p>
                  In case of reasonable suspicion of misuse of the services, the Company may temporarily suspend or
                  limit the service, request additional information from the Customer and cooperate with competent
                  authorities in accordance with applicable law.
                </p>
              </section>

              <section>
                <h2>5. Customer obligations</h2>
                <p>
                  Customers undertake to use the Company&apos;s services only for lawful purposes and, upon request,
                  to provide explanations or documents necessary to clarify suspicious transactions or activities.
                </p>
              </section>
            </>
          )}

          <p className="privacy-back">
            <Link to="/">{isCs ? '← Zpět na úvodní stránku' : '← Back to homepage'}</Link>
          </p>
        </motion.article>
      </div>
    </main>
  );
};

export default AMLPolicy;

