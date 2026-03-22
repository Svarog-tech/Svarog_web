import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import PageMeta from '../components/PageMeta';
import { useLanguage } from '../contexts/LanguageContext';
import { getServerStatus } from '../lib/api';
import type { StatusData, ServiceStatus, StatusIncident } from '../lib/api';
import './Status.css';

const STATUS_REFRESH_INTERVAL = 60000; // 60 seconds

function getStatusColor(status: string): string {
  switch (status) {
    case 'operational': return '#22c55e';
    case 'degraded': return '#eab308';
    case 'major_outage': return '#ef4444';
    default: return '#6b7280';
  }
}

function getStatusLabel(status: string, isCs: boolean): string {
  switch (status) {
    case 'operational': return isCs ? 'V provozu' : 'Operational';
    case 'degraded': return isCs ? 'Omezeno' : 'Degraded';
    case 'major_outage': return isCs ? 'V\u00fdpadek' : 'Major Outage';
    default: return status;
  }
}

function getSeverityLabel(severity: string, isCs: boolean): string {
  switch (severity) {
    case 'minor': return isCs ? 'Drobnost' : 'Minor';
    case 'major': return isCs ? 'Z\u00e1va\u017en\u00e9' : 'Major';
    case 'critical': return isCs ? 'Kritick\u00e9' : 'Critical';
    default: return severity;
  }
}

function getIncidentStatusLabel(status: string, isCs: boolean): string {
  switch (status) {
    case 'investigating': return isCs ? 'Vy\u0161et\u0159ujeme' : 'Investigating';
    case 'identified': return isCs ? 'Identifikov\u00e1no' : 'Identified';
    case 'monitoring': return isCs ? 'Monitorujeme' : 'Monitoring';
    case 'resolved': return isCs ? 'Vy\u0159e\u0161eno' : 'Resolved';
    default: return status;
  }
}

function formatDate(dateStr: string, isCs: boolean): string {
  const date = new Date(dateStr);
  return date.toLocaleString(isCs ? 'cs-CZ' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

const Status: React.FC = () => {
  const { language } = useLanguage();
  const isCs = language === 'cs';
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchStatus = useCallback(async () => {
    try {
      const data = await getServerStatus();
      setStatusData(data);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setError(isCs ? 'Nepoda\u0159ilo se na\u010d\u00edst stav slu\u017eeb' : 'Failed to load service status');
    } finally {
      setLoading(false);
    }
  }, [isCs]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, STATUS_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const activeIncidents = statusData?.incidents.filter(i => i.status !== 'resolved') || [];
  const recentResolved = statusData?.incidents.filter(i => i.status === 'resolved') || [];

  return (
    <main className="status-page">
      <PageMeta
        title={isCs ? 'Stav slu\u017eeb \u2013 Alatyr Hosting' : 'Service Status \u2013 Alatyr Hosting'}
        description={isCs ? 'Aktu\u00e1ln\u00ed stav v\u0161ech slu\u017eeb Alatyr Hosting.' : 'Current status of all Alatyr Hosting services.'}
        path="/status"
      />

      <div className="container">
        <motion.div
          className="status-content"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="status-title">{isCs ? 'Stav slu\u017eeb' : 'Service Status'}</h1>

          {loading ? (
            <div className="status-loading">
              <div className="status-spinner" />
              <p>{isCs ? 'Na\u010d\u00edt\u00e1m...' : 'Loading...'}</p>
            </div>
          ) : error ? (
            <div className="status-error">
              <p>{error}</p>
              <button onClick={fetchStatus} className="status-retry-btn">
                {isCs ? 'Zkusit znovu' : 'Retry'}
              </button>
            </div>
          ) : statusData ? (
            <>
              {/* Overall status banner */}
              <div className={`status-banner status-banner--${statusData.overall_status}`}>
                <span
                  className="status-dot"
                  style={{ backgroundColor: getStatusColor(statusData.overall_status) }}
                />
                <span className="status-banner-text">
                  {statusData.overall_status === 'operational'
                    ? (isCs ? 'V\u0161e funguje spr\u00e1vn\u011b' : 'All systems operational')
                    : statusData.overall_status === 'degraded'
                    ? (isCs ? 'N\u011bkter\u00e9 slu\u017eby jsou omezeny' : 'Some services degraded')
                    : (isCs ? 'Prob\u00edh\u00e1 v\u00fdpadek slu\u017eeb' : 'Major service outage')}
                </span>
              </div>

              {/* Services list */}
              <div className="status-services">
                {statusData.services.map((service: ServiceStatus, index: number) => (
                  <div key={index} className="status-service-row">
                    <div className="status-service-info">
                      <span
                        className="status-dot status-dot--small"
                        style={{ backgroundColor: getStatusColor(service.status) }}
                      />
                      <span className="status-service-name">{service.name}</span>
                    </div>
                    <div className="status-service-meta">
                      <span
                        className="status-service-label"
                        style={{ color: getStatusColor(service.status) }}
                      >
                        {getStatusLabel(service.status, isCs)}
                      </span>
                      <span className="status-uptime">
                        {service.uptime_30d.toFixed(1)}% {isCs ? 'za 30 dn\u00ed' : '30d uptime'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Active incidents */}
              {activeIncidents.length > 0 && (
                <div className="status-incidents">
                  <h2>{isCs ? 'Aktivn\u00ed incidenty' : 'Active Incidents'}</h2>
                  {activeIncidents.map((incident: StatusIncident) => (
                    <div key={incident.id} className={`status-incident status-incident--${incident.severity}`}>
                      <div className="status-incident-header">
                        <h3>{incident.title}</h3>
                        <div className="status-incident-badges">
                          <span className={`status-badge status-badge--${incident.severity}`}>
                            {getSeverityLabel(incident.severity, isCs)}
                          </span>
                          <span className={`status-badge status-badge--${incident.status}`}>
                            {getIncidentStatusLabel(incident.status, isCs)}
                          </span>
                        </div>
                      </div>
                      {incident.description && (
                        <p className="status-incident-desc">{incident.description}</p>
                      )}
                      <span className="status-incident-time">
                        {formatDate(incident.started_at, isCs)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Recent resolved incidents */}
              {recentResolved.length > 0 && (
                <div className="status-incidents status-incidents--resolved">
                  <h2>{isCs ? 'Ned\u00e1vno vy\u0159e\u0161en\u00e9' : 'Recently Resolved'}</h2>
                  {recentResolved.map((incident: StatusIncident) => (
                    <div key={incident.id} className="status-incident status-incident--resolved">
                      <div className="status-incident-header">
                        <h3>{incident.title}</h3>
                        <span className="status-badge status-badge--resolved">
                          {getIncidentStatusLabel('resolved', isCs)}
                        </span>
                      </div>
                      {incident.description && (
                        <p className="status-incident-desc">{incident.description}</p>
                      )}
                      <span className="status-incident-time">
                        {isCs ? 'Vy\u0159e\u0161eno' : 'Resolved'}: {incident.resolved_at ? formatDate(incident.resolved_at, isCs) : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Last updated */}
              <div className="status-footer">
                <span className="status-last-updated">
                  {isCs ? 'Posledn\u00ed aktualizace' : 'Last updated'}: {lastUpdated.toLocaleTimeString(isCs ? 'cs-CZ' : 'en-US')}
                </span>
                <span className="status-auto-refresh">
                  {isCs ? 'Automatick\u00e1 aktualizace ka\u017edou minutu' : 'Auto-refreshes every minute'}
                </span>
              </div>
            </>
          ) : null}
        </motion.div>
      </div>
    </main>
  );
};

export default Status;
