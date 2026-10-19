import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { t } from '../i18n/fr';
import { makeDeps, renderApp, TEST_USER } from '../test/fakes';

describe('JoinScreen', () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
  });

  it('joins the club after confirmation and opens it', async () => {
    const d = makeDeps();
    await d.fc.api.create('Maisons-Laffitte', 'U20'); // club-2, token-club-2
    d.fc.members.splice(d.fc.members.findIndex((m) => m.clubId === 'club-2'), 1); // TEST_USER not in club-2
    window.location.hash = '#/rejoindre/token-club-2';
    renderApp(d.deps);
    await userEvent.click(await screen.findByRole('button', { name: t.join.confirm }));
    await waitFor(() => expect(window.location.hash).toBe('#/'));
    expect(d.fc.members.some((m) => m.clubId === 'club-2' && m.userId === TEST_USER.id && m.role === 'member')).toBe(true);
    expect(localStorage.getItem(`club:${TEST_USER.id}`)).toBe('club-2');
  });

  it('says so when already a member', async () => {
    window.location.hash = '#/rejoindre/token-club-1';
    renderApp(makeDeps().deps);
    expect(await screen.findByText(t.join.already('Aix'))).toBeInTheDocument();
  });

  it('explains an invalid or regenerated link', async () => {
    window.location.hash = '#/rejoindre/old-token';
    renderApp(makeDeps().deps);
    expect(await screen.findByText(t.join.invalid)).toBeInTheDocument();
  });
});
