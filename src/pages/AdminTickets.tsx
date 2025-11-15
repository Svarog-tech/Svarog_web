import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTicket,
  faSearch,
  faFilter,
  faCircle,
  faClock,
  faCheckCircle,
  faTimesCircle,
  faEye,
  faExclamationCircle,
  faUser
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/auth';
import TicketDetailModal from '../components/TicketDetailModal';
import './AdminTickets.css';

interface Ticket {
  id: number;
  user_id: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  assigned_to?: string;
  last_reply_at?: string;
  created_at: string;
  user_email?: string;
  user_name?: string;
  assigned_name?: string;
}

interface Stats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
}

const AdminTickets: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!user || !profile?.is_admin) {
      navigate('/');
      return;
    }
    fetchTickets();
  }, [user, profile, navigate]);

  useEffect(() => {
    let filtered = tickets;

    if (searchTerm) {
      filtered = filtered.filter(ticket =>
        ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.id.toString().includes(searchTerm)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(ticket => ticket.status === statusFilter);
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter(ticket => ticket.priority === priorityFilter);
    }

    setFilteredTickets(filtered);
  }, [searchTerm, statusFilter, priorityFilter, tickets]);

  const fetchTickets = async () => {
    try {
      setLoading(true);

      // Fetch all tickets with user info
      const { data, error } = await supabase
        .from('support_tickets')
        .select(`
          *,
          profiles!support_tickets_user_id_fkey(email, first_name, last_name),
          assigned:profiles!support_tickets_assigned_to_fkey(first_name, last_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const ticketsWithUserInfo = data.map((ticket: any) => ({
          ...ticket,
          user_email: ticket.profiles?.email,
          user_name: `${ticket.profiles?.first_name || ''} ${ticket.profiles?.last_name || ''}`.trim(),
          assigned_name: ticket.assigned ? `${ticket.assigned.first_name || ''} ${ticket.assigned.last_name || ''}`.trim() : undefined
        }));

        setTickets(ticketsWithUserInfo);
        setFilteredTickets(ticketsWithUserInfo);

        // Calculate stats
        const total = ticketsWithUserInfo.length;
        const open = ticketsWithUserInfo.filter((t: Ticket) => t.status === 'open').length;
        const inProgress = ticketsWithUserInfo.filter((t: Ticket) => t.status === 'in_progress').length;
        const resolved = ticketsWithUserInfo.filter((t: Ticket) => t.status === 'resolved').length;
        const closed = ticketsWithUserInfo.filter((t: Ticket) => t.status === 'closed').length;

        setStats({ total, open, inProgress, resolved, closed });
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; icon: any; label: string }> = {
      open: { color: '#f59e0b', icon: faCircle, label: 'Otevřen' },
      in_progress: { color: '#3b82f6', icon: faClock, label: 'V řešení' },
      resolved: { color: '#10b981', icon: faCheckCircle, label: 'Vyřešen' },
      closed: { color: '#6b7280', icon: faTimesCircle, label: 'Uzavřen' }
    };

    const statusInfo = statusMap[status] || statusMap.open;

    return (
      <span
        className="status-badge"
        style={{ background: `${statusInfo.color}20`, color: statusInfo.color, borderColor: statusInfo.color }}
      >
        <FontAwesomeIcon icon={statusInfo.icon} />
        {statusInfo.label}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityMap: Record<string, { color: string; label: string }> = {
      low: { color: '#6b7280', label: 'Nízká' },
      medium: { color: '#3b82f6', label: 'Střední' },
      high: { color: '#f59e0b', label: 'Vysoká' },
      urgent: { color: '#ef4444', label: 'Urgentní' }
    };

    const priorityInfo = priorityMap[priority] || priorityMap.medium;

    return (
      <span
        className="priority-badge"
        style={{ background: `${priorityInfo.color}20`, color: priorityInfo.color, borderColor: priorityInfo.color }}
      >
        <FontAwesomeIcon icon={faExclamationCircle} />
        {priorityInfo.label}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('cs-CZ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="admin-tickets-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Načítání ticketů...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-tickets-page">
      <div className="admin-tickets-container">
        {/* Header */}
        <motion.div
          className="admin-tickets-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="header-content">
            <div className="title-section">
              <div className="icon-wrapper">
                <FontAwesomeIcon icon={faTicket} />
              </div>
              <div>
                <h1>Správa Ticketů</h1>
                <p>Správa podpory a zákaznických požadavků</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          className="stats-grid"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)' }}>
              <FontAwesomeIcon icon={faTicket} />
            </div>
            <div className="stat-content">
              <h3>{stats.total}</h3>
              <p>Celkem ticketů</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
              <FontAwesomeIcon icon={faCircle} />
            </div>
            <div className="stat-content">
              <h3>{stats.open}</h3>
              <p>Otevřené</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}>
              <FontAwesomeIcon icon={faClock} />
            </div>
            <div className="stat-content">
              <h3>{stats.inProgress}</h3>
              <p>V řešení</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
              <FontAwesomeIcon icon={faCheckCircle} />
            </div>
            <div className="stat-content">
              <h3>{stats.resolved}</h3>
              <p>Vyřešené</p>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          className="filters-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="search-box">
            <FontAwesomeIcon icon={faSearch} />
            <input
              type="text"
              placeholder="Hledat podle předmětu, emailu, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="filter-buttons">
            <button
              className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              <FontAwesomeIcon icon={faFilter} />
              Vše
            </button>
            <button
              className={`filter-btn ${statusFilter === 'open' ? 'active' : ''}`}
              onClick={() => setStatusFilter('open')}
            >
              <FontAwesomeIcon icon={faCircle} />
              Otevřené
            </button>
            <button
              className={`filter-btn ${statusFilter === 'in_progress' ? 'active' : ''}`}
              onClick={() => setStatusFilter('in_progress')}
            >
              <FontAwesomeIcon icon={faClock} />
              V řešení
            </button>
            <button
              className={`filter-btn ${statusFilter === 'resolved' ? 'active' : ''}`}
              onClick={() => setStatusFilter('resolved')}
            >
              <FontAwesomeIcon icon={faCheckCircle} />
              Vyřešené
            </button>
          </div>
        </motion.div>

        {/* Tickets Table */}
        <motion.div
          className="tickets-table-container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <div className="table-header">
            <h2>
              <FontAwesomeIcon icon={faTicket} className="section-icon" />
              Tickety ({filteredTickets.length})
            </h2>
          </div>

          {filteredTickets.length === 0 ? (
            <div className="no-tickets">
              <FontAwesomeIcon icon={faTicket} />
              <p>Žádné tickety</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="tickets-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Předmět</th>
                    <th>Zákazník</th>
                    <th>Status</th>
                    <th>Priorita</th>
                    <th>Přiřazeno</th>
                    <th>Vytvořeno</th>
                    <th>Akce</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((ticket) => (
                    <motion.tr
                      key={ticket.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <td>#{ticket.id}</td>
                      <td className="ticket-subject">{ticket.subject}</td>
                      <td>
                        <div className="customer-info">
                          <FontAwesomeIcon icon={faUser} />
                          <div>
                            <div className="customer-name">{ticket.user_name || 'Neznámý'}</div>
                            <div className="customer-email">{ticket.user_email}</div>
                          </div>
                        </div>
                      </td>
                      <td>{getStatusBadge(ticket.status)}</td>
                      <td>{getPriorityBadge(ticket.priority)}</td>
                      <td className="assigned-to">
                        {ticket.assigned_name || <span className="unassigned">Nepřiřazeno</span>}
                      </td>
                      <td className="date">{formatDate(ticket.created_at)}</td>
                      <td>
                        <button
                          className="action-btn view"
                          title="Zobrazit detail"
                          onClick={() => {
                            setSelectedTicket(ticket);
                            setIsModalOpen(true);
                          }}
                        >
                          <FontAwesomeIcon icon={faEye} />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>

      {/* Ticket Detail Modal */}
      <TicketDetailModal
        ticket={selectedTicket}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTicket(null);
        }}
        onUpdate={() => {
          fetchTickets();
        }}
      />
    </div>
  );
};

export default AdminTickets;
