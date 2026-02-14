"use client";

import { useState, useEffect } from "react";
import { getMenu, getOrders, createOrder, createMenuItem, updateOrderStatus, getGuestDietAndAllergiesForReservation } from "@/app/actions/gastronomy";
import { DIET_TAGS, ALLERGEN_TAGS } from "@/lib/gastronomy-constants";
import type { MenuItemForUi, OrderItemInput } from "@/app/actions/gastronomy";
import { getActiveReservationsForCharge } from "@/app/actions/spa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const DIET_LABELS: Record<string, string> = {
  VEGETARIAN: "Wegetariańska",
  VEGAN: "Wegańska",
  GLUTEN_FREE: "Bezglutenowa",
  LACTOSE_FREE: "Bez laktozy",
  HALAL: "Halal",
  KOSHER: "Koszer",
};

interface BasketItem extends MenuItemForUi {
  quantity: number;
}

export function GastronomyClient() {
  const [menu, setMenu] = useState<Array<{ category: string; items: MenuItemForUi[] }>>([]);
  const [orders, setOrders] = useState<Array<{ id: string; roomNumber: string | null; guestName: string | null; itemCount: number; totalAmount: number; status: string; createdAt: string }>>([]);
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [reservations, setReservations] = useState<Array<{ id: string; guestName: string; roomNumber: string }>>([]);
  const [selectedReservationId, setSelectedReservationId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("Dania główne");
  const [newItemDietTags, setNewItemDietTags] = useState<string[]>([]);
  const [newItemAllergens, setNewItemAllergens] = useState<string[]>([]);
  const [guestDietInfo, setGuestDietInfo] = useState<{ guestName: string; mealPreferences: { allergies?: string[]; other?: string }; healthAllergies: string | null } | null>(null);

  const loadData = () => {
    Promise.all([getMenu(), getOrders(), getActiveReservationsForCharge()]).then(
      ([menuRes, ordersRes, resRes]) => {
        if (menuRes.success && menuRes.data) setMenu(menuRes.data);
        if (ordersRes.success && ordersRes.data) setOrders(ordersRes.data);
        if (resRes.success && resRes.data) setReservations(resRes.data.map((r) => ({ id: r.id, guestName: r.guestName, roomNumber: r.roomNumber })));
        setLoading(false);
      }
    );
  };

  useEffect(() => loadData(), []);

  useEffect(() => {
    if (!selectedReservationId) {
      setGuestDietInfo(null);
      return;
    }
    getGuestDietAndAllergiesForReservation(selectedReservationId).then((r) => {
      if (r.success && r.data) setGuestDietInfo({ guestName: r.data.guestName, mealPreferences: r.data.mealPreferences, healthAllergies: r.data.healthAllergies });
      else setGuestDietInfo(null);
    });
  }, [selectedReservationId]);

  const addToBasket = (item: MenuItemForUi) => {
    setBasket((prev) => {
      const existing = prev.find((b) => b.id === item.id);
      if (existing) return prev.map((b) => (b.id === item.id ? { ...b, quantity: b.quantity + 1 } : b));
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromBasket = (id: string) => setBasket((prev) => prev.filter((b) => b.id !== id));
  const basketTotal = basket.reduce((s, b) => s + b.price * b.quantity, 0);

  const handleSubmitOrder = async () => {
    if (!basket.length) { toast.error("Koszyk jest pusty"); return; }
    if (!selectedReservationId) { toast.error("Wybierz rezerwację"); return; }
    const items: OrderItemInput[] = basket.map((b) => ({ menuItemId: b.id, quantity: b.quantity }));
    setSubmitting(true);
    const r = await createOrder(selectedReservationId, null, items);
    setSubmitting(false);
    if (r.success) { toast.success("Zamówienie złożone"); setBasket([]); setSelectedReservationId(""); loadData(); }
    else toast.error(r.error);
  };

  const handleAddMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(newItemPrice.replace(",", "."));
    if (!newItemName.trim()) { toast.error("Nazwa wymagana"); return; }
    if (Number.isNaN(price) || price < 0) { toast.error("Podaj prawidłową cenę"); return; }
    setSubmitting(true);
    const r = await createMenuItem(newItemName.trim(), price, newItemCategory, newItemDietTags.length ? newItemDietTags : undefined, newItemAllergens.length ? newItemAllergens : undefined);
    setSubmitting(false);
    if (r.success) {
      toast.success("Pozycja dodana");
      setAddItemOpen(false);
      setNewItemName("");
      setNewItemPrice("");
      setNewItemDietTags([]);
      setNewItemAllergens([]);
      loadData();
    } else toast.error(r.error);
  };

  const toggleDietTag = (tag: string) => setNewItemDietTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  const toggleAllergen = (a: string) => setNewItemAllergens((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const guestAllergyParts: string[] = [];
  guestDietInfo?.mealPreferences?.allergies?.forEach((a) => guestAllergyParts.push(a.toLowerCase().trim()));
  if (guestDietInfo?.healthAllergies) {
    guestDietInfo.healthAllergies.split(/[,;]/).forEach((s) => {
      const t = s.toLowerCase().trim();
      if (t) {
        guestAllergyParts.push(t);
        t.split(/\s+/).forEach((w) => w && guestAllergyParts.push(w));
      }
    });
  }
  const guestAllergiesSet = new Set(guestAllergyParts);
  const basketAllergenWarnings = basket.flatMap((b) =>
    (b.allergens ?? []).filter((a) => {
      const key = a.toLowerCase();
      return guestAllergiesSet.has(key) || Array.from(guestAllergiesSet).some((g) => g.includes(key) || key.includes(g));
    })
  );

  const handleUpdateStatus = async (orderId: string, status: string) => {
    const r = await updateOrderStatus(orderId, status);
    if (r.success) { toast.success("Status zaktualizowany"); loadData(); } else toast.error(r.error);
  };

  const STATUS_LABELS: Record<string, string> = { PENDING: "Oczekujące", CONFIRMED: "Potwierdzone", IN_PROGRESS: "W realizacji", DELIVERED: "Dostarczone", CANCELLED: "Anulowane" };

  if (loading) return <p className="text-muted-foreground">Ładowanie…</p>;

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Karta dań</h2>
            <Button variant="outline" size="sm" onClick={() => setAddItemOpen(true)}>Dodaj pozycję</Button>
          </div>
          {menu.length === 0 ? (
            <p className="text-muted-foreground text-sm">Brak pozycji. Dodaj dania do karty.</p>
          ) : (
            <div className="space-y-4 rounded-lg border p-4">
              {menu.map(({ category, items }) => (
                <div key={category}>
                  <h3 className="font-medium text-sm text-muted-foreground mb-2">{category}</h3>
                  <div className="space-y-1">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-4 rounded border px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <span className="text-sm">{item.name}</span>
                          {(item.dietTags?.length ?? 0) > 0 || (item.allergens?.length ?? 0) > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {item.dietTags?.map((t) => (
                                <Badge key={t} variant="secondary" className="text-xs">{DIET_LABELS[t] ?? t}</Badge>
                              ))}
                              {item.allergens?.map((a) => (
                                <Badge key={a} variant="outline" className="text-xs text-amber-700 border-amber-300">{a}</Badge>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-medium">{item.price.toFixed(2)} zł</span>
                          <Button size="sm" variant="outline" onClick={() => addToBasket(item)}>+ Do koszyka</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-4">Koszyk (room service)</h2>
          <div className="rounded-lg border p-4 space-y-4">
            {basket.length === 0 ? (
              <p className="text-muted-foreground text-sm">Koszyk pusty. Dodaj dania z karty.</p>
            ) : (
              <>
                <ul className="space-y-2">
                  {basket.map((b) => (
                    <li key={b.id} className="flex justify-between items-center text-sm">
                      <span>{b.name} × {b.quantity}</span>
                      <div className="flex items-center gap-2">
                        <span>{(b.price * b.quantity).toFixed(2)} zł</span>
                        <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => removeFromBasket(b.id)}>Usuń</Button>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="font-medium">Razem: {basketTotal.toFixed(2)} zł</p>
                <div>
                  <Label className="text-xs">Rezerwacja (pokój)</Label>
                  <select value={selectedReservationId} onChange={(e) => setSelectedReservationId(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                    <option value="">— Wybierz —</option>
                    {reservations.map((r) => <option key={r.id} value={r.id}>{r.roomNumber} · {r.guestName}</option>)}
                  </select>
                </div>
                {guestDietInfo && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-2 text-sm">
                    <span className="font-medium">Preferencje / alergie gościa ({guestDietInfo.guestName}):</span>
                    {guestDietInfo.mealPreferences?.allergies?.length ? (
                      <p className="mt-1 text-amber-800 dark:text-amber-200">Alergie pokarmowe: {guestDietInfo.mealPreferences.allergies.join(", ")}</p>
                    ) : null}
                    {guestDietInfo.healthAllergies ? (
                      <p className="mt-1 text-amber-800 dark:text-amber-200">Uwagi zdrowotne: {guestDietInfo.healthAllergies}</p>
                    ) : null}
                    {guestDietInfo.mealPreferences?.other ? (
                      <p className="mt-1 text-amber-800 dark:text-amber-200">Inne: {guestDietInfo.mealPreferences.other}</p>
                    ) : null}
                  </div>
                )}
                {basketAllergenWarnings.length > 0 && (
                  <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                    Uwaga: koszyk zawiera alergeny zgłoszone przez gościa: {[...new Set(basketAllergenWarnings)].join(", ")}
                  </p>
                )}
                <Button onClick={handleSubmitOrder} disabled={submitting || !selectedReservationId}>{submitting ? "Zapisywanie…" : "Złóż zamówienie"}</Button>
              </>
            )}
          </div>
        </div>
      </div>
      <div>
        <h2 className="text-lg font-semibold mb-4">Lista zamówień</h2>
        {orders.length === 0 ? <p className="text-muted-foreground text-sm">Brak zamówień.</p> : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2">Pokój / Gość</th>
                  <th className="text-left p-2">Pozycje</th>
                  <th className="text-left p-2">Kwota</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Data</th>
                  <th className="text-left p-2">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t">
                    <td className="p-2">{o.roomNumber ?? "—"} · {o.guestName ?? "—"}</td>
                    <td className="p-2">{o.itemCount} szt.</td>
                    <td className="p-2">{o.totalAmount.toFixed(2)} zł</td>
                    <td className="p-2">{STATUS_LABELS[o.status] ?? o.status}</td>
                    <td className="p-2">{new Date(o.createdAt).toLocaleString("pl-PL")}</td>
                    <td className="p-2">
                      {o.status !== "CANCELLED" && o.status !== "DELIVERED" && (
                        <select value={o.status} onChange={(e) => handleUpdateStatus(o.id, e.target.value)} className="h-8 rounded border px-2 text-xs">
                          <option value="PENDING">Oczekujące</option>
                          <option value="CONFIRMED">Potwierdzone</option>
                          <option value="IN_PROGRESS">W realizacji</option>
                          <option value="DELIVERED">Dostarczone</option>
                          <option value="CANCELLED">Anulowane</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Sheet open={addItemOpen} onOpenChange={setAddItemOpen}>
        <SheetContent side="right">
          <SheetHeader><SheetTitle>Dodaj pozycję do karty dań</SheetTitle></SheetHeader>
          <form onSubmit={handleAddMenuItem} className="mt-6 space-y-4">
            <div><Label>Nazwa</Label><Input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="np. Zupa dnia" className="mt-1" /></div>
            <div><Label>Cena (PLN)</Label><Input type="number" min={0} step={0.01} value={newItemPrice} onChange={(e) => setNewItemPrice(e.target.value)} placeholder="0.00" className="mt-1" /></div>
            <div><Label>Kategoria</Label><Input value={newItemCategory} onChange={(e) => setNewItemCategory(e.target.value)} placeholder="np. Dania główne" className="mt-1" /></div>
            <div>
              <Label>Diety specjalne</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {DIET_TAGS.map((t) => (
                  <label key={t} className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <input type="checkbox" checked={newItemDietTags.includes(t)} onChange={() => toggleDietTag(t)} className="rounded border-input" />
                    <span>{DIET_LABELS[t] ?? t}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label>Alergeny (Rozporządzenie UE 1169/2011)</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {ALLERGEN_TAGS.map((a) => (
                  <label key={a} className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <input type="checkbox" checked={newItemAllergens.includes(a)} onChange={() => toggleAllergen(a)} className="rounded border-input" />
                    <span>{a}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" disabled={submitting}>{submitting ? "Zapisywanie…" : "Dodaj"}</Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
