import { formatDate, formatNumber, formatPct } from './format';

describe('format', () => {
  it('formats percentages the French way', () => {
    expect(formatPct(0.9167)).toBe('91,7 %');
    expect(formatPct(1)).toBe('100 %');
    expect(formatPct(null)).toBe('—');
  });
  it('formats numbers with a decimal comma', () => {
    expect(formatNumber(2.5)).toBe('2,5');
    expect(formatNumber(3)).toBe('3');
  });
  it('formats ISO dates as dd/mm/yyyy', () => {
    expect(formatDate('2026-09-24')).toBe('24/09/2026');
  });
});
