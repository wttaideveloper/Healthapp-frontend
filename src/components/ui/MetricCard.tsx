export function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wider text-foreground/65">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </article>
  );
}
