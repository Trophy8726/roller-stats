import { INITIAL_MATCH_STATE, type MatchState } from './matchState';
import type {
  DotId, FaceoffResult, GameEvent, Kind, OpenShotResult, OwnGoalKind, Period, Point, Role, ShootoutKind,
  ShotKind, ShotResult, Strength,
} from './types';

export interface EventContext {
  code: string;
  period: Period;
  role: Role;
  /** The match state when the event is recorded (defaults to "nothing known"). */
  state?: MatchState;
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

/** Which goalie faced the event and whether the net it was aimed at was empty. */
function attribution(kind: Kind, s: MatchState): { goalie_id: string | null; empty_net: boolean } {
  switch (kind) {
    case 'shot_for':
      return { goalie_id: null, empty_net: s.theirNetEmpty };
    case 'shot_against':
    case 'own_goal_against':
      return { goalie_id: s.ourNetEmpty ? null : s.ourGoalieId, empty_net: s.ourNetEmpty };
    case 'shootout_against':
      // A shootout is never on an empty net.
      return { goalie_id: s.ourNetEmpty ? null : s.ourGoalieId, empty_net: false };
    default:
      return { goalie_id: null, empty_net: false };
  }
}

function build(ctx: EventContext, kind: Kind, result: GameEvent['result'], extra: Partial<GameEvent> = {}): GameEvent {
  const s = ctx.state ?? INITIAL_MATCH_STATE;
  return {
    id: ctx.id ?? uuid(),
    game_code: ctx.code,
    kind,
    period: ctx.period,
    x: null,
    y: null,
    dot: null,
    result,
    device_role: ctx.role,
    recorded_at: (ctx.now ?? new Date()).toISOString(),
    deleted_at: null,
    ...attribution(kind, s),
    strength: s.strength,
    penalty_shot: false,
    note: null,
    ...extra,
  };
}

export function makeShot(ctx: EventContext, kind: ShotKind, p: Point, result: ShotResult): GameEvent {
  return build(ctx, kind, result, { x: round3(p.x), y: round3(p.y) });
}

/** A penalty shot during play: no position on the rink. */
export function makePenaltyShot(ctx: EventContext, kind: ShotKind, result: OpenShotResult): GameEvent {
  return build(ctx, kind, result, { penalty_shot: true });
}

export function makeFaceoff(ctx: EventContext, dot: DotId, result: FaceoffResult): GameEvent {
  return build(ctx, 'faceoff', result, { dot });
}

/** Own goal (CSC): a goal that is not a shot. */
export function makeOwnGoal(ctx: EventContext, kind: OwnGoalKind): GameEvent {
  return build(ctx, kind, 'goal');
}

export function makeShootout(ctx: EventContext, kind: ShootoutKind, result: OpenShotResult): GameEvent {
  return build(ctx, kind, result);
}

export function makeNote(ctx: EventContext, text: string): GameEvent {
  return build(ctx, 'note', 'note', { note: text.trim().slice(0, 200) });
}

/** `null`: our net is empty (goalie pulled). */
export function makeGoalieState(ctx: EventContext, goalieId: string | null): GameEvent {
  return goalieId ? build(ctx, 'state_our_goalie', 'goalie', { goalie_id: goalieId }) : build(ctx, 'state_our_goalie', 'empty');
}

export function makeTheirNetState(ctx: EventContext, empty: boolean): GameEvent {
  return build(ctx, 'state_their_net', empty ? 'empty' : 'present');
}

export function makeStrengthState(ctx: EventContext, s: Strength): GameEvent {
  return build(ctx, 'state_strength', s, { strength: s });
}

/** Exactly the columns of the `events` table (drops local fields like `sync`, `mine`; fills columns older events lack). */
export function toRow(e: GameEvent): GameEvent {
  return {
    id: e.id, game_code: e.game_code, kind: e.kind, period: e.period, x: e.x, y: e.y, dot: e.dot,
    result: e.result, device_role: e.device_role, recorded_at: e.recorded_at, deleted_at: e.deleted_at,
    goalie_id: e.goalie_id ?? null, empty_net: e.empty_net ?? false, strength: e.strength ?? 'even',
    penalty_shot: e.penalty_shot ?? false, note: e.note ?? null,
  };
}
