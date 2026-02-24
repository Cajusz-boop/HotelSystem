/** Identyczny z placeholderem w FrontOfficeClient (!hasMounted) – unika hydration mismatch przy Suspense + streaming. */
export default function FrontOfficeLoading() {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden items-center justify-center p-8 text-muted-foreground">
      Ładowanie recepcji…
    </div>
  );
}
