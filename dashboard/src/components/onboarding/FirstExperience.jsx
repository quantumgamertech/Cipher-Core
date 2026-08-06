import { useMemo, useState } from 'react';
import { purposes } from '../../data/identities.js';
import { createIdentityProfile, getIdentity, sanitizeAgentName } from '../../services/identity/identityService.js';
import IdentityGallery from '../identity/IdentityGallery.jsx';
import OnboardingStep from './OnboardingStep.jsx';

const TOTAL_STEPS = 9;
const emptyBusiness = {
  name: '',
  industry: '',
  hours: '',
  services: '',
  policies: '',
  faqs: '',
  leadPreferences: '',
  tone: '',
};

export default function FirstExperience({ initialProfile, onComplete, onExit }) {
  const [step, setStep] = useState(0);
  const [identityId, setIdentityId] = useState(initialProfile?.identityId ?? 'nexus');
  const [agentName, setAgentName] = useState(initialProfile?.agentName ?? '');
  const [purpose, setPurpose] = useState(initialProfile?.purpose ?? 'Personal Operator');
  const [business, setBusiness] = useState({ ...emptyBusiness, ...(initialProfile?.business ?? {}) });
  const [complete, setComplete] = useState(false);
  const identity = useMemo(() => getIdentity(identityId), [identityId]);
  const safeName = sanitizeAgentName(agentName, identity.name);

  const profile = useMemo(
    () => createIdentityProfile({ identityId, agentName: safeName, purpose, business }),
    [identityId, safeName, purpose, business],
  );

  const next = () => setStep((current) => Math.min(TOTAL_STEPS - 1, current + 1));
  const back = () => setStep((current) => Math.max(0, current - 1));
  const updateBusiness = (field, value) => setBusiness((current) => ({ ...current, [field]: value }));
  const finish = () => {
    setComplete(true);
    onComplete?.(profile);
  };

  if (complete) {
    return (
      <section className="first-experience complete-experience">
        <span>PROTOTYPE PROFILE READY</span>
        <h2>{safeName} is ready.</h2>
        <p>{identity.greeting}</p>
        <small>Nothing was saved or connected. This profile exists only until the page reloads.</small>
        <div className="experience-actions">
          <button type="button" className="primary-action" onClick={onExit}>ENTER CIPHER CORE</button>
          <button type="button" onClick={() => { setComplete(false); setStep(2); }}>EDIT PROFILE</button>
        </div>
      </section>
    );
  }

  const renderStep = () => {
    if (step === 0) {
      return (
        <OnboardingStep className="pulse-intro" title="">
          <div className="intro-pulse" />
          <span>CIPHER // FIRST SIGNAL</span>
          <button type="button" className="ghost-action" onClick={next}>BEGIN</button>
        </OnboardingStep>
      );
    }
    if (step === 1) {
      return (
        <OnboardingStep eyebrow="FIRST CONTACT" title="Hello.">
          <button type="button" className="primary-action" onClick={next}>CONTINUE</button>
        </OnboardingStep>
      );
    }
    if (step === 2) {
      return (
        <OnboardingStep
          eyebrow="FIRST CONTACT"
          title="Before I become your teammate, let’s get to know each other."
          description="This prototype stays in local React memory. Nothing is connected or saved."
        >
          <button type="button" className="primary-action" onClick={next}>MEET THE IDENTITIES</button>
        </OnboardingStep>
      );
    }
    if (step === 3) {
      return (
        <OnboardingStep
          eyebrow="01 // IDENTITY"
          title="How should your teammate show up?"
          description="Identity shapes expression and temperament. You choose the name next."
        >
          <IdentityGallery selectedId={identityId} onSelect={setIdentityId} />
        </OnboardingStep>
      );
    }
    if (step === 4) {
      return (
        <OnboardingStep
          eyebrow="02 // NAME"
          title={`Meet ${safeName}.`}
          description="Use any name that fits. Public faces are designed without a fixed letter mark."
        >
          <div className="name-stage">
            <label>
              AGENT NAME
              <input
                value={agentName}
                onChange={(event) => setAgentName(event.target.value)}
                maxLength={32}
                placeholder={identity.name}
                autoFocus
              />
            </label>
          </div>
        </OnboardingStep>
      );
    }
    if (step === 5) {
      return (
        <OnboardingStep eyebrow="03 // PURPOSE" title={`What is ${safeName} here to help with?`}>
          <div className="purpose-grid">
            {purposes.map((item) => (
              <button
                type="button"
                key={item}
                aria-pressed={purpose === item}
                className={purpose === item ? 'selected' : ''}
                onClick={() => setPurpose(item)}
              >
                <i /> {item}
              </button>
            ))}
          </div>
        </OnboardingStep>
      );
    }
    if (step === 6) {
      const fields = [
        ['name', 'Business name'],
        ['industry', 'Industry'],
        ['hours', 'Hours'],
        ['services', 'Services'],
        ['policies', 'Policies'],
        ['faqs', 'FAQs'],
        ['leadPreferences', 'Lead preferences'],
        ['tone', 'Tone'],
      ];
      return (
        <OnboardingStep
          eyebrow="04 // BUSINESS PREVIEW"
          title="Teach the shape of the business."
          description="Preview fields only. No data leaves this page or persists after reload."
        >
          <div className="business-form">
            {fields.map(([field, label]) => (
              <label key={field}>
                {label.toUpperCase()}
                <input
                  value={business[field]}
                  onChange={(event) => updateBusiness(field, event.target.value)}
                  placeholder={`Mock ${label.toLowerCase()}`}
                />
              </label>
            ))}
          </div>
        </OnboardingStep>
      );
    }
    if (step === 7) {
      return (
        <OnboardingStep eyebrow="05 // REVIEW" title="This is your teammate profile.">
          <div className="profile-review">
            <dl>
              <div><dt>Name</dt><dd>{safeName}</dd></div>
              <div><dt>Identity</dt><dd>{identity.name}</dd></div>
              <div><dt>Purpose</dt><dd>{purpose}</dd></div>
              <div><dt>Business</dt><dd>{business.name || 'Not provided'}</dd></div>
              <div><dt>Industry</dt><dd>{business.industry || 'Not provided'}</dd></div>
              <div><dt>Data mode</dt><dd>Local state · Prototype</dd></div>
            </dl>
          </div>
        </OnboardingStep>
      );
    }
    return (
      <OnboardingStep
        eyebrow="06 // READY"
        title="The profile is clear. The boundaries are clear."
        description="No permissions are enabled. No accounts or devices are connected."
      >
        <button type="button" className="ready-action" onClick={finish}>I’M READY.</button>
      </OnboardingStep>
    );
  };

  return (
    <section className="first-experience">
      <header className="experience-progress">
        <span>FIRST EXPERIENCE</span>
        <small>PROTOTYPE / MOCK ONLY</small>
        <div><i style={{ '--step-progress': `${(step / (TOTAL_STEPS - 1)) * 100}%` }} /></div>
      </header>
      {renderStep()}
      {step > 0 && (
        <footer className="experience-footer">
          <button type="button" onClick={back}>← BACK</button>
          <span>{String(step + 1).padStart(2, '0')} / {String(TOTAL_STEPS).padStart(2, '0')}</span>
          {step >= 3 && step < TOTAL_STEPS - 1
            ? <button type="button" onClick={next}>CONTINUE →</button>
            : <i />}
        </footer>
      )}
    </section>
  );
}
