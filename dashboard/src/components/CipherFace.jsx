import { useEffect, useState } from 'react';

const modeMessages = {
  idle: 'Core signal stable',
  listening: 'Input channel simulated',
  thinking: 'Processing local context',
  speaking: 'Voice sequence active',
  alert: 'Attention required',
};

export default function CipherFace({ mode }) {
  const [isBlinking, setIsBlinking] = useState(false);

  useEffect(() => {
    let blinkTimeout;
    let resetTimeout;
    const scheduleBlink = () => {
      blinkTimeout = window.setTimeout(() => {
        setIsBlinking(true);
        resetTimeout = window.setTimeout(() => {
          setIsBlinking(false);
          scheduleBlink();
        }, 150);
      }, 2600 + Math.random() * 4300);
    };
    scheduleBlink();
    return () => {
      window.clearTimeout(blinkTimeout);
      window.clearTimeout(resetTimeout);
    };
  }, []);

  return (
    <section className={`cipher-stage mode-${mode}`} aria-label={`Cipher avatar: ${mode}`}>
      <div className="particle-field" aria-hidden="true">
        {Array.from({ length: 18 }, (_, index) => <i key={index} style={{ '--particle': index }} />)}
      </div>
      <div className="orbit orbit-outer" aria-hidden="true" />
      <div className="orbit orbit-inner" aria-hidden="true" />
      <div className="orbit orbit-core" aria-hidden="true" />
      <div className="scan-arc" aria-hidden="true" />
      <div className="face-shell">
        <div className="face-grid" aria-hidden="true" />
        <div className="brow brow-left" />
        <div className="brow brow-right" />
        <div className={`eyes ${isBlinking ? 'blink' : ''}`}>
          <span className="eye"><i /></span>
          <span className="eye"><i /></span>
        </div>
        <div className="nose-mark" aria-hidden="true" />
        <div className="mouth" aria-hidden="true">
          {Array.from({ length: 9 }, (_, index) => <i key={index} />)}
        </div>
      </div>
      <div className="mode-readout">
        <span className="mode-pip" />
        <strong>{mode}</strong>
        <small>{modeMessages[mode]}</small>
      </div>
    </section>
  );
}
