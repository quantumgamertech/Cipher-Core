import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSensesController,
  SENSE_STATUS,
} from '../src/services/voice/sensesService.js';

function createTrack() {
  const listeners = new Map();
  return {
    readyState: 'live',
    stopped: false,
    addEventListener(name, listener) {
      listeners.set(name, listener);
    },
    stop() {
      this.stopped = true;
      this.readyState = 'ended';
    },
    end() {
      this.readyState = 'ended';
      listeners.get('ended')?.();
    },
  };
}

test('microphone and camera use the same enable and disable controller actions', async () => {
  const tracks = [];
  const requested = [];
  const controller = createSensesController({
    mediaDevices: {
      async getUserMedia(constraints) {
        requested.push(constraints);
        const track = createTrack();
        tracks.push(track);
        return { getTracks: () => [track] };
      },
      async enumerateDevices() {
        return [{ kind: 'audiooutput' }];
      },
    },
    audioSupported: true,
  });

  await controller.initialize();
  assert.equal(controller.snapshot().speakers, SENSE_STATUS.READY);
  assert.equal(await controller.enable('microphone'), true);
  assert.equal(controller.snapshot().microphone, SENSE_STATUS.READY);
  assert.deepEqual(requested[0], { audio: true, video: false });

  controller.disable('microphone');
  assert.equal(tracks[0].stopped, true);
  assert.equal(controller.snapshot().microphone, SENSE_STATUS.OFFLINE);

  assert.equal(await controller.enable('camera'), true);
  assert.equal(controller.snapshot().camera, SENSE_STATUS.READY);
  assert.deepEqual(requested[1], { audio: false, video: true });
  controller.disable('camera');
  assert.equal(controller.snapshot().camera, SENSE_STATUS.OFFLINE);
});

test('denied media access remains offline', async () => {
  const controller = createSensesController({
    mediaDevices: {
      getUserMedia: async () => {
        throw new Error('denied');
      },
      enumerateDevices: async () => [],
    },
    audioSupported: false,
  });

  assert.equal(await controller.enable('microphone'), false);
  assert.equal(await controller.enable('camera'), false);
  assert.deepEqual(controller.snapshot(), {
    microphone: SENSE_STATUS.OFFLINE,
    camera: SENSE_STATUS.OFFLINE,
    speakers: SENSE_STATUS.OFFLINE,
  });
});

test('ended browser media tracks synchronize status back to offline', async () => {
  const track = createTrack();
  const controller = createSensesController({
    mediaDevices: {
      getUserMedia: async () => ({ getTracks: () => [track] }),
    },
  });

  await controller.enable('camera');
  track.end();
  assert.equal(controller.snapshot().camera, SENSE_STATUS.OFFLINE);
});
