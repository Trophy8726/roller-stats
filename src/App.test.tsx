import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { t } from './i18n/fr';
import { savePendingInvite } from './settings';
import { makeDeps, renderApp, TEST_USER } from './test/fakes';

describe('App gate', () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
  });

  it('shows the login screen when signed out', () => {
    renderApp(makeDeps({ user: null }).deps, null);
    expect(screen.getByRole('button', { name: t.auth.google })).toBeInTheDocument();
  });

  it('shows the onboarding when the account has no club', async () => {
    const d = makeDeps();
    d.fc.members.length = 0;
    renderApp(d.deps);
    expect(await screen.findByRole('heading', { name: t.onboarding.createTitle })).toBeInTheDocument();
  });

  it('creates a club with its first team and opens it', async () => {
    const d = makeDeps();
    d.fc.members.length = 0;
    renderApp(d.deps);
    await userEvent.type(await screen.findByLabelText(t.onboarding.clubName), 'Rouen');
    await userEvent.type(screen.getByLabelText(t.onboarding.teamName), 'N1');
    await userEvent.click(screen.getByRole('button', { name: t.onboarding.create }));
    expect(await screen.findByRole('heading', { name: t.home.newGame })).toBeInTheDocument();
    expect(d.ft.list.some((x) => x.name === 'N1')).toBe(true);
    expect(localStorage.getItem(`club:${TEST_USER.id}`)).toBe('club-2');
  });

  it('returns to the invitation after the Google round trip', async () => {
    const d = makeDeps();
    d.fc.members.length = 0;
    savePendingInvite('token-club-1');
    renderApp(d.deps);
    expect(await screen.findByText(t.join.question('Aix'))).toBeInTheDocument();
    expect(window.location.hash).toBe('#/rejoindre/token-club-1');
  });

  it('opens the home of the current club', async () => {
    renderApp(makeDeps().deps);
    expect(await screen.findByRole('heading', { name: t.home.newGame })).toBeInTheDocument();
  });

  it('explains when the clubs cannot be loaded and retries', async () => {
    const d = makeDeps();
    d.fc.setFailing(true);
    renderApp(d.deps);
    expect(await screen.findByText(t.errors.server)).toBeInTheDocument();
    d.fc.setFailing(false);
    await userEvent.click(screen.getByRole('button', { name: t.ui.retry }));
    await waitFor(() => expect(screen.getByRole('heading', { name: t.home.newGame })).toBeInTheDocument());
  });
});
