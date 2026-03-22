const express = require('express');
const router = express.Router();

module.exports = function({ db, logger, authenticateUser, requireAdmin, templateService }) {
  const { asyncHandler, AppError } = require('../middleware/errorHandler');

  // ============================================
  // HELPERS
  // ============================================

  function validateNumericId(id, paramName = 'id') {
    const num = parseInt(id, 10);
    if (isNaN(num) || num <= 0 || String(num) !== String(id)) {
      throw new AppError(`Invalid ${paramName}: must be a positive integer`, 400);
    }
    return num;
  }

  function parsePagination(query, defaultLimit = 20, maxLimit = 100) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
    const offset = (page - 1) * limit;
    return { page, limit, offset };
  }

  function paginationMeta(page, limit, total) {
    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    };
  }

  // ============================================
  // GET /admin/email-templates — list all templates
  // ============================================
  router.get('/admin/email-templates', authenticateUser, requireAdmin, asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query);
    const category = req.query.category;

    let where = '';
    const params = [];
    if (category) {
      where = 'WHERE category = ?';
      params.push(category);
    }

    const countRow = await db.queryOne(
      `SELECT COUNT(*) AS total FROM email_templates ${where}`,
      params
    );
    const total = countRow ? countRow.total : 0;

    const templates = await db.query(
      `SELECT id, template_key, name, subject, category, is_active, updated_at
       FROM email_templates ${where}
       ORDER BY category, name
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      templates,
      pagination: paginationMeta(page, limit, total),
    });
  }));

  // ============================================
  // GET /admin/email-templates/:id — single template
  // ============================================
  router.get('/admin/email-templates/:id', authenticateUser, requireAdmin, asyncHandler(async (req, res) => {
    const id = validateNumericId(req.params.id);

    const template = await db.queryOne(
      'SELECT * FROM email_templates WHERE id = ?',
      [id]
    );

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    // Parse variables JSON
    if (typeof template.variables === 'string') {
      try {
        template.variables = JSON.parse(template.variables);
      } catch {
        template.variables = [];
      }
    }

    res.json({ template });
  }));

  // ============================================
  // PUT /admin/email-templates/:id — update template
  // ============================================
  router.put('/admin/email-templates/:id', authenticateUser, requireAdmin, asyncHandler(async (req, res) => {
    const id = validateNumericId(req.params.id);
    const { subject, body_html, body_text, is_active } = req.body;

    // Verify template exists
    const existing = await db.queryOne(
      'SELECT id, template_key FROM email_templates WHERE id = ?',
      [id]
    );
    if (!existing) {
      throw new AppError('Template not found', 404);
    }

    // Build update fields
    const updates = [];
    const params = [];

    if (subject !== undefined) {
      if (typeof subject !== 'string' || subject.trim().length === 0) {
        throw new AppError('Subject must be a non-empty string', 400);
      }
      updates.push('subject = ?');
      params.push(subject.trim());
    }

    if (body_html !== undefined) {
      if (typeof body_html !== 'string' || body_html.trim().length === 0) {
        throw new AppError('body_html must be a non-empty string', 400);
      }
      updates.push('body_html = ?');
      params.push(body_html);
    }

    if (body_text !== undefined) {
      updates.push('body_text = ?');
      params.push(body_text || null);
    }

    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active ? 1 : 0);
    }

    // Track who updated
    updates.push('updated_by = ?');
    params.push(req.user.id);

    if (updates.length === 1) {
      // Only updated_by, nothing else changed
      throw new AppError('No fields to update', 400);
    }

    params.push(id);
    await db.query(
      `UPDATE email_templates SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    // Invalidate cache for this template
    templateService.invalidateCache(existing.template_key);

    const updated = await db.queryOne('SELECT * FROM email_templates WHERE id = ?', [id]);
    if (typeof updated.variables === 'string') {
      try { updated.variables = JSON.parse(updated.variables); } catch { updated.variables = []; }
    }

    logger.info('Email template updated', {
      templateId: id,
      templateKey: existing.template_key,
      updatedBy: req.user.id,
    });

    res.json({ success: true, template: updated });
  }));

  // ============================================
  // POST /admin/email-templates/:id/preview — preview with sample data
  // ============================================
  router.post('/admin/email-templates/:id/preview', authenticateUser, requireAdmin, asyncHandler(async (req, res) => {
    const id = validateNumericId(req.params.id);

    const template = await db.queryOne(
      'SELECT * FROM email_templates WHERE id = ?',
      [id]
    );
    if (!template) {
      throw new AppError('Template not found', 404);
    }

    if (typeof template.variables === 'string') {
      try { template.variables = JSON.parse(template.variables); } catch { template.variables = []; }
    }

    // Use provided variables or generate sample ones
    const variables = req.body.variables || templateService.getSampleVariables(template.variables);
    const rendered = templateService.renderTemplate(template, variables);

    res.json({
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      variables_used: variables,
    });
  }));

  // ============================================
  // POST /admin/email-templates/:id/test — send test email
  // ============================================
  router.post('/admin/email-templates/:id/test', authenticateUser, requireAdmin, asyncHandler(async (req, res) => {
    const id = validateNumericId(req.params.id);

    const template = await db.queryOne(
      'SELECT * FROM email_templates WHERE id = ?',
      [id]
    );
    if (!template) {
      throw new AppError('Template not found', 404);
    }

    if (typeof template.variables === 'string') {
      try { template.variables = JSON.parse(template.variables); } catch { template.variables = []; }
    }

    const variables = req.body.variables || templateService.getSampleVariables(template.variables);
    const rendered = templateService.renderTemplate(template, variables);

    // Send via nodemailer
    const nodemailer = require('nodemailer');
    const {
      SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE,
    } = process.env;

    if (!SMTP_HOST || !SMTP_PORT) {
      throw new AppError('SMTP is not configured. Cannot send test email.', 503);
    }

    const port = Number(SMTP_PORT);
    const secure = SMTP_SECURE ? SMTP_SECURE === 'true' : port === 465;

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure,
      auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });

    const adminEmail = req.user.email;
    const from = process.env.SMTP_FROM || process.env.MAIL_FROM || 'no-reply@localhost';

    await transporter.sendMail({
      from,
      to: adminEmail,
      subject: `[TEST] ${rendered.subject}`,
      text: rendered.text || undefined,
      html: rendered.html,
    });

    logger.info('Test email sent', {
      templateId: id,
      templateKey: template.template_key,
      sentTo: adminEmail,
      sentBy: req.user.id,
    });

    res.json({ success: true, sent_to: adminEmail });
  }));

  // ============================================
  // POST /admin/email-templates/reset/:id — reset to default
  // ============================================
  router.post('/admin/email-templates/reset/:id', authenticateUser, requireAdmin, asyncHandler(async (req, res) => {
    const id = validateNumericId(req.params.id);

    const template = await db.queryOne(
      'SELECT id, template_key FROM email_templates WHERE id = ?',
      [id]
    );
    if (!template) {
      throw new AppError('Template not found', 404);
    }

    // Load default from migration SQL is not practical at runtime.
    // Instead we store the defaults in a lookup and restore from there.
    const defaults = getDefaultTemplates();
    const defaultTpl = defaults[template.template_key];

    if (!defaultTpl) {
      throw new AppError('No default template found for this key', 404);
    }

    await db.query(
      `UPDATE email_templates
       SET subject = ?, body_html = ?, body_text = ?, is_active = 1, updated_by = ?
       WHERE id = ?`,
      [defaultTpl.subject, defaultTpl.body_html, defaultTpl.body_text, req.user.id, id]
    );

    templateService.invalidateCache(template.template_key);

    const updated = await db.queryOne('SELECT * FROM email_templates WHERE id = ?', [id]);
    if (typeof updated.variables === 'string') {
      try { updated.variables = JSON.parse(updated.variables); } catch { updated.variables = []; }
    }

    logger.info('Email template reset to default', {
      templateId: id,
      templateKey: template.template_key,
      resetBy: req.user.id,
    });

    res.json({ success: true, template: updated });
  }));

  return router;
};

