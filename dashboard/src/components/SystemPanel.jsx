import aidaSystemPanel from '../../../QGT_Themes/Permanent_Master/QGT_Inferno_RedOrange.png';
import qgtMark from '../../../../Users/kevin/Downloads/qgt-mark.png';
import { TEMPERATURE_THRESHOLDS } from '../services/telemetry/temperatureAlerts.js';
import { themes } from '../data/themes.js';

const hudStyle = {
  position: 'relative',
  width: '100%',
  aspectRatio: '4 / 3',
  overflow: 'hidden',
};

const imageStyle = {
  display: 'block',
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  filter: 'grayscale(1) contrast(1.14)',
};

const overlayBase = {
  position: 'absolute',
  display: 'grid',
  justifyItems: 'center',
  transform: 'translate(-50%, -50%)',
  color: '#fff',
  fontFamily: '"Chakra Petch", "Segoe UI", sans-serif',
  lineHeight: 1,
  pointerEvents: 'none',
  zIndex: 2,
};

const positions = {
  cpuUsage: { left: '25%', top: '25%' },
  gpuUsage: { left: '75%', top: '25%' },
  cpuTemp: { left: '23%', top: '53.5%' },
  gpuTemp: { left: '77%', top: '53.5%' },
  ram: { left: '33%', top: '77%' },
  disk: { left: '67%', top: '77%' },
};

const gaugeLevel = (value) => (
  Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0
);

export default function SystemPanel({
  telemetry,
  themeColors = ['#24eaff', '#477bff'],
  themeId = 'Default',
  ownerUnlocked = false,
  temperatureThreshold = 95,
  onTemperatureThresholdChange = () => {},
}) {
  const [primary, secondary] = themeColors;
  const activeTheme = themes.find((theme) => theme.id === themeId);
  const [leftLabel, rightLabel] = activeTheme?.labelColors ?? [primary, primary];
  const display = (value) => (
    Number.isFinite(value) ? Math.round(value) : '--'
  );
  const systemStats = [
    { id: 'cpuUsage', label: 'CPU LOAD', value: display(telemetry.cpuUsage), unit: '%' },
    { id: 'gpuUsage', label: 'GPU LOAD', value: display(telemetry.gpuUsage), unit: '%' },
    { id: 'cpuTemp', label: 'CPU TEMP', value: display(telemetry.cpuTemp), unit: '°C' },
    { id: 'gpuTemp', label: 'GPU TEMP', value: display(telemetry.gpuTemp), unit: '°C' },
    { id: 'ram', label: 'MEMORY', value: display(telemetry.ram), unit: '%' },
    { id: 'disk', label: 'DISK', value: display(telemetry.disk), unit: '%' },
  ];
  const ringGauges = [
    { id: 'cpuUsage', value: telemetry.cpuUsage, cx: 25, cy: 18.9, radius: 14 },
    { id: 'gpuUsage', value: telemetry.gpuUsage, cx: 75, cy: 18.9, radius: 14 },
    { id: 'ram', value: telemetry.ram, cx: 33, cy: 57.3, radius: 11.5 },
    { id: 'disk', value: telemetry.disk, cx: 67, cy: 57.3, radius: 11.5 },
  ];

  return (
    <section className="panel system-panel">
      <div className="panel-heading">
        <span>SYSTEM</span>
        <div className="system-panel-heading-tools">
          <small>{telemetry.provider.toUpperCase()} TELEMETRY</small>
          {ownerUnlocked && (
            <label>
              TEMP ALERT
              <select
                aria-label="Temperature alert threshold"
                value={temperatureThreshold}
                onChange={(event) => onTemperatureThresholdChange(event.target.value)}
              >
                {TEMPERATURE_THRESHOLDS.map((threshold) => (
                  <option key={threshold} value={threshold}>{threshold}°C</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>
      <div style={hudStyle}>
        <img src={aidaSystemPanel} alt="AIDA-style system telemetry HUD" style={imageStyle} />
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            background: `linear-gradient(115deg, ${primary}, ${secondary})`,
            mixBlendMode: 'color',
            pointerEvents: 'none',
          }}
        />
        <svg
          viewBox="0 0 100 75"
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            width: '100%',
            height: '100%',
            overflow: 'visible',
            pointerEvents: 'none',
            filter: `drop-shadow(0 0 2px ${primary})`,
          }}
        >
          <defs>
            <linearGradient id="system-gauge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={primary} />
              <stop offset="100%" stopColor={secondary} />
            </linearGradient>
          </defs>
          {ringGauges.map((gauge) => (
            <circle
              key={gauge.id}
              cx={gauge.cx}
              cy={gauge.cy}
              r={gauge.radius}
              pathLength="100"
              fill="none"
              stroke="url(#system-gauge-gradient)"
              strokeWidth="1.05"
              strokeLinecap="round"
              strokeDasharray={`${gaugeLevel(gauge.value)} 100`}
              transform={`rotate(-90 ${gauge.cx} ${gauge.cy})`}
              style={{ transition: 'stroke-dasharray .55s ease' }}
            />
          ))}
          <line
            x1="12"
            y1="40"
            x2="34"
            y2="40"
            pathLength="100"
            stroke="url(#system-gauge-gradient)"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeDasharray={`${gaugeLevel(telemetry.cpuTemp)} 100`}
            style={{ transition: 'stroke-dasharray .55s ease' }}
          />
          <line
            x1="66"
            y1="40"
            x2="88"
            y2="40"
            pathLength="100"
            stroke="url(#system-gauge-gradient)"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeDasharray={`${gaugeLevel(telemetry.gpuTemp)} 100`}
            style={{ transition: 'stroke-dasharray .55s ease' }}
          />
        </svg>
        <img
          src={qgtMark}
          alt="QGT"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            zIndex: 3,
            width: '22%',
            height: 'auto',
            transform: 'translate(-50%, -50%)',
            filter: `drop-shadow(0 0 6px ${primary})`,
            opacity: .9,
            pointerEvents: 'none',
          }}
        />
        {systemStats.map((stat) => (
          <div
            key={stat.id}
            style={{
              ...overlayBase,
              ...positions[stat.id],
              textShadow: `0 0 8px ${primary}`,
              zIndex: 3,
            }}
          >
            <small style={{
              marginBottom: '5px',
              color: ['cpuUsage', 'cpuTemp', 'ram'].includes(stat.id)
                ? leftLabel
                : rightLabel,
              fontSize: 'clamp(5px, .48vw, 8px)',
              fontWeight: 700,
              letterSpacing: '.12em',
              whiteSpace: 'nowrap',
            }}
            >
              {stat.label}
            </small>
            <strong style={{
              fontSize: 'clamp(13px, 1.45vw, 24px)',
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
            >
              {stat.value}
              <small style={{ marginLeft: '2px', fontSize: '.46em', color: secondary }}>
                {stat.unit}
              </small>
            </strong>
          </div>
        ))}
      </div>
    </section>
  );
}
