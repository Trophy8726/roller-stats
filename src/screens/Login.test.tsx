import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { t } from '../i18n/fr';
import { loadPendingInvite } from '../settings';
import { makeDeps, renderWithSync } from '../test/fakes';
import { Login } from './Login';

describe('Login', () => {
  beforeEach(() => localStorage.clear());

  it('starts the Google sign-in', async () => {
    const d = makeDeps({ user: null });
    renderWithSync(<Login error={false} inviteToken={null} />, d.deps, { user: null });
    await userEvent.click(screen.getByRole('button', { name: t.auth.google }));
    expect(d.fa.api.signInWithGoogle).toHaveBeenCalledTimes(1);
    expect(loadPendingInvite()).toBeNull();
  });

  it('keeps the invitation across the Google round trip', async () => {
    const d = makeDeps({ user: null });
    renderWithSync(<Login error={false} inviteToken="tok123" />, d.deps, { user: null });
    expect(screen.getByText(t.auth.invitePending)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: t.auth.google }));
    expect(loadPendingInvite()).toBe('tok123');
  });

  it('explains a failed sign-in', () => {
    const d = makeDeps({ user: null });
    renderWithSync(<Login error inviteToken={null} />, d.deps, { user: null });
    expect(screen.getByRole('alert')).toHaveTextContent(t.auth.failed);
  });
});
