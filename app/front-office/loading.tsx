export default function FrontOfficeLoading() {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden animate-pulse">
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b bg-card">
        <div className="flex items-center gap-2">
          <div className="h-8 w-24 bg-muted rounded" />
          <div className="h-8 w-8 bg-muted rounded" />
          <div className="h-8 w-8 bg-muted rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-32 bg-muted rounded" />
          <div className="h-8 w-8 bg-muted rounded" />
        </div>
      </div>
      <div className="flex-1 p-4">
        <div className="grid gap-1">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex gap-1">
              <div className="h-8 w-24 bg-muted rounded shrink-0" />
              <div className="flex-1 h-8 bg-muted/50 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
