import type { MatchState } from '../../domain/matchState';
import { t } from '../../i18n/fr';

/** The current state of the match, always visible: who is in net, the opponent net, the numerical situation. */
export function StateBanner({ state, names, onOpen }: { state: MatchState; names: ReadonlyMap<string, string>; onOpen: () => void }) {
  const goalie = state.ourNetEmpty
    ? t.state.ourNetEmpty
    : state.ourGoalieId
      ? t.state.goalie(names.get(state.ourGoalieId) ?? t.goalies.unknown)
      : t.state.goalieUnset;
  const parts = [goalie, state.theirNetEmpty ? t.state.theirNetEmpty : null, state.strength !== 'even' ? t.strength[state.strength] : null].filter(
    (p): p is string => p !== null,
  );
  return (
    <button type="button" className={`banner${state.ourNetEmpty || state.theirNetEmpty ? ' banner--alert' : ''}`} title={t.state.label} onClick={onOpen}>
      {parts.join(' · ')}
    </button>
  );
}
