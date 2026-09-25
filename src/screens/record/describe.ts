import type { GameEvent, MarkResult } from '../../domain/types';
import { t } from '../../i18n/fr';

/** One line for the "last entries" list: "P2 · Tir contre · Arrêt". */
export function describeEvent(e: GameEvent, goalieNames: ReadonlyMap<string, string>): string {
  const kind = e.penalty_shot ? (e.kind === 'shot_for' ? t.kinds.penalty_for : t.kinds.penalty_against) : t.kinds[e.kind];
  const head = `${t.record.period(e.period)} · ${kind}`;
  switch (e.kind) {
    case 'note':
      return `${head} · ${e.note ?? ''}`;
    case 'state_our_goalie':
      return `${head} · ${e.goalie_id ? (goalieNames.get(e.goalie_id) ?? t.goalies.unknown) : t.state.ourNetEmpty}`;
    case 'state_their_net':
      return `${head} · ${e.result === 'empty' ? t.state.theirNetEmpty : t.state.theirNetPresent}`;
    case 'state_strength':
      return `${head} · ${t.strength[e.strength]}`;
    case 'own_goal_for':
    case 'own_goal_against':
      return head;
    default:
      return `${head} · ${t.results[e.result as MarkResult]}`;
  }
}
