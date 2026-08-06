import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import {
  normalizeCompanionState,
} from './companionStates.js';

const Companion = forwardRef(function Companion({
  state,
}, ref) {
  const [requestedState, setRequestedState] = useState(() => normalizeCompanionState(state));

  useEffect(() => {
    if (state !== undefined) setRequestedState(normalizeCompanionState(state));
  }, [state]);

  useImperativeHandle(ref, () => ({
    setState(nextState) {
      setRequestedState(normalizeCompanionState(nextState));
    },
    getState() {
      return requestedState;
    },
  }), [requestedState]);

  return null;
});

export default Companion;