// ============================================
// Default templates (matching migration inserts)
// ============================================
function getDefaultTemplates() {
  return {
    password_reset: {
      subject: 'Alatyr Hosting – reset hesla',
      body_html: `<p>Dobrý den,</p>
<p>obdrželi jsme žádost o resetování hesla k Vašemu účtu na <strong>Alatyr Hosting</strong>.</p>
<p>Pokud jste o reset nežádali, můžete tento email ignorovat.</p>
<p>
  Pro nastavení nového hesla klikněte na tento odkaz:<br />
  <a href="{{reset_url}}" target="_blank" rel="noopener noreferrer">{{reset_url}}</a>
</p>
<p>Odkaz je platný <strong>1 hodinu</strong>.</p>
<p>S pozdravem,<br />Alatyr Hosting</p>`,
      body_text: 'Dobrý den,\n\nobdrželi jsme žádost o resetování hesla k Vašemu účtu na Alatyr Hosting.\nPokud jste o reset nežádali, můžete tento email ignorovat.\n\nPro nastavení nového hesla použijte tento odkaz:\n{{reset_url}}\n\nOdkaz je platný 1 hodinu.\n\nS pozdravem,\nAlatyr Hosting',
    },
    email_verification: {
      subject: 'Alatyr Hosting – ověření emailu',
      body_html: `<p>Dobrý den,</p>
<p>děkujeme za registraci na <strong>Alatyr Hosting</strong>.</p>
<p>Pro dokončení registrace je potřeba ověřit vaši emailovou adresu.</p>
<p>
  Pro ověření emailu klikněte na tento odkaz:<br />
  <a href="{{verify_url}}" target="_blank" rel="noopener noreferrer">{{verify_url}}</a>
</p>
<p>Pokud jste se neregistrovali, můžete tento email ignorovat.</p>
<p>S pozdravem,<br />Alatyr Hosting</p>`,
      body_text: 'Dobrý den,\n\nděkujeme za registraci na Alatyr Hosting.\nPro dokončení registrace je potřeba ověřit vaši emailovou adresu.\n\nPro ověření emailu použijte tento odkaz:\n{{verify_url}}\n\nPokud jste se neregistrovali, můžete tento email ignorovat.\n\nS pozdravem,\nAlatyr Hosting',
    },
    payment_confirmation: {
      subject: 'Alatyr Hosting – potvrzení platby',
      body_html: `<p>Dobrý den,</p>
<p>děkujeme za vaši platbu za hostingovou službu na <strong>Alatyr Hosting</strong>.</p>
<p><strong>Částka:</strong> {{amount}} {{currency}}<br/>
   <strong>ID objednávky:</strong> {{order_id}}</p>
<p>Fakturu k této platbě si můžete zobrazit zde:<br/>
  <a href="{{invoice_url}}" target="_blank" rel="noopener noreferrer">{{invoice_url}}</a>
</p>
<p>S pozdravem,<br />Alatyr Hosting</p>`,
      body_text: 'Dobrý den,\n\nděkujeme za vaši platbu za hostingovou službu na Alatyr Hosting.\nČástka: {{amount}} {{currency}}\nID objednávky: {{order_id}}\n\nFakturu k této platbě si můžete zobrazit zde:\n{{invoice_url}}\n\nS pozdravem,\nAlatyr Hosting',
    },
    ticket_notification: {
      subject: 'Alatyr Hosting – {{subject_suffix}}',
      body_html: `<p>Dobrý den,</p>
<p>{{subject_suffix}}</p>
<p><strong>Náhled zprávy:</strong><br/>{{message_preview}}</p>
<p>Detail ticketu najdete v klientské sekci:<br/>
  <a href="{{ticket_url}}" target="_blank" rel="noopener noreferrer">{{ticket_url}}</a>
</p>
<p>S pozdravem,<br />Alatyr Hosting</p>`,
      body_text: 'Dobrý den,\n\n{{subject_suffix}}\n\nNáhled zprávy:\n{{message_preview}}\n\nDetail ticketu najdete v klientské sekci: {{ticket_url}}\n\nS pozdravem,\nAlatyr Hosting',
    },
    service_activated: {
      subject: 'Alatyr Hosting – služba aktivována',
      body_html: `<p>Dobrý den,</p>
<p>vaše hostingová služba <strong>{{plan_name}}</strong> byla úspěšně aktivována.</p>
{{#domain}}<p><strong>Doména:</strong> {{domain}}</p>{{/domain}}
{{#expires_at}}<p><strong>Platnost do:</strong> {{expires_at}}</p>{{/expires_at}}
<p>Správu služby najdete v <a href="{{dashboard_url}}" target="_blank" rel="noopener noreferrer">klientské sekci</a>.</p>
<p>S pozdravem,<br />Alatyr Hosting</p>`,
      body_text: 'Dobrý den,\n\nvaše hostingová služba "{{plan_name}}" byla úspěšně aktivována.\n{{#domain}}Doména: {{domain}}\n{{/domain}}{{#expires_at}}Platnost do: {{expires_at}}\n{{/expires_at}}\nSprávu služby najdete v klientské sekci: {{dashboard_url}}\n\nS pozdravem,\nAlatyr Hosting',
    },
    service_expiring: {
      subject: 'Alatyr Hosting – služba brzy vyprší',
      body_html: `<p>Dobrý den,</p>
<p>vaše hostingová služba <strong>{{plan_name}}</strong>{{#domain}} ({{domain}}){{/domain}} vyprší <strong>{{expires_at}}</strong>.</p>
<p>Pokud máte zapnuté automatické prodlužování, služba bude obnovena automaticky.</p>
<p>V opačném případě ji můžete obnovit v <a href="{{dashboard_url}}" target="_blank" rel="noopener noreferrer">klientské sekci</a>.</p>
<p>S pozdravem,<br />Alatyr Hosting</p>`,
      body_text: 'Dobrý den,\n\nvaše hostingová služba "{{plan_name}}"{{#domain}} ({{domain}}){{/domain}} vyprší {{expires_at}}.\n\nPokud máte zapnuté automatické prodlužování, služba bude obnovena automaticky.\nV opačném případě ji můžete obnovit v klientské sekci: {{dashboard_url}}\n\nS pozdravem,\nAlatyr Hosting',
    },
    password_changed: {
      subject: 'Alatyr Hosting – heslo bylo změněno',
      body_html: `<p>Dobrý den,</p>
<p>vaše heslo k účtu na <strong>Alatyr Hosting</strong> bylo právě změněno.</p>
<p>Pokud jste tuto změnu neprovedli vy, kontaktujte nás <strong>ihned</strong> na support.</p>
<p>S pozdravem,<br />Alatyr Hosting</p>`,
      body_text: 'Dobrý den,\n\nvaše heslo k účtu na Alatyr Hosting bylo právě změněno.\nPokud jste tuto změnu neprovedli vy, kontaktujte nás ihned na support.\n\nS pozdravem,\nAlatyr Hosting',
    },
    welcome_email: {
      subject: 'Vítejte na Alatyr Hosting!',
      body_html: `<p>Dobrý den {{user_name}},</p>
<p>vítáme vás na <strong>Alatyr Hosting</strong>! Váš účet byl úspěšně vytvořen.</p>
<p>Pro začátek můžete:</p>
<ul>
  <li>Prohlédnout si naše <a href="{{dashboard_url}}" target="_blank" rel="noopener noreferrer">hostingové plány</a></li>
  <li>Nastavit si <a href="{{profile_url}}" target="_blank" rel="noopener noreferrer">svůj profil</a></li>
</ul>
<p>Pokud budete mít jakékoli otázky, neváhejte nás kontaktovat prostřednictvím support ticketu.</p>
<p>S pozdravem,<br />Alatyr Hosting</p>`,
      body_text: 'Dobrý den {{user_name}},\n\nvítáme vás na Alatyr Hosting! Váš účet byl úspěšně vytvořen.\n\nPro začátek můžete:\n- Prohlédnout si naše hostingové plány: {{dashboard_url}}\n- Nastavit si svůj profil: {{profile_url}}\n\nPokud budete mít jakékoli otázky, neváhejte nás kontaktovat prostřednictvím support ticketu.\n\nS pozdravem,\nAlatyr Hosting',
    },
    '2fa_enabled': {
      subject: 'Alatyr Hosting – dvoufaktorové ověření aktivováno',
      body_html: `<p>Dobrý den,</p>
<p>dvoufaktorové ověření (2FA) bylo úspěšně aktivováno na vašem účtu na <strong>Alatyr Hosting</strong>.</p>
<p>Od teď budete při přihlášení potřebovat kromě hesla i ověřovací kód z vaší autentizační aplikace.</p>
<p>Pokud jste tuto změnu neprovedli vy, kontaktujte nás <strong>ihned</strong> na support.</p>
<p>S pozdravem,<br />Alatyr Hosting</p>`,
      body_text: 'Dobrý den,\n\ndvoufaktorové ověření (2FA) bylo úspěšně aktivováno na vašem účtu na Alatyr Hosting.\n\nOd teď budete při přihlášení potřebovat kromě hesla i ověřovací kód z vaší autentizační aplikace.\n\nPokud jste tuto změnu neprovedli vy, kontaktujte nás ihned na support.\n\nS pozdravem,\nAlatyr Hosting',
    },
  };
}
