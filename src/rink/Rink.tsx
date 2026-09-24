import type { KeyboardEvent, MouseEvent } from 'react';
import type { DotId, EventResult, Point } from '../domain/types';
import { t } from '../i18n/fr';
import { orient } from './coords';
import { DOTS, DOT_IDS } from './dots';
import { ResultMarker } from './ResultMarker';

export const RINK_W = 400;
export const RINK_H = 200;

export interface RinkMarker {
  id: string;
  x: number;
  y: number;
  result: EventResult;
}

export interface RinkProps {
  attackRight: boolean;
  leftLabel?: string;
  rightLabel?: string;
  markers?: RinkMarker[];
  pending?: Point | null;
  dotMode?: 'plain' | 'interactive';
  dotText?: Partial<Record<DotId, string>>;
  selectedDot?: DotId | null;
  onTap?: (p: Point) => void;
  onDotTap?: (d: DotId) => void;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function RinkLines() {
  return (
    <g>
      <rect x={1} y={1} width={398} height={198} rx={40} fill="#FFFFFF" stroke="#1A1A1A" strokeWidth={2} />
      <line x1={200} y1={1} x2={200} y2={199} stroke="#1A1A1A" strokeWidth={1.5} />
      <circle cx={200} cy={100} r={30} fill="none" stroke="#9A9A9A" strokeWidth={1} />
      <line x1={35} y1={12} x2={35} y2={188} stroke="#9A9A9A" strokeWidth={1} />
      <line x1={365} y1={12} x2={365} y2={188} stroke="#9A9A9A" strokeWidth={1} />
      <path d="M35 82 A18 18 0 0 1 35 118 Z" fill="#EDEDED" stroke="#9A9A9A" strokeWidth={1} />
      <path d="M365 82 A18 18 0 0 0 365 118 Z" fill="#EDEDED" stroke="#9A9A9A" strokeWidth={1} />
      <rect x={25} y={91.5} width={10} height={17} fill="none" stroke="#1A1A1A" strokeWidth={1.5} />
      <rect x={365} y={91.5} width={10} height={17} fill="none" stroke="#1A1A1A" strokeWidth={1.5} />
    </g>
  );
}

export function Rink({ attackRight, leftLabel, rightLabel, markers = [], pending = null, dotMode = 'plain', dotText, selectedDot = null, onTap, onDotTap }: RinkProps) {
  const toSvg = (p: Point) => {
    const s = orient(p, attackRight);
    return { x: s.x * RINK_W, y: s.y * RINK_H };
  };

  function handleClick(e: MouseEvent<SVGSVGElement>) {
    if (!onTap) return;
    const r = e.currentTarget.getBoundingClientRect();
    onTap(orient({ x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height) }, attackRight));
  }

  const interactive = dotMode === 'interactive';
  const p = pending ? toSvg(pending) : null;

  return (
    <svg className="rink" viewBox={`0 0 ${RINK_W} ${RINK_H}`} role="group" aria-label={t.rink.label} onClick={handleClick}>
      <RinkLines />
      {leftLabel && (
        <text x={100} y={190} textAnchor="middle" className="rink__label">
          {leftLabel}
        </text>
      )}
      {rightLabel && (
        <text x={300} y={190} textAnchor="middle" className="rink__label">
          {rightLabel}
        </text>
      )}
      {DOT_IDS.map((id) => {
        const c = toSvg(DOTS[id]);
        const handlers = interactive
          ? {
              role: 'button',
              'aria-label': t.dots[id],
              tabIndex: 0,
              onClick: (ev: MouseEvent) => {
                ev.stopPropagation();
                onDotTap?.(id);
              },
              onKeyDown: (ev: KeyboardEvent) => {
                if (ev.key === 'Enter' || ev.key === ' ') onDotTap?.(id);
              },
            }
          : {};
        return (
          <g key={id} className={interactive ? 'rink__dot rink__dot--interactive' : 'rink__dot'} {...handlers}>
            <circle cx={c.x} cy={c.y} r={22} fill="none" stroke="#CFCFCF" strokeWidth={1} />
            {interactive && <circle cx={c.x} cy={c.y} r={20} fill={selectedDot === id ? 'rgba(30,30,30,0.15)' : 'transparent'} />}
            <circle cx={c.x} cy={c.y} r={interactive ? 6 : 3.5} fill="#1A1A1A" />
            {dotText?.[id] && (
              <text x={c.x} y={c.y - 27} textAnchor="middle" className="rink__dottext">
                {dotText[id]}
              </text>
            )}
          </g>
        );
      })}
      {markers.map((m) => {
        const c = toSvg(m);
        return <ResultMarker key={m.id} cx={c.x} cy={c.y} result={m.result} />;
      })}
      {p && <circle cx={p.x} cy={p.y} r={9} fill="none" stroke="#1A1A1A" strokeWidth={2} strokeDasharray="3 2" data-testid="pending-tap" />}
    </svg>
  );
}
