const express = require('express');
const router = express.Router();

module.exports = function({ db, logger, authenticateUser, parsePagination, paginationMeta, validateNumericId }) {
  const { asyncHandler, AppError } = require('../middleware/errorHandler');
  const discordService = require('../services/discordService');
  const { initializeDiscordBot, getDiscordBot } = require('../services/discordTicketBot');
  const { sendTicketNotificationEmail } = require('../services/emailService');

  /**
   * Create a new support ticket
   * POST /
   * Protected route - requires authentication
   */
  router.post('/',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const { subject, message, priority, category } = req.body;
      const userId = req.user.id;

      // Validation: must be strings with non-whitespace content (reject arrays, objects, whitespace-only)
      if (typeof subject !== 'string' || typeof message !== 'string') {
        throw new AppError('Subject and message must be strings', 400);
      }
      const subjectTrimmed = subject.trim();
      const messageTrimmed = message.trim();
      if (!subjectTrimmed || !messageTrimmed) {
        throw new AppError('Subject and message are required and cannot be whitespace-only', 400);
      }

      // SECURITY: Length validation to prevent oversized payloads hitting the database
      if (subjectTrimmed.length > 200) {
        throw new AppError('Subject too long (max 200 characters)', 400);
      }
      if (messageTrimmed.length > 10000) {
        throw new AppError('Message too long (max 10000 characters)', 400);
      }

      // Validate priority
      const validPriorities = ['low', 'medium', 'high', 'urgent'];
      const ticketPriority = priority && validPriorities.includes(priority) ? priority : 'medium';

      // Validate category
      const validCategories = ['general', 'technical', 'billing', 'domain', 'hosting'];
      const ticketCategory = category && validCategories.includes(category) ? category : 'general';

      // Insert ticket into database
      const insertQuery = `
        INSERT INTO support_tickets (user_id, subject, message, priority, category, status)
        VALUES (?, ?, ?, ?, ?, 'open')
      `;

      const result = await db.execute(insertQuery, [
        userId,
        subjectTrimmed,
        messageTrimmed,
        ticketPriority,
        ticketCategory
      ]);

      const ticketId = result.insertId;

      // Get user info for Discord notification
      // BUG FIX: users tabulka nema sloupec "name" - jmeno je v tabulce profiles (first_name, last_name)
      const userQuery = 'SELECT email, first_name, last_name FROM profiles WHERE id = ?';
      const userResult = await db.queryOne(userQuery, [userId]);

      // Send Discord notification and create ticket channel (non-blocking)
      if (userResult) {
        const fullName = [userResult.first_name, userResult.last_name]
          .filter(Boolean)
          .join(' ')
          .trim();

        const ticketData = {
          ticketId: ticketId,
          userId: userId,
          name: fullName || userResult.email || 'Unknown',
          email: userResult.email || 'Unknown',
          subject: subjectTrimmed,
          message: messageTrimmed,
          priority: ticketPriority,
          category: ticketCategory,
          status: 'open'
        };

        // Legacy Discord notification (to notification channel)
        discordService.sendTicketNotification(ticketData).catch(error => {
          logger.error('Failed to send Discord notification', { error: error?.message || String(error) });
        });

        // Create Discord ticket channel (new feature)
        const discordBot = getDiscordBot();
        if (discordBot && discordBot.ready) {
          discordBot.createTicketChannel(ticketData).catch(error => {
            logger.error('Failed to create Discord ticket channel', { error: error?.message || String(error) });
          });
        }
      }

      logger.info(`Ticket #${ticketId} created by user ${userId}`, {
        requestId: req.id,
        ticketId,
        userId,
        priority: ticketPriority,
        category: ticketCategory
      });

      res.status(201).json({
        success: true,
        message: 'Ticket created successfully',
        ticket: {
          id: ticketId,
          subject: subjectTrimmed,
          message: messageTrimmed,
          priority: ticketPriority,
          category: ticketCategory,
          status: 'open',
          created_at: new Date().toISOString()
        }
      });
    })
  );

  /**
   * Get user's tickets
   * GET /
   * Protected route - requires authentication
   */
  router.get('/',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const { page, limit, offset } = parsePagination(req.query);

      const countResult = await db.query(
        'SELECT COUNT(*) as total FROM support_tickets WHERE user_id = ?', [userId]
      );
      const total = countResult[0]?.total || 0;

      const tickets = await db.query(`
        SELECT t.id, t.subject, t.message, t.status, t.priority, t.category,
               t.created_at, t.updated_at, t.last_reply_at, t.resolved_at,
               TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))) AS user_name
        FROM support_tickets t
        LEFT JOIN profiles p ON p.id = t.user_id
        WHERE t.user_id = ?
        ORDER BY t.created_at DESC LIMIT ? OFFSET ?
      `, [userId, limit, offset]);

      logger.info(`Retrieved ${tickets.length} tickets for user ${userId}`, {
        requestId: req.id,
        userId,
        ticketCount: tickets.length
      });

      res.json({
        success: true,
        tickets: tickets || [],
        pagination: paginationMeta(page, limit, total)
      });
    })
  );

  /**
   * Get a specific ticket by ID (vlastnik nebo admin)
   * GET /:id
   */
  router.get('/:id',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const ticketId = validateNumericId(req.params.id);
      const userId = req.user.id;

      const ticket = await db.queryOne(
        `SELECT t.id, t.user_id, t.subject, t.message, t.status, t.priority, t.category, t.assigned_to,
                t.created_at, t.updated_at, t.last_reply_at, t.resolved_at,
                TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))) AS user_name,
                p.email AS user_email
         FROM support_tickets t
         LEFT JOIN profiles p ON p.id = t.user_id
         WHERE t.id = ?`,
        [ticketId]
      );
      if (!ticket) throw new AppError('Ticket not found', 404);

      const isOwner = ticket.user_id === userId;
      if (!isOwner && !req.user.is_admin) {
        throw new AppError('Forbidden', 403);
      }

      res.json({ success: true, ticket });
    })
  );

  /**
   * Update ticket (status, priority, assigned_to)
   * PUT /:id
   * body: { status?, priority?, assigned_to? }
   */
  router.put('/:id',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const ticketId = validateNumericId(req.params.id);
      const { status, priority, assigned_to } = req.body || {};

      const ticket = await db.queryOne('SELECT id, user_id FROM support_tickets WHERE id = ?', [ticketId]);
      if (!ticket) throw new AppError('Ticket not found', 404);

      const isOwner = ticket.user_id === req.user.id;
      const isAdmin = !!req.user.is_admin;
      if (!isOwner && !isAdmin) throw new AppError('Forbidden', 403);

      const updates = [];
      const values = [];
      const validStatus = ['open', 'in_progress', 'waiting', 'resolved', 'closed'];
      const validPriority = ['low', 'medium', 'high', 'urgent'];

      // SECURITY: Non-admin users can only close their own tickets
      if (status && validStatus.includes(status)) {
        if (!isAdmin && status !== 'closed') {
          throw new AppError('You can only close tickets', 403);
        }
        updates.push('status = ?');
        values.push(status);
      }
      // SECURITY: Only admins can change priority and assignment
      if (priority && validPriority.includes(priority)) {
        if (!isAdmin) throw new AppError('Only admins can change priority', 403);
        updates.push('priority = ?');
        values.push(priority);
      }
      if (assigned_to !== undefined) {
        if (!isAdmin) throw new AppError('Only admins can assign tickets', 403);
        updates.push('assigned_to = ?');
        values.push(assigned_to === null || assigned_to === '' ? null : assigned_to);
      }
      if (updates.length === 0) throw new AppError('No valid fields to update', 400);
      values.push(ticketId);
      await db.execute(
        `UPDATE support_tickets SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
        values
      );
      const updated = await db.queryOne('SELECT * FROM support_tickets WHERE id = ?', [ticketId]);

      // Notify Discord about status change (non-blocking)
      try {
        const discordBot = getDiscordBot();
        if (discordBot && discordBot.ready && status) {
          if (status === 'closed') {
            // Handle ticket closure - delete Discord channel
            discordBot.onTicketClosed(ticketId).catch(err => {
              logger.error('Failed to close Discord ticket channel', { error: err?.message || String(err), ticketId });
            });
          } else {
            // Notify about status change
            discordBot.onTicketStatusChanged(ticketId, status).catch(err => {
              logger.error('Failed to notify Discord about status change', { error: err?.message || String(err), ticketId });
            });
          }
        }
      } catch (discordError) {
        logger.error('Discord status notification error', { error: discordError?.message || String(discordError), ticketId });
      }

      res.json({ success: true, ticket: updated });
    })
  );

  /**
   * Get messages for a ticket
   * GET /:id/messages
   */
  router.get('/:id/messages',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const ticketId = validateNumericId(req.params.id);

      const ticket = await db.queryOne('SELECT id, user_id FROM support_tickets WHERE id = ?', [ticketId]);
      if (!ticket) throw new AppError('Ticket not found', 404);

      const isOwner = ticket.user_id === req.user.id;
      if (!isOwner && !req.user.is_admin) throw new AppError('Forbidden', 403);

      const messages = await db.query(
        `SELECT m.id, m.ticket_id, m.user_id, m.message, m.is_admin_reply, m.created_at,
                CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, '')) AS user_name,
                p.email AS user_email
         FROM ticket_messages m
         LEFT JOIN profiles p ON p.id = m.user_id
         WHERE m.ticket_id = ? ORDER BY m.created_at ASC`,
        [ticketId]
      );
      const formatted = (messages || []).map(m => ({
        ...m,
        user_name: (m.user_name || '').trim() || m.user_email || 'Uzivatel'
      }));
      res.json({ success: true, messages: formatted });
    })
  );

  /**
   * Add message to ticket
   * POST /:id/messages
   * body: { message, is_admin_reply?, mentions? }
   */
  router.post('/:id/messages',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const ticketId = validateNumericId(req.params.id);
      const { message, is_admin_reply } = req.body || {};

      if (typeof message !== 'string' || !message.trim()) throw new AppError('Message is required', 400);

      // SECURITY: Length validation for ticket reply messages
      if (message.trim().length > 10000) {
        throw new AppError('Message too long (max 10000 characters)', 400);
      }

      const ticket = await db.queryOne(
        `SELECT t.id, t.user_id, t.subject, p.email AS user_email
         FROM support_tickets t
         LEFT JOIN profiles p ON p.id = t.user_id
         WHERE t.id = ?`,
        [ticketId]
      );
      if (!ticket) throw new AppError('Ticket not found', 404);

      const isOwner = ticket.user_id === req.user.id;
      const isAdmin = !!req.user.is_admin;
      if (!isOwner && !isAdmin) throw new AppError('Forbidden', 403);

      await db.execute(
        'INSERT INTO ticket_messages (ticket_id, user_id, message, is_admin_reply) VALUES (?, ?, ?, ?)',
        [ticketId, req.user.id, message.trim(), isAdmin]
      );
      await db.execute(
        'UPDATE support_tickets SET last_reply_at = NOW(), updated_at = NOW() WHERE id = ?',
        [ticketId]
      );

      const messages = await db.query(
        'SELECT id, ticket_id, user_id, message, is_admin_reply, created_at FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC',
        [ticketId]
      );

      // BEST-EFFORT EMAIL NOTIFIKACE (neblokuje odpoved)
      try {
        const appUrl = process.env.APP_URL || 'http://localhost:3000';
        const subjectBase = ticket.subject || `Ticket #${ticket.id}`;
        const preview = message.trim().slice(0, 200);

        // Pokud odpovida admin -> posli mail uzivateli
        if (isAdmin && ticket.user_email) {
          await sendTicketNotificationEmail(
            ticket.user_email,
            `Nova odpoved na ticket: ${subjectBase}`,
            preview,
            ticket.id
          );
        }

        // Pokud odpovida uzivatel -> TODO: tady by bylo vhodne poslat email na support/admin adresu
        // Muzeme pouzit SMTP_FROM jako fallback prijemce
        if (!isAdmin) {
          const supportEmail = process.env.SMTP_FROM || process.env.MAIL_FROM;
          if (supportEmail) {
            await sendTicketNotificationEmail(
              supportEmail,
              `Nova zprava od zakaznika v ticketu: ${subjectBase}`,
              preview,
              ticket.id
            );
          }
        }
      } catch (emailError) {
        logger.error('Failed to send ticket notification email', {
          requestId: req.id,
          error: emailError.message || emailError,
          ticketId,
        });
      }

      // Sync message to Discord channel (non-blocking)
      try {
        const discordBot = getDiscordBot();
        if (discordBot && discordBot.ready) {
          const userName = req.user.first_name && req.user.last_name
            ? `${req.user.first_name} ${req.user.last_name}`.trim()
            : req.user.email || 'Unknown';
          discordBot.sendMessageToChannel(ticketId, message.trim(), userName, isAdmin).catch(err => {
            logger.error('Failed to sync message to Discord', { error: err?.message || String(err), ticketId });
          });
        }
      } catch (discordError) {
        logger.error('Discord message sync error', { error: discordError?.message || String(discordError), ticketId });
      }

      res.json({ success: true, messages: messages || [] });
    })
  );

  /**
   * Public ticket endpoint for testing (development only)
   * POST /public - Creates a ticket without auth, just Discord channel
   */
  router.post('/public', asyncHandler(async (req, res) => {
    const { subject, message, priority, category, email, name } = req.body;

    // Validation
    if (!subject?.trim() || !message?.trim()) {
      throw new AppError('Subject and message are required', 400);
    }

    const discordBot = getDiscordBot();
    if (!discordBot || !discordBot.isReady) {
      throw new AppError('Discord bot is not ready', 503);
    }

    const ticketId = Date.now();
    const ticketData = {
      ticketId,
      userId: 0,
      name: name?.trim() || 'Test User',
      email: email?.trim() || 'test@example.com',
      subject: subject.trim(),
      message: message.trim(),
      priority: ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium',
      category: ['general', 'technical', 'billing', 'domain', 'hosting'].includes(category) ? category : 'general',
      status: 'open'
    };

    const channelId = await discordBot.createTicketChannel(ticketData);

    if (channelId) {
      logger.info(`[DEV] Public ticket #${ticketId} created`, { ticketId, channelId });
      res.json({
        success: true,
        ticketId,
        channelId,
        message: 'Ticket created (development mode - Discord only)'
      });
    } else {
      throw new AppError('Failed to create Discord channel', 500);
    }
  }));

  return router;
};
