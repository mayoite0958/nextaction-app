export function SplitBar({
  urgentShare,
  urgentLabel,
  longtermLabel,
}: {
  urgentShare: number;
  urgentLabel: string;
  longtermLabel: string;
}) {
  const urgent = Math.min(100, Math.max(0, urgentShare));
  return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Your balance
        </h2>
        <p className="text-sm text-muted-foreground">
          {urgent}% / {100 - urgent}%
        </p>
      </div>
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-muted">
        <div className="bg-urgent" style={{ width: `${urgent}%` }} />
        <div className="bg-longterm" style={{ width: `${100 - urgent}%` }} />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-urgent" />
          {urgentLabel}
        </span>
        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-longterm" />
          {longtermLabel}
        </span>
      </div>
    </div>
  );
}
