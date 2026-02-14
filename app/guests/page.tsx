"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchGuests, type GuestSearchResult } from "@/app/actions/reservations";

const SEARCH_DEBOUNCE_MS = 300;

export default function GuestsPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [guests, setGuests] = useState<GuestSearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filtry
  const [onlyVip, setOnlyVip] = useState(false);
  const [onlyBlacklisted, setOnlyBlacklisted] = useState(false);
  const [guestType, setGuestType] = useState("");
  const [segment, setSegment] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "lastStay" | "totalStays" | "createdAt">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  
  // Paginacja
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const doSearch = useCallback(async () => {
    setLoading(true);
    setError(null);

    const res = await searchGuests(debouncedQuery, {
      limit: pageSize,
      offset: (page - 1) * pageSize,
      sortBy,
      sortOrder,
      onlyVip: onlyVip || undefined,
      onlyBlacklisted: onlyBlacklisted || undefined,
      guestType: guestType || undefined,
      segment: segment || undefined,
    });

    setLoading(false);
    if (res.success) {
      setGuests(res.data.guests);
      setTotal(res.data.total);
    } else {
      setError(res.error);
    }
  }, [debouncedQuery, page, sortBy, sortOrder, onlyVip, onlyBlacklisted, guestType, segment]);

  // Wyszukiwanie przy zmianie filtrów (debounced dla pola wyszukiwania)
  useEffect(() => {
    doSearch();
  }, [doSearch]);

  // Reset strony przy zmianie filtrów
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, sortBy, sortOrder, onlyVip, onlyBlacklisted, guestType, segment]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/front-office" className="hover:text-foreground">Recepcja</Link>
        <span>/</span>
        <span>Wyszukiwarka gości</span>
      </div>
      
      <h1 className="text-2xl font-semibold mb-6">Wyszukiwarka gości</h1>

      {/* Wyszukiwarka i filtry */}
      <div className="mb-6 p-4 border rounded-lg bg-card">
        <div className="grid gap-4">
          <div>
            <Label htmlFor="search" className="text-sm font-medium">Szukaj gościa</Label>
            <Input
              id="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Wpisz imię, nazwisko, e-mail, telefon lub numer dokumentu..."
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="guestType" className="text-xs">Typ gościa</Label>
              <select
                id="guestType"
                value={guestType}
                onChange={(e) => setGuestType(e.target.value)}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">Wszystkie</option>
                <option value="INDIVIDUAL">Indywidualny</option>
                <option value="CORPORATE">Korporacyjny</option>
                <option value="GROUP">Grupowy</option>
                <option value="CREW">Załoga</option>
              </select>
            </div>
            <div>
              <Label htmlFor="segment" className="text-xs">Segment</Label>
              <select
                id="segment"
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">Wszystkie</option>
                <option value="BUSINESS">Business</option>
                <option value="LEISURE">Leisure</option>
                <option value="MICE">MICE</option>
                <option value="VIP">VIP</option>
                <option value="LONGSTAY">Long stay</option>
                <option value="CREW">Załoga</option>
              </select>
            </div>
            <div>
              <Label htmlFor="sortBy" className="text-xs">Sortuj wg</Label>
              <select
                id="sortBy"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="name">Nazwa</option>
                <option value="lastStay">Ostatni pobyt</option>
                <option value="totalStays">Liczba pobytów</option>
                <option value="createdAt">Data utworzenia</option>
              </select>
            </div>
            <div>
              <Label htmlFor="sortOrder" className="text-xs">Kierunek</Label>
              <select
                id="sortOrder"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="asc">Rosnąco (A-Z)</option>
                <option value="desc">Malejąco (Z-A)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={onlyVip}
                onChange={(e) => setOnlyVip(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Tylko VIP
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={onlyBlacklisted}
                onChange={(e) => setOnlyBlacklisted(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Tylko czarna lista
            </label>
          </div>
        </div>
      </div>

      {/* Wyniki */}
      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {loading ? "Wyszukiwanie..." : `Znaleziono ${total} gości`}
        </span>
        {totalPages > 1 && (
          <span>
            Strona {page} z {totalPages}
          </span>
        )}
      </div>

      {/* Tabela wyników */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Gość</th>
              <th className="text-left px-4 py-3 font-medium">Kontakt</th>
              <th className="text-left px-4 py-3 font-medium">Dokument</th>
              <th className="text-center px-4 py-3 font-medium">Pobyty</th>
              <th className="text-left px-4 py-3 font-medium">Typ</th>
              <th className="text-left px-4 py-3 font-medium">Ostatni pobyt</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {guests.length === 0 && !loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  {query ? "Nie znaleziono gości spełniających kryteria." : "Wprowadź kryteria wyszukiwania."}
                </td>
              </tr>
            ) : (
              guests.map((guest) => (
                <tr key={guest.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {guest.isVip && <span title="VIP" className="text-yellow-500">⭐</span>}
                      {guest.isBlacklisted && <span title="Czarna lista" className="text-red-500">🚫</span>}
                      <span className="font-medium">{guest.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs">
                      {guest.email && <div>{guest.email}</div>}
                      {guest.phone && <div className="text-muted-foreground">{guest.phone}</div>}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {guest.documentNumber ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                      guest.totalStays >= 10 ? "bg-green-100 text-green-800" :
                      guest.totalStays >= 5 ? "bg-blue-100 text-blue-800" :
                      guest.totalStays > 0 ? "bg-gray-100 text-gray-800" :
                      "text-muted-foreground"
                    }`}>
                      {guest.totalStays}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div>{guest.guestType === "INDIVIDUAL" ? "Indyw." : 
                          guest.guestType === "CORPORATE" ? "Korp." :
                          guest.guestType === "GROUP" ? "Grup." :
                          guest.guestType === "CREW" ? "Załoga" : guest.guestType}</div>
                    {guest.segment && (
                      <div className="text-muted-foreground">{guest.segment}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {guest.lastStayDate ? new Date(guest.lastStayDate).toLocaleDateString("pl-PL") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/guests/${guest.id}`}>
                      <Button variant="outline" size="sm">
                        Otwórz
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginacja */}
      {totalPages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
          >
            Poprzednia
          </Button>
          <span className="flex items-center px-3 text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || loading}
          >
            Następna
          </Button>
        </div>
      )}
    </div>
  );
}
