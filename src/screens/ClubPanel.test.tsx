import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { t } from '../i18n/fr';
import { makeDeps, renderWithSync, TEST_USER } from '../test/fakes';
import { ClubPanel } from './ClubPanel';

function withVolunteer() {
  const d = makeDeps();
  d.fc.members.push({ clubId: 'club-1', userId: 'user-2', name: 'Léa', role: 'member', joinedAt: '2026-10-10T00:00:00Z' });
  return d;
}

describe('ClubPanel — owner', () => {
  beforeEach(() => localStorage.clear());

  it('lists members with their roles', async () => {
    renderWithSync(<ClubPanel />, withVolunteer().deps);
    const list = await screen.findByRole('list', { name: t.club.members });
    expect(within(list).getByText(`${TEST_USER.name} ${t.club.you}`)).toBeInTheDocument();
    expect(within(list).getByText('Léa')).toBeInTheDocument();
    expect(within(list).getAllByText(t.club.roles.member)).toHaveLength(1);
  });

  it('shows the invitation link and regenerates it after confirmation', async () => {
    const d = withVolunteer();
    renderWithSync(<ClubPanel />, d.deps);
    const link = await screen.findByLabelText(t.club.invite);
    expect((link as HTMLInputElement).value).toMatch(/#\/rejoindre\/token-club-1$/);
    await userEvent.click(screen.getByRole('button', { name: t.club.regenerate }));
    expect(screen.getByText(t.club.regenerateConfirm)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: t.club.confirm }));
    await waitFor(() => expect((screen.getByLabelText(t.club.invite) as HTMLInputElement).value).not.toMatch(/token-club-1$/));
  });

  it('promotes and removes a member', async () => {
    const d = withVolunteer();
    renderWithSync(<ClubPanel />, d.deps);
    await userEvent.click(await screen.findByRole('button', { name: `${t.club.makeOwner} Léa` }));
    await waitFor(() => expect(d.fc.members.find((m) => m.userId === 'user-2')?.role).toBe('owner'));
    await userEvent.click(screen.getByRole('button', { name: `${t.club.remove} Léa` }));
    await userEvent.click(screen.getByRole('button', { name: t.club.confirm }));
    await waitFor(() => expect(d.fc.members.some((m) => m.userId === 'user-2')).toBe(false));
  });

  it('archives and reactivates a team', async () => {
    const d = withVolunteer();
    renderWithSync(<ClubPanel />, d.deps);
    await userEvent.click(await screen.findByRole('button', { name: `${t.club.archive} N2` }));
    await waitFor(() => expect(d.ft.list[0].archived_at).not.toBeNull());
    await userEvent.click(screen.getByRole('button', { name: `${t.club.unarchive} N2` }));
    await waitFor(() => expect(d.ft.list[0].archived_at).toBeNull());
  });

  it('explains why the last owner cannot leave', async () => {
    renderWithSync(<ClubPanel />, withVolunteer().deps);
    await userEvent.click(await screen.findByRole('button', { name: t.club.leave }));
    await userEvent.click(screen.getByRole('button', { name: t.club.confirm }));
    expect(await screen.findByText(t.club.lastOwner)).toBeInTheDocument();
  });
});

describe('ClubPanel — member', () => {
  it('hides the owner tools and lets the member leave', async () => {
    const d = withVolunteer();
    d.fc.members[0].role = 'member';
    d.fc.members[1].role = 'owner';
    renderWithSync(<ClubPanel />, d.deps, { memberships: [{ clubId: 'club-1', clubName: 'Aix', role: 'member' }] });
    await screen.findByRole('list', { name: t.club.members });
    expect(screen.queryByLabelText(t.club.invite)).toBeNull();
    expect(screen.queryByRole('button', { name: `${t.club.archive} N2` })).toBeNull();
    expect(screen.getByRole('button', { name: `${t.club.renameTeam} N2` })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: t.club.leave }));
    await userEvent.click(screen.getByRole('button', { name: t.club.confirm }));
    await waitFor(() => expect(d.fc.members.some((m) => m.userId === TEST_USER.id)).toBe(false));
  });
});
