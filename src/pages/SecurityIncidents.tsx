import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import PageMeta from '../components/PageMeta';
import { useLanguage } from '../contexts/LanguageContext';
import './Privacy.css';

const SecurityIncidents: React.FC = () => {
  const { language } = useLanguage();
  const isCs = language === 'cs';

  return (
    <main className="privacy-page">
      <PageMeta
        title={
          isCs
            ? 'Bezpečnostní incidenty – Alatyr Hosting'
            : 'Security Incidents – Alatyr Hosting'
        }
        description={
          isCs
            ? 'Informace o hlášení a řešení bezpečnostních incidentů u služeb Alatyr Hosting.'
            : 'Information on reporting and handling security incidents for Alatyr Hosting services.'
        }
        path="/security-incidents"
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
              <h1>Bezpečnostní incidenty</h1>
              <p className="privacy-updated">Naposledy aktualizováno: únor 2026</p>

              <section>
                <h2>1. Co je bezpečnostní incident</h2>
                <p>
                  Bezpečnostním incidentem se rozumí zejména podezření na neoprávněný přístup k účtu, únik
                  přihlašovacích údajů, kompromitaci webu, zneužití služeb k útokům (např. DDoS) nebo šíření
                  škodlivého obsahu.
                </p>
              </section>

              <section>
                <h2>2. Jak incident nahlásit</h2>
                <p>
                  Incident prosím nahlaste co nejdříve prostřednictvím zákaznické podpory (tickety v zákaznické
                  sekci) nebo e-mailem na adresu <strong>info@alatyrhosting.eu</strong>. Uveďte prosím co
                  nejvíce detailů (ID účtu, doménu, čas, popis problému, případně logy či screenshoty).
                </p>
              </section>

              <section>
                <h2>3. Jak postupujeme při řešení incidentu</h2>
                <p>
                  Po obdržení hlášení incident vyhodnotíme, zařadíme jej podle závažnosti a zahájíme kroky k
                  omezení dopadů (např. dočasné blokování přístupu, změna hesel, izolace napadeného webu).
                  O průběhu a výsledku řešení budeme Zákazníka informovat prostřednictvím podpory.
                </p>
              </section>

              <section>
                <h2>4. Incidenty s dopadem na osobní údaje</h2>
                <p>
                  Pokud bezpečnostní incident může vést k porušení zabezpečení osobních údajů, posoudíme dopady
                  na subjekty údajů a v souladu s GDPR provedeme příslušná opatření včetně případného oznámení
                  dozorovému úřadu a dotčeným osobám.
                </p>
              </section>

              <section>
                <h2>5. Povinnosti Zákazníků</h2>
                <p>
                  Zákazníci jsou povinni chránit své přístupové údaje, používat silná hesla a neprodleně nás
                  informovat o podezření na zneužití účtu nebo služeb.
                </p>
              </section>
            </>
          ) : (
            <>
              <h1>Security Incidents</h1>
              <p className="privacy-updated">Last updated: February 2026</p>

              <section>
                <h2>1. What is a security incident</h2>
                <p>
                  A security incident is in particular any suspected unauthorised access to an account, credential
                  leakage, website compromise, misuse of services for attacks (e.g. DDoS) or distribution of
                  malicious content.
                </p>
              </section>

              <section>
                <h2>2. How to report an incident</h2>
                <p>
                  Please report security incidents as soon as possible via the customer support ticket system or
                  by e-mail to <strong>info@alatyrhosting.eu</strong>. Include as many details as possible (account
                  ID, domain, time, description of the issue, and logs or screenshots if available).
                </p>
              </section>

              <section>
                <h2>3. Our incident handling process</h2>
                <p>
                  Once we receive your report, we assess the incident, classify its severity and take steps to
                  mitigate its impact (for example, temporarily restricting access, resetting passwords, isolating
                  the affected website). We keep the Customer informed through the support channel.
                </p>
              </section>

              <section>
                <h2>4. Incidents affecting personal data</h2>
                <p>
                  If a security incident is likely to result in a personal data breach, we assess the impact on
                  data subjects and take the necessary steps under GDPR, including notifying the supervisory
                  authority and affected individuals where required.
                </p>
              </section>

              <section>
                <h2>5. Customer responsibilities</h2>
                <p>
                  Customers are responsible for protecting their credentials, using strong passwords and informing
                  us without undue delay about any suspected misuse of their account or services.
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

export default SecurityIncidents;

