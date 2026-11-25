export default function Loading() {
  return (
    <div className="space-y-6 py-8">
      <div className="h-44 animate-pulse rounded-3xl bg-slate-900/70" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="h-48 animate-pulse rounded-3xl bg-slate-900/60" />
        <div className="h-48 animate-pulse rounded-3xl bg-slate-900/60" />
        <div className="h-48 animate-pulse rounded-3xl bg-slate-900/60" />
      </div>
    </div>
  );
}
