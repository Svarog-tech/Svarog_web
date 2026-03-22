/**
 * TemplateService - Email template rendering with DB-backed templates and caching.
 *
 * Supports {{variable}} replacement and simple conditional blocks:
 *   {{#variable}}content{{/variable}}  — rendered only when variable is truthy
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

class TemplateService {
  constructor(db) {
    this.db = db;
    this.cache = new Map(); // key -> { template, fetchedAt }
  }

  /**
   * Retrieve a template by key. Uses in-memory cache with 5-min TTL.
   * Returns null if template not found or inactive.
   */
  async getTemplate(templateKey) {
    // Check cache
    const cached = this.cache.get(templateKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.template;
    }

    try {
      const template = await this.db.queryOne(
        'SELECT * FROM email_templates WHERE template_key = ? AND is_active = 1',
        [templateKey]
      );

      if (template) {
        // Parse variables JSON if it comes as a string
        if (typeof template.variables === 'string') {
          try {
            template.variables = JSON.parse(template.variables);
          } catch {
            template.variables = [];
          }
        }
        this.cache.set(templateKey, { template, fetchedAt: Date.now() });
        return template;
      }
    } catch (err) {
      // DB error — fall through to return null so caller can use hardcoded fallback
      console.error(`[TemplateService] Failed to fetch template "${templateKey}":`, err.message);
    }

    return null;
  }

  /**
   * Render a template object with the given variables.
   *
   * - Replaces {{key}} with the corresponding value (or empty string if missing)
   * - Processes conditional blocks: {{#key}}...{{/key}} — kept only if key is truthy
   * - Works on subject, body_html, and body_text
   */
  renderTemplate(template, variables = {}) {
    const render = (text) => {
      if (!text) return text;

      let result = text;

      // Process conditional blocks first: {{#key}}content{{/key}}
      result = result.replace(
        /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
        (match, key, content) => {
          return variables[key] ? content : '';
        }
      );

      // Replace {{variable}} placeholders
      result = result.replace(
        /\{\{(\w+)\}\}/g,
        (match, key) => {
          const val = variables[key];
          return val !== undefined && val !== null ? String(val) : '';
        }
      );

      return result;
    };

    return {
      subject: render(template.subject),
      html: render(template.body_html),
      text: render(template.body_text),
    };
  }

  /**
   * Convenience: fetch + render in one call.
   * Returns { subject, html, text } or null if template not found.
   */
  async renderByKey(templateKey, variables = {}) {
    const template = await this.getTemplate(templateKey);
    if (!template) return null;
    return this.renderTemplate(template, variables);
  }

  /**
   * Generate sample variable values for preview purposes.
   */
  getSampleVariables(variableNames) {
    const samples = {
      reset_url: 'https://alatyr.cz/reset-password?token=sample-token-123',
      verify_url: 'https://alatyr.cz/verify-email?token=sample-token-456',
      invoice_url: 'https://alatyr.cz/invoices/INV-2026-001',
      amount: '299',
      currency: 'CZK',
      order_id: '10042',
      subject_suffix: 'nová odpověď na váš ticket #1234',
      message_preview: 'Děkujeme za vaši zprávu. Váš problém řešíme...',
      ticket_url: 'https://alatyr.cz/tickets',
      ticket_id: '1234',
      plan_name: 'Hosting Pro',
      domain: 'example.cz',
      expires_at: '15. 4. 2026',
      dashboard_url: 'https://alatyr.cz/services',
      user_name: 'Jan Novák',
      profile_url: 'https://alatyr.cz/profile',
    };

    const result = {};
    for (const name of (variableNames || [])) {
      result[name] = samples[name] || `[${name}]`;
    }
    return result;
  }

  /**
   * Invalidate cache for a specific key, or clear all if no key given.
   */
  invalidateCache(templateKey) {
    if (templateKey) {
      this.cache.delete(templateKey);
    } else {
      this.cache.clear();
    }
  }
}

module.exports = TemplateService;
