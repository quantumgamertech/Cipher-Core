# Voice

## Purpose

Voice renders Cipher's responses as optional speech. It is a presentation capability, not a separate identity or reasoning provider.

## Architecture

```text
Voice Center
     |
POST /api/voice/speak
     |
Cipher Voice backend
     +-- ElevenLabs when configured
     +-- local simulation fallback
```

`ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` are backend-only environment values. The API key must never be serialized into frontend code, logs, responses, or browser storage.

The current voice ID is supplied through configuration. The backend uses ElevenLabs Text to Speech and returns MP3 audio to the local browser. Missing configuration returns timing metadata for the existing simulation path.

## Safety

- No startup auto-speech.
- Speech requires an explicit user action.
- Text input is normalized and length-limited.
- Audio responses are not cached.
- Provider errors fail visibly without exposing credentials.
- Voice availability does not grant hardware or Bridge permissions.
