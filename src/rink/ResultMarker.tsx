import type { MarkResult } from '../domain/types';

/** ColorBrewer Set2. The only place colors are allowed; always paired with a shape. */
export const RESULT_COLOR: Record<MarkResult, string> = {
  goal: '#FC8D62',
  save: '#66C2A5',
  missed: '#8DA0CB',
  blocked: '#B3B3B3',
  won: '#66C2A5',
  lost: '#FC8D62',
};
const OUTLINE = '#1A1A1A';

export function starPoints(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

const xPath = (cx: number, cy: number, d: number) => `M${cx - d} ${cy - d} L${cx + d} ${cy + d} M${cx + d} ${cy - d} L${cx - d} ${cy + d}`;

export function ResultMarker({ cx, cy, result, size = 1 }: { cx: number; cy: number; result: MarkResult; size?: number }) {
  const c = RESULT_COLOR[result];
  switch (result) {
    case 'goal':
      return <polygon data-result="goal" points={starPoints(cx, cy, 8 * size, 3.6 * size)} fill={c} stroke={OUTLINE} strokeWidth={1} />;
    case 'missed':
      return (
        <g data-result="missed">
          <path d={xPath(cx, cy, 4.5 * size)} stroke={OUTLINE} strokeWidth={4.5} strokeLinecap="round" />
          <path d={xPath(cx, cy, 4.5 * size)} stroke={c} strokeWidth={2.5} strokeLinecap="round" />
        </g>
      );
    case 'blocked':
      return <rect data-result="blocked" x={cx - 4.5 * size} y={cy - 4.5 * size} width={9 * size} height={9 * size} fill={c} stroke={OUTLINE} strokeWidth={1} />;
    default:
      return <circle data-result={result} cx={cx} cy={cy} r={5 * size} fill={c} stroke={OUTLINE} strokeWidth={1} />;
  }
}
