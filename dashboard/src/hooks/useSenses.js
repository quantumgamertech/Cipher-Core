import { useEffect, useState } from 'react';
import { browserSenses } from '../services/voice/sensesService.js';

export function useSenses(controller = browserSenses) {
  const [senses, setSenses] = useState(controller.snapshot);

  useEffect(() => {
    const unsubscribe = controller.subscribe(setSenses);
    controller.initialize();
    return () => {
      unsubscribe();
      controller.destroy();
    };
  }, [controller]);

  return {
    senses,
    enableSense: controller.enable,
    disableSense: controller.disable,
  };
}
