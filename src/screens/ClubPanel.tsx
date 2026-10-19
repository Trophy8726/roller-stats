import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { LastOwnerError, type ClubRole, type Member } from '../clubs/api';
import { useClub } from '../clubs/ClubContext';
import { useSync } from '../events/SyncContext';
import { t } from '../i18n/fr';
import { href, navigate } from '../router';
import { DuplicateTeamError } from '../teams/api';
import { useTeams } from '../teams/useTeams';

type Pending = { kind: 'remove'; member: Member } | { kind: 'regenerate' } | { kind: 'leave' } | null;

const inviteUrl = (token: string) => `${window.location.origin}${import.meta.env.BASE_URL}${href({ name: 'join', token })}`;

export function ClubPanel() {
  const { clubs } = useSync();
  const { state } = useAuth();
  const club = useClub();
  const me = state.status === 'signedIn' ? state.user.id : '';
  const clubId = club.current?.clubId ?? '';
  const owner = club.current?.role === 'owner';
  const teams = useTeams(clubId || undefined);
  const [members, setMembers] = useState<Member[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [newTeam, setNewTeam] = useState('');
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [teamDraft, setTeamDraft] = useState('');
  const [clubDraft, setClubDraft] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fail = (e: unknown) => setMessage(e instanceof LastOwnerError ? t.club.lastOwner : e instanceof DuplicateTeamError ? t.home.teamDuplicate : t.errors.server);

  const load = useCallback(async () => {
    if (!clubId) return;
    try {
      setMembers(await clubs.members(clubId));
      if (owner) setToken(await clubs.invite(clubId));
    } catch (e) {
      fail(e);
    }
  }, [clubs, clubId, owner]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<unknown>) {
    setMessage(null);
    try {
      await action();
      await load();
    } catch (e) {
      fail(e);
    }
  }

  async function confirm() {
    const p = pending;
    setPending(null);
    if (!p) return;
    if (p.kind === 'remove') await run(() => clubs.remove(clubId, p.member.userId));
    if (p.kind === 'regenerate') await run(async () => setToken(await clubs.regenerateInvite(clubId)));
    if (p.kind === 'leave') {
      setMessage(null);
      try {
        await clubs.remove(clubId, me);
        await club.reload();
        navigate({ name: 'home' });
      } catch (e) {
        fail(e);
      }
    }
  }

  async function addTeam(e: FormEvent) {
    e.preventDefault();
    if (!newTeam.trim()) return;
    await run(async () => {
      await teams.add(newTeam);
      setNewTeam('');
    });
  }

  const setRole = (m: Member, role: ClubRole) => run(() => clubs.setRole(clubId, m.userId, role));

  return (
    <section className="card stack">
      {message && (
        <p className="notice" role="alert">
          {message}
        </p>
      )}
      {pending && (
        <div className="notice stack" role="alert">
          <span>
            {pending.kind === 'remove' ? t.club.removeConfirm(pending.member.name) : pending.kind === 'regenerate' ? t.club.regenerateConfirm : t.club.leaveConfirm}
          </span>
          <div className="row">
            <button type="button" className="btn" onClick={() => void confirm()}>
              {t.club.confirm}
            </button>
            <button type="button" className="btn" onClick={() => setPending(null)}>
              {t.club.cancel}
            </button>
          </div>
        </div>
      )}

      {owner && (
        <section className="stack">
          <h2>{t.club.clubName}</h2>
          {clubDraft === null ? (
            <div className="row">
              <strong>{club.current?.clubName}</strong>
              <button type="button" className="btn" onClick={() => setClubDraft(club.current?.clubName ?? '')}>
                {t.club.renameClub}
              </button>
            </div>
          ) : (
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                if (!clubDraft.trim()) return;
                void run(async () => {
                  await clubs.rename(clubId, clubDraft);
                  await club.reload();
                  setClubDraft(null);
                });
              }}
            >
              <input className="input" aria-label={t.club.clubName} value={clubDraft} maxLength={80} onChange={(e) => setClubDraft(e.target.value)} />
              <button type="submit" className="btn btn--primary">
                {t.club.save}
              </button>
            </form>
          )}
        </section>
      )}

      <section className="stack">
        <h2>{t.club.members}</h2>
        <ul className="list" aria-label={t.club.members}>
          {members.map((m) => (
            <li key={m.userId}>
              <span>
                <strong>{m.userId === me ? `${m.name} ${t.club.you}` : m.name}</strong> <span className="muted">{t.club.roles[m.role]}</span>
              </span>
              {owner && m.userId !== me && (
                <span className="row">
                  <button type="button" className="btn" aria-label={`${m.role === 'owner' ? t.club.makeMember : t.club.makeOwner} ${m.name}`} onClick={() => void setRole(m, m.role === 'owner' ? 'member' : 'owner')}>
                    {m.role === 'owner' ? t.club.makeMember : t.club.makeOwner}
                  </button>
                  <button type="button" className="btn" aria-label={`${t.club.remove} ${m.name}`} onClick={() => setPending({ kind: 'remove', member: m })}>
                    {t.club.remove}
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {owner && token && (
        <section className="stack">
          <label className="field">
            {t.club.invite}
            <input className="input" readOnly value={inviteUrl(token)} onFocus={(e) => e.target.select()} />
          </label>
          <p className="muted">{t.club.inviteHint}</p>
          <div className="row">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                void navigator.clipboard?.writeText(inviteUrl(token)).then(() => setCopied(true));
              }}
            >
              {copied ? t.club.copied : t.club.copy}
            </button>
            <button type="button" className="btn" onClick={() => setPending({ kind: 'regenerate' })}>
              {t.club.regenerate}
            </button>
          </div>
        </section>
      )}

      <section className="stack">
        <h2>{t.club.teams}</h2>
        <ul className="list" aria-label={t.club.teams}>
          {teams.teams.map((x) => (
            <li key={x.id}>
              {editingTeam === x.id ? (
                <form
                  className="row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!teamDraft.trim()) return;
                    void run(async () => {
                      await teams.rename(x.id, teamDraft);
                      setEditingTeam(null);
                    });
                  }}
                >
                  <input className="input" aria-label={t.club.teamName} value={teamDraft} maxLength={60} onChange={(e) => setTeamDraft(e.target.value)} />
                  <button type="submit" className="btn btn--primary">
                    {t.club.save}
                  </button>
                </form>
              ) : (
                <>
                  <span>
                    {x.name} {x.archived_at && <span className="muted">{t.club.archived}</span>}
                  </span>
                  <span className="row">
                    <button
                      type="button"
                      className="btn"
                      aria-label={`${t.club.renameTeam} ${x.name}`}
                      onClick={() => {
                        setEditingTeam(x.id);
                        setTeamDraft(x.name);
                      }}
                    >
                      {t.club.renameTeam}
                    </button>
                    {owner && (
                      <button
                        type="button"
                        className="btn"
                        aria-label={`${x.archived_at ? t.club.unarchive : t.club.archive} ${x.name}`}
                        onClick={() => void run(() => teams.setArchived(x.id, !x.archived_at))}
                      >
                        {x.archived_at ? t.club.unarchive : t.club.archive}
                      </button>
                    )}
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
        <form className="row" onSubmit={(e) => void addTeam(e)}>
          <input className="input" aria-label={t.club.teamName} value={newTeam} maxLength={60} onChange={(e) => setNewTeam(e.target.value)} />
          <button type="submit" className="btn">
            {t.club.addTeam}
          </button>
        </form>
      </section>

      <div className="row">
        <button type="button" className="btn" onClick={() => setPending({ kind: 'leave' })}>
          {t.club.leave}
        </button>
      </div>
    </section>
  );
}
