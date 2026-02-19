// Jednoduchý email service pro odesílání transakčních emailů (reset hesla, atd.)
// Používá nodemailer, ale pokud není SMTP správně nastaveno, pouze loguje URL do konzole,
// aby se aplikace nerozbila v developmentu.

const nodemailer = require('nodemailer');

/**
 * SECURITY: Escape HTML entities to prevent XSS/HTML injection in emails
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_SECURE,
  } = process.env;

  if (!SMTP_HOST || !SMTP_PORT) {
    console.warn('[Email] SMTP není nakonfigurováno (SMTP_HOST/SMTP_PORT). Emaily se nebudou skutečně odesílat.');
    return null;
  }

  const port = Number(SMTP_PORT);
  const secure = SMTP_SECURE ? SMTP_SECURE === 'true' : port === 465;

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure,
    auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });

  return transporter;
}

async function sendPasswordResetEmail(to, resetUrl) {
  const transport = getTransporter();

  const subject = 'Alatyr Hosting – reset hesla';
  const text = [
    'Dobrý den,',
    '',
    'obdrželi jsme žádost o resetování hesla k Vašemu účtu na Alatyr Hosting.',
    'Pokud jste o reset nežádali, můžete tento email ignorovat.',
    '',
    `Pro nastavení nového hesla použijte tento odkaz:`,
    resetUrl,
    '',
    'Odkaz je platný 1 hodinu.',
    '',
    'S pozdravem,',
    'Alatyr Hosting',
  ].join('\n');

  const html = `
    <p>Dobrý den,</p>
    <p>obdrželi jsme žádost o resetování hesla k Vašemu účtu na <strong>Alatyr Hosting</strong>.</p>
    <p>Pokud jste o reset nežádali, můžete tento email ignorovat.</p>
    <p>
      Pro nastavení nového hesla klikněte na tento odkaz:<br />
      <a href="${escapeHtml(resetUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(resetUrl)}</a>
    </p>
    <p>Odkaz je platný <strong>1 hodinu</strong>.</p>
    <p>S pozdravem,<br />Alatyr Hosting</p>
  `;

  // Pokud není SMTP nakonfigurované, vypiš URL do logu a nevyhazuj chybu
  if (!transport) {
    console.log('[Email] Password reset link (SMTP není nastaveno):', { to, resetUrl });
    return;
  }

  const from =
    process.env.SMTP_FROM ||
    process.env.MAIL_FROM ||
    'no-reply@localhost';

  await transport.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
}

async function sendEmailVerificationEmail(to, verifyUrl) {
  const transport = getTransporter();

  const subject = 'Alatyr Hosting – ověření emailu';
  const text = [
    'Dobrý den,',
    '',
    'děkujeme za registraci na Alatyr Hosting.',
    'Pro dokončení registrace je potřeba ověřit vaši emailovou adresu.',
    '',
    'Pro ověření emailu použijte tento odkaz:',
    verifyUrl,
    '',
    'Pokud jste se neregistrovali, můžete tento email ignorovat.',
    '',
    'S pozdravem,',
    'Alatyr Hosting',
  ].join('\n');

  const html = `
    <p>Dobrý den,</p>
    <p>děkujeme za registraci na <strong>Alatyr Hosting</strong>.</p>
    <p>Pro dokončení registrace je potřeba ověřit vaši emailovou adresu.</p>
    <p>
      Pro ověření emailu klikněte na tento odkaz:<br />
      <a href="${escapeHtml(verifyUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(verifyUrl)}</a>
    </p>
    <p>Pokud jste se neregistrovali, můžete tento email ignorovat.</p>
    <p>S pozdravem,<br />Alatyr Hosting</p>
  `;

  if (!transport) {
    console.log('[Email] Email verification link (SMTP není nastaveno):', { to, verifyUrl });
    return;
  }

  const from =
    process.env.SMTP_FROM ||
    process.env.MAIL_FROM ||
    'no-reply@localhost';

  await transport.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
}

async function sendPaymentConfirmationEmail(to, invoiceUrl, amount, currency, orderId) {
  const transport = getTransporter();

  const subject = 'Alatyr Hosting – potvrzení platby';
  const text = [
    'Dobrý den,',
    '',
    'děkujeme za vaši platbu za hostingovou službu na Alatyr Hosting.',
    `Částka: ${amount} ${currency}`,
    `ID objednávky: ${orderId}`,
    '',
    'Fakturu k této platbě si můžete zobrazit zde:',
    invoiceUrl,
    '',
    'S pozdravem,',
    'Alatyr Hosting',
  ].join('\n');

  const html = `
    <p>Dobrý den,</p>
    <p>děkujeme za vaši platbu za hostingovou službu na <strong>Alatyr Hosting</strong>.</p>
    <p><strong>Částka:</strong> ${escapeHtml(String(amount))} ${escapeHtml(String(currency))}<br/>
       <strong>ID objednávky:</strong> ${escapeHtml(String(orderId))}</p>
    <p>Fakturu k této platbě si můžete zobrazit zde:<br/>
      <a href="${invoiceUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(invoiceUrl)}</a>
    </p>
    <p>S pozdravem,<br />Alatyr Hosting</p>
  `;

  if (!transport) {
    console.log('[Email] Payment confirmation (SMTP není nastaveno):', {
      to,
      invoiceUrl,
      amount,
      currency,
      orderId,
    });
    return;
  }

  const from =
    process.env.SMTP_FROM ||
    process.env.MAIL_FROM ||
    'no-reply@localhost';

  await transport.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
}

async function sendTicketNotificationEmail(to, subjectSuffix, messagePreview, ticketId) {
  const transport = getTransporter();

  const subject = `Alatyr Hosting – ${subjectSuffix}`;
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const ticketUrl = `${appUrl.replace(/\/+$/, '')}/tickets`;

  const text = [
    'Dobrý den,',
    '',
    subjectSuffix,
    '',
    'Náhled zprávy:',
    messagePreview,
    '',
    `Detail ticketu najdete v klientské sekci: ${ticketUrl}`,
    '',
    'S pozdravem,',
    'Alatyr Hosting',
  ].join('\n');

  const html = `
    <p>Dobrý den,</p>
    <p>${escapeHtml(subjectSuffix)}</p>
    <p><strong>Náhled zprávy:</strong><br/>${escapeHtml(messagePreview)}</p>
    <p>Detail ticketu najdete v klientské sekci:<br/>
      <a href="${ticketUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(ticketUrl)}</a>
    </p>
    <p>S pozdravem,<br />Alatyr Hosting</p>
  `;

  if (!transport) {
    console.log('[Email] Ticket notification (SMTP není nastaveno):', {
      to,
      subjectSuffix,
      messagePreview,
      ticketId,
    });
    return;
  }

  const from =
    process.env.SMTP_FROM ||
    process.env.MAIL_FROM ||
    'no-reply@localhost';

  await transport.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
}

/**
 * Notifikace o aktivaci hosting služby
 */
