import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { t } from '../i18n/fr';
import { makeDeps, renderWithSync, TEST_USER } from '../test/fakes';
import { ClubSwitcher } from './ClubSwitcher';

describe('ClubSwitcher', () => {
  beforeEach(() => localStorage.clear());

  it('shows only the club name with a single club', () => {
    renderWithSync(<ClubSwitcher />, makeDeps().deps);
    expect(screen.getByText('Aix')).toBeInTheDocument();
    expect(screen.queryByLabelText(t.clubs.switch)).toBeNull();
  });

  it('switches club when there are several', async () => {
    const d = makeDeps();
    await d.fc.api.create('Maisons-Laffitte', 'U20'); // the fake server agrees with the initial list below
    renderWithSync(<ClubSwitcher />, d.deps, {
      memberships: [
        { clubId: 'club-1', clubName: 'Aix', role: 'owner' },
        { clubId: 'club-2', clubName: 'Maisons-Laffitte', role: 'owner' },
      ],
    });
    await userEvent.selectOptions(await screen.findByLabelText(t.clubs.switch), 'Maisons-Laffitte');
    expect(localStorage.getItem(`club:${TEST_USER.id}`)).toBe('club-2');
  });
});
