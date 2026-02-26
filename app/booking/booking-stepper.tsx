"use client";

import { cn } from "@/lib/utils";

const STEPS = [
  { key: "search", label: "Daty i goście" },
  { key: "rooms", label: "Wybór pokoju" },
  { key: "guest", label: "Dane" },
  { key: "payment", label: "Płatność" },
  { key: "done", label: "Gotowe" },
] as const;

export type BookingStepKey = (typeof STEPS)[number]["key"];

export function BookingStepper({
  currentStep,
  className,
}: {
  currentStep: BookingStepKey;
  className?: string;
}) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);
  return (
    <nav
      className={cn("flex items-center justify-center gap-1 sm:gap-2 flex-wrap", className)}
      aria-label="Kroki rezerwacji"
    >
      {STEPS.map((step, i) => {
        const isActive = i === currentIndex;
        const isDone = i < currentIndex;
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors",
                  isDone && "border-green-500 bg-green-500 text-white",
                  isActive && "border-primary bg-primary text-primary-foreground",
                  !isDone && !isActive && "border-muted-foreground/30 bg-muted/50 text-muted-foreground"
                )}
                aria-current={isActive ? "step" : undefined}
              >
                {isDone ? "\u2713" : i + 1}
              </div>
              <span
                className={cn(
                  "mt-1 hidden text-xs font-medium sm:block",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-1 h-0.5 w-4 sm:w-8 shrink-0 rounded",
                  i < currentIndex ? "bg-green-500" : "bg-muted"
                )}
                aria-hidden
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
