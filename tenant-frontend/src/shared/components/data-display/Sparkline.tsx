'use client';

import React from 'react';

type SparklineProps = {
  data: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  padding?: number; // padding interno para que no corte los picos
};

export default function Sparkline({
  data,
  width = 160,
  height = 48,
  strokeWidth = 2,
  padding = 2,
}: SparklineProps) {
  if (!data || data.length === 0) {
    return <div style={{ width, height, display: 'inline-block' }} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const innerW = Math.max(0, width - padding * 2);
  const innerH = Math.max(0, height - padding * 2);

  const stepX = data.length > 1 ? innerW / (data.length - 1) : innerW;

  const points = data.map((v, i) => {
    const x = padding + i * stepX;
    // y invertida porque en SVG el 0 está arriba
    const y = padding + innerH - ((v - min) / range) * innerH;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} role="img" aria-label="sparkline">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