async function sendServiceActivatedEmail(to, planName, domain, expiresAt) {
  const transport = getTransporter();
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const dashUrl = `${appUrl.replace(/\/+$/, '')}/services`;

  const subject = 'Alatyr Hosting – služba aktivována';
  const text = [
    'Dobrý den,',
    '',
    `vaše hostingová služba "${planName}" byla úspěšně aktivována.`,
    domain ? `Doména: ${domain}` : '',
    expiresAt ? `Platnost do: ${new Date(expiresAt).toLocaleDateString('cs-CZ')}` : '',
    '',
    `Správu služby najdete v klientské sekci: ${dashUrl}`,
    '',
    'S pozdravem,',
    'Alatyr Hosting',
  ].filter(Boolean).join('\n');

  const html = `
    <p>Dobrý den,</p>
    <p>vaše hostingová služba <strong>${escapeHtml(planName)}</strong> byla úspěšně aktivována.</p>
    ${domain ? `<p><strong>Doména:</strong> ${escapeHtml(domain)}</p>` : ''}
    ${expiresAt ? `<p><strong>Platnost do:</strong> ${new Date(expiresAt).toLocaleDateString('cs-CZ')}</p>` : ''}
    <p>Správu služby najdete v <a href="${dashUrl}" target="_blank" rel="noopener noreferrer">klientské sekci</a>.</p>
    <p>S pozdravem,<br />Alatyr Hosting</p>
  `;

  if (!transport) {
    console.log('[Email] Service activated (SMTP není nastaveno):', { to, planName, domain });
    return;
  }

  const from = process.env.SMTP_FROM || process.env.MAIL_FROM || 'no-reply@localhost';
  await transport.sendMail({ from, to, subject, text, html });
}

