"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Tracks an element's content width so SVG charts can render at real pixel size
 * instead of being stretched by `preserveAspectRatio` (which would distort
 * stroke widths and text).
 *
 * Returns 0 before the first measurement; charts render nothing until then, so
 * there is no layout jump from a wrong first guess.
 */
export function useMeasuredWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const apply = (next: number) => {
      // Ignore sub-pixel churn; it would re-render the chart on every scroll.
      setWidth((current) => (Math.abs(current - next) < 1 ? current : next));
    };

    apply(element.clientWidth);

    if (typeof ResizeObserver === "undefined") {
      const onResize = () => apply(element.clientWidth);
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) apply(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}
