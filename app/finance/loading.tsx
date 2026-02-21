export default function FinanceLoading() {
  return (
    <div className="flex flex-col flex-1 p-6 animate-pulse">
      <div className="h-8 w-48 bg-muted rounded mb-6" />
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 bg-muted rounded-lg" />
        ))}
      </div>
      <div className="h-64 bg-muted rounded-lg" />
    </div>
  );
}
