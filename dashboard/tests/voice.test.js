import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  createCipherResponse,
  createVoiceSpeech,
  normalizeVoiceText,
  voiceConfigured,
} from '../server/voice.js';
import {
  createSpeechRecognitionSession,
  requestCipherResponse,
  requestVoiceSpeech,
  voiceScripts,
} from '../src/services/voice/voiceService.js';

const voiceHookSource = () => readFileSync(new URL('../src/hooks/useVoice.js', import.meta.url), 'utf8');

test('missing Fish Audio environment stays in simulation mode without a network call', async () => {
  let calls = 0;
  const result = await createVoiceSpeech(
    'Good afternoon, Kevin. Ready when you are.',
    {
      environment: {},
      fetcher: async () => {
        calls += 1;
      },
    },
  );

  assert.equal(voiceConfigured({}), false);
  assert.equal(result.mode, 'simulation');
  assert.equal(result.text, 'Good afternoon, Kevin. Ready when you are.');
  assert.ok(result.durationMs >= 2_200);
  assert.equal(calls, 0);
});

test('configured voice sends the API key only from the backend Fish Audio request', async () => {
  let request;
  const result = await createVoiceSpeech('Ready when you are.', {
    environment: {
      FISH_API_KEY: 'server-secret',
      FISH_VOICE_ID: 'fish-voice-id',
    },
    fetcher: async (url, options) => {
      request = { url, options };
      return new Response(Uint8Array.from([1, 2, 3]), {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg' },
      });
    },
  });

  assert.equal(request.url, 'https://api.fish.audio/v1/tts');
  assert.equal(request.options.headers.Authorization, 'Bearer server-secret');
  assert.equal(request.options.headers.model, 's2-pro');
  assert.deepEqual(JSON.parse(request.options.body), {
    text: 'Ready when you are.',
    reference_id: 'fish-voice-id',
    format: 'mp3',
    sample_rate: 44_100,
    mp3_bitrate: 128,
    normalize: true,
  });
  assert.equal(result.mode, 'live');
  assert.equal(result.contentType, 'audio/mpeg');
  assert.deepEqual([...result.audio], [1, 2, 3]);
});

test('voice input is required and bounded', () => {
  assert.throws(() => normalizeVoiceText('  '), (error) => error.code === 'INVALID_VOICE_TEXT');
  assert.throws(() => normalizeVoiceText('x'.repeat(501)), (error) => error.code === 'INVALID_VOICE_TEXT');
});

test('generated speech accepts concise replies beyond the transcript input limit', async () => {
  const text = 'Cipher response. '.repeat(40).trim();
  const result = await createVoiceSpeech(text, {
    environment: {},
  });

  assert.ok(text.length > 500);
  assert.equal(result.mode, 'simulation');
  assert.equal(result.text, text);
});

