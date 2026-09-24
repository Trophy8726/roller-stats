export function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <section className="card stack">
      <span className="muted">{label}</span>
      <span className="stat-big">{value}</span>
      {sub && <span className="muted">{sub}</span>}
    </section>
  );
}
