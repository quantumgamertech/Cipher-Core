export const voiceScripts = [
  'Good afternoon, Kevin. Ready when you are.',
  'Good evening, Kevin. Cipher Core is online.',
  'Systems are stable.',
  'Awaiting your command.',
  'Development environment ready.',
];

export function createSpeechRecognitionSession({
  Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition,
  onInterim = () => {},
} = {}) {
  if (!Recognition) {
    throw new Error('Speech service unavailable.');
  }

  const recognition = new Recognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  let settled = false;
  let finalTranscript = '';
  const promise = new Promise((resolve, reject) => {
    recognition.onresult = (event) => {
      let interimTranscript = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = String(event.results[index][0]?.transcript || '').trim();
        if (event.results[index].isFinal) finalTranscript += `${transcript} `;
        else interimTranscript += `${transcript} `;
      }
      onInterim((finalTranscript + interimTranscript).trim());
    };
    recognition.onerror = (event) => {
      if (settled) return;
      settled = true;
      const messages = {
        'not-allowed': 'Microphone permission denied.',
        'service-not-allowed': 'Speech service unavailable.',
        network: 'Connection lost.',
        'audio-capture': 'Microphone unavailable.',
        'no-speech': 'Cipher did not hear any speech.',
      };
      const detail = messages[event.error] || 'Speech service unavailable.';
      reject(new Error(detail));
    };
    recognition.onend = () => {
      if (settled) return;
      settled = true;
      const transcript = finalTranscript.trim();
      if (!transcript) {
        reject(new Error('Cipher did not hear any speech.'));
        return;
      }
      resolve(transcript);
    };
  });

  recognition.start();
  return {
    promise,
    stop() {
      if (!settled) recognition.abort();
    },
  };
}

export async function requestCipherResponse(transcript, { fetcher = fetch } = {}) {
  let response;
  try {
    response = await fetcher('/api/voice/respond', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transcript }),
    });
  } catch {
    throw new Error('Connection lost.');
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || 'Speech service unavailable.');
  }
  if (!payload?.response) {
    throw new Error('Speech service unavailable.');
  }
  return payload.response;
}

export async function requestVoiceSpeech(text, { fetcher = fetch } = {}) {
  let response;
  try {
    response = await fetcher('/api/voice/speak', {
      method: 'POST',
      headers: {
        Accept: 'audio/mpeg, application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });
  } catch {
    throw new Error('Connection lost.');
  }
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    const payload = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : null;
    throw new Error(payload?.error || 'Voice unavailable.');
  }
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return {
    mode: 'live',
    text,
    audio: await response.blob(),
    contentType,
  };
}

const WORDS_PER_SECOND = 2.6;

export function createSimulatedSpeech(text) {
  const durationMs = Math.max(2200, Math.round((text.split(/\s+/).length / WORDS_PER_SECOND) * 1000));
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `speech-${Date.now()}`,
    text,
    durationMs,
    source: 'simulation',
  };
}
