import { useMemo, useRef, useState } from 'react';
import { makeFaceoff, makeShot } from '../../domain/factory';
import { computeMatchState } from '../../domain/matchState';
import {
  FACEOFF_RESULTS, SHOT_RESULTS, type DotId, type FaceoffResult, type Game, type Period, type Point, type Role, type ShotKind,
  type ShotResult, type Side,
} from '../../domain/types';
import { useGameEvents } from '../../events/useGameEvents';
import { useGoalies } from '../../goalies/useGoalies';
import { t } from '../../i18n/fr';
import { attacksRight, endLabels } from '../../rink/coords';
import { Rink } from '../../rink/Rink';
import { href } from '../../router';
import type { RecordSetup } from '../../settings';
import { ResultButtons } from '../../ui/ResultButtons';
import { SyncChip } from '../../ui/SyncChip';
import { describeEvent } from './describe';
import { MiscPanel } from './MiscPanel';
import { SidePrompt } from './SidePrompt';
import { StateBanner } from './StateBanner';

type Mode = ShotKind | 'faceoff' | 'misc';
const ALL_MODES: Mode[] = ['shot_for', 'shot_against', 'faceoff', 'misc'];
const modeLabel = (m: Mode) => (m === 'misc' ? t.misc.tab : t.modes[m]);

export function initialMode(role: Role): Mode {
  if (role === 'shots_against') return 'shot_against';
  if (role === 'faceoffs') return 'faceoff';
  return 'shot_for';
}

