export default function RootLoading() {
  return (
    <div className="flex flex-col flex-1 p-6 animate-pulse">
      <div className="h-8 w-48 bg-muted rounded mb-6" />
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-muted rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-72 bg-muted rounded-lg" />
        <div className="h-72 bg-muted rounded-lg" />
      </div>
    </div>
  );
}
