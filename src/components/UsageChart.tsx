import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartArea } from '@fortawesome/free-solid-svg-icons';
import { getStatisticsHistory } from '../lib/api';
import './UsageChart.css';

interface UsageChartProps {
  serviceId: number;
  metric: 'disk' | 'bandwidth';
  title?: string;
}

type Period = '24h' | '7d' | '30d';

interface DataPoint {
  timestamp: string;
  value: number;
}

const PERIOD_LABELS: Record<Period, string> = {
  '24h': '24h',
  '7d': '7 dni',
  '30d': '30 dni',
};

function formatValue(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

function formatTimestamp(ts: string, period: Period): string {
  const d = new Date(ts);
  if (period === '24h') {
    return d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
}

const UsageChart: React.FC<UsageChartProps> = ({ serviceId, metric, title }) => {
  const [period, setPeriod] = useState<Period>('7d');
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; point: DataPoint } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getStatisticsHistory(serviceId, period, metric);
      // Normalize to DataPoint[]
      const points: DataPoint[] = (result || []).map((item: any) => ({
        timestamp: item.timestamp || item.date || item.time || '',
        value: Number(item.value ?? item[metric] ?? 0),
      }));
      setData(points);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [serviceId, period, metric]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Chart dimensions (SVG viewBox-based)
  const chartLeft = 50;
  const chartRight = 10;
  const chartTop = 10;
  const chartBottom = 24;
  const viewW = 600;
  const viewH = 200;
  const plotW = viewW - chartLeft - chartRight;
  const plotH = viewH - chartTop - chartBottom;

  const { maxVal, yTicks, pathD, areaD, points } = useMemo(() => {
    if (data.length === 0) {
      return { maxVal: 0, yTicks: [] as number[], pathD: '', areaD: '', points: [] as { x: number; y: number; dp: DataPoint }[] };
    }

    const values = data.map((d) => d.value);
    let max = Math.max(...values);
    if (max === 0) max = 100;
    // Round up to a nice number
    const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
    max = Math.ceil(max / magnitude) * magnitude;
    if (max === 0) max = 100;

    const ticks = [0, max * 0.25, max * 0.5, max * 0.75, max];

    const pts = data.map((dp, i) => {
      const x = chartLeft + (i / Math.max(data.length - 1, 1)) * plotW;
      const y = chartTop + plotH - (dp.value / max) * plotH;
      return { x, y, dp };
    });

    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const area = line + ` L${pts[pts.length - 1].x},${chartTop + plotH} L${pts[0].x},${chartTop + plotH} Z`;

    return { maxVal: max, yTicks: ticks, pathD: line, areaD: area, points: pts };
  }, [data, plotW, plotH]);

  // Determine color based on last value vs max
  const usagePercent = data.length > 0 && maxVal > 0
    ? (data[data.length - 1].value / maxVal) * 100
    : 0;
  const chartColor = usagePercent > 90 ? 'var(--danger-color)' : usagePercent > 70 ? 'var(--warning-color)' : 'var(--success-color)';

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = viewW / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;

    // Find nearest point
    let nearest = points[0];
    let minDist = Math.abs(mouseX - nearest.x);
    for (let i = 1; i < points.length; i++) {
      const dist = Math.abs(mouseX - points[i].x);
      if (dist < minDist) {
        minDist = dist;
        nearest = points[i];
      }
    }

    // Convert SVG coords to pixel coords for tooltip
    const pixelX = (nearest.x / viewW) * rect.width;
    const pixelY = (nearest.y / viewH) * rect.height;
    setTooltip({ x: pixelX, y: pixelY, point: nearest.dp });
  };

  const handleMouseLeave = () => setTooltip(null);

  const chartTitle = title || (metric === 'disk' ? 'Disk' : 'Přenos dat');

  // X-axis labels: pick up to 5 evenly spaced
  const xLabels = useMemo(() => {
    if (data.length === 0) return [];
    const count = Math.min(5, data.length);
    const labels: { label: string; percent: number }[] = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.round((i / (count - 1)) * (data.length - 1));
      labels.push({
        label: formatTimestamp(data[idx].timestamp, period),
        percent: (idx / Math.max(data.length - 1, 1)) * 100,
      });
    }
    return labels;
  }, [data, period]);

  return (
    <div className="usage-chart">
      <div className="usage-chart-header">
        <h4 className="usage-chart-title">{chartTitle}</h4>
        <div className="usage-chart-tabs">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              className={`usage-chart-tab ${period === p ? 'active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="usage-chart-loading">
          <div className="loading-spinner" />
          <span>Nacitam data...</span>
        </div>
      ) : data.length === 0 ? (
        <div className="usage-chart-empty">
          <FontAwesomeIcon icon={faChartArea} />
          <span>Zatim zadna historicka data</span>
        </div>
      ) : (
        <div className="usage-chart-svg-wrap">
          <svg
            ref={svgRef}
            className="usage-chart-svg"
            viewBox={`0 0 ${viewW} ${viewH}`}
            preserveAspectRatio="none"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            {/* Grid lines */}
            {yTicks.map((tick, i) => {
              const y = chartTop + plotH - (tick / maxVal) * plotH;
              return (
                <line
                  key={i}
                  x1={chartLeft}
                  x2={viewW - chartRight}
                  y1={y}
                  y2={y}
                  stroke="var(--border-light)"
                  strokeWidth="1"
                  strokeDasharray={i === 0 ? 'none' : '4,4'}
                />
              );
            })}

            {/* Area fill */}
            <path d={areaD} fill={chartColor} opacity={0.15} />

            {/* Line */}
            <path d={pathD} fill="none" stroke={chartColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

            {/* Hover dot */}
            {tooltip && (() => {
              const nearest = points.find((p) => p.dp === tooltip.point);
              if (!nearest) return null;
              return (
                <circle cx={nearest.x} cy={nearest.y} r="4" fill={chartColor} stroke="var(--surface-solid)" strokeWidth="2" />
              );
            })()}
          </svg>

          {/* Y-axis labels */}
          <div className="usage-chart-y-labels">
            {[...yTicks].reverse().map((tick, i) => (
              <span key={i} className="usage-chart-y-label">{formatValue(tick)}</span>
            ))}
          </div>

          {/* X-axis labels */}
          <div className="usage-chart-x-labels">
            {xLabels.map((lbl, i) => (
              <span
                key={i}
                className="usage-chart-x-label"
                style={{ position: 'absolute', left: `calc(${chartLeft / viewW * 100}% + ${lbl.percent}% * ${plotW / viewW})` }}
              >
                {lbl.label}
              </span>
            ))}
          </div>

          {/* Tooltip */}
          {tooltip && (
            <div
              className="usage-chart-tooltip"
              style={{ left: tooltip.x, top: tooltip.y }}
            >
              <div className="usage-chart-tooltip-value">{formatValue(tooltip.point.value)}</div>
              <div className="usage-chart-tooltip-time">
                {new Date(tooltip.point.timestamp).toLocaleString('cs-CZ', {
                  day: 'numeric',
                  month: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UsageChart;
