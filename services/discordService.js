/**
 * Discord Bot Service
 * Handles sending notifications to Discord channels
 */

const fetch = require('node-fetch');
const logger = require('../utils/logger');

/**
 * Send ticket notification to Discord
 * @param {Object} ticketData - Ticket information
 * @param {string} ticketData.name - User name
 * @param {string} ticketData.email - User email
 * @param {string} ticketData.subject - Ticket subject
 * @param {string} ticketData.message - Ticket message
 * @param {string} ticketData.priority - Ticket priority (low, medium, high, urgent)
 * @param {string} ticketData.category - Ticket category
 * @param {number} ticketData.ticketId - Database ticket ID
 * @returns {Promise<boolean>} - Success status
 */
async function sendTicketNotification(ticketData) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_CHANNEL_ID;

  if (!botToken || !channelId) {
    logger.warn('Discord bot credentials not configured. Skipping Discord notification.');
    return false;
  }

  // Discord API endpoint for sending messages
  const url = `https://discord.com/api/v10/channels/${channelId}/messages`;

  // Priority colors for Discord embed
  const priorityColors = {
    low: 3447003,      // Blue
    medium: 16776960,  // Yellow
    high: 16753920,    // Orange
    urgent: 16711680   // Red
  };

  // Category emojis
  const categoryEmojis = {
    general: '💬',
    technical: '🔧',
    billing: '💰',
    domain: '🌐',
    hosting: '🖥️'
  };

  const priorityEmojis = {
    low: '🟢',
    medium: '🟡',
    high: '🟠',
    urgent: '🔴'
  };

  // Create Discord embed
  const embed = {
    title: `${categoryEmojis[ticketData.category] || '📋'} New Support Ticket #${ticketData.ticketId}`,
    color: priorityColors[ticketData.priority] || 3447003,
    fields: [
      {
        name: '👤 User',
        value: ticketData.name,
        inline: true
      },
      {
        name: '📧 Email',
        value: ticketData.email,
        inline: true
      },
      {
        name: '\u200B',
        value: '\u200B',
        inline: true
      },
      {
        name: '📝 Subject',
        value: ticketData.subject,
        inline: false
      },
      {
        name: '💬 Message',
        value: ticketData.message.length > 1024
          ? ticketData.message.substring(0, 1021) + '...'
          : ticketData.message,
        inline: false
      },
      {
        name: `${priorityEmojis[ticketData.priority]} Priority`,
        value: ticketData.priority.charAt(0).toUpperCase() + ticketData.priority.slice(1),
        inline: true
      },
      {
        name: '📂 Category',
        value: ticketData.category.charAt(0).toUpperCase() + ticketData.category.slice(1),
        inline: true
      }
    ],
    footer: {
      text: 'Svarog Tech Support System'
    },
    timestamp: new Date().toISOString()
  };

  const payload = {
    embeds: [embed]
  };

  const headers = {
    'Authorization': `Bot ${botToken}`,
    'Content-Type': 'application/json'
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.text();
      logger.error('Discord API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      return false;
    }

    logger.info(`Discord notification sent successfully for ticket #${ticketData.ticketId}`);
    return true;
  } catch (error) {
    logger.error('Discord bot error:', {
      error: error.message,
      stack: error.stack
    });
    return false;
  }
}

/**
 * Send contact form notification to Discord
 * @param {Object} contactData - Contact form data
 * @param {string} contactData.name - User name
 * @param {string} contactData.email - User email
 * @param {string} contactData.message - Contact message
 * @returns {Promise<boolean>} - Success status
 */
async function sendContactNotification(contactData) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_CHANNEL_ID;

  if (!botToken || !channelId) {
    logger.warn('Discord bot credentials not configured. Skipping Discord notification.');
    return false;
  }

  const url = `https://discord.com/api/v10/channels/${channelId}/messages`;

  const embed = {
    title: '📧 New Contact Form Submission',
    color: 16766720, // Amber color
    fields: [
      {
        name: '👤 Name',
        value: contactData.name,
        inline: true
      },
      {
        name: '📧 Email',
        value: contactData.email,
        inline: true
      },
      {
        name: '💬 Message',
        value: contactData.message.length > 1024
          ? contactData.message.substring(0, 1021) + '...'
          : contactData.message,
        inline: false
      }
    ],
    footer: {
      text: 'Svarog Tech Contact Form'
    },
    timestamp: new Date().toISOString()
  };

  const payload = {
    embeds: [embed]
  };

  const headers = {
    'Authorization': `Bot ${botToken}`,
    'Content-Type': 'application/json'
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.text();
      logger.error('Discord API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      return false;
    }

    logger.info('Discord contact notification sent successfully');
    return true;
  } catch (error) {
    logger.error('Discord bot error:', {
      error: error.message,
      stack: error.stack
    });
    return false;
  }
}

module.exports = {
  sendTicketNotification,
  sendContactNotification
};
