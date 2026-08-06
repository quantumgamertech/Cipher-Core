import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createSpeechRecognitionSession,
  createSimulatedSpeech,
  requestCipherResponse,
  requestVoiceSpeech,
} from '../services/voice/voiceService.js';

export function useVoice(onCompanionStateChange) {
  const [speech, setSpeech] = useState(null);
  const [progress, setProgress] = useState(0);
  const [voiceMode, setVoiceMode] = useState('standby');
  const [voiceError, setVoiceError] = useState('');
  const timerRef = useRef(null);
  const completionRef = useRef(null);
  const audioRef = useRef(null);
  const audioUrlRef = useRef('');
  const startedAtRef = useRef(0);
  const recognitionRef = useRef(null);
  const operationRef = useRef(0);

  const clearAudioHandlers = useCallback((audio) => {
    if (!audio) return;
    audio.ontimeupdate = null;
    audio.onended = null;
    audio.onerror = null;
  }, []);

  const primeAudioPlayback = useCallback(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
    audioRef.current = audio;
    void audio.play().then(() => {
      audio.pause();
      audio.currentTime = 0;
    }).catch((error) => {
      console.warn('[Cipher Voice] Browser audio priming was blocked.', error);
    });
  }, []);

  const releaseAudio = useCallback(() => {
    if (audioRef.current) {
      clearAudioHandlers(audioRef.current);
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = '';
    }
  }, [clearAudioHandlers]);

  const stop = useCallback(() => {
    operationRef.current += 1;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    window.clearInterval(timerRef.current);
    window.clearTimeout(completionRef.current);
    timerRef.current = null;
    completionRef.current = null;
    releaseAudio();
    setProgress(0);
    setSpeech(null);
    setVoiceMode('standby');
    onCompanionStateChange?.('idle');
  }, [onCompanionStateChange, releaseAudio]);

  const finish = useCallback((operation = operationRef.current) => {
    if (operation !== operationRef.current) return;
    releaseAudio();
    setSpeech(null);
    setProgress(0);
    setVoiceMode('standby');
    onCompanionStateChange?.('idle');
  }, [onCompanionStateChange, releaseAudio]);

  const playSimulation = useCallback((result, operation = operationRef.current) => {
    if (operation !== operationRef.current) return;
    const nextSpeech = {
      ...createSimulatedSpeech(result.text),
      durationMs: result.durationMs,
      source: 'simulation',
    };
    startedAtRef.current = Date.now();
    setSpeech(nextSpeech);
    setProgress(0);
    setVoiceMode('simulation');
    onCompanionStateChange?.('speaking');
    timerRef.current = window.setInterval(() => {
      if (operation !== operationRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
        return;
      }
      const elapsed = Date.now() - startedAtRef.current;
      const nextProgress = Math.min(100, (elapsed / nextSpeech.durationMs) * 100);
      setProgress(nextProgress);
      if (nextProgress >= 100) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
        completionRef.current = window.setTimeout(() => finish(operation), 300);
      }
    }, 80);
  }, [finish, onCompanionStateChange]);

  const playAudio = useCallback(async (result, operation = operationRef.current) => {
    if (operation !== operationRef.current) return;
    releaseAudio();
    const url = URL.createObjectURL(result.audio);
    const audio = audioRef.current || new Audio();
    audio.pause();
    audio.src = url;
    audio.preload = 'auto';
    audio.currentTime = 0;
    audioRef.current = audio;
    audioUrlRef.current = url;
    setSpeech({ text: result.text, source: 'fish-audio' });
    setProgress(0);
    setVoiceMode('live');
    onCompanionStateChange?.('speaking');
    audio.ontimeupdate = () => {
      if (operation !== operationRef.current) return;
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setProgress(Math.min(100, (audio.currentTime / audio.duration) * 100));
      }
    };
    audio.onended = () => finish(operation);
    audio.onerror = () => {
      if (operation !== operationRef.current) return;
      setVoiceError('Audio playback failed.');
      setVoiceMode('error');
      finish(operation);
    };
    try {
      await audio.play();
    } catch (error) {
      if (operation !== operationRef.current) return;
      console.error('[Cipher Voice] Audio playback failed.', error);
      throw new Error('Audio playback failed.');
    }
  }, [finish, onCompanionStateChange, releaseAudio]);

  const speak = useCallback(async (text) => {
    stop();
    const operation = operationRef.current;
    primeAudioPlayback();
    setVoiceError('');
    setVoiceMode('connecting');
    setSpeech({ text, source: 'loading' });
    try {
      const result = await requestVoiceSpeech(text);
      if (operation !== operationRef.current) return;
      if (result.mode === 'simulation') playSimulation(result, operation);
      else await playAudio(result, operation);
    } catch (error) {
      if (operation !== operationRef.current) return;
      releaseAudio();
      setSpeech(null);
      setProgress(0);
      setVoiceMode('error');
      setVoiceError(error.message);
      onCompanionStateChange?.('idle');
    }
  }, [onCompanionStateChange, playAudio, playSimulation, primeAudioPlayback, releaseAudio, stop]);

  const listen = useCallback(async () => {
    stop();
    primeAudioPlayback();
    const operation = operationRef.current;
    setVoiceError('');
    setVoiceMode('listening');
    setSpeech({ text: 'Listening...', source: 'microphone' });
    onCompanionStateChange?.('listening');

    try {
      const recognition = createSpeechRecognitionSession({
        onInterim: (transcript) => {
          if (operation === operationRef.current && transcript) {
            setSpeech({ text: transcript, source: 'microphone' });
          }
        },
      });
      recognitionRef.current = recognition;
      const transcript = await recognition.promise;
      recognitionRef.current = null;
      if (operation !== operationRef.current) return;

      setVoiceMode('thinking');
      setSpeech({ text: transcript, source: 'transcript' });
      onCompanionStateChange?.('thinking');
      const response = await requestCipherResponse(transcript);
      if (operation !== operationRef.current) return;

      setVoiceMode('connecting');
      setSpeech({ text: response, source: 'loading' });
      const result = await requestVoiceSpeech(response);
      if (operation !== operationRef.current) return;
      if (result.mode === 'simulation') playSimulation(result, operation);
      else await playAudio(result, operation);
    } catch (error) {
      if (operation !== operationRef.current) return;
      recognitionRef.current = null;
      releaseAudio();
      setSpeech(null);
      setProgress(0);
      setVoiceMode('error');
      setVoiceError(error.message);
      onCompanionStateChange?.('idle');
    }
  }, [
    onCompanionStateChange,
    playAudio,
    playSimulation,
    primeAudioPlayback,
    releaseAudio,
    stop,
  ]);

  useEffect(() => () => {
    window.clearInterval(timerRef.current);
    window.clearTimeout(completionRef.current);
    releaseAudio();
    recognitionRef.current?.stop();
  }, [releaseAudio]);

  return {
    speech,
    progress,
    speak,
    listen,
    stop,
    voiceMode,
    voiceError,
  };
}
