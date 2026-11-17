import { render, screen } from '@testing-library/react';
import { SHOT_RESULTS, TURNOVER_RESULTS } from '../domain/types';
import { Legend } from './Legend';

describe('Legend', () => {
  it('shows each label with its count when counts are given', () => {
    render(<Legend results={TURNOVER_RESULTS} counts={{ lost: 12, recovered: 3 }} />);
    expect(screen.getByText('Perdu · 12')).toBeInTheDocument();
    expect(screen.getByText('Récupéré · 3')).toBeInTheDocument();
  });
  it('draws a recovered puck as a triangle, not a circle like a lost one', () => {
    const { container } = render(<Legend results={TURNOVER_RESULTS} />);
    expect(container.querySelector('polygon[data-result="recovered"]')).not.toBeNull();
    expect(container.querySelector('circle[data-result="lost"]')).not.toBeNull();
  });
  it('shows bare labels without counts', () => {
    render(<Legend results={SHOT_RESULTS} />);
    expect(screen.getByText('But')).toBeInTheDocument();
  });
});
