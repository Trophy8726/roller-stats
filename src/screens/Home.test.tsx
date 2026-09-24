import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { t } from '../i18n/fr';
import { gameFx } from '../test/builders';
import { makeDeps, renderWithSync } from '../test/fakes';
import { Home } from './Home';

function renderHome(games = [gameFx({ code: 'K7QX' })]) {
  const d = makeDeps({ games });
  renderWithSync(<Home />, d.deps);
  return d;
}

describe('Home', () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
  });

  it('joins an existing game with a lowercase, spaced code', async () => {
    renderHome();
    await userEvent.type(screen.getByLabelText(t.home.codeLabel), ' k7qx ');
    await userEvent.click(screen.getByRole('button', { name: t.home.joinButton }));
    await waitFor(() => expect(window.location.hash).toBe('#/saisie/K7QX'));
  });

  it('shows an error for an unknown code', async () => {
    renderHome([]);
    await userEvent.type(screen.getByLabelText(t.home.codeLabel), 'ZZZZ');
    await userEvent.click(screen.getByRole('button', { name: t.home.joinButton }));
    expect(await screen.findByText(t.errors.unknownCode)).toBeInTheDocument();
  });

  it('rejects malformed codes', async () => {
    renderHome();
    await userEvent.type(screen.getByLabelText(t.home.codeLabel), 'AB1');
    await userEvent.click(screen.getByRole('button', { name: t.home.joinButton }));
    expect(await screen.findByText(t.errors.badCode)).toBeInTheDocument();
  });

  it('creates a game, shows its code and remembers the team name', async () => {
    renderHome([]);
    await userEvent.type(screen.getByLabelText(t.home.team), 'Nous');
    await userEvent.type(screen.getByLabelText(t.home.opponent), 'Rouen');
    await userEvent.click(screen.getByRole('button', { name: t.home.create }));
    expect(await screen.findByText('K7QX')).toBeInTheDocument();
    expect(localStorage.getItem('teamName')).toBe('Nous');
  });

  it('explains when the server is unreachable', async () => {
    const d = makeDeps();
    d.fg.setFailing(true);
    renderWithSync(<Home />, d.deps);
    expect(await screen.findByText(t.errors.server)).toBeInTheDocument();
  });

  it('lists recent games with links', async () => {
    renderHome([gameFx({ code: 'K7QX', opponent: 'Caen' })]);
    expect(await screen.findByText('Caen')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.nav.report })).toHaveAttribute('href', '#/rapport/K7QX');
  });
});
