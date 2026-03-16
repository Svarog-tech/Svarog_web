/**
 * Discord Ticket Bot Service
 *
 * Handles bidirectional ticket communication between Discord and the web app.
 * Creates private channels for each ticket where support staff can communicate with users.
 *
 * Features:
 * - Creates a private channel when a ticket is opened
 * - Syncs messages between Discord and the web ticket system
 * - Provides close button to resolve tickets
 * - Archives conversation to database when ticket is closed
 * - Deletes Discord channel after closure
 */

import {
  Client,
  GatewayIntentBits,
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  Message,
  Interaction,
  ButtonInteraction,
  Events,
  ColorResolvable,
  GuildChannelCreateOptions,
  OverwriteResolvable
} from 'discord.js';

// Types
interface TicketData {
  ticketId: number;
  userId: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  status: string;
}

interface TicketMessage {
  id: number;
  ticketId: number;
  userId: string;
  message: string;
  isAdminReply: boolean;
  userName?: string;
  createdAt: Date;
}

interface DatabaseConnection {
  query: (sql: string, params?: any[]) => Promise<any>;
  queryOne: (sql: string, params?: any[]) => Promise<any>;
  execute: (sql: string, params?: any[]) => Promise<any>;
}

// Configuration
const PRIORITY_COLORS: Record<string, ColorResolvable> = {
  low: 0x3498DB,      // Blue
  medium: 0xF1C40F,   // Yellow
  high: 0xE67E22,     // Orange
  urgent: 0xE74C3C    // Red
};

const CATEGORY_EMOJIS: Record<string, string> = {
  general: '💬',
  technical: '🔧',
  billing: '💰',
  domain: '🌐',
  hosting: '🖥️'
};

const STATUS_COLORS: Record<string, ColorResolvable> = {
  open: 0x3498DB,
  in_progress: 0xF39C12,
  waiting: 0x9B59B6,
  resolved: 0x2ECC71,
  closed: 0x95A5A6
};

