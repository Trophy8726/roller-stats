import { useState } from 'react';
import type { Game } from '../../domain/types';
import { GameGate } from '../../games/useGame';
import { loadSetup, saveSetup, type RecordSetup } from '../../settings';
import { Recorder } from './Recorder';
import { SetupPanel } from './SetupPanel';

export function RecordScreen({ code }: { code: string }) {
  return <GameGate code={code}>{(game) => <RecordFlow game={game} />}</GameGate>;
}

function RecordFlow({ game }: { game: Game }) {
  const [setup, setSetup] = useState<RecordSetup | null>(() => loadSetup(game.code));
  const update = (s: RecordSetup | null) => {
    saveSetup(game.code, s);
    setSetup(s);
  };
  return setup ? <Recorder game={game} setup={setup} onSetupChange={update} /> : <SetupPanel game={game} onDone={update} />;
}
