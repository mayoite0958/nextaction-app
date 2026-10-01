import type { CategorySummary } from "@/lib/categories";

export function CategoryBalance({
  targets,
  summary,
}: {
  targets: Record<string, number>;
  summary: CategorySummary;
}) {
  const names = [...new Set([...Object.keys(targets), ...Object.keys(summary)])];
  const totalDone = Object.values(summary).reduce((s, c) => s + c.count, 0);
  return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Your balance
        </h2>
        <p className="text-xs text-muted-foreground">Target vs. actual, last 7 days</p>
      </div>
      {names.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Set category targets in Settings to see your balance.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {names.map((n) => {
            const target = targets[n] ?? 0;
            const actual = totalDone ? Math.round(((summary[n]?.count ?? 0) / totalDone) * 100) : 0;
            return (
              <li key={n} className="text-sm">
                <div className="flex justify-between gap-2">
                  <span className="truncate">{n}</span>
                  <span className="text-muted-foreground">
                    target {target}% vs. actual {actual}%
                  </span>
                </div>
                <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${actual}%` }} />
                  <div
                    className="absolute top-0 h-full w-0.5 bg-foreground"
                    style={{ left: `${Math.min(99.5, target)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {names.length > 0 && totalDone === 0 && (
        <p className="mt-3 text-xs text-muted-foreground">No finished sessions in the last 7 days yet.</p>
      )}
    </div>
  );
}
