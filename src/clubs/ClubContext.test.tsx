import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '../auth/AuthContext';
import { SyncProvider } from '../events/SyncContext';
import { saveCurrentClub, saveMemberships } from '../settings';
import { makeDeps, TEST_USER } from '../test/fakes';
import { ClubProvider, useClub } from './ClubContext';

function Probe() {
  const c = useClub();
  return (
    <>
      <p>{`${c.status}:${c.current?.clubName ?? 'none'}:${c.memberships.length}`}</p>
      <button type="button" onClick={() => c.select('club-2')}>
        switch
      </button>
    </>
  );
}

function renderProbe(d = makeDeps()) {
  render(
    <SyncProvider deps={d.deps}>
      <AuthProvider initialUser={TEST_USER}>
        <ClubProvider userId={TEST_USER.id}>
          <Probe />
        </ClubProvider>
      </AuthProvider>
    </SyncProvider>,
  );
  return d;
}

describe('ClubProvider', () => {
  beforeEach(() => localStorage.clear());

  it('loads the memberships and picks the first club', async () => {
    renderProbe();
    expect(screen.getByText('loading:none:0')).toBeInTheDocument();
    expect(await screen.findByText('ready:Aix:1')).toBeInTheDocument();
  });

  it('remembers the chosen club per account', async () => {
    const d = makeDeps();
    await d.fc.api.create('Maisons-Laffitte', 'U20'); // becomes club-2, TEST_USER owner
    renderProbe(d);
    await screen.findByText('ready:Aix:2');
    await userEvent.click(screen.getByRole('button', { name: 'switch' }));
    expect(await screen.findByText('ready:Maisons-Laffitte:2')).toBeInTheDocument();
    expect(localStorage.getItem(`club:${TEST_USER.id}`)).toBe('club-2');
  });

  it('falls back when the remembered club is gone', async () => {
    saveCurrentClub(TEST_USER.id, 'club-removed');
    renderProbe();
    expect(await screen.findByText('ready:Aix:1')).toBeInTheDocument();
  });

  it('opens offline from the cached memberships', async () => {
    saveMemberships(TEST_USER.id, [{ clubId: 'club-1', clubName: 'Aix', role: 'owner' }]);
    const d = makeDeps();
    d.fc.setFailing(true);
    renderProbe(d);
    expect(screen.getByText('ready:Aix:1')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('ready:Aix:1')).toBeInTheDocument());
  });

  it('reports an error when nothing is cached and the server is down', async () => {
    const d = makeDeps();
    d.fc.setFailing(true);
    renderProbe(d);
    expect(await screen.findByText('error:none:0')).toBeInTheDocument();
  });
});
