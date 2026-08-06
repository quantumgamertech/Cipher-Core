export default function OnboardingStep({ eyebrow, title, description, children, className = '' }) {
  return (
    <section className={`onboarding-step ${className}`}>
      {eyebrow && <span className="step-eyebrow">{eyebrow}</span>}
      <h2>{title}</h2>
      {description && <p className="step-description">{description}</p>}
      {children}
    </section>
  );
}
