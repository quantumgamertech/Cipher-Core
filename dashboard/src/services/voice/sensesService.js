export const SENSE_STATUS = Object.freeze({
  READY: 'ready',
  OFFLINE: 'offline',
});

const MEDIA_CONSTRAINTS = Object.freeze({
  microphone: { audio: true, video: false },
  camera: { audio: false, video: true },
});

export function createSensesController({
  mediaDevices = globalThis.navigator?.mediaDevices,
  permissions = globalThis.navigator?.permissions,
  audioSupported = typeof globalThis.Audio === 'function',
} = {}) {
  const listeners = new Set();
  const streams = {
    microphone: null,
    camera: null,
  };
  const permissionListeners = [];
  let state = {
    microphone: SENSE_STATUS.OFFLINE,
    camera: SENSE_STATUS.OFFLINE,
    speakers: audioSupported ? SENSE_STATUS.READY : SENSE_STATUS.OFFLINE,
  };

  const publish = (updates) => {
    state = { ...state, ...updates };
    listeners.forEach((listener) => listener(state));
  };

  const disable = (sense) => {
    const stream = streams[sense];
    stream?.getTracks?.().forEach((track) => track.stop());
    streams[sense] = null;
    publish({ [sense]: SENSE_STATUS.OFFLINE });
  };

  const enable = async (sense) => {
    const constraints = MEDIA_CONSTRAINTS[sense];
    if (!constraints || !mediaDevices?.getUserMedia) {
      publish({ [sense]: SENSE_STATUS.OFFLINE });
      return false;
    }

    disable(sense);
    try {
      const stream = await mediaDevices.getUserMedia(constraints);
      streams[sense] = stream;
      const tracks = stream.getTracks?.() ?? [];
      tracks.forEach((track) => {
        track.addEventListener?.('ended', () => {
          if (streams[sense] === stream) {
            streams[sense] = null;
            publish({ [sense]: SENSE_STATUS.OFFLINE });
          }
        }, { once: true });
      });
      const ready = tracks.some((track) => track.readyState !== 'ended');
      publish({ [sense]: ready ? SENSE_STATUS.READY : SENSE_STATUS.OFFLINE });
      return ready;
    } catch {
      streams[sense] = null;
      publish({ [sense]: SENSE_STATUS.OFFLINE });
      return false;
    }
  };

  const refreshSpeakers = async () => {
    if (!audioSupported) {
      publish({ speakers: SENSE_STATUS.OFFLINE });
      return;
    }
    if (!mediaDevices?.enumerateDevices) {
      publish({ speakers: SENSE_STATUS.READY });
      return;
    }
    try {
      const devices = await mediaDevices.enumerateDevices();
      publish({
        speakers: devices.some((device) => device.kind === 'audiooutput')
          ? SENSE_STATUS.READY
          : SENSE_STATUS.OFFLINE,
      });
    } catch {
      publish({ speakers: SENSE_STATUS.OFFLINE });
    }
  };

  const watchPermission = async (sense, permissionName) => {
    if (!permissions?.query) return;
    try {
      const permission = await permissions.query({ name: permissionName });
      const onChange = () => {
        if (permission.state === 'denied') disable(sense);
      };
      permission.addEventListener?.('change', onChange);
      permissionListeners.push(() => permission.removeEventListener?.('change', onChange));
      if (permission.state === 'denied') disable(sense);
    } catch {
      // Some browsers do not expose camera/microphone through Permissions API.
    }
  };

  const initialize = async () => {
    permissionListeners.splice(0).forEach((remove) => remove());
    await Promise.all([
      watchPermission('microphone', 'microphone'),
      watchPermission('camera', 'camera'),
      refreshSpeakers(),
    ]);
    return state;
  };

  const destroy = () => {
    permissionListeners.splice(0).forEach((remove) => remove());
    disable('microphone');
    disable('camera');
    listeners.clear();
  };

  return {
    initialize,
    enable,
    disable,
    refreshSpeakers,
    snapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    destroy,
  };
}

export const browserSenses = createSensesController();

