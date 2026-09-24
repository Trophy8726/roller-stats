import type { DotId, FaceoffResult, GameEvent, Period, Point, Role, ShotKind, ShotResult } from './types';

export interface EventContext {
  code: string;
  period: Period;
  role: Role;
  now?: Date;
  id?: string;
}

/** crypto.randomUUID only exists on https/localhost; tablets testing over plain http need the fallback. */
export function uuid(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

function base(ctx: EventContext) {
  return {
    id: ctx.id ?? uuid(),
    game_code: ctx.code,
    period: ctx.period,
    device_role: ctx.role,
    recorded_at: (ctx.now ?? new Date()).toISOString(),
    deleted_at: null,
  };
}

export function makeShot(ctx: EventContext, kind: ShotKind, p: Point, result: ShotResult): GameEvent {
  const b = base(ctx);
  return { id: b.id, game_code: b.game_code, kind, period: b.period, x: round3(p.x), y: round3(p.y), dot: null, result, device_role: b.device_role, recorded_at: b.recorded_at, deleted_at: null };
}

export function makeFaceoff(ctx: EventContext, dot: DotId, result: FaceoffResult): GameEvent {
  const b = base(ctx);
  return { id: b.id, game_code: b.game_code, kind: 'faceoff', period: b.period, x: null, y: null, dot, result, device_role: b.device_role, recorded_at: b.recorded_at, deleted_at: null };
}

/** Exactly the columns of the `events` table (drops local fields like `sync`, `mine`). */
export function toRow(e: GameEvent): GameEvent {
  return {
    id: e.id, game_code: e.game_code, kind: e.kind, period: e.period, x: e.x, y: e.y, dot: e.dot,
    result: e.result, device_role: e.device_role, recorded_at: e.recorded_at, deleted_at: e.deleted_at,
  };
}
