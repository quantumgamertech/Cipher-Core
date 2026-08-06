export default function TemperatureAlert({ warning }) {
  if (!warning) return null;

  const details = warning.sensors
    .map(({ name, temperature }) => `${name} ${Math.round(temperature)}°C`)
    .join(' · ');

  return (
    <div className="temperature-warning" role="alert" aria-live="assertive">
      <strong>Temperature warning</strong>
      <span>{details}</span>
      <small>Threshold {warning.threshold}°C</small>
    </div>
  );
}

