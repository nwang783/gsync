import { useEffect } from 'react';

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function sectionProgress(element, viewportHeight, startRatio, endRatio) {
  if (!element) return 0;

  const rect = element.getBoundingClientRect();
  const start = viewportHeight * startRatio;
  const distance = rect.height + viewportHeight * (startRatio - endRatio);

  if (distance <= 0) return 0;
  return clamp((start - rect.top) / distance);
}

export function useScrollScene(rootRef, scenes, enabled = true) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !enabled) return undefined;

    let frameId = 0;

    const update = () => {
      frameId = 0;

      const viewportHeight = window.innerHeight || 1;
      const scrollableHeight = Math.max(document.documentElement.scrollHeight - viewportHeight, 1);

      root.style.setProperty('--page-progress', clamp(window.scrollY / scrollableHeight).toFixed(4));
      root.style.setProperty('--viewport-height', `${viewportHeight}px`);

      Object.entries(scenes).forEach(([name, config]) => {
        const ref = config?.current ? config : config?.ref;
        const startRatio = config?.startRatio ?? 0.88;
        const endRatio = config?.endRatio ?? 0.12;
        const progress = sectionProgress(ref?.current, viewportHeight, startRatio, endRatio);
        root.style.setProperty(`--${name}-progress`, progress.toFixed(4));
      });
    };

    const queueUpdate = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', queueUpdate, { passive: true });
    window.addEventListener('resize', queueUpdate);

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      window.removeEventListener('scroll', queueUpdate);
      window.removeEventListener('resize', queueUpdate);
    };
  }, [enabled, rootRef, scenes]);
}
