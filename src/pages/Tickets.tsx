import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTicket,
  faPlus,
  faTimes,
  faCircle,
  faClock,
  faCheckCircle
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext';
import { createSupportTicket } from '../lib/supabase';
import { supabase } from '../lib/auth';
import './Tickets.css';

interface Ticket {
  id: number;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  created_at: string;
}

const Tickets: React.FC = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    message: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    category: 'general'
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, [user]);

  const fetchTickets = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setTickets(data);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.subject || !formData.message) {
      return;
    }

    setSubmitting(true);

    try {
      await createSupportTicket(formData);
      setSuccess(true);
      setFormData({
        subject: '',
        message: '',
        priority: 'medium',
        category: 'general'
      });

      // Načtení tiketů znovu
      fetchTickets();

      setTimeout(() => {
        setShowNewTicketForm(false);
        setSuccess(false);
      }, 2000);
    } catch (error) {
      console.error('Error creating ticket:', error);
      alert('Chyba při vytváření tiketu');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'warning';
      case 'in_progress':
        return 'info';
      case 'resolved':
        return 'success';
      case 'closed':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open':
        return 'Otevřeno';
      case 'in_progress':
        return 'Zpracovává se';
      case 'resolved':
        return 'Vyřešeno';
      case 'closed':
        return 'Uzavřeno';
      default:
        return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'danger';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'Urgentní';
      case 'high':
        return 'Vysoká';
      case 'medium':
        return 'Střední';
      case 'low':
        return 'Nízká';
      default:
        return priority;
    }
  };

  return (
    <div className="tickets-page">
      <div className="tickets-container">
        {/* Header */}
        <motion.div
          className="tickets-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div>
            <h1 className="tickets-title">Support tikety</h1>
            <p className="tickets-subtitle">
              Spravuj své support požadavky a komunikuj s naším týmem
            </p>
          </div>
          <button
            className="new-ticket-btn"
            onClick={() => setShowNewTicketForm(true)}
          >
            <FontAwesomeIcon icon={faPlus} />
            Nový tiket
          </button>
        </motion.div>

        {/* Tickets List */}
        {tickets.length === 0 ? (
          <motion.div
            className="empty-state"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <FontAwesomeIcon icon={faTicket} className="empty-icon" />
            <h3>Žádné tikety</h3>
            <p>
              Zatím nemáš žádné support tikety. Pokud potřebuješ pomoc, vytvoř nový tiket.
            </p>
            <button
              className="cta-button"
              onClick={() => setShowNewTicketForm(true)}
            >
              <FontAwesomeIcon icon={faPlus} />
              Vytvořit tiket
            </button>
          </motion.div>
        ) : (
          <motion.div
            className="tickets-list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {tickets.map((ticket, index) => (
              <motion.div
                key={ticket.id}
                className="ticket-card"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <div className="ticket-card-header">
                  <div className="ticket-info">
                    <h3 className="ticket-subject">{ticket.subject}</h3>
                    <div className="ticket-meta">
                      <span className={`priority-badge priority-${getPriorityColor(ticket.priority)}`}>
                        {getPriorityLabel(ticket.priority)}
                      </span>
                      <span className="ticket-date">
                        <FontAwesomeIcon icon={faClock} />
                        {new Date(ticket.created_at).toLocaleDateString('cs-CZ')}
                      </span>
                    </div>
                  </div>
                  <div className={`ticket-status status-${getStatusColor(ticket.status)}`}>
                    <FontAwesomeIcon icon={faCircle} />
                    {getStatusLabel(ticket.status)}
                  </div>
                </div>
                <p className="ticket-message">{ticket.message}</p>
                <button className="view-ticket-btn">
                  Zobrazit detail
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* New Ticket Modal */}
        <AnimatePresence>
          {showNewTicketForm && (
            <motion.div
              className="modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNewTicketForm(false)}
            >
              <motion.div
                className="modal-content"
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-header">
                  <h2>Nový support tiket</h2>
                  <button
                    className="close-modal-btn"
                    onClick={() => setShowNewTicketForm(false)}
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>

                {success ? (
                  <div className="success-message">
                    <FontAwesomeIcon icon={faCheckCircle} />
                    <h3>Tiket byl úspěšně vytvořen!</h3>
                    <p>Náš tým se ti ozve co nejdříve.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="ticket-form">
                    <div className="form-group">
                      <label>Předmět *</label>
                      <input
                        type="text"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        placeholder="Stručně popiš problém"
                        required
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Priorita</label>
                        <select
                          value={formData.priority}
                          onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                        >
                          <option value="low">Nízká</option>
                          <option value="medium">Střední</option>
                          <option value="high">Vysoká</option>
                          <option value="urgent">Urgentní</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Kategorie</label>
                        <select
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        >
                          <option value="general">Obecné</option>
                          <option value="technical">Technická podpora</option>
                          <option value="billing">Fakturace</option>
                          <option value="domain">Domény</option>
                          <option value="hosting">Hosting</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Zpráva *</label>
                      <textarea
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        placeholder="Podrobně popiš svůj problém nebo dotaz..."
                        rows={6}
                        required
                      />
                    </div>

                    <div className="form-actions">
                      <button
                        type="button"
                        className="cancel-btn"
                        onClick={() => setShowNewTicketForm(false)}
                      >
                        Zrušit
                      </button>
                      <button
                        type="submit"
                        className="submit-btn"
                        disabled={submitting}
                      >
                        {submitting ? 'Vytváření...' : 'Vytvořit tiket'}
                      </button>
                    </div>
                  </form>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Tickets;
