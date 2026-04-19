import { useEffect, useRef, useState } from "react";

/**
 * Smoothly animates a number from its previous value to the new one.
 * easeOutCubic over 1.2s by default. Respects an optional format fn so
 * callers can render currency / compact units without extra wrappers.
 */
interface CountUpProps {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}

export function CountUp({
  value,
  duration = 1200,
  format = (n) => n.toLocaleString(undefined, { maximumFractionDigits: 0 }),
  className,
}: CountUpProps) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    fromRef.current = display;
    let raf = 0;
    let start: number | null = null;
    const step = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(fromRef.current + (value - fromRef.current) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // display isn't a real dep — we capture it once per new value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return <span className={className}>{format(display)}</span>;
}
