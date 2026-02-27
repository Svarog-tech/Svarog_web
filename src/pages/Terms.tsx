import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import PageMeta from '../components/PageMeta';
import { useLanguage } from '../contexts/LanguageContext';
import './Privacy.css';

const Terms: React.FC = () => {
  const { language } = useLanguage();
  const isCs = language === 'cs';

  return (
    <main className="privacy-page">
      <PageMeta
        title={isCs ? 'Všeobecné smluvní podmínky – Alatyr Hosting' : 'General Terms and Conditions – Alatyr Hosting'}
        description={
          isCs
            ? 'Všeobecné smluvní podmínky poskytování služeb Alatyr Hosting.'
            : 'General terms and conditions for services provided by Alatyr Hosting.'
        }
        path="/terms"
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
              <h1>Všeobecné smluvní podmínky služeb</h1>
              <p className="privacy-updated">Naposledy aktualizováno: únor 2026</p>

              <section>
                <h2>1. Úvodní ustanovení</h2>
                <p>
                  Tyto Všeobecné smluvní podmínky (dále jen „Podmínky“) upravují práva a povinnosti mezi
                  poskytovatelem Alatyr Hosting, Náves 73, 664 08 Blažovice, Česká republika, ID: 09992961,
                  Non-VAT payer (dále jen „Poskytovatel“) a zákazníkem (dále jen „Zákazník“) při poskytování
                  hostingových a s nimi souvisejících služeb (dále jen „Služby“).
                </p>
              </section>

              <section>
                <h2>2. Uzavření smlouvy</h2>
                <p>
                  Smlouva mezi Poskytovatelem a Zákazníkem je uzavřena okamžikem potvrzení objednávky
                  prostřednictvím webového rozhraní a přijetím platby za zvolenou Službu. Zákazník bere na vědomí,
                  že objednávku podává prostřednictvím svého zákaznického účtu a zavazuje se uvádět pravdivé a
                  aktuální údaje.
                </p>
              </section>

              <section>
                <h2>3. Cena a platby</h2>
                <p>
                  Ceny Služeb jsou uvedeny na webu Poskytovatele a jsou platné v okamžiku odeslání objednávky.
                  Úhrada probíhá bezhotovostně prostřednictvím dostupných platebních metod. Po připsání platby je
                  Zákazníkovi vystavena faktura, kterou může stáhnout ve svém zákaznickém účtu.
                </p>
              </section>

              <section>
                <h2>4. Práva a povinnosti Zákazníka</h2>
                <p>
                  Zákazník je povinen využívat Služby v souladu s těmito Podmínkami, právními předpisy a dobrými
                  mravy. Zákazník zejména nesmí prostřednictvím Služeb šířit škodlivý obsah, porušovat autorská
                  práva třetích osob, provozovat nevyžádanou poštu (spam) ani narušovat bezpečnost a stabilitu
                  infrastruktury Poskytovatele.
                </p>
              </section>

              <section>
                <h2>5. Práva a povinnosti Poskytovatele</h2>
                <p>
                  Poskytovatel se zavazuje vyvíjet přiměřené úsilí k zajištění vysoké dostupnosti Služeb a
                  provádět pravidelnou údržbu a aktualizace systémů. Poskytovatel je oprávněn přerušit nebo
                  omezit poskytování Služeb v případě nezbytné údržby, bezpečnostních incidentů nebo porušení
                  těchto Podmínek ze strany Zákazníka.
                </p>
              </section>

              <section>
                <h2>6. Odpovědnost a omezení odpovědnosti</h2>
                <p>
                  Zákazník odpovídá za obsah umístěný na svých webových stránkách a za veškeré aktivity prováděné
                  prostřednictvím jeho účtů. Poskytovatel neodpovídá za škody způsobené výpadky Služeb z důvodů
                  vyšší moci, útoků třetích stran nebo chyb na straně Zákazníka.
                </p>
              </section>

              <section>
                <h2>7. Doba trvání a ukončení smlouvy</h2>
                <p>
                  Smlouva se uzavírá na dobu určitou dle zvoleného fakturačního období. Zákazník může Službu
                  kdykoli ukončit nepokračováním v úhradě dalšího období. Poskytovatel je oprávněn smlouvu
                  vypovědět v případě závažného nebo opakovaného porušení těchto Podmínek.
                </p>
              </section>

              <section>
                <h2>8. Rozhodné právo a řešení sporů</h2>
                <p>
                  Tyto Podmínky se řídí právním řádem České republiky. Veškeré spory vzniklé v souvislosti se
                  Službami budou řešeny přednostně smírnou cestou, a nepodaří-li se spor vyřešit smírně, pak
                  u příslušných soudů České republiky.
                </p>
              </section>
            </>
          ) : (
            <>
              <h1>General Terms and Conditions of Services</h1>
              <p className="privacy-updated">Last updated: February 2026</p>

              <section>
                <h2>1. Introduction</h2>
                <p>
                  These General Terms and Conditions (the “Terms”) govern the relationship between Alatyr Hosting,
                  Náves 73, 664 08 Blažovice, Czech Republic, ID: 09992961, Non-VAT payer (the “Provider”) and the
                  customer (the “Customer”) for the provision of hosting and related services (the “Services”).
                </p>
              </section>

              <section>
                <h2>2. Formation of the contract</h2>
                <p>
                  The contract between the Provider and the Customer is concluded at the moment the order is
                  confirmed via the Provider&apos;s website and the payment for the selected Service is received.
                  The Customer acknowledges that the order is placed from their customer account and undertakes
                  to provide true and up-to-date information.
                </p>
              </section>

              <section>
                <h2>3. Price and payments</h2>
                <p>
                  Service prices are listed on the Provider&apos;s website and are valid at the time the order is
                  submitted. Payment is made cashless using the available payment methods. After the payment is
                  received, an invoice is issued and made available in the Customer&apos;s account.
                </p>
              </section>

              <section>
                <h2>4. Customer rights and obligations</h2>
                <p>
                  The Customer shall use the Services in accordance with these Terms, applicable laws and good
                  practice. In particular, the Customer may not distribute harmful content, infringe the
                  intellectual property rights of third parties, operate unsolicited communication (spam) or
                  compromise the security and stability of the Provider&apos;s infrastructure.
                </p>
              </section>

              <section>
                <h2>5. Provider rights and obligations</h2>
                <p>
                  The Provider undertakes to use reasonable efforts to ensure high availability of the Services and
                  to perform regular maintenance and updates. The Provider may suspend or limit the Services in
                  case of necessary maintenance, security incidents or the Customer&apos;s breach of these Terms.
                </p>
              </section>

              <section>
                <h2>6. Liability and limitation of liability</h2>
                <p>
                  The Customer is responsible for the content hosted on their websites and for all activities
                  performed via their accounts. The Provider shall not be liable for damages caused by Service
                  outages due to force majeure, attacks by third parties or the Customer&apos;s own actions.
                </p>
              </section>

              <section>
                <h2>7. Term and termination</h2>
                <p>
                  The contract is concluded for a fixed term corresponding to the selected billing period. The
                  Customer may terminate the Service at any time by not paying for the next period. The Provider
                  may terminate the contract in case of serious or repeated breaches of these Terms by the
                  Customer.
                </p>
              </section>

              <section>
                <h2>8. Governing law and disputes</h2>
                <p>
                  These Terms are governed by the laws of the Czech Republic. Any disputes arising in connection
                  with the Services shall be resolved primarily amicably and, if no amicable solution is reached,
                  before the competent courts of the Czech Republic.
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

export default Terms;

