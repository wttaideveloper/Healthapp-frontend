"use client";

/**
 * Trend hint for a stat tile. Decorative by contract: the value it accompanies is
 * always present as text, and the same series is plotted in full in the Growth
 * section, so nothing is readable only here.
 */

type SparklineProps = {
  values: number[];
  color: string;
  width?: number;
  height?: number;
};

export function Sparkline({ values, color, width = 76, height = 24 }: SparklineProps) {
  if (values.length < 2) return null;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);

  const points = values.map((value, index) => {
    const x = index * step;
    // 2px inset top and bottom so the stroke is never clipped by the viewBox.
    const y = height - 2 - ((value - min) / span) * (height - 4);
    return [x, y] as const;
  });

  const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <svg width={width} height={height} aria-hidden="true" className="block overflow-visible">
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.55} />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill={color} stroke="var(--card)" strokeWidth={1.5} />
    </svg>
  );
}
