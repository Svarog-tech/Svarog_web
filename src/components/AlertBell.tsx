import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBell,
  faExclamationTriangle,
  faExclamationCircle,
  faCheck
} from '@fortawesome/free-solid-svg-icons';
import { getUnreadAlerts, acknowledgeAlert, type ServiceAlert } from '../lib/api';
import './AlertBell.css';

const ALERT_TYPE_LABELS: Record<string, string> = {
  disk_limit: 'Disk',
  bandwidth_limit: 'Přenos dat',
  email_limit: 'E-maily',
  database_limit: 'Databáze',
  domain_limit: 'Domény',
  cpu_high: 'CPU',
  memory_high: 'Paměť',
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'právě teď';
  if (minutes < 60) return `před ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `před ${hours} h`;
  const days = Math.floor(hours / 24);
  return `před ${days} d`;
}

const AlertBell: React.FC = () => {
  const [alerts, setAlerts] = useState<ServiceAlert[]>([]);
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const fetchAlerts = useCallback(async () => {
    const result = await getUnreadAlerts();
    setAlerts(result.alerts);
    setCount(result.count);
  }, []);

  // Poll every 60 seconds
  useEffect(() => {
    let cancelled = false;
    const safeFetch = async () => {
      const result = await getUnreadAlerts();
      if (!cancelled) {
        setAlerts(result.alerts);
        setCount(result.count);
      }
    };
    safeFetch();
    const interval = setInterval(fetchAlerts, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fetchAlerts]);

  // Position dropdown below button
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const menuWidth = 380;
    const vw = window.innerWidth;
    let left = rect.right - menuWidth;
    if (left < 12) left = 12;
    if (left + menuWidth > vw - 12) left = vw - menuWidth - 12;
    setMenuPos({ top: rect.bottom + 8, left });
  }, [open]);

  const handleAcknowledge = async (alert: ServiceAlert) => {
    try {
      await acknowledgeAlert(alert.service_id, alert.id);
      setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
      setCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const handleAcknowledgeAll = async () => {
    try {
      await Promise.all(alerts.map((a) => acknowledgeAlert(a.service_id, a.id)));
      setAlerts([]);
      setCount(0);
    } catch (err) {
      console.error('Failed to acknowledge all alerts:', err);
    }
  };

  return (
    <div className="alert-bell">
      <button
        ref={btnRef}
        className={`alert-bell-btn ${count > 0 ? 'has-alerts' : ''}`}
        onClick={() => setOpen(!open)}
        aria-label={`Upozornění${count > 0 ? ` (${count})` : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <FontAwesomeIcon icon={faBell} />
        {count > 0 && (
          <span className="alert-bell-badge">{count > 99 ? '99+' : count}</span>
        )}
      </button>

      {open && (
        <>
          <div className="alert-bell-backdrop" onClick={() => setOpen(false)} />
          <div
            className="alert-bell-dropdown"
            style={{ top: `${menuPos.top}px`, left: `${menuPos.left}px` }}
          >
            <div className="alert-bell-header">
              <h3>Upozornění</h3>
              {alerts.length > 0 && (
                <button className="alert-bell-ack-all" onClick={handleAcknowledgeAll}>
                  <FontAwesomeIcon icon={faCheck} /> Potvrdit vše
                </button>
              )}
            </div>
            <div className="alert-bell-list">
              {alerts.length === 0 ? (
                <div className="alert-bell-empty">
                  <FontAwesomeIcon icon={faBell} />
                  <span>Žádná nová upozornění</span>
                </div>
              ) : (
                alerts.map((alert) => (
                  <div key={alert.id} className="alert-item">
                    <div className={`alert-item-icon severity-${alert.severity}`}>
                      <FontAwesomeIcon
                        icon={alert.severity === 'critical' ? faExclamationCircle : faExclamationTriangle}
                      />
                    </div>
                    <div className="alert-item-body">
                      <div className="alert-item-type">
                        {ALERT_TYPE_LABELS[alert.alert_type] || alert.alert_type}
                      </div>
                      <div className="alert-item-values">
                        <span>{alert.current_value}</span> / {alert.threshold_value}
                      </div>
                      <div className="alert-item-meta">
                        <span className="alert-item-service">
                          {alert.hestia_domain || alert.plan_name || `Služba #${alert.service_id}`}
                        </span>
                        <span className="alert-item-time">{timeAgo(alert.created_at)}</span>
                      </div>
                    </div>
                    <div className="alert-item-actions">
                      <button
                        className="alert-item-ack"
                        onClick={() => handleAcknowledge(alert)}
                        title="Potvrdit"
                      >
                        Potvrdit
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AlertBell;
