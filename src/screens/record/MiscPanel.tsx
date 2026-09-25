import { useRef, useState, type FormEvent } from 'react';
import {
  makeGoalieState, makeNote, makeOwnGoal, makePenaltyShot, makeShootout, makeStrengthState, makeTheirNetState,
  type EventContext,
} from '../../domain/factory';
import type { MatchState } from '../../domain/matchState';
import { OPEN_SHOT_RESULTS, type Game, type GameEvent, type Goalie, type OpenShotResult, type ShootoutKind, type ShotKind, type Strength } from '../../domain/types';
import { t } from '../../i18n/fr';
import { ResultButtons } from '../../ui/ResultButtons';

const EMPTY_NET = '__empty__';
const STRENGTHS: Strength[] = ['even', 'pp', 'pk'];
/** A second tap on the same control this soon is a double tap, not a second entry. */
const LOCKOUT_MS = 600;

interface Props {
  game: Game;
  ctx: EventContext;
  state: MatchState;
  goalies: Goalie[];
  events: GameEvent[];
  onRecord: (e: GameEvent) => void;
}

/** Rare events and the match states. Deliberately smaller buttons than the shot results. */
export function MiscPanel({ game, ctx, state, goalies, events, onRecord }: Props) {
  const [penalty, setPenalty] = useState<ShotKind | null>(null);
  const [note, setNote] = useState('');
  const last = useRef<Record<string, number>>({});

  /** Runs `fn` unless the same control fired a moment ago. */
  const once = (key: string, fn: () => void) => {
    const now = Date.now();
    if (now - (last.current[key] ?? -Infinity) < LOCKOUT_MS) return;
    last.current[key] = now;
    fn();
  };

  const goalieValue = state.ourNetEmpty ? EMPTY_NET : (state.ourGoalieId ?? '');
  const shootoutCount = (kind: ShootoutKind) => {
    const list = events.filter((e) => !e.deleted_at && e.kind === kind);
    return `${list.filter((e) => e.result === 'goal').length}/${list.length}`;
  };

  function submitNote(e: FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    once('note', () => {
      onRecord(makeNote(ctx, note));
      setNote('');
    });
  }

  const shootoutRow = (kind: ShootoutKind, label: string) => (
    <div className="row" role="group" aria-label={label}>
      <strong>{label}</strong>
      {OPEN_SHOT_RESULTS.map((r: OpenShotResult) => (
        <button key={r} type="button" className="btn btn--small" onClick={() => once(`${kind}:${r}`, () => onRecord(makeShootout(ctx, kind, r)))}>
          {t.results[r]}
        </button>
      ))}
    </div>
  );

  return (
    <div className="misc">
      <section className="stack">
        <h2>{t.misc.goalieTitle}</h2>
        <select
          className="input"
          aria-label={t.misc.goalieTitle}
          value={goalieValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v) onRecord(makeGoalieState(ctx, v === EMPTY_NET ? null : v));
          }}
        >
          <option value="">{t.misc.goalieChoose}</option>
          {goalies.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
          <option value={EMPTY_NET}>{t.state.ourNetEmpty}</option>
        </select>
        {goalies.length === 0 && <p className="muted">{t.misc.goalieNone}</p>}
      </section>

      <section className="stack">
        <h2>{t.misc.netTitle}</h2>
        <div className="row">
          <button
            type="button"
            className="btn btn--small"
            aria-pressed={state.theirNetEmpty}
            onClick={() => once('their-net', () => onRecord(makeTheirNetState(ctx, !state.theirNetEmpty)))}
          >
            {t.misc.theirNetToggle}
          </button>
        </div>
      </section>

      <section className="stack">
        <h2>{t.misc.strengthTitle}</h2>
        <div className="seg" role="group" aria-label={t.misc.strengthTitle}>
          {STRENGTHS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={state.strength === s}
              onClick={() => {
                if (s !== state.strength) once(`strength:${s}`, () => onRecord(makeStrengthState(ctx, s)));
              }}
            >
              {t.strength[s]}
            </button>
          ))}
        </div>
      </section>

      <section className="stack">
        <h2>{t.misc.ownGoalTitle}</h2>
        <div className="row">
          <button type="button" className="btn btn--small" onClick={() => once('own-for', () => onRecord(makeOwnGoal(ctx, 'own_goal_for')))}>
            {t.misc.ownGoalFor}
          </button>
          <button type="button" className="btn btn--small" onClick={() => once('own-against', () => onRecord(makeOwnGoal(ctx, 'own_goal_against')))}>
            {t.misc.ownGoalAgainst}
          </button>
        </div>
      </section>

      <section className="stack">
        <h2>{t.misc.penaltyTitle}</h2>
        <div className="seg" role="group" aria-label={t.misc.penaltyTitle}>
          <button type="button" aria-pressed={penalty === 'shot_for'} onClick={() => setPenalty(penalty === 'shot_for' ? null : 'shot_for')}>
            {t.misc.penaltyFor}
          </button>
          <button type="button" aria-pressed={penalty === 'shot_against'} onClick={() => setPenalty(penalty === 'shot_against' ? null : 'shot_against')}>
            {t.misc.penaltyAgainst}
          </button>
        </div>
        {penalty && (
          <ResultButtons
            results={OPEN_SHOT_RESULTS}
            onPick={(r) =>
              once('penalty', () => {
                onRecord(makePenaltyShot(ctx, penalty, r));
                setPenalty(null);
              })
            }
            onCancel={() => setPenalty(null)}
          />
        )}
      </section>

      {game.overtime_possible && (
        <section className="stack">
          <h2>{t.misc.shootoutTitle}</h2>
          <p className="muted">{t.misc.shootoutCount(shootoutCount('shootout_for'), shootoutCount('shootout_against'))}</p>
          {shootoutRow('shootout_for', t.misc.shootoutUs)}
          {shootoutRow('shootout_against', t.misc.shootoutThem)}
        </section>
      )}

      <section className="stack">
        <h2>{t.misc.noteTitle}</h2>
        <form className="row" onSubmit={submitNote}>
          <input
            className="input"
            aria-label={t.misc.noteTitle}
            placeholder={t.misc.notePlaceholder}
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button type="submit" className="btn btn--small">
            {t.misc.noteAdd}
          </button>
        </form>
      </section>
    </div>
  );
}
