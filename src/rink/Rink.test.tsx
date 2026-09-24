import { fireEvent, render, screen } from '@testing-library/react';
import { t } from '../i18n/fr';
import { Rink } from './Rink';

function mockRect(el: Element) {
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 200, right: 400, bottom: 200, x: 0, y: 0, toJSON() {} }) as DOMRect;
}

describe('Rink', () => {
  it('reports a normalized tap when we attack right', () => {
    const onTap = vi.fn();
    render(<Rink attackRight onTap={onTap} />);
    const svg = screen.getByRole('group', { name: t.rink.label });
    mockRect(svg);
    fireEvent.click(svg, { clientX: 360, clientY: 50 });
    expect(onTap).toHaveBeenCalledWith({ x: 0.9, y: 0.25 });
  });

  it('rotates the tap when we attack left', () => {
    const onTap = vi.fn();
    render(<Rink attackRight={false} onTap={onTap} />);
    const svg = screen.getByRole('group', { name: t.rink.label });
    mockRect(svg);
    fireEvent.click(svg, { clientX: 360, clientY: 50 });
    const p = onTap.mock.calls[0][0];
    expect(p.x).toBeCloseTo(0.1);
    expect(p.y).toBeCloseTo(0.75);
  });

  it('reports dot taps with the normalized dot id and does not also report a rink tap', () => {
    const onDotTap = vi.fn();
    const onTap = vi.fn();
    render(<Rink attackRight={false} dotMode="interactive" onDotTap={onDotTap} onTap={onTap} />);
    fireEvent.click(screen.getByRole('button', { name: t.dots.off_top }));
    expect(onDotTap).toHaveBeenCalledWith('off_top');
    expect(onTap).not.toHaveBeenCalled();
  });

  it('shows the team defending each end', () => {
    render(<Rink attackRight leftLabel="Nous" rightLabel="Rouen" />);
    expect(screen.getByText('Nous')).toBeInTheDocument();
    expect(screen.getByText('Rouen')).toBeInTheDocument();
  });

  it('draws one shaped marker per event', () => {
    const { container } = render(
      <Rink attackRight markers={[{ id: 'a', x: 0.9, y: 0.5, result: 'goal' }, { id: 'b', x: 0.8, y: 0.4, result: 'blocked' }]} />,
    );
    expect(container.querySelectorAll('[data-result="goal"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-result="blocked"]')).toHaveLength(1);
  });
});
