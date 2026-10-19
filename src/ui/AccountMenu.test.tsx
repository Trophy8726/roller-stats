import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { t } from '../i18n/fr';
import { shotEv } from '../test/builders';
import { makeDeps, renderWithSync, TEST_USER } from '../test/fakes';
import { AccountMenu } from './AccountMenu';

describe('AccountMenu', () => {
  it('shows the account and signs out', async () => {
    const d = makeDeps();
    renderWithSync(<AccountMenu />, d.deps);
    await userEvent.click(screen.getByRole('button', { name: TEST_USER.name }));
    expect(screen.getByText(TEST_USER.email)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: t.account.signOut }));
    expect(d.fa.api.signOut).toHaveBeenCalledTimes(1);
  });

  it('warns before signing out with pending entries and keeps them', async () => {
    const d = makeDeps();
    d.fr.setOnline(false);
    await d.deps.store.add(shotEv('shot_for', 'goal', { game_code: 'K7QX' }));
    renderWithSync(<AccountMenu />, d.deps);
    await userEvent.click(screen.getByRole('button', { name: TEST_USER.name }));
    await userEvent.click(screen.getByRole('button', { name: t.account.signOut }));
    expect(await screen.findByText(t.account.pendingWarning(1))).toBeInTheDocument();
    expect(d.fa.api.signOut).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: t.account.signOutAnyway }));
    await waitFor(() => expect(d.fa.api.signOut).toHaveBeenCalledTimes(1));
    expect(await d.deps.store.pendingTotal()).toBe(1);
  });
});
