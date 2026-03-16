/**
 * Discord Ticket Bot Service
 *
 * Handles bidirectional ticket communication between Discord and the web app.
 * Creates private channels for each ticket where support staff can communicate with users.
 */

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  Events
} = require('discord.js');

// Configuration
const PRIORITY_COLORS = {
  low: 0x3498DB,      // Blue
  medium: 0xF1C40F,   // Yellow
  high: 0xE67E22,     // Orange
  urgent: 0xE74C3C    // Red
};

const CATEGORY_EMOJIS = {
  general: '💬',
  technical: '🔧',
  billing: '💰',
  domain: '🌐',
  hosting: '🖥️'
};

const STATUS_COLORS = {
  open: 0x3498DB,
  in_progress: 0xF39C12,
  waiting: 0x9B59B6,
  resolved: 0x2ECC71,
  closed: 0x95A5A6
};

class DiscordTicketBot {
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
      ]
    });

    this.db = null;
    this.isReady = false;
    this.guildId = process.env.DISCORD_GUILD_ID || '';
    this.categoryId = process.env.DISCORD_TICKET_CATEGORY_ID || '';
    this.ticketRoleId = process.env.DISCORD_TICKET_ROLE_ID || '';
    this.logChannelId = process.env.DISCORD_LOG_CHANNEL_ID || null;

    // In-memory ticket tracking (when database is not available)
    this.ticketChannels = new Map(); // ticketId -> channelId
    this.channelTickets = new Map(); // channelId -> ticketId

    this.setupEventHandlers();
  }

  /**
   * Set database connection (optional)
   */
  setDatabase(db) {
    this.db = db;
  }

  /**
   * Initialize and connect the bot
   */
  async initialize() {
    const token = process.env.DISCORD_BOT_TOKEN;

    if (!token) {
      console.warn('[DiscordBot] DISCORD_BOT_TOKEN not configured. Bot disabled.');
      return false;
    }

    if (!this.guildId || !this.categoryId || !this.ticketRoleId) {
      console.warn('[DiscordBot] Missing required Discord configuration (GUILD_ID, CATEGORY_ID, or TICKET_ROLE_ID). Bot disabled.');
      return false;
    }

    let timeout;
    try {
      // Create a promise that resolves when the bot is ready
      const readyPromise = new Promise((resolve, reject) => {
        timeout = setTimeout(() => {
          reject(new Error('Bot login timed out after 30 seconds'));
        }, 30000);

        this.client.once(Events.ClientReady, () => {
          clearTimeout(timeout);
          resolve(true);
        });

        this.client.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      await this.client.login(token);
      await readyPromise;
      return true;
    } catch (error) {
      // Clear timeout to prevent crashes
      if (timeout) clearTimeout(timeout);

      // Don't crash the server, just log the error
      if (error.message?.includes('disallowed intents')) {
        console.error('[DiscordBot] Failed to login: MESSAGE CONTENT INTENT not enabled!');
        console.error('[DiscordBot] Go to Discord Developer Portal -> Bot -> Enable "MESSAGE CONTENT INTENT"');
      } else {
        console.error('[DiscordBot] Failed to login:', error.message);
      }
      this.isReady = false;
      return false;
    }
  }

  /**
   * Setup event handlers for the Discord client
   */
  setupEventHandlers() {
    this.client.once(Events.ClientReady, (client) => {
      console.log(`[DiscordBot] Logged in as ${client.user.tag}`);
      this.isReady = true;
    });

    // Handle messages in ticket channels
    this.client.on(Events.MessageCreate, async (message) => {
      await this.handleMessage(message);
    });

    // Handle button interactions (close ticket, etc.)
    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (interaction.isButton()) {
        await this.handleButtonInteraction(interaction);
      }
    });

    this.client.on(Events.Error, (error) => {
      console.error('[DiscordBot] Client error:', error);
    });
  }

  /**
   * Create a Discord channel for a new ticket
   */
  async createTicketChannel(ticket) {
    if (!this.isReady) {
      console.warn('[DiscordBot] Bot not ready');
      return null;
    }

    try {
      const guild = await this.client.guilds.fetch(this.guildId);
      if (!guild) {
        console.error('[DiscordBot] Guild not found');
        return null;
      }

      // Create channel name (sanitized)
      const channelName = `ticket-${ticket.ticketId}-${this.sanitizeChannelName(ticket.subject)}`;

      // Define permissions
      const permissionOverwrites = [
        {
          id: guild.id, // @everyone
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: this.ticketRoleId, // Ticket support role
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
          ]
        },
        {
          id: this.client.user.id, // Bot
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.EmbedLinks
          ]
        }
      ];

      // Create the channel
      const channel = await guild.channels.create({
        name: channelName.substring(0, 100), // Discord limit
        type: ChannelType.GuildText,
        parent: this.categoryId,
        permissionOverwrites,
        topic: `Ticket #${ticket.ticketId} | ${ticket.email} | ${ticket.category}`
      });

      // Send initial ticket embed with close button
      const embed = this.createTicketEmbed(ticket);
      const row = this.createActionButtons(ticket.ticketId);

      const sentMessage = await channel.send({
        content: `<@&${this.ticketRoleId}> New ticket received!`,
        embeds: [embed],
        components: [row]
      });

      // Store in memory
      this.ticketChannels.set(ticket.ticketId, channel.id);
      this.channelTickets.set(channel.id, ticket.ticketId);

      // Save to database if available
      if (this.db) {
        try {
          await this.db.execute(
            'UPDATE support_tickets SET discord_channel_id = ?, discord_message_id = ? WHERE id = ?',
            [channel.id, sentMessage.id, ticket.ticketId]
          );
        } catch (dbError) {
          console.warn('[DiscordBot] Could not save to database:', dbError.message);
        }
      }

      // Log to log channel if configured
      await this.logTicketAction('created', ticket, channel.id);

      console.log(`[DiscordBot] Created channel ${channel.name} for ticket #${ticket.ticketId}`);
      return channel.id;
    } catch (error) {
      console.error('[DiscordBot] Failed to create ticket channel:', error);
      return null;
    }
  }

  /**
   * Send a message to a ticket's Discord channel
   */
  async sendMessageToChannel(ticketId, message, userName, isAdminReply) {
    if (!this.isReady) return false;

    try {
      // Try memory first, then database
      let channelId = this.ticketChannels.get(ticketId);

      if (!channelId && this.db) {
        try {
          const ticket = await this.db.queryOne(
            'SELECT discord_channel_id FROM support_tickets WHERE id = ?',
            [ticketId]
          );
          channelId = ticket?.discord_channel_id;
        } catch (dbError) {
          console.warn('[DiscordBot] Could not query database:', dbError.message);
        }
      }

      if (!channelId) {
        console.warn(`[DiscordBot] No Discord channel for ticket #${ticketId}`);
        return false;
      }

      const channel = await this.client.channels.fetch(channelId);
      if (!channel) {
        console.error(`[DiscordBot] Channel not found: ${channelId}`);
        return false;
      }

      // Create embed for the message
      const embed = new EmbedBuilder()
        .setColor(isAdminReply ? 0x3498DB : 0x2ECC71)
        .setAuthor({
          name: isAdminReply ? `🛡️ ${userName} (Support)` : `👤 ${userName}`,
        })
        .setDescription(message.length > 4096 ? message.substring(0, 4093) + '...' : message)
        .setTimestamp()
        .setFooter({ text: isAdminReply ? 'Admin Reply (from Web)' : 'Customer Message (from Web)' });

      await channel.send({ embeds: [embed] });
      return true;
    } catch (error) {
      console.error('[DiscordBot] Failed to send message to channel:', error);
      return false;
    }
  }

  /**
   * Handle messages in ticket channels
   */
  async handleMessage(message) {
    // Ignore bot messages
    if (message.author.bot) return;

    // Check if this is a ticket channel (from memory)
    const ticketId = this.channelTickets.get(message.channel.id);

    if (!ticketId) {
      // Try to get from channel topic
      const topic = message.channel.topic;
      if (!topic || !topic.includes('Ticket #')) return;
    }

    // Check if user has the ticket role (is support staff)
    const member = message.member;
    const hasTicketRole = member?.roles.cache.has(this.ticketRoleId);

    // Save to database if available
    if (this.db && ticketId) {
      try {
        const ticket = await this.db.queryOne(
          'SELECT id, user_id, status FROM support_tickets WHERE id = ?',
          [ticketId]
        );

        if (ticket) {
          if (ticket.status === 'closed') {
            await message.reply('⚠️ This ticket is closed. Please open a new ticket if you need assistance.');
            return;
          }

          await this.db.execute(
            `INSERT INTO ticket_messages (ticket_id, user_id, message, is_admin_reply, source, discord_message_id, created_at)
             VALUES (?, ?, ?, ?, 'discord', ?, NOW())`,
            [ticket.id, ticket.user_id, message.content, hasTicketRole ? 1 : 0, message.id]
          );

          await this.db.execute(
            'UPDATE support_tickets SET last_reply_at = NOW(), updated_at = NOW() WHERE id = ?',
            [ticket.id]
          );
        }
      } catch (dbError) {
        console.warn('[DiscordBot] Could not save message to database:', dbError.message);
      }
    }

    // Add reaction to confirm message was processed
    await message.react('✅');
    console.log(`[DiscordBot] Message processed in ticket channel`);
  }

  /**
   * Handle button interactions
   */
  async handleButtonInteraction(interaction) {
    const [action, ticketIdStr] = interaction.customId.split('_');
    const ticketId = parseInt(ticketIdStr, 10);

    if (isNaN(ticketId)) return;

    try {
      switch (action) {
        case 'close':
          await this.closeTicket(interaction, ticketId);
          break;
        case 'resolve':
          await this.resolveTicket(interaction, ticketId);
          break;
        case 'reopen':
          await this.reopenTicket(interaction, ticketId);
          break;
        default:
          await interaction.reply({ content: 'Unknown action', ephemeral: true });
      }
    } catch (error) {
      console.error('[DiscordBot] Button interaction error:', error);
      await interaction.reply({ content: 'An error occurred', ephemeral: true });
    }
  }

  /**
   * Close a ticket
   */
  async closeTicket(interaction, ticketId) {
    await interaction.deferReply();

    try {
      // Update database if available
      if (this.db) {
        try {
          await this.db.execute(
            'UPDATE support_tickets SET status = ?, updated_at = NOW(), resolved_at = NOW() WHERE id = ?',
            ['closed', ticketId]
          );
        } catch (dbError) {
          console.warn('[DiscordBot] Could not update database:', dbError.message);
        }
      }

      // Send closing message
      const embed = new EmbedBuilder()
        .setColor(0x95A5A6)
        .setTitle('🔒 Ticket Closed')
        .setDescription(`This ticket has been closed by ${interaction.user.tag}.\n\nThis channel will be deleted in 5 seconds.`)
        .addFields(
          { name: 'Ticket ID', value: `#${ticketId}`, inline: true },
          { name: 'Closed At', value: new Date().toLocaleString(), inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Log the action
      await this.logTicketAction('closed', { ticketId }, interaction.channel.id, interaction.user.tag);

      // Clean up memory
      this.ticketChannels.delete(ticketId);
      this.channelTickets.delete(interaction.channel.id);

      // Delete channel after delay (5 seconds)
      setTimeout(async () => {
        try {
          const channel = interaction.channel;
          if (channel) {
            await channel.delete('Ticket closed');
            console.log(`[DiscordBot] Deleted channel for ticket #${ticketId}`);
          }
        } catch (err) {
          console.error('[DiscordBot] Failed to delete channel:', err);
        }
      }, 5000);
    } catch (error) {
      console.error('[DiscordBot] Failed to close ticket:', error);
      await interaction.editReply('Failed to close ticket. Please try again.');
    }
  }

  /**
   * Mark ticket as resolved (but keep channel open)
   */
  async resolveTicket(interaction, ticketId) {
    try {
      // Update database if available
      if (this.db) {
        try {
          await this.db.execute(
            'UPDATE support_tickets SET status = ?, updated_at = NOW(), resolved_at = NOW() WHERE id = ?',
            ['resolved', ticketId]
          );
        } catch (dbError) {
          console.warn('[DiscordBot] Could not update database:', dbError.message);
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle('✅ Ticket Resolved')
        .setDescription(`This ticket has been marked as resolved by ${interaction.user.tag}.`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      // Update the original message with new buttons
      const message = interaction.message;
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`reopen_${ticketId}`)
            .setLabel('Reopen')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔓'),
          new ButtonBuilder()
            .setCustomId(`close_${ticketId}`)
            .setLabel('Close & Delete')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️')
        );

      await message.edit({ components: [row] });
    } catch (error) {
      console.error('[DiscordBot] Failed to resolve ticket:', error);
      await interaction.reply({ content: 'Failed to resolve ticket.', ephemeral: true });
    }
  }

  /**
   * Reopen a resolved ticket
   */
  async reopenTicket(interaction, ticketId) {
    try {
      // Update database if available
      if (this.db) {
        try {
          await this.db.execute(
            'UPDATE support_tickets SET status = ?, updated_at = NOW(), resolved_at = NULL WHERE id = ?',
            ['in_progress', ticketId]
          );
        } catch (dbError) {
          console.warn('[DiscordBot] Could not update database:', dbError.message);
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0xF39C12)
        .setTitle('🔓 Ticket Reopened')
        .setDescription(`This ticket has been reopened by ${interaction.user.tag}.`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      // Update buttons back to original
      const row = this.createActionButtons(ticketId);
      await interaction.message.edit({ components: [row] });
    } catch (error) {
      console.error('[DiscordBot] Failed to reopen ticket:', error);
      await interaction.reply({ content: 'Failed to reopen ticket.', ephemeral: true });
    }
  }

  /**
   * Close and delete channel when ticket is closed via web
   */
  async onTicketClosed(ticketId) {
    if (!this.isReady) return;

    try {
      let channelId = this.ticketChannels.get(ticketId);

      if (!channelId && this.db) {
        try {
          const ticket = await this.db.queryOne(
            'SELECT discord_channel_id FROM support_tickets WHERE id = ?',
            [ticketId]
          );
          channelId = ticket?.discord_channel_id;
        } catch (dbError) {
          console.warn('[DiscordBot] Could not query database:', dbError.message);
        }
      }

      if (!channelId) return;

      const channel = await this.client.channels.fetch(channelId);
      if (!channel) return;

      // Send closing notification
      const embed = new EmbedBuilder()
        .setColor(0x95A5A6)
        .setTitle('🔒 Ticket Closed via Web')
        .setDescription('This ticket has been closed from the web interface.\nThis channel will be deleted in 5 seconds.')
        .setTimestamp();

      await channel.send({ embeds: [embed] });

      // Clean up memory
      this.ticketChannels.delete(ticketId);
      this.channelTickets.delete(channelId);

      // Delete channel after delay
      setTimeout(async () => {
        try {
          await channel.delete('Ticket closed via web');
        } catch (err) {
          console.error('[DiscordBot] Failed to delete channel:', err);
        }
      }, 5000);
    } catch (error) {
      console.error('[DiscordBot] Failed to handle web ticket close:', error);
    }
  }

  /**
   * Update ticket status embed when status changes
   */
  async onTicketStatusChanged(ticketId, newStatus) {
    if (!this.isReady) return;

    try {
      let channelId = this.ticketChannels.get(ticketId);

      if (!channelId && this.db) {
        try {
          const ticket = await this.db.queryOne(
            'SELECT discord_channel_id FROM support_tickets WHERE id = ?',
            [ticketId]
          );
          channelId = ticket?.discord_channel_id;
        } catch (dbError) {
          console.warn('[DiscordBot] Could not query database:', dbError.message);
        }
      }

      if (!channelId) return;

      const channel = await this.client.channels.fetch(channelId);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setColor(STATUS_COLORS[newStatus] || 0x95A5A6)
        .setTitle(`📊 Status Updated`)
        .setDescription(`Ticket status changed to: **${newStatus.replace('_', ' ').toUpperCase()}**`)
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('[DiscordBot] Failed to send status update:', error);
    }
  }

  /**
   * Create ticket embed
   */
  createTicketEmbed(ticket) {
    const categoryEmoji = CATEGORY_EMOJIS[ticket.category] || '📋';
    const priorityColor = PRIORITY_COLORS[ticket.priority] || 0x3498DB;

    return new EmbedBuilder()
      .setColor(priorityColor)
      .setTitle(`${categoryEmoji} Ticket #${ticket.ticketId}`)
      .setDescription(ticket.message.length > 4096 ? ticket.message.substring(0, 4093) + '...' : ticket.message)
      .addFields(
        { name: '📝 Subject', value: ticket.subject, inline: false },
        { name: '👤 Customer', value: ticket.name || 'Unknown', inline: true },
        { name: '📧 Email', value: ticket.email || 'Unknown', inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: '🏷️ Priority', value: (ticket.priority || 'medium').charAt(0).toUpperCase() + (ticket.priority || 'medium').slice(1), inline: true },
        { name: '📂 Category', value: (ticket.category || 'general').charAt(0).toUpperCase() + (ticket.category || 'general').slice(1), inline: true },
        { name: '📊 Status', value: (ticket.status || 'open').replace('_', ' ').toUpperCase(), inline: true }
      )
      .setFooter({ text: 'Reply in this channel to respond to the customer' })
      .setTimestamp();
  }

  /**
   * Create action buttons row
   */
  createActionButtons(ticketId) {
    return new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`resolve_${ticketId}`)
          .setLabel('Mark Resolved')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅'),
        new ButtonBuilder()
          .setCustomId(`close_${ticketId}`)
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒')
      );
  }

  /**
   * Log ticket action to log channel
   */
  async logTicketAction(action, ticket, channelId, actor) {
    if (!this.logChannelId || !this.isReady) return;

    try {
      const logChannel = await this.client.channels.fetch(this.logChannelId);
      if (!logChannel) return;

      const embed = new EmbedBuilder()
        .setColor(action === 'created' ? 0x2ECC71 : action === 'closed' ? 0xE74C3C : 0xF39C12)
        .setTitle(`📋 Ticket ${action.charAt(0).toUpperCase() + action.slice(1)}`)
        .addFields(
          { name: 'Ticket ID', value: `#${ticket.ticketId || ticket.id}`, inline: true },
          { name: 'Channel', value: `<#${channelId}>`, inline: true }
        )
        .setTimestamp();

      if (ticket.email) {
        embed.addFields({ name: 'Customer', value: ticket.email, inline: true });
      }

      if (actor) {
        embed.addFields({ name: 'Action By', value: actor, inline: true });
      }

      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      console.error('[DiscordBot] Failed to log action:', error);
    }
  }

  /**
   * Sanitize channel name
   */
  sanitizeChannelName(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 30);
  }

  /**
   * Check if bot is ready
   */
  get ready() {
    return this.isReady;
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('[DiscordBot] Shutting down...');
    this.client.destroy();
  }
}

// Singleton instance
let botInstance = null;

/**
 * Get or create the Discord bot instance
 */
function getDiscordBot() {
  if (!botInstance) {
    botInstance = new DiscordTicketBot();
  }
  return botInstance;
}

/**
 * Initialize the Discord bot (database is optional)
 */
async function initializeDiscordBot(db = null) {
  const bot = getDiscordBot();
  if (db) {
    bot.setDatabase(db);
  }

  const success = await bot.initialize();
  if (!success) {
    return null;
  }

  return bot;
}

module.exports = {
  DiscordTicketBot,
  getDiscordBot,
  initializeDiscordBot
};
