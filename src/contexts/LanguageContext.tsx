import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'cs' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Czech translations
const translations = {
  cs: {
    // Navigation
    'nav.home': 'Domů',
    'nav.hosting': 'Hosting',
    'nav.domains': 'Domény',
    'nav.support': 'Podpora',
    'nav.about': 'O nás',
    'nav.login': 'Přihlásit se',
    'nav.getStarted': 'Registrace',

    // Hero section
    'hero.badge': '🚀 Nová generace hostingu',
    'hero.title': 'Výkonný Hosting pro VÁŠ',
    'hero.titleHighlight': ' Úspěch',
    'hero.description': 'Profesionální webhosting s 99.9% dostupností, bleskurychlou odezvou a 24/7 podporou. Začněte svůj úspěšný web ještě dnes.',
    'hero.feature1': 'SSL certifikát zdarma',
    'hero.feature2': 'Denní zálohování',
    'hero.feature3': '24/7 podpora v češtině',
    'hero.startNow': 'Začít nyní',
    'hero.contactSales': 'Kontaktovat prodej',
    'hero.uptime': 'Dostupnost',
    'hero.customers': 'Spokojených zákazníků',
    'hero.support': 'Podpora',
    'hero.showPlans': 'Zobrazit plány',

    // Hosting plans
    'plans.badge': 'Speciální nabídka - Sleva až 50%',
    'plans.title': 'Vyberte si ',
    'plans.titleHighlight': 'hosting plán',
    'plans.description': 'Všechny plány zahrnují 30-denní záruku vrácení peněz a bezplatnou migraci',
    'plans.monthly': 'Měsíčně',
    'plans.yearly': 'Ročně',
    'plans.discount': '-10%',
    'plans.popular': 'Nejoblíbenější',
    'plans.perMonth': 'za měsíc',
    'plans.perYear': 'za rok',
    'plans.save': 'Ušetříte',
    'plans.saveAmount': 'Kč ročně',
    'plans.selectPlan': 'Vybrat plán',
    'plans.selected': 'Vybráno',
    'plans.guarantee': '30-denní záruka',
    'plans.uptime99': '99.9% Uptime',
    'plans.securePayments': 'Bezpečné platby',
    'plans.quickActivation': 'Rychlá aktivace',

    // Plan details - Webhosting
    'plans.basic.name': 'Basic',
    'plans.basic.description': 'Ideální pro malé osobní weby a začátečníky',
    'plans.basic.specs.storage': '5 GB',
    'plans.basic.specs.websites': '1 doména',
    'plans.basic.specs.bandwidth': 'Neomezený',
    'plans.basic.specs.support': 'Email podpora',

    'plans.standard.name': 'Standard',
    'plans.standard.description': 'Pro malé podnikatele a rozšiřující se weby',
    'plans.standard.specs.storage': '10 GB',
    'plans.standard.specs.websites': '1 doména',
    'plans.standard.specs.bandwidth': 'Neomezený',
    'plans.standard.specs.support': 'Email podpora',

    'plans.pro.name': 'Pro',
    'plans.pro.description': 'Pro středně velké projekty s vyšší návštěvností',
    'plans.pro.specs.storage': '15 GB',
    'plans.pro.specs.websites': '1 doména',
    'plans.pro.specs.bandwidth': 'Neomezený',
    'plans.pro.specs.support': 'Email & Chat podpora',

    'plans.ultimate.name': 'Ultimate',
    'plans.ultimate.description': 'Pro velké weby s maximálním výkonem a funkcemi',
    'plans.ultimate.specs.storage': '25 GB',
    'plans.ultimate.specs.websites': '1 doména',
    'plans.ultimate.specs.bandwidth': 'Neomezený',
    'plans.ultimate.specs.support': '24/7 Prioritní podpora',

    // WordPress Plan details
    'wpPlans.wp-start.name': 'WP Start',
    'wpPlans.wp-start.description': 'Optimalizováno pro základní WordPress weby',

    'wpPlans.wp-pro.name': 'WP Pro',
    'wpPlans.wp-pro.description': 'Pro profesionální WordPress weby s maximálním výkonem',

    // Features
    'feature.storage': 'SSD úložiště',
    'feature.websites': 'webová stránka',
    'feature.websites.multiple': 'webových stránek',
    'feature.websites.unlimited': 'Neomezené webové stránky',
    'feature.transfer': 'přenos dat',
    'feature.transfer.unlimited': 'Neomezený přenos dat',
    'feature.support.email': 'Email podpora',
    'feature.support.chat': 'Email & live chat podpora',
    'feature.support.priority': '24/7 prioritní podpora',
    'feature.ssl': 'SSL certifikát zdarma',
    'feature.backup': 'Denní zálohování',
    'feature.backup.hourly': 'Hodinové zálohování',
    'feature.wordpress': '1-click WordPress instalace',
    'feature.cdn': 'Cloudflare CDN',
    'feature.cdn.global': 'Globální CDN síť',
    'feature.staging': 'Staging prostředí',
    'feature.git': 'Git integrace',
    'feature.resources': 'Dedicated server zdroje',

    // Registration page
    'register.title': 'Vytvořit účet',
    'register.subtitle': 'Začněte svou cestu s Alatyr Hosting',
    'register.firstName': 'Jméno',
    'register.firstNamePlaceholder': 'Vaše jméno',
    'register.lastName': 'Příjmení',
    'register.lastNamePlaceholder': 'Vaše příjmení',
    'register.email': 'Email',
    'register.emailPlaceholder': 'vas-email@email.cz',
    'register.password': 'Heslo',
    'register.passwordPlaceholder': 'Minimálně 8 znaků',
    'register.confirmPassword': 'Potvrdit heslo',
    'register.confirmPasswordPlaceholder': 'Zopakujte heslo',
    'register.agreeToTerms': 'Souhlasím s',
    'register.termsLink': 'obchodními podmínkami',
    'register.createAccount': 'Vytvořit účet',
    'register.alreadyHaveAccount': 'Už máte účet?',
    'register.loginLink': 'Přihlásit se',
    'register.orContinueWith': 'Nebo pokračujte s',
    'register.continueWithGoogle': 'Pokračovat s Google',
    'register.continueWithGitHub': 'Pokračovat s GitHub',
    'register.continueWithEmail': 'Pokračovat s emailem',
    'register.back': 'Zpět',

    // Auth callback
    'auth.processing': 'Zpracování přihlášení...',
    'auth.success': 'Úspěšně přihlášen!',
    'auth.error': 'Chyba přihlášení',
    'auth.processingDescription': 'Váš účet se právě ověřuje. Prosím čekejte...',
    'auth.successDescription': 'Budete přesměrováni na hlavní stránku.',
    'auth.errorDescription': 'Něco se pokazilo při přihlášení. Zkuste to znovu.',
    'auth.tryAgain': 'Zkusit znovu',
    'feature.security': 'Pokročilá bezpečnost',
    'feature.malware': 'Malware scanning',

    // Cookies banner
    'cookies.title': 'Používáme cookies',
    'cookies.description': 'Používáme cookies pro zlepšení vašeho zážitku na webu a analýzu návštěvnosti.',
    'cookies.accept': 'Přijmout vše',
    'cookies.settings': 'Nastavení',
    'cookies.decline': 'Odmítnout',

    // Footer
    'footer.description': 'Spolehlivý a výkonný webhosting pro vaše projekty. S 99.9% dostupností a 24/7 podporou.',
    'footer.services': 'Služby',
    'footer.ssl': 'SSL certifikáty',
    'footer.backup': 'Zálohování',
    'footer.support': 'Podpora',
    'footer.documentation': 'Dokumentace',
    'footer.faq': 'FAQ',
    'footer.liveSupport': 'Živá podpora',
    'footer.status': 'Stav služeb',
    'footer.company': 'Společnost',
    'footer.careers': 'Kariéra',
    'footer.privacy': 'Soukromí',
    'footer.terms': 'Podmínky',
    'footer.contact': 'Kontakt',
    'footer.rights': 'Všechna práva vyhrazena.',
    'footer.cookies': 'Cookies',

    // Hosting page
    'hosting.title': 'Profesionální',
    'hosting.titleHighlight': ' Hosting Služby',
    'hosting.description': 'Objevte naše vysoce výkonné hosting řešení navržené pro úspěch vašeho webu. S pokročilými technologiemi a spolehlivou infrastrukturou.',
    'hosting.featuresTitle': 'Proč si vybrat',
    'hosting.featuresDescription': 'náš hosting?',
    'hosting.feature1.title': 'Bleskurychlý výkon',
    'hosting.feature1.description': 'SSD úložiště a optimalizované servery pro maximální rychlost vašeho webu.',
    'hosting.feature2.title': '99.9% dostupnost',
    'hosting.feature2.description': 'Spolehlivá infrastruktura s garantovanou vysokou dostupností.',
    'hosting.feature3.title': '24/7 podpora',
    'hosting.feature3.description': 'Náš expertní tým je vždy připraven pomoci s jakýmkoliv problémem.',
    'hosting.feature4.title': 'Pokročilá bezpečnost',
    'hosting.feature4.description': 'Komplexní ochrana proti malware a pravidelné bezpečnostní aktualizace.',
    'hosting.guarantee.title': '30denní záruka',
    'hosting.guarantee.description': 'Nejste spokojeni? Vrátíme vám peníze během 30 dní bez ptaní.',
    'hosting.guarantee.cta': 'Začít bez rizika',

    // Domains page
    'domains.title': 'Najděte perfektní',
    'domains.titleHighlight': ' doménu',
    'domains.description': 'Zaregistrujte si svou ideální doménu z široké nabídky TLD a začněte budovat svou online přítomnost.',
    'domains.searchPlaceholder': 'Zadejte název domény...',
    'domains.search': 'Vyhledat',
    'domains.pricesTitle': 'Transparentní',
    'domains.pricesDescription': ' cenník domén',
    'domains.popular': 'Oblíbené',
    'domains.year': 'rok',
    'domains.register': 'Registrovat',
    'domains.feature1.title': 'Snadná správa',
    'domains.feature1.description': 'Intuitivní panel pro správu všech vašich domén na jednom místě.',
    'domains.feature2.title': 'DNS hosting zdarma',
    'domains.feature2.description': 'Profesionální DNS hosting s vysokou dostupností pro všechny domény.',
    'domains.feature3.title': 'Ochrana soukromí',
    'domains.feature3.description': 'WHOIS ochrana pro bezpečnost vašich osobních údajů zdarma.',

    // Support page
    'support.title': 'Jsme tu pro',
    'support.titleHighlight': ' vás 24/7',
    'support.description': 'Náš expertní tým podpory je připraven pomoci s jakýmkoliv problémem. Kontaktujte nás způsobem, který vám vyhovuje.',
    'support.searchPlaceholder': 'Hledejte v nápovědě...',
    'support.optionsTitle': 'Možnosti',
    'support.optionsDescription': ' podpory',
    'support.ticket.title': 'Support tikety',
    'support.ticket.description': 'Vytvořte tiket pro složitější problémy s detailním popisem.',
    'support.ticket.action': 'Vytvořit tiket',
    'support.chat.title': 'Live chat',
    'support.chat.description': 'Rychlá pomoc prostřednictvím živého chatu s naším týmem.',
    'support.chat.action': 'Zahájit chat',
    'support.phone.title': 'Telefonická podpora',
    'support.phone.description': 'Volejte nám pro okamžitou pomoc s urgentními problémy.',
    'support.phone.action': 'Zavolat',
    'support.email.title': 'Email podpora',
    'support.email.description': 'Napište nám email a odpovíme do 2 hodin.',
    'support.email.action': 'Napsat email',
    'support.hours.title': 'Dostupnost',
    'support.hours.description': 'podpory:',
    'support.hours.chat': 'Live chat',
    'support.hours.email': 'Email',
    'support.faqTitle': 'Často kladené',
    'support.faqDescription': ' otázky',
    'support.faq.q1.question': 'Jak rychle je můj hosting aktivován?',
    'support.faq.q1.answer': 'Hosting je automaticky aktivován během několika minut po dokončení platby.',
    'support.faq.q2.question': 'Mohu migrovat svůj existující web?',
    'support.faq.q2.answer': 'Ano, poskytujeme bezplatnou migraci vašeho webu z jiného poskytovatele.',
    'support.faq.q3.question': 'Jaká je uptime záruka?',
    'support.faq.q3.answer': 'Garantujeme 99.9% uptime. V případě neplnění vám vrátíme poměrnou část platby.',
    'support.faq.q4.question': 'Mohu upgradovat svůj plán později?',
    'support.faq.q4.answer': 'Ano, můžete kdykoliv upgradovat na vyšší plán bez výpadku služeb.',

    // About page
    'about.title': 'O společnosti',
    'about.titleHighlight': ' Alatyr',
    'about.description': 'Jsme český poskytovatel hostingu s více než 10letými zkušenostmi. Naší misí je poskytovat spolehlivé a výkonné hosting služby.',
    'about.stats.customers': 'Spokojených zákazníků',
    'about.stats.uptime': 'Průměrná dostupnost',
    'about.stats.support': 'Průměrná doba odezvy',
    'about.stats.years': 'Let zkušeností',
    'about.story.title': 'Náš příběh',
    'about.story.paragraph1': 'Alatyr byl založen v roce 2014 s vizí demokratizovat přístup k kvalitnímu webhostingu. Začínali jsme jako malý tým nadšenců, kteří věřili, že každý by měl mít možnost vytvořit svou online přítomnost.',
    'about.story.paragraph2': 'Během let jsme vyrostli v jednoho z předních poskytovatelů hostingu v České republice, ale nikdy jsme neztratili náš osobní přístup ke každému zákazníkovi. Investujeme neustále do nejnovějších technologií a vzdělávání našeho týmu.',
    'about.story.paragraph3': 'Dnes obsluhujeme tisíce zákazníků po celém světě a jsme hrdí na to, že pomáháme realizovat jejich digitální sny. Naše hodnoty zůstávají stejné: spolehlivost, inovace a péče o zákazníka.',
    'about.valuesTitle': 'Naše',
    'about.valuesDescription': ' hodnoty',
    'about.values.innovation.title': 'Inovace',
    'about.values.innovation.description': 'Neustále hledáme nové technologie a řešení pro zlepšení našich služeb.',
    'about.values.reliability.title': 'Spolehlivost',
    'about.values.reliability.description': 'Poskytujeme stabilní a bezpečné služby, na které se můžete spolehnout.',
    'about.values.care.title': 'Péče',
    'about.values.care.description': 'Každý zákazník je pro nás důležitý a poskytujeme personalizovanou podporu.',
    'about.values.performance.title': 'Výkon',
    'about.values.performance.description': 'Optimalizujeme naši infrastrukturu pro maximální rychlost a výkon.',
    'about.teamTitle': 'Náš',
    'about.teamDescription': ' tým',
    'about.team.ceo.role': 'CEO & Zakladatel',
    'about.team.ceo.description': 'Visionář s více než 15letými zkušenostmi v IT průmyslu.',
    'about.team.cto.role': 'CTO',
    'about.team.cto.description': 'Expert na cloudové technologie a architekturu systémů.',
    'about.team.support.role': 'Vedoucí podpory',
    'about.team.support.description': 'Zajišťuje vynikající zákaznický servis a spokojenost klientů.',
    'about.cta.title': 'Připojte se k tisícům spokojených zákazníků',
    'about.cta.description': 'Začněte svou cestu s Alatyr ještě dnes a objevte rozdíl profesionálního hostingu.',
    'about.cta.button': 'Začít nyní',

    // Registration
    'registration.title': 'Založit účet',
    'registration.titleHighlight': ' dnes',
    'registration.description': 'Vytvořte si účet a získejte přístup k našim hostingovým službám s 24/7 podporou.',
    'registration.formTitle': 'Registrační formulář',
    'registration.firstName': 'Křestní jméno *',
    'registration.firstNamePlaceholder': 'Zadejte vaše křestní jméno',
    'registration.lastName': 'Příjmení *',
    'registration.lastNamePlaceholder': 'Zadejte vaše příjmení',
    'registration.email': 'Email *',
    'registration.emailPlaceholder': 'vas@email.cz',
    'registration.company': 'Společnost',
    'registration.companyPlaceholder': 'Název vaší společnosti',
    'registration.phone': 'Telefon',
    'registration.phonePlaceholder': '+420 123 456 789',
    'registration.password': 'Heslo *',
    'registration.passwordPlaceholder': 'Minimálně 8 znaků',
    'registration.confirmPassword': 'Potvrzení hesla *',
    'registration.confirmPasswordPlaceholder': 'Zadejte heslo znovu',
    'registration.acceptTerms': 'Souhlasím s ',
    'registration.termsLink': 'obchodními podmínkami',
    'registration.acceptNewsletters': 'Chci dostávat newsletter s novinkami a nabídkami',
    'registration.submit': 'Vytvořit účet',
    'registration.submitting': 'Vytváří se...',
    'registration.success': 'Účet byl úspěšně vytvořen! Zkontrolujte váš email.',
    'registration.error': 'Při vytváření účtu došlo k chybě. Zkuste to prosím znovu.',
    'registration.benefitsTitle': 'Výhody registrace',
    'registration.benefit1': '24/7 technická podpora',
    'registration.benefit2': 'Bezplatný SSL certifikát',
    'registration.benefit3': 'Správa domén v jednom místě',
    'registration.benefit4': '99.9% garantovaná dostupnost',
    'registration.benefit5': 'Pravidelné zálohy dat',

    // Registration errors
    'registration.errors.firstNameRequired': 'Křestní jméno je povinné',
    'registration.errors.lastNameRequired': 'Příjmení je povinné',
    'registration.errors.emailRequired': 'Email je povinný',
    'registration.errors.emailInvalid': 'Email není ve správném formátu',
    'registration.errors.passwordRequired': 'Heslo je povinné',
    'registration.errors.passwordTooShort': 'Heslo musí mít alespoň 8 znaků',
    'registration.errors.passwordMismatch': 'Hesla se neshodují',
    'registration.errors.termsRequired': 'Musíte souhlasit s obchodními podmínkami'
  },
  en: {
    // Navigation
    'nav.home': 'Home',
    'nav.hosting': 'Hosting',
    'nav.domains': 'Domains',
    'nav.support': 'Support',
    'nav.about': 'About',
    'nav.login': 'Login',
    'nav.getStarted': 'Register',

    // Hero section
    'hero.badge': '🚀 Next Generation Hosting',
    'hero.title': 'Powerful Hosting for YOUR',
    'hero.titleHighlight': ' Success',
    'hero.description': 'Professional web hosting with 99.9% uptime, lightning-fast response and 24/7 support. Start your successful website today.',
    'hero.feature1': 'Free SSL certificate',
    'hero.feature2': 'Daily backups',
    'hero.feature3': '24/7 support',
    'hero.startNow': 'Start Now',
    'hero.contactSales': 'Contact Sales',
    'hero.uptime': 'Uptime',
    'hero.customers': 'Happy Customers',
    'hero.support': 'Support',
    'hero.showPlans': 'Show Plans',

    // Hosting plans
    'plans.badge': 'Special Offer - Up to 50% Off',
    'plans.title': 'Choose your ',
    'plans.titleHighlight': 'hosting plan',
    'plans.description': 'All plans include 30-day money-back guarantee and free migration',
    'plans.monthly': 'Monthly',
    'plans.yearly': 'Yearly',
    'plans.discount': '-10%',
    'plans.popular': 'Most Popular',
    'plans.perMonth': 'per month',
    'plans.perYear': 'per year',
    'plans.save': 'Save',
    'plans.saveAmount': 'CZK annually',
    'plans.selectPlan': 'Select Plan',
    'plans.selected': 'Selected',
    'plans.guarantee': '30-day guarantee',
    'plans.uptime99': '99.9% Uptime',
    'plans.securePayments': 'Secure Payments',
    'plans.quickActivation': 'Quick Activation',

    // Plan details - Webhosting
    'plans.basic.name': 'Basic',
    'plans.basic.description': 'Perfect for small personal sites and beginners',
    'plans.basic.specs.storage': '5 GB',
    'plans.basic.specs.websites': '1 domain',
    'plans.basic.specs.bandwidth': 'Unlimited',
    'plans.basic.specs.support': 'Email support',

    'plans.standard.name': 'Standard',
    'plans.standard.description': 'For small entrepreneurs and growing websites',
    'plans.standard.specs.storage': '10 GB',
    'plans.standard.specs.websites': '1 domain',
    'plans.standard.specs.bandwidth': 'Unlimited',
    'plans.standard.specs.support': 'Email support',

    'plans.pro.name': 'Pro',
    'plans.pro.description': 'For medium-sized projects with higher traffic',
    'plans.pro.specs.storage': '15 GB',
    'plans.pro.specs.websites': '1 domain',
    'plans.pro.specs.bandwidth': 'Unlimited',
    'plans.pro.specs.support': 'Email & Chat support',

    'plans.ultimate.name': 'Ultimate',
    'plans.ultimate.description': 'For large websites with maximum performance and features',
    'plans.ultimate.specs.storage': '25 GB',
    'plans.ultimate.specs.websites': '1 domain',
    'plans.ultimate.specs.bandwidth': 'Unlimited',
    'plans.ultimate.specs.support': '24/7 Priority support',

    // WordPress Plan details
    'wpPlans.wp-start.name': 'WP Start',
    'wpPlans.wp-start.description': 'Optimized for basic WordPress websites',

    'wpPlans.wp-pro.name': 'WP Pro',
    'wpPlans.wp-pro.description': 'For professional WordPress websites with maximum performance',

    // Features
    'feature.storage': 'SSD storage',
    'feature.websites': 'website',
    'feature.websites.multiple': 'websites',
    'feature.websites.unlimited': 'Unlimited websites',
    'feature.transfer': 'data transfer',
    'feature.transfer.unlimited': 'Unlimited data transfer',
    'feature.support.email': 'Email support',
    'feature.support.chat': 'Email & live chat support',
    'feature.support.priority': '24/7 priority support',
    'feature.ssl': 'Free SSL certificate',
    'feature.backup': 'Daily backups',
    'feature.backup.hourly': 'Hourly backups',
    'feature.wordpress': '1-click WordPress installation',
    'feature.cdn': 'Cloudflare CDN',
    'feature.cdn.global': 'Global CDN network',
    'feature.staging': 'Staging environment',
    'feature.git': 'Git integration',
    'feature.resources': 'Dedicated server resources',

    // Registration page
    'register.title': 'Create Account',
    'register.subtitle': 'Start your journey with Alatyr Hosting',
    'register.firstName': 'First Name',
    'register.firstNamePlaceholder': 'Your first name',
    'register.lastName': 'Last Name',
    'register.lastNamePlaceholder': 'Your last name',
    'register.email': 'Email',
    'register.emailPlaceholder': 'your-email@email.com',
    'register.password': 'Password',
    'register.passwordPlaceholder': 'At least 8 characters',
    'register.confirmPassword': 'Confirm Password',
    'register.confirmPasswordPlaceholder': 'Repeat password',
    'register.agreeToTerms': 'I agree to the',
    'register.termsLink': 'terms and conditions',
    'register.createAccount': 'Create Account',
    'register.alreadyHaveAccount': 'Already have an account?',
    'register.loginLink': 'Sign in',
    'register.orContinueWith': 'Or continue with',
    'register.continueWithGoogle': 'Continue with Google',
    'register.continueWithGitHub': 'Continue with GitHub',
    'register.continueWithEmail': 'Continue with Email',
    'register.back': 'Back',

    // Auth callback
    'auth.processing': 'Processing login...',
    'auth.success': 'Successfully logged in!',
    'auth.error': 'Login error',
    'auth.processingDescription': 'Your account is being verified. Please wait...',
    'auth.successDescription': 'You will be redirected to the main page.',
    'auth.errorDescription': 'Something went wrong during login. Please try again.',
    'auth.tryAgain': 'Try again',
    'feature.security': 'Advanced security',
    'feature.malware': 'Malware scanning',

    // Cookies banner
    'cookies.title': 'We use cookies',
    'cookies.description': 'We use cookies to improve your website experience and analyze traffic.',
    'cookies.accept': 'Accept All',
    'cookies.settings': 'Settings',
    'cookies.decline': 'Decline',

    // Footer
    'footer.description': 'Reliable and powerful web hosting for your projects. With 99.9% uptime and 24/7 support.',
    'footer.services': 'Services',
    'footer.ssl': 'SSL Certificates',
    'footer.backup': 'Backup',
    'footer.support': 'Support',
    'footer.documentation': 'Documentation',
    'footer.faq': 'FAQ',
    'footer.liveSupport': 'Live Support',
    'footer.status': 'Service Status',
    'footer.company': 'Company',
    'footer.careers': 'Careers',
    'footer.privacy': 'Privacy',
    'footer.terms': 'Terms',
    'footer.contact': 'Contact',
    'footer.rights': 'All rights reserved.',
    'footer.cookies': 'Cookies',

    // Hosting page
    'hosting.title': 'Professional',
    'hosting.titleHighlight': ' Hosting Services',
    'hosting.description': 'Discover our high-performance hosting solutions designed for your website\'s success. With advanced technologies and reliable infrastructure.',
    'hosting.featuresTitle': 'Why choose',
    'hosting.featuresDescription': ' our hosting?',
    'hosting.feature1.title': 'Lightning-fast performance',
    'hosting.feature1.description': 'SSD storage and optimized servers for maximum speed of your website.',
    'hosting.feature2.title': '99.9% uptime',
    'hosting.feature2.description': 'Reliable infrastructure with guaranteed high availability.',
    'hosting.feature3.title': '24/7 support',
    'hosting.feature3.description': 'Our expert team is always ready to help with any issue.',
    'hosting.feature4.title': 'Advanced security',
    'hosting.feature4.description': 'Comprehensive malware protection and regular security updates.',
    'hosting.guarantee.title': '30-day guarantee',
    'hosting.guarantee.description': 'Not satisfied? We\'ll refund your money within 30 days, no questions asked.',
    'hosting.guarantee.cta': 'Start risk-free',

    // Domains page
    'domains.title': 'Find the perfect',
    'domains.titleHighlight': ' domain',
    'domains.description': 'Register your ideal domain from a wide range of TLDs and start building your online presence.',
    'domains.searchPlaceholder': 'Enter domain name...',
    'domains.search': 'Search',
    'domains.pricesTitle': 'Transparent',
    'domains.pricesDescription': ' domain pricing',
    'domains.popular': 'Popular',
    'domains.year': 'year',
    'domains.register': 'Register',
    'domains.feature1.title': 'Easy management',
    'domains.feature1.description': 'Intuitive panel for managing all your domains in one place.',
    'domains.feature2.title': 'Free DNS hosting',
    'domains.feature2.description': 'Professional DNS hosting with high availability for all domains.',
    'domains.feature3.title': 'Privacy protection',
    'domains.feature3.description': 'WHOIS protection for your personal data security at no extra cost.',

    // Support page
    'support.title': 'We\'re here for',
    'support.titleHighlight': ' you 24/7',
    'support.description': 'Our expert support team is ready to help with any issue. Contact us in the way that suits you best.',
    'support.searchPlaceholder': 'Search help articles...',
    'support.optionsTitle': 'Support',
    'support.optionsDescription': ' options',
    'support.ticket.title': 'Support tickets',
    'support.ticket.description': 'Create a ticket for complex issues with detailed description.',
    'support.ticket.action': 'Create ticket',
    'support.chat.title': 'Live chat',
    'support.chat.description': 'Quick help through live chat with our team.',
    'support.chat.action': 'Start chat',
    'support.phone.title': 'Phone support',
    'support.phone.description': 'Call us for immediate help with urgent issues.',
    'support.phone.action': 'Call now',
    'support.email.title': 'Email support',
    'support.email.description': 'Send us an email and we\'ll respond within 2 hours.',
    'support.email.action': 'Send email',
    'support.hours.title': 'Support',
    'support.hours.description': 'availability:',
    'support.hours.chat': 'Live chat',
    'support.hours.email': 'Email',
    'support.faqTitle': 'Frequently asked',
    'support.faqDescription': ' questions',
    'support.faq.q1.question': 'How quickly is my hosting activated?',
    'support.faq.q1.answer': 'Hosting is automatically activated within minutes after payment completion.',
    'support.faq.q2.question': 'Can I migrate my existing website?',
    'support.faq.q2.answer': 'Yes, we provide free website migration from another hosting provider.',
    'support.faq.q3.question': 'What is the uptime guarantee?',
    'support.faq.q3.answer': 'We guarantee 99.9% uptime. If we fail to meet this, we\'ll refund a proportional amount.',
    'support.faq.q4.question': 'Can I upgrade my plan later?',
    'support.faq.q4.answer': 'Yes, you can upgrade to a higher plan anytime without service interruption.',

    // About page
    'about.title': 'About',
    'about.titleHighlight': ' Alatyr',
    'about.description': 'We are a Czech hosting provider with more than 10 years of experience. Our mission is to provide reliable and high-performance hosting services.',
    'about.stats.customers': 'Happy customers',
    'about.stats.uptime': 'Average uptime',
    'about.stats.support': 'Average response time',
    'about.stats.years': 'Years of experience',
    'about.story.title': 'Our story',
    'about.story.paragraph1': 'Alatyr was founded in 2014 with a vision to democratize access to quality web hosting. We started as a small team of enthusiasts who believed everyone should have the opportunity to create their online presence.',
    'about.story.paragraph2': 'Over the years, we\'ve grown to become one of the leading hosting providers in the Czech Republic, but we\'ve never lost our personal approach to each customer. We constantly invest in the latest technologies and team education.',
    'about.story.paragraph3': 'Today we serve thousands of customers worldwide and are proud to help realize their digital dreams. Our values remain the same: reliability, innovation, and customer care.',
    'about.valuesTitle': 'Our',
    'about.valuesDescription': ' values',
    'about.values.innovation.title': 'Innovation',
    'about.values.innovation.description': 'We constantly seek new technologies and solutions to improve our services.',
    'about.values.reliability.title': 'Reliability',
    'about.values.reliability.description': 'We provide stable and secure services you can depend on.',
    'about.values.care.title': 'Care',
    'about.values.care.description': 'Every customer is important to us and we provide personalized support.',
    'about.values.performance.title': 'Performance',
    'about.values.performance.description': 'We optimize our infrastructure for maximum speed and performance.',
    'about.teamTitle': 'Our',
    'about.teamDescription': ' team',
    'about.team.ceo.role': 'CEO & Founder',
    'about.team.ceo.description': 'Visionary with more than 15 years of experience in the IT industry.',
    'about.team.cto.role': 'CTO',
    'about.team.cto.description': 'Expert in cloud technologies and system architecture.',
    'about.team.support.role': 'Support Manager',
    'about.team.support.description': 'Ensures excellent customer service and client satisfaction.',
    'about.cta.title': 'Join thousands of satisfied customers',
    'about.cta.description': 'Start your journey with Alatyr today and discover the difference of professional hosting.',
    'about.cta.button': 'Get started',

    // Registration
    'registration.title': 'Create account',
    'registration.titleHighlight': ' today',
    'registration.description': 'Create your account and get access to our hosting services with 24/7 support.',
    'registration.formTitle': 'Registration form',
    'registration.firstName': 'First name *',
    'registration.firstNamePlaceholder': 'Enter your first name',
    'registration.lastName': 'Last name *',
    'registration.lastNamePlaceholder': 'Enter your last name',
    'registration.email': 'Email *',
    'registration.emailPlaceholder': 'your@email.com',
    'registration.company': 'Company',
    'registration.companyPlaceholder': 'Your company name',
    'registration.phone': 'Phone',
    'registration.phonePlaceholder': '+420 123 456 789',
    'registration.password': 'Password *',
    'registration.passwordPlaceholder': 'At least 8 characters',
    'registration.confirmPassword': 'Confirm password *',
    'registration.confirmPasswordPlaceholder': 'Enter password again',
    'registration.acceptTerms': 'I agree to the ',
    'registration.termsLink': 'terms and conditions',
    'registration.acceptNewsletters': 'I want to receive newsletter with updates and offers',
    'registration.submit': 'Create account',
    'registration.submitting': 'Creating...',
    'registration.success': 'Account created successfully! Check your email.',
    'registration.error': 'An error occurred while creating account. Please try again.',
    'registration.benefitsTitle': 'Registration benefits',
    'registration.benefit1': '24/7 technical support',
    'registration.benefit2': 'Free SSL certificate',
    'registration.benefit3': 'Domain management in one place',
    'registration.benefit4': '99.9% guaranteed uptime',
    'registration.benefit5': 'Regular data backups',

    // Registration errors
    'registration.errors.firstNameRequired': 'First name is required',
    'registration.errors.lastNameRequired': 'Last name is required',
    'registration.errors.emailRequired': 'Email is required',
    'registration.errors.emailInvalid': 'Email format is invalid',
    'registration.errors.passwordRequired': 'Password is required',
    'registration.errors.passwordTooShort': 'Password must be at least 8 characters',
    'registration.errors.passwordMismatch': 'Passwords do not match',
    'registration.errors.termsRequired': 'You must agree to the terms and conditions'
  }
};

// Detect user language based on browser/location
const detectLanguage = (): Language => {
  // Check localStorage first
  const stored = localStorage.getItem('language') as Language;
  if (stored && ['cs', 'en'].includes(stored)) {
    return stored;
  }

  // Detect from browser language
  const browserLang = navigator.language.toLowerCase();

  // Czech language detection
  if (browserLang.startsWith('cs') || browserLang.includes('cz')) {
    return 'cs';
  }

  // Default to English for international users
  return 'en';
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('cs');

  useEffect(() => {
    const detectedLang = detectLanguage();
    setLanguageState(detectedLang);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };

  const t = (key: string, fallback?: string): string => {
    return (translations[language] as Record<string, string>)[key] || fallback || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};