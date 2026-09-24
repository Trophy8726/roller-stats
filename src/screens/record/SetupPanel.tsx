import { useState } from 'react';
import type { Game, Role, Side } from '../../domain/types';
import { t } from '../../i18n/fr';
import { attacksRight, endLabels } from '../../rink/coords';
import { Rink } from '../../rink/Rink';
import type { RecordSetup } from '../../settings';

const ROLES: Role[] = ['shots_for', 'shots_against', 'faceoffs', 'all'];
const SIDES: Side[] = ['left', 'right'];

export function SetupPanel({ game, onDone }: { game: Game; onDone: (s: RecordSetup) => void }) {
  const [role, setRole] = useState<Role | null>(null);
  const [side, setSide] = useState<Side | null>(null);
  const attackRight = side ? attacksRight(side, 1) : true;
  const labels = endLabels(game.team_name, game.opponent, attackRight);

  return (
    <main className="page">
      <header className="topbar">
        <a className="btn" href="#/">
          {t.nav.home}
        </a>
        <h1>{t.setup.title}</h1>
        <span className="chip chip--dark">{game.code}</span>
      </header>
      <section className="card stack">
        <h2>{t.setup.chooseRole}</h2>
        <div className="row">
          {ROLES.map((r) => (
            <button key={r} type="button" className={`btn btn--big${role === r ? ' btn--primary' : ''}`} aria-pressed={role === r} onClick={() => setRole(r)}>
              {t.roles[r]}
            </button>
          ))}
        </div>
      </section>
      <section className="card stack">
        <h2>{t.setup.chooseSide}</h2>
        <p className="muted">{t.setup.sideHint}</p>
        <div className="row">
          {SIDES.map((s) => (
            <button key={s} type="button" className={`btn btn--big${side === s ? ' btn--primary' : ''}`} aria-pressed={side === s} onClick={() => setSide(s)}>
              {s === 'left' ? t.setup.defendLeft : t.setup.defendRight}
            </button>
          ))}
        </div>
        {side && <Rink attackRight={attackRight} leftLabel={labels.left} rightLabel={labels.right} />}
      </section>
      <button
        type="button"
        className="btn btn--primary btn--big"
        disabled={!role || !side}
        onClick={() => {
          if (role && side) onDone({ role, defendP1: side, period: 1 });
        }}
      >
        {t.setup.start}
      </button>
    </main>
  );
}