export function Recorder({ game, setup, onSetupChange }: { game: Game; setup: RecordSetup; onSetupChange: (s: RecordSetup | null) => void }) {
  const { events, pending, connected, record, remove } = useGameEvents(game.code);
  const { goalies, names } = useGoalies();
  const [mode, setMode] = useState<Mode>(() => initialMode(setup.role));
  const [tap, setTapState] = useState<Point | null>(null);
  const [dot, setDotState] = useState<DotId | null>(null);
  // Title of the overlay shown whenever the ends flip (P1 -> P2 and back, overtime), so a flip is never silent.
  const [flipNotice, setFlipNotice] = useState<string | null>(null);
  const [sidePrompt, setSidePrompt] = useState(false);
  // Refs make the selection single-use even if two taps land before React re-renders (double tap).
  const tapRef = useRef<Point | null>(null);
  const dotRef = useRef<DotId | null>(null);

  const setTap = (p: Point | null) => {
    tapRef.current = p;
    setTapState(p);
  };
  const setDot = (d: DotId | null) => {
    dotRef.current = d;
    setDotState(d);
  };
  const clear = () => {
    setTap(null);
    setDot(null);
  };

  const matchState = useMemo(() => computeMatchState(events), [events]);
  const periods: Period[] = game.overtime_possible ? [1, 2, 3] : [1, 2];
  const modes: Mode[] = setup.role === 'all' ? ALL_MODES : [initialMode(setup.role), 'misc'];
  const attackRight = attacksRight(setup.defendP1, setup.period, setup.defendOT);
  const labels = endLabels(game.team_name, game.opponent, attackRight);
  const ctx = { code: game.code, period: setup.period, role: setup.role, state: matchState };
  const shotMode = mode === 'shot_for' || mode === 'shot_against' ? mode : null;

  function changeMode(m: Mode) {
    clear();
    setMode(m);
  }
  function changePeriod(p: Period) {
    if (p === setup.period) return;
    clear();
    if (p === 3 && !setup.defendOT) {
      setSidePrompt(true);
      return;
    }
    const from = setup.period;
    onSetupChange({ ...setup, period: p });
    setFlipNotice(p === 1 ? t.record.backToP1Title : p === 2 ? (from === 3 ? t.record.backToP2Title : t.record.halftimeTitle) : t.record.overtimeTitle);
  }
  function chooseOvertimeSide(side: Side) {
    setSidePrompt(false);
    onSetupChange({ ...setup, period: 3, defendOT: side });
  }
  function pickShot(r: ShotResult) {
    const p = tapRef.current;
    if (!p || !shotMode) return;
    clear();
    record(makeShot(ctx, shotMode, p, r));
  }
  function pickFaceoff(r: FaceoffResult) {
    const d = dotRef.current;
    if (!d) return;
    clear();
    record(makeFaceoff(ctx, d, r));
  }

  const live = events.filter((e) => !e.deleted_at);
  const markers = shotMode
    ? live
        .filter((e) => e.kind === shotMode && e.period === setup.period && e.x !== null && e.y !== null)
        .map((e) => ({ id: e.id, x: e.x as number, y: e.y as number, result: e.result as ShotResult }))
    : [];
  const mine = live.filter((e) => e.mine);
  const lastTen = mine.slice(-10).reverse();

  return (
    <main className="page">
      <header className="topbar">
        <a className="btn" href="#/">
          {t.nav.home}
        </a>
        <span className="chip chip--dark">{game.code}</span>
        <strong>
          {game.team_name} – {game.opponent}
        </strong>
        <span className="topbar__spacer" />
        <div className="seg" role="group" aria-label={t.record.periodLabel}>
          {periods.map((p) => (
            <button key={p} type="button" aria-pressed={setup.period === p} onClick={() => changePeriod(p)}>
              {t.record.period(p)}
            </button>
          ))}
        </div>
        <SyncChip pending={pending} connected={connected} />
        <a className="btn" href={href({ name: 'report', code: game.code })}>
          {t.nav.report}
        </a>
      </header>

      <StateBanner state={matchState} names={names} onOpen={() => changeMode('misc')} />

      <div className="seg" role="group" aria-label={t.record.modeLabel}>
        {modes.map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => changeMode(m)}>
            {modeLabel(m)}
          </button>
        ))}
      </div>

      <div className="record">
        <section className="card stack">
          {mode === 'misc' ? (
            <MiscPanel game={game} ctx={ctx} state={matchState} goalies={goalies} events={events} onRecord={record} />
          ) : (
            <>
              <Rink
                attackRight={attackRight}
                leftLabel={labels.left}
                rightLabel={labels.right}
                markers={markers}
                pending={mode === 'faceoff' ? null : tap}
                dotMode={mode === 'faceoff' ? 'interactive' : 'plain'}
                selectedDot={dot}
                onTap={mode === 'faceoff' ? undefined : setTap}
                onDotTap={mode === 'faceoff' ? setDot : undefined}
              />
              {mode !== 'faceoff' && tap && <ResultButtons results={SHOT_RESULTS} onPick={pickShot} onCancel={clear} />}
              {mode === 'faceoff' && dot && <ResultButtons results={FACEOFF_RESULTS} onPick={pickFaceoff} onCancel={clear} />}
              {!tap && !dot && (
                <div className="actionbar">
                  <div className="actionbar__hint">{mode === 'faceoff' ? t.record.tapDot : t.record.tapShot}</div>
                </div>
              )}
            </>
          )}
        </section>

        <aside className="card stack">
          <button
            type="button"
            className="btn btn--primary"
            disabled={mine.length === 0}
            onClick={() => {
              const last = mine[mine.length - 1];
              if (last) remove(last.id);
            }}
          >
            {t.record.undoLast}
          </button>
          <h2>{t.record.recent}</h2>
          {lastTen.length === 0 ? (
            <p className="muted">{t.record.none}</p>
          ) : (
            <ul className="list">
              {lastTen.map((e) => (
                <li key={e.id}>
                  <span>{describeEvent(e, names)}</span>
                  <button type="button" className="btn btn--icon" aria-label={t.record.delete} onClick={() => remove(e.id)}>
                    {t.ui.close}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="btn" onClick={() => onSetupChange(null)}>
            {t.setup.change}
          </button>
        </aside>
      </div>

      {flipNotice && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label={flipNotice}>
          <h1>{flipNotice}</h1>
          <Rink attackRight={attackRight} leftLabel={labels.left} rightLabel={labels.right} />
          <button type="button" className="btn btn--big" autoFocus onClick={() => setFlipNotice(null)}>
            {t.record.halftimeOk}
          </button>
        </div>
      )}
      {sidePrompt && <SidePrompt onPick={chooseOvertimeSide} onCancel={() => setSidePrompt(false)} />}
    </main>
  );
}
