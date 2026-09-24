export function formatPct(v: number | null): string {
  if (v === null) return '—';
  return `${(v * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
