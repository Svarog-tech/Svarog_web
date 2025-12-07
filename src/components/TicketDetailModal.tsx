import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTimes,
  faPaperPlane,
  faImage,
  faUser,
  faClock,
  faCircle,
  faCheckCircle,
  faTimesCircle,
  faExclamationCircle,
  faSave
} from '@fortawesome/free-solid-svg-icons';
import { supabase } from '../lib/auth';
import { useAuth } from '../contexts/AuthContext';
import './TicketDetailModal.css';

interface Ticket {
  id: number;
  user_id: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  assigned_to?: string;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

interface TicketMessage {
  id: number;
  ticket_id: number;
  user_id: string;
  message: string;
  is_admin_reply: boolean;
  created_at: string;
  user_name?: string;
  attachments?: string[];
}

interface TicketDetailModalProps {
  ticket: Ticket | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

const TicketDetailModal: React.FC<TicketDetailModalProps> = ({ ticket, isOpen, onClose, onUpdate }) => {
  const { user, profile } = useAuth();
  const [status, setStatus] = useState(ticket?.status || 'open');
  const [priority, setPriority] = useState(ticket?.priority || 'medium');
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [admins, setAdmins] = useState<any[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ticket) {
      setStatus(ticket.status);
      setPriority(ticket.priority);
      fetchMessages();
      fetchAdmins();
    }
  }, [ticket]);

