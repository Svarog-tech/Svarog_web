import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import PageMeta from '../components/PageMeta';
import './Privacy.css';

const Privacy: React.FC = () => {
  return (
    <main className="privacy-page">
      <PageMeta
        title="Ochrana soukromí – Alatyr Hosting"
        description="Zásady ochrany osobních údajů Alatyr Hosting. Jak zpracováváme vaše údaje, cookies a práva podle GDPR."
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

          <section>
            <h2>1. Správce údajů</h2>
            <p>Správcem vašich osobních údajů je Alatyr Hosting (dále „my“). Kontakt: info@alatyr.cz.</p>
          </section>

          <section>
            <h2>2. Jaké údaje zpracováváme</h2>
            <p>Zpracováváme údaje nezbytné pro poskytování hostingu a souvisejících služeb: e-mail, jméno, adresa, údaje o platbách a využití služeb.</p>
          </section>

          <section>
            <h2>3. Účel zpracování</h2>
            <p>Údaje používáme k plnění smlouvy, fakturaci, technické podpoře, zlepšování služeb a v rozsahu zákonných povinností.</p>
          </section>

          <section>
            <h2>4. Cookies</h2>
            <p>Používáme technicky nezbytné cookies (přihlášení, preference). Více v našem cookie banneru na webu.</p>
          </section>

          <section>
            <h2>5. Vaše práva</h2>
            <p>Máte právo na přístup k údajům, opravu, výmaz, omezení zpracování a přenositelnost. Podání stížnosti můžete uplatnit u dozorového úřadu (ÚOOÚ).</p>
          </section>

          <p className="privacy-back">
            <Link to="/">← Zpět na úvodní stránku</Link>
          </p>
        </motion.article>
      </div>
    </main>
  );
};

export default Privacy;