test('frontend voice client accepts simulation JSON and live audio', async () => {
  let request;
  const simulated = await requestVoiceSpeech('Hello', {
    fetcher: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({
        mode: 'simulation',
        text: 'Hello',
        durationMs: 2_200,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });
  assert.equal(request.url, '/api/voice/speak');
  assert.equal(request.options.method, 'POST');
  assert.deepEqual(JSON.parse(request.options.body), { text: 'Hello' });
  assert.equal(simulated.mode, 'simulation');

  const live = await requestVoiceSpeech('Hello', {
    fetcher: async () => new Response(Uint8Array.from([4, 5]), {
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg' },
    }),
  });
  assert.equal(live.mode, 'live');
  assert.equal(live.contentType, 'audio/mpeg');
  assert.equal(live.audio.size, 2);
});

test('canonical voice test phrase is available first', () => {
  assert.equal(voiceScripts[0], 'Good afternoon, Kevin. Ready when you are.');
});

test('Cipher backend sends transcripts to OpenAI and returns real model text', async () => {
  let request;
  const response = await createCipherResponse('Hey Cipher, is this cool or what?', {
    environment: {
      OPENAI_API_KEY: 'openai-server-secret',
      CIPHER_OPENAI_MODEL: 'gpt-test',
    },
    fetcher: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({
        output: [{
          type: 'message',
          content: [{
            type: 'output_text',
            text: 'Absolutely. This is the moment Cipher Core starts feeling alive.',
          }],
        }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  assert.equal(request.url, 'https://api.openai.com/v1/responses');
  assert.equal(request.options.headers.Authorization, 'Bearer openai-server-secret');
  const body = JSON.parse(request.options.body);
  assert.equal(body.model, 'gpt-test');
  assert.equal(body.input, 'Hey Cipher, is this cool or what?');
  assert.match(body.instructions, /Kevin's desktop AI companion/);
  assert.match(body.instructions, /collaborative co-pilot, not a character/);
  assert.match(body.instructions, /Keep spoken replies concise/);
  assert.match(body.instructions, /Never echo or restate/);
  assert.equal(response, 'Absolutely. This is the moment Cipher Core starts feeling alive.');
  assert.doesNotMatch(response, /I heard you|You said/i);
});

test('frontend sends the microphone transcript to the Cipher backend', async () => {
  let request;
  const response = await requestCipherResponse('Hey Cipher.', {
    fetcher: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({
        response: 'Hey Kevin. I am here and ready when you are.',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });
  assert.equal(request.url, '/api/voice/respond');
  assert.deepEqual(JSON.parse(request.options.body), { transcript: 'Hey Cipher.' });
  assert.equal(response, 'Hey Kevin. I am here and ready when you are.');
});

test('speech recognition captures final microphone transcript', async () => {
  class Recognition {
    start() {
      queueMicrotask(() => {
        this.onresult({
          resultIndex: 0,
          results: Object.assign([
            Object.assign([{ transcript: 'Hey Cipher.' }], { isFinal: true }),
          ], { length: 1 }),
        });
        this.onend();
      });
    }

    abort() {}
  }

  const states = [];
  const session = createSpeechRecognitionSession({
    Recognition,
    onInterim: (value) => states.push(value),
  });
  assert.equal(await session.promise, 'Hey Cipher.');
  assert.deepEqual(states, ['Hey Cipher.']);
});

test('frontend voice errors never expose HTTP status or provider payloads', async () => {
  await assert.rejects(
    requestVoiceSpeech('Hello', {
      fetcher: async () => new Response('provider secret detail', { status: 502 }),
    }),
    (error) => error.message === 'Voice unavailable.'
      && !error.message.includes('502')
      && !error.message.includes('provider'),
  );
  await assert.rejects(
    requestCipherResponse('Hello', {
      fetcher: async () => {
        throw new Error('ECONNREFUSED internal detail');
      },
    }),
    (error) => error.message === 'Connection lost.',
  );
});

test('speech recognition maps provider failures to friendly Cipher statuses', async () => {
  class Recognition {
    start() {
      queueMicrotask(() => this.onerror({ error: 'not-allowed' }));
    }

    abort() {}
  }

  const session = createSpeechRecognitionSession({ Recognition });
  await assert.rejects(
    session.promise,
    (error) => error.message === 'Microphone permission denied.',
  );
});

test('voice hook uses replaceable audio handlers instead of accumulating playback listeners', () => {
  const source = voiceHookSource();

  assert.match(source, /audio\.ontimeupdate =/);
  assert.match(source, /audio\.onended =/);
  assert.match(source, /audio\.onerror =/);
  assert.match(source, /clearAudioHandlers/);
  assert.doesNotMatch(source, /audio\.addEventListener\('timeupdate'/);
  assert.doesNotMatch(source, /audio\.addEventListener\('ended'/);
  assert.doesNotMatch(source, /audio\.addEventListener\('error'/);
});

test('voice hook guards stale requests and playback events with the active operation token', () => {
  const source = voiceHookSource();

  assert.match(source, /operationRef\.current \+= 1/);
  assert.match(source, /if \(operation !== operationRef\.current\) return;/);
  assert.match(source, /playSimulation\(result, operation\)/);
  assert.match(source, /playAudio\(result, operation\)/);
  assert.match(source, /finish\(operation\)/);
});
