"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Calendar, User, DoorOpen, FilePlus, MapPin, Receipt } from "lucide-react";
import { getCommandPaletteData } from "@/app/actions/tape-chart";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [guests, setGuests] = useState<
    { id: string; name: string; reservationId?: string }[]
  >([]);
  const [rooms, setRooms] = useState<{ number: string; type: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Gdy palette zamknięty: co 100ms dodaj klasę pms-allow-clicks na body (CSS z !important wymusza klikalność).
  useEffect(() => {
    const interval = setInterval(() => {
      if (!open && typeof document !== "undefined" && document.body) {
        if (!document.querySelector("[data-state='open']")) {
          document.body.classList.add("pms-allow-clicks");
          document.body.style.removeProperty("pointer-events");
        }
      }
    }, 100);
    return () => clearInterval(interval);
  }, [open]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCommandPaletteData();
      setGuests(data.guests);
      setRooms(data.rooms);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadData();
  }, [open, loadData]);

  const run = useCallback(
    (fn: () => void) => {
      setOpen(false);
      fn();
    },
    []
  );

  // Renderuj dialog tylko gdy otwarty – gdy zamknięty nie ma overlayu w DOM, więc nic nie blokuje kliknięć.
  return (
    <>
      {open && (
    <CommandDialog open={true} onOpenChange={setOpen}>
      <CommandInput placeholder="Szukaj gościa, pokoju lub wybierz akcję…" />
      <CommandList>
        <CommandEmpty>
          {loading ? "Ładowanie…" : "Brak wyników."}
        </CommandEmpty>
        <CommandGroup heading="Szybkie akcje">
          <CommandItem
            onSelect={() =>
              run(() => router.push("/front-office"))
            }
          >
            <Calendar className="mr-2 h-4 w-4" />
            Grafik
          </CommandItem>
          <CommandItem
            onSelect={() =>
              run(() => router.push("/front-office"))
            }
          >
            <FilePlus className="mr-2 h-4 w-4" />
            Nowa rezerwacja
          </CommandItem>
          <CommandItem
            onSelect={() =>
              run(() => router.push("/cennik"))
            }
          >
            <Receipt className="mr-2 h-4 w-4" />
            Cennik
          </CommandItem>
          <CommandItem
            onSelect={() =>
              run(() => router.push("/"))
            }
          >
            <DoorOpen className="mr-2 h-4 w-4" />
            Panel
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Pokaż na grafiku">
          {guests
            .filter((g) => g.reservationId)
            .map((g) => (
              <CommandItem
                key={`show-${g.id}`}
                value={`Pokaż na grafiku ${g.name}`}
                onSelect={() =>
                  run(() =>
                    router.push(
                      `/front-office?reservationId=${encodeURIComponent(g.reservationId!)}`
                    )
                  )
                }
              >
                <MapPin className="mr-2 h-4 w-4" />
                Pokaż na grafiku – {g.name}
              </CommandItem>
            ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Goście">
          {guests.map((g) => (
            <CommandItem
              key={g.id}
              value={g.name}
              onSelect={() =>
                run(() => router.push(`/front-office?guest=${encodeURIComponent(g.name)}`))
              }
            >
              <User className="mr-2 h-4 w-4" />
              {g.name}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Pokoje">
          {rooms.map((r) => (
            <CommandItem
              key={r.number}
              value={`${r.number} ${r.type}`}
              onSelect={() =>
                run(() => router.push(`/front-office?room=${encodeURIComponent(r.number)}`))
              }
            >
              <DoorOpen className="mr-2 h-4 w-4" />
              Pokój {r.number} ({r.type})
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
      )}
    </>
  );
}
