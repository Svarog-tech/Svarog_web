import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faEnvelope,
  faArrowLeft,
  faSearch,
  faFilter,
  faEdit,
  faEye,
  faPaperPlane,
  faUndo,
  faSave,
  faTimes,
  faCheckCircle,
  faTimesCircle,
  faCode,
  faArrowRight
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import {
  getEmailTemplates,
  getEmailTemplate,
  updateEmailTemplate,
  previewEmailTemplate,
  testEmailTemplate,
  resetEmailTemplate,
  EmailTemplate
} from '../lib/api';
import './AdminEmailTemplates.css';

const CATEGORIES = [
  { key: '', label: 'Vše' },
  { key: 'auth', label: 'Auth' },
  { key: 'payment', label: 'Platby' },
  { key: 'hosting', label: 'Hosting' },
  { key: 'support', label: 'Podpora' },
  { key: 'system', label: 'Systém' }
];

const AdminEmailTemplates: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Editor state
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [editorSubject, setEditorSubject] = useState('');
  const [editorHtml, setEditorHtml] = useState('');
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!user || !profile?.is_admin) {
      navigate('/');
      return;
    }
    fetchTemplates();
  }, [user, profile, navigate]);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getEmailTemplates(categoryFilter || undefined);
      setTemplates(result.templates || []);
    } catch (error) {
      console.error('Error fetching email templates:', error);
      showError('Chyba při načítání email šablon');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  useEffect(() => {
    fetchTemplates();
  }, [categoryFilter]);

  const filteredTemplates = templates.filter(t => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return t.name.toLowerCase().includes(term) ||
      t.template_key.toLowerCase().includes(term) ||
      t.subject.toLowerCase().includes(term);
  });

  const openEditor = async (template: EmailTemplate) => {
    try {
      const full = await getEmailTemplate(template.id);
      setEditingTemplate(full);
      setEditorSubject(full.subject);
      setEditorHtml(full.body_html);
    } catch (error) {
      showError('Chyba při načítání šablony');
    }
  };

  const closeEditor = () => {
    setEditingTemplate(null);
    setEditorSubject('');
    setEditorHtml('');
  };

  const insertVariable = (variable: string) => {
    const tag = `{{${variable}}}`;
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = editorHtml.substring(0, start) + tag + editorHtml.substring(end);
      setEditorHtml(newValue);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + tag.length, start + tag.length);
      }, 0);
    } else {
      setEditorHtml(prev => prev + tag);
    }
  };

  const handleSave = async () => {
    if (!editingTemplate) return;
    try {
      setSaving(true);
      const updated = await updateEmailTemplate(editingTemplate.id, {
        subject: editorSubject,
        body_html: editorHtml
      });
      setEditingTemplate(updated);
      showSuccess('Šablona byla uložena');
      fetchTemplates();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Neočekávaná chyba';
      showError(msg || 'Chyba při ukládání šablony');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!editingTemplate) return;
    try {
      setLoadingPreview(true);
      const result = await previewEmailTemplate(editingTemplate.id);
      setPreviewHtml(result.html);
      setPreviewOpen(true);
    } catch (error: unknown) {
      showError('Chyba při generování náhledu');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleTestSend = async () => {
    if (!editingTemplate) return;
    if (!window.confirm('Odeslat testovací email na vaši adresu?')) return;
    try {
      setSendingTest(true);
      const result = await testEmailTemplate(editingTemplate.id);
      showSuccess(`Testovací email odeslán na ${result.sent_to}`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Neočekávaná chyba';
      showError(msg || 'Chyba při odesílání testovacího emailu');
    } finally {
      setSendingTest(false);
    }
  };

  const handleReset = async () => {
    if (!editingTemplate) return;
    if (!window.confirm('Opravdu chcete obnovit výchozí obsah šablony? Vaše úpravy budou ztraceny.')) return;
    try {
      const reset = await resetEmailTemplate(editingTemplate.id);
      setEditingTemplate(reset);
      setEditorSubject(reset.subject);
      setEditorHtml(reset.body_html);
      showSuccess('Šablona byla obnovena na výchozí');
      fetchTemplates();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Neočekávaná chyba';
      showError(msg || 'Chyba při obnovování šablony');
    }
  };

  const handleToggleActive = async (template: EmailTemplate) => {
    try {
      await updateEmailTemplate(template.id, { is_active: !template.is_active });
      showSuccess(template.is_active ? 'Šablona deaktivována' : 'Šablona aktivována');
      fetchTemplates();
    } catch (error) {
      showError('Chyba při změně stavu šablony');
    }
  };

  const getCategoryBadge = (category: string) => {
    const colorMap: Record<string, string> = {
      auth: '#8b5cf6',
      payment: '#10b981',
      hosting: '#2563eb',
      support: '#f59e0b',
      system: '#6b7280'
    };
    const labelMap: Record<string, string> = {
      auth: 'Auth',
      payment: 'Platby',
      hosting: 'Hosting',
      support: 'Podpora',
      system: 'Systém'
    };
    const color = colorMap[category] || '#6b7280';
    return (
      <span
        className="category-badge"
        style={{ background: `${color}15`, color, borderColor: `${color}30` }}
      >
        {labelMap[category] || category}
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
      <div className="admin-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Načítání email šablon...</p>
        </div>
      </div>
    );
  }

  // If editing a template, show the editor view
  if (editingTemplate) {
    return (
      <div className="admin-page">
        <div className="admin-container">
          <motion.div
            className="admin-header email-header"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="admin-header-content">
              <div className="admin-title-section">
                <div className="admin-icon-wrapper">
                  <FontAwesomeIcon icon={faEdit} />
                </div>
                <div>
                  <h1>{editingTemplate.name}</h1>
                  <p>{editingTemplate.template_key}</p>
                </div>
              </div>
              <div className="admin-quick-links">
                <button className="quick-link-btn" onClick={closeEditor}>
                  <FontAwesomeIcon icon={faArrowLeft} />
                  <span>Zpět na seznam</span>
                </button>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="email-editor-container"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            {/* Subject */}
            <div className="editor-section">
              <label className="editor-label">Předmět emailu</label>
              <input
                type="text"
                className="editor-subject-input"
                value={editorSubject}
                onChange={(e) => setEditorSubject(e.target.value)}
              />
            </div>

            {/* Variables */}
            {editingTemplate.variables && editingTemplate.variables.length > 0 && (
              <div className="editor-section">
                <label className="editor-label">
                  <FontAwesomeIcon icon={faCode} /> Dostupné proměnné (kliknutím vložíte)
                </label>
                <div className="variables-chips">
                  {editingTemplate.variables.map((v) => (
                    <button
                      key={v}
                      className="variable-chip"
                      onClick={() => insertVariable(v)}
                      title={`Vložit {{${v}}}`}
                    >
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* HTML Editor */}
            <div className="editor-section">
              <label className="editor-label">HTML obsah</label>
              <textarea
                ref={textareaRef}
                className="editor-html-textarea"
                value={editorHtml}
                onChange={(e) => setEditorHtml(e.target.value)}
                rows={20}
                spellCheck={false}
              />
            </div>

            {/* Action buttons */}
            <div className="editor-actions">
              <button className="editor-btn save" onClick={handleSave} disabled={saving}>
                <FontAwesomeIcon icon={faSave} />
                {saving ? 'Ukládám...' : 'Uložit'}
              </button>
              <button className="editor-btn preview" onClick={handlePreview} disabled={loadingPreview}>
                <FontAwesomeIcon icon={faEye} />
                {loadingPreview ? 'Generuji...' : 'Náhled'}
              </button>
              <button className="editor-btn test" onClick={handleTestSend} disabled={sendingTest}>
                <FontAwesomeIcon icon={faPaperPlane} />
                {sendingTest ? 'Odesílám...' : 'Testovací email'}
              </button>
              <button className="editor-btn reset" onClick={handleReset}>
                <FontAwesomeIcon icon={faUndo} />
                Obnovit výchozí
              </button>
            </div>
          </motion.div>
        </div>

        {/* Preview Modal */}
        {previewOpen && (
          <div className="admin-modal-overlay" onClick={() => setPreviewOpen(false)}>
            <motion.div
              className="admin-modal preview-modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="admin-modal-header">
                <h3>Náhled emailu</h3>
                <button className="modal-close-btn" onClick={() => setPreviewOpen(false)}>
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
              <div className="preview-frame-container">
                <iframe
                  srcDoc={previewHtml}
                  title="Email preview"
                  className="preview-iframe"
                  sandbox="allow-same-origin"
                />
              </div>
            </motion.div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-container">
        {/* Header */}
        <motion.div
          className="admin-header email-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="admin-header-content">
            <div className="admin-title-section">
              <div className="admin-icon-wrapper">
                <FontAwesomeIcon icon={faEnvelope} />
              </div>
              <div>
                <h1>Email šablony</h1>
                <p>Správa emailových šablon systému</p>
              </div>
            </div>
            <div className="admin-quick-links">
              <button className="quick-link-btn" onClick={() => navigate('/admin')}>
                <FontAwesomeIcon icon={faArrowLeft} />
                <span>Zpět na administraci</span>
              </button>
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
              <FontAwesomeIcon icon={faEnvelope} />
            </div>
            <div className="stat-content">
              <h3>{templates.length}</h3>
              <p>Celkem šablon</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
              <FontAwesomeIcon icon={faCheckCircle} />
            </div>
            <div className="stat-content">
              <h3>{templates.filter(t => t.is_active).length}</h3>
              <p>Aktivních</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
              <FontAwesomeIcon icon={faTimesCircle} />
            </div>
            <div className="stat-content">
              <h3>{templates.filter(t => !t.is_active).length}</h3>
              <p>Neaktivních</p>
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
              placeholder="Hledat šablony..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="filter-buttons">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                className={`filter-btn ${categoryFilter === cat.key ? 'active' : ''}`}
                onClick={() => setCategoryFilter(cat.key)}
              >
                {cat.key === '' && <FontAwesomeIcon icon={faFilter} />}
                {cat.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Table */}
        <motion.div
          className="orders-table-container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <div className="table-header">
            <h2>
              <FontAwesomeIcon icon={faEnvelope} className="section-icon" />
              Šablony ({filteredTemplates.length})
            </h2>
          </div>

          {filteredTemplates.length === 0 ? (
            <div className="no-orders">
              <FontAwesomeIcon icon={faEnvelope} />
              <p>Žádné email šablony</p>
            </div>
          ) : (
            <div className="table-wrapper table-responsive">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Název</th>
                    <th>Klíč</th>
                    <th>Kategorie</th>
                    <th>Status</th>
                    <th>Poslední úprava</th>
                    <th>Akce</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTemplates.map((template) => (
                    <tr key={template.id} className="clickable-row" onClick={() => openEditor(template)}>
                      <td className="customer-name">{template.name}</td>
                      <td>
                        <code className="template-key">{template.template_key}</code>
                      </td>
                      <td>{getCategoryBadge(template.category)}</td>
                      <td>
                        <span
                          className={`promo-status-badge ${template.is_active ? 'active' : 'inactive'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleActive(template);
                          }}
                          style={{ cursor: 'pointer' }}
                          title="Kliknutím přepnete stav"
                        >
                          {template.is_active ? 'Aktivní' : 'Neaktivní'}
                        </span>
                      </td>
                      <td className="date">{formatDate(template.updated_at)}</td>
                      <td>
                        <div className="action-buttons" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="action-btn view"
                            title="Upravit šablonu"
                            onClick={() => openEditor(template)}
                          >
                            <FontAwesomeIcon icon={faEdit} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default AdminEmailTemplates;
