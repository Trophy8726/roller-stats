import { useState, type FormEvent } from 'react';
import { DuplicateGoalieError } from '../goalies/api';
import type { GoaliesState } from '../goalies/useGoalies';
import { t } from '../i18n/fr';

/** The roster tab: add a goalie, correct a name. There is no delete: a goalie's statistics keep his name. */
export function GoalieRoster({ roster }: { roster: GoaliesState }) {
  const { goalies, loading, error, add, rename } = roster;
  const [name, setName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const explain = (e: unknown) => (e instanceof DuplicateGoalieError ? t.goalies.duplicate : t.errors.server);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true);
    try {
      await add(name);
      setName('');
      setMessage(null);
    } catch (err) {
      setMessage(explain(err));
    } finally {
      setBusy(false);
    }
  }

  async function save(id: string) {
    if (busy || !draft.trim()) return;
    setBusy(true);
    try {
      await rename(id, draft);
      setEditing(null);
      setMessage(null);
    } catch (err) {
      setMessage(explain(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card stack">
      <h2>{t.goalies.title}</h2>
      <p className="muted">{t.goalies.hint}</p>
      {error && goalies.length === 0 && (
        <p className="notice" role="alert">
          {t.errors.server}
        </p>
      )}
      {message && (
        <p className="notice" role="alert">
          {message}
        </p>
      )}
      <form className="row" onSubmit={submit}>
        <label className="field">
          {t.goalies.nameLabel}
          <input
            className="input"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setMessage(null);
            }}
            maxLength={60}
          />
        </label>
        <button className="btn btn--primary" type="submit" disabled={busy}>
          {t.goalies.add}
        </button>
      </form>
      {!loading && goalies.length === 0 ? (
        <p className="muted">{t.goalies.empty}</p>
      ) : (
        <ul className="list">
          {goalies.map((g) => (
            <li key={g.id}>
              {editing === g.id ? (
                <>
                  <input className="input" aria-label={t.goalies.rename} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={60} />
                  <span className="row">
                    <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void save(g.id)}>
                      {t.goalies.save}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        setEditing(null);
                        setMessage(null);
                      }}
                    >
                      {t.goalies.cancel}
                    </button>
                  </span>
                </>
              ) : (
                <>
                  <span>{g.name}</span>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setEditing(g.id);
                      setDraft(g.name);
                    }}
                  >
                    {t.goalies.rename}
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