  const fetchMessages = async () => {
    if (!ticket) return;

    try {
      const { data, error } = await supabase
        .from('ticket_messages')
        .select(`
          *,
          profiles!ticket_messages_user_id_fkey(first_name, last_name)
        `)
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data) {
        const messagesWithUserInfo = data.map((msg: any) => ({
          ...msg,
          user_name: `${msg.profiles?.first_name || ''} ${msg.profiles?.last_name || ''}`.trim()
        }));
        setMessages(messagesWithUserInfo);
        setTimeout(() => scrollToBottom(), 100);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const fetchAdmins = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('is_admin', true);

      if (error) throw error;
      if (data) setAdmins(data);
    } catch (error) {
      console.error('Error fetching admins:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSave = async () => {
    if (!ticket) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from('support_tickets')
        .update({
          status,
          priority,
          assigned_to: profile?.is_admin ? user?.id : ticket.assigned_to
        })
        .eq('id', ticket.id);

      if (error) throw error;

      onUpdate();
    } catch (error) {
      console.error('Error updating ticket:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSendMessage = async () => {
    if (!ticket || !newMessage.trim()) return;

    try {
      // Extract mentions
      const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
      const mentions: string[] = [];
      let match;

      while ((match = mentionRegex.exec(newMessage)) !== null) {
        mentions.push(match[2]); // user_id
      }

      // Insert message
      const { data: messageData, error: messageError } = await supabase
        .from('ticket_messages')
        .insert([{
          ticket_id: ticket.id,
          user_id: user?.id,
          message: newMessage,
          is_admin_reply: profile?.is_admin || false
        }])
        .select()
        .single();

      if (messageError) throw messageError;

      // Insert mentions
      if (mentions.length > 0 && messageData) {
        const mentionRecords = mentions.map(userId => ({
          message_id: messageData.id,
          mentioned_user_id: userId
        }));

        await supabase
          .from('ticket_mentions')
          .insert(mentionRecords);
      }

      setNewMessage('');
      fetchMessages();

      // Update last_reply_at
      await supabase
        .from('support_tickets')
        .update({
          last_reply_at: new Date().toISOString(),
          last_reply_by: user?.id
        })
        .eq('id', ticket.id);

    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !ticket) return;

    const file = e.target.files[0];
    setUploading(true);

    try {
      // Upload to Supabase Storage
      const fileName = `${ticket.id}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('ticket-attachments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('ticket-attachments')
        .getPublicUrl(fileName);

      // Save attachment record
      await supabase
        .from('ticket_attachments')
        .insert([{
          ticket_id: ticket.id,
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: user?.id
        }]);

      // Add image to message
      setNewMessage(prev => prev + `\n![${file.name}](${urlData.publicUrl})`);

    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Chyba při nahrávání obrázku');
    } finally {
      setUploading(false);
    }
  };

  const handleMention = (admin: any) => {
    const mention = `@[${admin.first_name} ${admin.last_name}](${admin.id})`;
    const cursorPos = newMessage.lastIndexOf('@');
    const beforeMention = newMessage.substring(0, cursorPos);
    const afterMention = newMessage.substring(cursorPos + mentionSearch.length + 1);
    setNewMessage(beforeMention + mention + ' ' + afterMention);
    setShowMentions(false);
    setMentionSearch('');
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNewMessage(value);

    // Check for @ mention
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const textAfterAt = value.substring(lastAtIndex + 1);
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setMentionSearch(textAfterAt);
        setShowMentions(true);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const filteredAdmins = admins.filter(admin =>
    `${admin.first_name} ${admin.last_name}`.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  const renderMessage = (text: string) => {
    // SECURITY: Sanitizace proti XSS
    // Escape HTML znaky před renderováním
    const escapeHtml = (unsafe: string) => {
      return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    // Escape celý text nejdřív
    let safeText = escapeHtml(text);

    // Pak renderuj markdown (už je escape)
    // Render images (URL je už escape, ale zkontroluj)
    safeText = safeText.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
      // Zkontroluj že URL je bezpečná (pouze http/https)
      const safeUrl = url.match(/^https?:\/\//) ? url : '#';
      return `<img src="${safeUrl}" alt="${escapeHtml(alt)}" class="message-image" />`;
    });

    // Render mentions
    safeText = safeText.replace(/@\[([^\]]+)\]\([^)]+\)/g, '<span class="mention">@$1</span>');

    // POZNÁMKA: Pro produkci by bylo lepší použít DOMPurify nebo markdown parser
    // npm install dompurify @types/dompurify
    // import DOMPurify from 'dompurify';
    // return <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(safeText) }} />;
    
    return <div dangerouslySetInnerHTML={{ __html: safeText }} />;
  };

  if (!ticket) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="ticket-detail-modal"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="modal-header">
              <h2>
                <FontAwesomeIcon icon={faCircle} className="header-icon" />
                Ticket #{ticket.id}: {ticket.subject}
              </h2>
              <button className="close-btn" onClick={onClose}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            {/* Body */}
            <div className="modal-body">
              {/* Ticket Info */}
              <div className="ticket-info-section">
                <div className="info-row">
                  <div className="info-item">
                    <label>Status</label>
                    <select value={status} onChange={(e) => setStatus(e.target.value as any)}>
                      <option value="open">Otevřen</option>
                      <option value="in_progress">V řešení</option>
                      <option value="resolved">Vyřešen</option>
                      <option value="closed">Uzavřen</option>
                    </select>
                  </div>
                  <div className="info-item">
                    <label>Priorita</label>
                    <select value={priority} onChange={(e) => setPriority(e.target.value as any)}>
                      <option value="low">Nízká</option>
                      <option value="medium">Střední</option>
                      <option value="high">Vysoká</option>
                      <option value="urgent">Urgentní</option>
                    </select>
                  </div>
                  <button className="save-btn" onClick={handleSave} disabled={saving}>
                    <FontAwesomeIcon icon={faSave} />
                    {saving ? 'Ukládám...' : 'Uložit'}
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="messages-section">
                <h3>Konverzace</h3>
                <div className="messages-list">
                  {/* Original message */}
                  <div className="message user-message">
                    <div className="message-header">
                      <FontAwesomeIcon icon={faUser} />
                      <span className="message-author">{ticket.user_name}</span>
                      <span className="message-time">
                        {new Date(ticket.created_at).toLocaleString('cs-CZ')}
                      </span>
                    </div>
                    <div className="message-content">{ticket.message}</div>
                  </div>

                  {/* Replies */}
                  {messages.map((msg) => (
                    <div key={msg.id} className={`message ${msg.is_admin_reply ? 'admin-message' : 'user-message'}`}>
                      <div className="message-header">
                        <FontAwesomeIcon icon={faUser} />
                        <span className="message-author">{msg.user_name}</span>
                        {msg.is_admin_reply && <span className="admin-badge">Admin</span>}
                        <span className="message-time">
                          {new Date(msg.created_at).toLocaleString('cs-CZ')}
                        </span>
                      </div>
                      <div className="message-content">{renderMessage(msg.message)}</div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Reply Box */}
              <div className="reply-section">
                <div className="reply-box">
                  <textarea
                    value={newMessage}
                    onChange={handleMessageChange}
                    placeholder="Napište odpověď... (použijte @ pro označení administrátora)"
                    rows={3}
                  />

                  {showMentions && filteredAdmins.length > 0 && (
                    <div className="mentions-dropdown">
                      {filteredAdmins.map((admin) => (
                        <div
                          key={admin.id}
                          className="mention-item"
                          onClick={() => handleMention(admin)}
                        >
                          <FontAwesomeIcon icon={faUser} />
                          {admin.first_name} {admin.last_name}
                          <span className="admin-email">{admin.email}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="reply-actions">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleImageUpload}
                    />
                    <button
                      className="attach-btn"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      <FontAwesomeIcon icon={faImage} />
                      {uploading ? 'Nahrávám...' : 'Přiložit obrázek'}
                    </button>
                    <button
                      className="send-btn"
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim()}
                    >
                      <FontAwesomeIcon icon={faPaperPlane} />
                      Odeslat
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TicketDetailModal;
