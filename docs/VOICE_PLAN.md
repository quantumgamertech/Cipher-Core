# Voice Plan

v0.3 supplies presentation and timing contracts only. The current voice service estimates duration from local text and drives transcript, progress, and mouth animation without producing audio.

Future TTS should implement a replaceable local provider interface:

```text
synthesize(text, voiceOptions) -> local audio stream + timing metadata
cancel(speechId) -> completion state
```

Before real voice work:

- Select a local-first TTS engine
- Validate licensing and distribution constraints
- Add mute, stop, volume, and failure states
- Keep speech text local by default
- Never couple TTS directly to microphone permission

Microphone, speech recognition, and wake-word behavior remain disabled.
