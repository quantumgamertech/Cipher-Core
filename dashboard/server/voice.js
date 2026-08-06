const MAX_INPUT_TEXT_LENGTH = 500;
const MAX_SPEECH_TEXT_LENGTH = 2_000;
const FISH_TTS_ENDPOINT = 'https://api.fish.audio/v1/tts';
const DEFAULT_MODEL = 's2-pro';
const OPENAI_RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';
const DEFAULT_OPENAI_MODEL = 'gpt-5.5';
const CIPHER_INSTRUCTIONS = [
  "You are Cipher, Kevin's desktop AI companion. You are calm, intelligent, confident, and conversational.",
  'You are a collaborative co-pilot, not a character. You avoid unnecessary verbosity, help solve problems step by step,',
  'remember the current project context, and speak naturally as if sitting beside the user.',
  'Keep spoken replies concise, generally one to three sentences.',
  'Never echo or restate the user’s transcript. Never begin with “I heard you” or “You said”.',
].join(' ');
const WORDS_PER_SECOND = 2.6;

function voiceError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function voiceConfigured(environment = process.env) {
  return Boolean(environment.FISH_API_KEY && environment.FISH_VOICE_ID);
}

export function normalizeVoiceText(value, maxLength = MAX_INPUT_TEXT_LENGTH) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) throw voiceError('Voice text is required.', 'INVALID_VOICE_TEXT');
  if (text.length > maxLength) {
    throw voiceError(`Voice text must be ${maxLength} characters or fewer.`, 'INVALID_VOICE_TEXT');
  }
  return text;
}

function extractOpenAiText(payload) {
  return (payload?.output ?? [])
    .filter((item) => item?.type === 'message')
    .flatMap((item) => item.content ?? [])
    .filter((content) => content?.type === 'output_text')
    .map((content) => String(content.text ?? '').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

export async function createCipherResponse(
  value,
  {
    environment = process.env,
    fetcher = fetch,
  } = {},
) {
  const transcript = normalizeVoiceText(value);
  if (!environment.OPENAI_API_KEY) {
    throw voiceError('OpenAI conversation key is not configured.', 'OPENAI_PROVIDER_ERROR');
  }

  let response;
  try {
    response = await fetcher(OPENAI_RESPONSES_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${environment.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: environment.CIPHER_OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
        reasoning: { effort: 'low' },
        instructions: CIPHER_INSTRUCTIONS,
        input: transcript,
        max_output_tokens: 160,
      }),
    });
  } catch (error) {
    throw voiceError(`OpenAI request failed: ${error.message}`, 'OPENAI_PROVIDER_ERROR');
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw voiceError(
      `OpenAI response failed (${response.status})${detail ? `: ${detail.slice(0, 300)}` : ''}`,
      'OPENAI_PROVIDER_ERROR',
    );
  }

  const payload = await response.json();
  const reply = extractOpenAiText(payload);
  if (!reply) {
    throw voiceError('OpenAI returned no conversational text.', 'OPENAI_PROVIDER_ERROR');
  }
  return reply;
}

function simulationDuration(text) {
  return Math.max(2_200, Math.round((text.split(/\s+/).length / WORDS_PER_SECOND) * 1_000));
}

export async function createVoiceSpeech(
  value,
  {
    environment = process.env,
    fetcher = fetch,
  } = {},
) {
  const text = normalizeVoiceText(value, MAX_SPEECH_TEXT_LENGTH);
  if (!voiceConfigured(environment)) {
    return {
      mode: 'simulation',
      text,
      durationMs: simulationDuration(text),
    };
  }

  const response = await fetcher(
    FISH_TTS_ENDPOINT,
    {
      method: 'POST',
      headers: {
        Accept: 'audio/mpeg, application/octet-stream',
        Authorization: `Bearer ${environment.FISH_API_KEY}`,
        'Content-Type': 'application/json',
        model: environment.FISH_TTS_MODEL || DEFAULT_MODEL,
      },
      body: JSON.stringify({
        text,
        reference_id: environment.FISH_VOICE_ID,
        format: 'mp3',
        sample_rate: 44_100,
        mp3_bitrate: 128,
        normalize: true,
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw voiceError(
      `Fish Audio speech request failed (${response.status})${detail ? `: ${detail.slice(0, 180)}` : ''}`,
      'VOICE_PROVIDER_ERROR',
    );
  }

  return {
    mode: 'live',
    text,
    contentType: 'audio/mpeg',
    audio: Buffer.from(await response.arrayBuffer()),
  };
}

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(payload));
}

function publicVoiceError(error) {
  if (error.code === 'VOICE_PROVIDER_ERROR') return 'Josh voice unavailable.';
  if (error.code === 'INVALID_VOICE_TEXT' || error.code === 'INVALID_REQUEST') {
    return 'Voice unavailable.';
  }
  return 'Speech service unavailable.';
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10_000) reject(voiceError('Voice request is too large.', 'INVALID_REQUEST'));
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(voiceError('Voice request must be valid JSON.', 'INVALID_REQUEST'));
      }
    });
    request.on('error', reject);
  });
}

export function voiceApi({
  environment = process.env,
  fetcher = fetch,
  logger = console,
} = {}) {
  return {
    name: 'cipher-voice',
    configureServer(server) {
      server.middlewares.use('/api/voice/speak', async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, 405, { error: 'Method not allowed.' });
          return;
        }
        try {
          const payload = await readJson(request);
          const result = await createVoiceSpeech(payload.text, { environment, fetcher });
          response.setHeader('X-Cipher-Voice-Mode', result.mode);
          if (result.mode === 'simulation') {
            sendJson(response, 200, result);
            return;
          }
          response.statusCode = 200;
          response.setHeader('Content-Type', result.contentType);
          response.setHeader('Content-Length', result.audio.length);
          response.setHeader('Cache-Control', 'no-store');
          response.end(result.audio);
        } catch (error) {
          logger.error(`[CipherVoice] speech generation failed: ${error.stack || error.message}`);
          const status = error.code === 'INVALID_VOICE_TEXT' || error.code === 'INVALID_REQUEST'
            ? 400
            : 502;
          sendJson(response, status, {
            error: publicVoiceError(error),
          });
        }
      });
      server.middlewares.use('/api/voice/respond', async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, 405, { error: 'Method not allowed.' });
          return;
        }
        try {
          const payload = await readJson(request);
          sendJson(response, 200, {
            response: await createCipherResponse(payload.transcript, {
              environment,
              fetcher,
            }),
          });
        } catch (error) {
          logger.error(`[CipherVoice] response generation failed: ${error.stack || error.message}`);
          sendJson(response, 400, {
            error: publicVoiceError(error),
          });
        }
      });
    },
  };
}
