-- Migration: Discord Integration for Ticket System
-- Version: v5
-- Description: Adds Discord channel tracking to tickets

-- Add Discord channel ID to support_tickets
ALTER TABLE support_tickets
ADD COLUMN discord_channel_id VARCHAR(32) NULL AFTER assigned_to,
ADD COLUMN discord_message_id VARCHAR(32) NULL AFTER discord_channel_id;

-- Create index for Discord channel lookups
CREATE INDEX idx_discord_channel ON support_tickets(discord_channel_id);

-- Add source field to ticket_messages to track where message came from
ALTER TABLE ticket_messages
ADD COLUMN source ENUM('web', 'discord', 'email') DEFAULT 'web' AFTER is_admin_reply,
ADD COLUMN discord_message_id VARCHAR(32) NULL AFTER source;

-- Create index for Discord message ID lookups
CREATE INDEX idx_discord_message ON ticket_messages(discord_message_id);

-- Create table for Discord user mappings (optional - for linking Discord users to web users)
CREATE TABLE IF NOT EXISTS discord_user_mappings (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  discord_user_id VARCHAR(32) NOT NULL,
  discord_username VARCHAR(100) NULL,
  linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_discord_user (discord_user_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add comment to explain the migration
-- Run this migration with: mysql -u your_user -p your_database < sql/migration-discord.sql