class DiscordTicketBot {
  private client: Client;
  private db: DatabaseConnection | null = null;
  private isReady: boolean = false;
  private guildId: string;
  private categoryId: string;
  private ticketRoleId: string;
  private logChannelId: string | null;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
      ]
    });

    this.guildId = process.env.DISCORD_GUILD_ID || '';
    this.categoryId = process.env.DISCORD_TICKET_CATEGORY_ID || '';
    this.ticketRoleId = process.env.DISCORD_TICKET_ROLE_ID || '';
    this.logChannelId = process.env.DISCORD_LOG_CHANNEL_ID || null;

    this.setupEventHandlers();
  }

  /**
   * Set database connection
   */
  setDatabase(db: DatabaseConnection): void {
    this.db = db;
  }

  /**
   * Initialize and connect the bot
   */
  async initialize(): Promise<boolean> {
    const token = process.env.DISCORD_BOT_TOKEN;

    if (!token) {
      console.warn('[DiscordBot] DISCORD_BOT_TOKEN not configured. Bot disabled.');
      return false;
    }

    if (!this.guildId || !this.categoryId || !this.ticketRoleId) {
      console.warn('[DiscordBot] Missing required Discord configuration (GUILD_ID, CATEGORY_ID, or TICKET_ROLE_ID). Bot disabled.');
      return false;
    }

    try {
      await this.client.login(token);
      return true;
    } catch (error) {
      console.error('[DiscordBot] Failed to login:', error);
      return false;
    }
  }

  /**
   * Setup event handlers for the Discord client
   */
  private setupEventHandlers(): void {
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
  async createTicketChannel(ticket: TicketData): Promise<string | null> {
    if (!this.isReady || !this.db) {
      console.warn('[DiscordBot] Bot not ready or database not connected');
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
      const permissionOverwrites: OverwriteResolvable[] = [
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
          id: this.client.user!.id, // Bot
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
      const channelOptions: GuildChannelCreateOptions = {
        name: channelName.substring(0, 100), // Discord limit
        type: ChannelType.GuildText,
        parent: this.categoryId,
        permissionOverwrites,
        topic: `Ticket #${ticket.ticketId} | ${ticket.email} | ${ticket.category}`
      };

      const channel = await guild.channels.create(channelOptions);

      // Send initial ticket embed with close button
      const embed = this.createTicketEmbed(ticket);
      const row = this.createActionButtons(ticket.ticketId);

      const sentMessage = await (channel as TextChannel).send({
        embeds: [embed],
        components: [row]
      });

      // Save channel and message IDs to database
      await this.db.execute(
        'UPDATE support_tickets SET discord_channel_id = ?, discord_message_id = ? WHERE id = ?',
        [channel.id, sentMessage.id, ticket.ticketId]
      );

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
  async sendMessageToChannel(ticketId: number, message: string, userName: string, isAdminReply: boolean): Promise<boolean> {
    if (!this.isReady || !this.db) return false;

    try {
      // Get channel ID from database
      const ticket = await this.db.queryOne(
        'SELECT discord_channel_id FROM support_tickets WHERE id = ?',
        [ticketId]
      );

      if (!ticket?.discord_channel_id) {
        console.warn(`[DiscordBot] No Discord channel for ticket #${ticketId}`);
        return false;
      }

      const channel = await this.client.channels.fetch(ticket.discord_channel_id) as TextChannel;
      if (!channel) {
        console.error(`[DiscordBot] Channel not found: ${ticket.discord_channel_id}`);
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
        .setFooter({ text: isAdminReply ? 'Admin Reply' : 'Customer Message' });

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
  private async handleMessage(message: Message): Promise<void> {
    // Ignore bot messages
    if (message.author.bot) return;
    if (!this.db) return;

    try {
      // Check if this is a ticket channel
      const ticket = await this.db.queryOne(
        'SELECT id, user_id, status FROM support_tickets WHERE discord_channel_id = ?',
        [message.channel.id]
      );

      if (!ticket) return; // Not a ticket channel

      // Don't process messages for closed tickets
      if (ticket.status === 'closed') {
        await message.reply('⚠️ This ticket is closed. Please open a new ticket if you need assistance.');
        return;
      }

      // Check if user has the ticket role (is support staff)
      const member = message.member;
      const hasTicketRole = member?.roles.cache.has(this.ticketRoleId);

      // Insert message into database
      const result = await this.db.execute(
        `INSERT INTO ticket_messages (ticket_id, user_id, message, is_admin_reply, source, discord_message_id, created_at)
         VALUES (?, ?, ?, ?, 'discord', ?, NOW())`,
        [
          ticket.id,
          ticket.user_id, // Use ticket owner's ID for now (we could map Discord users later)
          message.content,
          hasTicketRole ? 1 : 0,
          message.id
        ]
      );

      // Update ticket's last reply timestamp
      await this.db.execute(
        'UPDATE support_tickets SET last_reply_at = NOW(), updated_at = NOW() WHERE id = ?',
        [ticket.id]
      );

      // Add reaction to confirm message was processed
      await message.react('✅');

      console.log(`[DiscordBot] Message from Discord saved to ticket #${ticket.id}`);
    } catch (error) {
      console.error('[DiscordBot] Failed to handle message:', error);
      await message.react('❌');
    }
  }

  /**
   * Handle button interactions
   */
  private async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    if (!this.db) return;

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
  private async closeTicket(interaction: ButtonInteraction, ticketId: number): Promise<void> {
    if (!this.db) return;

    await interaction.deferReply();

    try {
      // Get ticket info
      const ticket = await this.db.queryOne(
        'SELECT * FROM support_tickets WHERE id = ?',
        [ticketId]
      );

      if (!ticket) {
        await interaction.editReply('Ticket not found.');
        return;
      }

      // Get all messages for archiving
      const messages = await this.db.query(
        'SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC',
        [ticketId]
      );

      // Update ticket status
      await this.db.execute(
        'UPDATE support_tickets SET status = ?, updated_at = NOW(), resolved_at = NOW() WHERE id = ?',
        ['closed', ticketId]
      );

      // Send closing message
      const embed = new EmbedBuilder()
        .setColor(0x95A5A6)
        .setTitle('🔒 Ticket Closed')
        .setDescription(`This ticket has been closed by ${interaction.user.tag}.\n\nThe conversation has been saved to the database.`)
        .addFields(
          { name: 'Ticket ID', value: `#${ticketId}`, inline: true },
          { name: 'Messages', value: `${messages?.length || 0}`, inline: true },
          { name: 'Closed At', value: new Date().toLocaleString(), inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Log the action
      await this.logTicketAction('closed', { ...ticket, ticketId }, ticket.discord_channel_id, interaction.user.tag);

      // Delete channel after delay (5 seconds)
      setTimeout(async () => {
        try {
          const channel = interaction.channel as TextChannel;
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
  private async resolveTicket(interaction: ButtonInteraction, ticketId: number): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.execute(
        'UPDATE support_tickets SET status = ?, updated_at = NOW(), resolved_at = NOW() WHERE id = ?',
        ['resolved', ticketId]
      );

      const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle('✅ Ticket Resolved')
        .setDescription(`This ticket has been marked as resolved by ${interaction.user.tag}.`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      // Update the original message with new buttons
      const message = interaction.message;
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`reopen_${ticketId}`)
            .setLabel('Reopen')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔓'),
          new ButtonBuilder()
            .setCustomId(`close_${ticketId}`)
            .setLabel('Close & Archive')
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
  private async reopenTicket(interaction: ButtonInteraction, ticketId: number): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.execute(
        'UPDATE support_tickets SET status = ?, updated_at = NOW(), resolved_at = NULL WHERE id = ?',
        ['in_progress', ticketId]
      );

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
  async onTicketClosed(ticketId: number): Promise<void> {
    if (!this.isReady || !this.db) return;

    try {
      const ticket = await this.db.queryOne(
        'SELECT discord_channel_id FROM support_tickets WHERE id = ?',
        [ticketId]
      );

      if (!ticket?.discord_channel_id) return;

      const channel = await this.client.channels.fetch(ticket.discord_channel_id) as TextChannel;
      if (!channel) return;

      // Send closing notification
      const embed = new EmbedBuilder()
        .setColor(0x95A5A6)
        .setTitle('🔒 Ticket Closed via Web')
        .setDescription('This ticket has been closed from the web interface.\nThis channel will be deleted in 5 seconds.')
        .setTimestamp();

      await channel.send({ embeds: [embed] });

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
  async onTicketStatusChanged(ticketId: number, newStatus: string): Promise<void> {
    if (!this.isReady || !this.db) return;

    try {
      const ticket = await this.db.queryOne(
        'SELECT * FROM support_tickets WHERE id = ?',
        [ticketId]
      );

      if (!ticket?.discord_channel_id) return;

      const channel = await this.client.channels.fetch(ticket.discord_channel_id) as TextChannel;
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
  private createTicketEmbed(ticket: TicketData): EmbedBuilder {
    const categoryEmoji = CATEGORY_EMOJIS[ticket.category] || '📋';
    const priorityColor = PRIORITY_COLORS[ticket.priority] || 0x3498DB;

    return new EmbedBuilder()
      .setColor(priorityColor)
      .setTitle(`${categoryEmoji} Ticket #${ticket.ticketId}`)
      .setDescription(ticket.message.length > 4096 ? ticket.message.substring(0, 4093) + '...' : ticket.message)
      .addFields(
        { name: '📝 Subject', value: ticket.subject, inline: false },
        { name: '👤 Customer', value: ticket.name, inline: true },
        { name: '📧 Email', value: ticket.email, inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: '🏷️ Priority', value: ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1), inline: true },
        { name: '📂 Category', value: ticket.category.charAt(0).toUpperCase() + ticket.category.slice(1), inline: true },
        { name: '📊 Status', value: ticket.status.replace('_', ' ').toUpperCase(), inline: true }
      )
      .setFooter({ text: 'Reply in this channel to respond to the customer' })
      .setTimestamp();
  }

  /**
   * Create action buttons row
   */
  private createActionButtons(ticketId: number): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>()
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
  private async logTicketAction(action: string, ticket: any, channelId: string, actor?: string): Promise<void> {
    if (!this.logChannelId || !this.isReady) return;

    try {
      const logChannel = await this.client.channels.fetch(this.logChannelId) as TextChannel;
      if (!logChannel) return;

      const embed = new EmbedBuilder()
        .setColor(action === 'created' ? 0x2ECC71 : action === 'closed' ? 0xE74C3C : 0xF39C12)
        .setTitle(`📋 Ticket ${action.charAt(0).toUpperCase() + action.slice(1)}`)
        .addFields(
          { name: 'Ticket ID', value: `#${ticket.ticketId || ticket.id}`, inline: true },
          { name: 'Channel', value: `<#${channelId}>`, inline: true },
          { name: 'Customer', value: ticket.email || 'Unknown', inline: true }
        )
        .setTimestamp();

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
  private sanitizeChannelName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 30);
  }

  /**
   * Check if bot is ready
   */
  get ready(): boolean {
    return this.isReady;
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('[DiscordBot] Shutting down...');
    this.client.destroy();
  }
}

// Singleton instance
let botInstance: DiscordTicketBot | null = null;

/**
 * Get or create the Discord bot instance
 */
export function getDiscordBot(): DiscordTicketBot {
  if (!botInstance) {
    botInstance = new DiscordTicketBot();
  }
  return botInstance;
}

/**
 * Initialize the Discord bot with database connection
 */
export async function initializeDiscordBot(db: DatabaseConnection): Promise<DiscordTicketBot | null> {
  const bot = getDiscordBot();
  bot.setDatabase(db);

  const success = await bot.initialize();
  if (!success) {
    return null;
  }

  return bot;
}

export { DiscordTicketBot };
export default getDiscordBot;