/**
 * Notifikace o blížící se expiraci služby
 */
async function sendServiceExpiringEmail(to, planName, domain, expiresAt) {
  const transport = getTransporter();
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const dashUrl = `${appUrl.replace(/\/+$/, '')}/services`;

  const subject = 'Alatyr Hosting – služba brzy vyprší';
  const expiryDate = new Date(expiresAt).toLocaleDateString('cs-CZ');
  const text = [
    'Dobrý den,',
    '',
    `vaše hostingová služba "${planName}"${domain ? ` (${domain})` : ''} vyprší ${expiryDate}.`,
    '',
    'Pokud máte zapnuté automatické prodlužování, služba bude obnovena automaticky.',
    `V opačném případě ji můžete obnovit v klientské sekci: ${dashUrl}`,
    '',
    'S pozdravem,',
    'Alatyr Hosting',
  ].join('\n');

  const html = `
    <p>Dobrý den,</p>
    <p>vaše hostingová služba <strong>${escapeHtml(planName)}</strong>${domain ? ` (${escapeHtml(domain)})` : ''} vyprší <strong>${expiryDate}</strong>.</p>
    <p>Pokud máte zapnuté automatické prodlužování, služba bude obnovena automaticky.</p>
    <p>V opačném případě ji můžete obnovit v <a href="${dashUrl}" target="_blank" rel="noopener noreferrer">klientské sekci</a>.</p>
    <p>S pozdravem,<br />Alatyr Hosting</p>
  `;

  if (!transport) {
    console.log('[Email] Service expiring (SMTP není nastaveno):', { to, planName, expiresAt });
    return;
  }

  const from = process.env.SMTP_FROM || process.env.MAIL_FROM || 'no-reply@localhost';
  await transport.sendMail({ from, to, subject, text, html });
}

/**
 * Notifikace o změně hesla (bezpečnostní upozornění)
 */
async function sendPasswordChangedEmail(to) {
  const transport = getTransporter();

  const subject = 'Alatyr Hosting – heslo bylo změněno';
  const text = [
    'Dobrý den,',
    '',
    'vaše heslo k účtu na Alatyr Hosting bylo právě změněno.',
    'Pokud jste tuto změnu neprovedli vy, kontaktujte nás ihned na support.',
    '',
    'S pozdravem,',
    'Alatyr Hosting',
  ].join('\n');

  const html = `
    <p>Dobrý den,</p>
    <p>vaše heslo k účtu na <strong>Alatyr Hosting</strong> bylo právě změněno.</p>
    <p>Pokud jste tuto změnu neprovedli vy, kontaktujte nás <strong>ihned</strong> na support.</p>
    <p>S pozdravem,<br />Alatyr Hosting</p>
  `;

  if (!transport) {
    console.log('[Email] Password changed notification (SMTP není nastaveno):', { to });
    return;
  }

  const from = process.env.SMTP_FROM || process.env.MAIL_FROM || 'no-reply@localhost';
  await transport.sendMail({ from, to, subject, text, html });
}

module.exports = {
  sendPasswordResetEmail,
  sendEmailVerificationEmail,
  sendPaymentConfirmationEmail,
  sendTicketNotificationEmail,
  sendServiceActivatedEmail,
  sendServiceExpiringEmail,
  sendPasswordChangedEmail,
};

