"use client";

import { useState, useEffect } from "react";
import {
  getLaundryServices,
  createLaundryService,
  getLaundryOrders,
  createLaundryOrder,
  updateLaundryOrderStatus,
} from "@/app/actions/laundry";
import { getActiveReservationsForCharge } from "@/app/actions/spa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";

type ServiceRow = { id: string; name: string; price: number; unit: string };

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Oczekujące",
  PICKED_UP: "Odebrane",
  IN_PROGRESS: "W praniu",
  READY: "Gotowe",
  DELIVERED: "Oddane",
  CANCELLED: "Anulowane",
};

export default function LaundryPage() {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [orders, setOrders] = useState<
    Array<{
      id: string;
      roomNumber: string;
      guestName: string;
      status: string;
      totalAmount: number;
      itemCount: number;
      requestedAt: string;
    }>
  >([]);
  const [reservations, setReservations] = useState<Array<{ id: string; guestName: string; roomNumber: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");
  const [newServiceUnit, setNewServiceUnit] = useState("szt");
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [selectedReservationId, setSelectedReservationId] = useState("");
  const [basket, setBasket] = useState<Array<{ id: string; name: string; price: number; unit: string; quantity: number }>>([]);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      getLaundryServices(),
      getLaundryOrders(),
      getActiveReservationsForCharge(),
    ]).then(([sRes, oRes, rRes]) => {
      if (sRes.success && sRes.data) setServices(sRes.data);
      if (oRes.success && oRes.data) setOrders(oRes.data);
      if (rRes.success && rRes.data)
        setReservations(rRes.data.map((r) => ({ id: r.id, guestName: r.guestName, roomNumber: r.roomNumber })));
      setLoading(false);
    });
  };

  useEffect(() => load(), []);

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(newServicePrice.replace(",", "."));
    if (!newServiceName.trim()) {
      toast.error("Nazwa wymagana");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Podaj prawidłową cenę");
      return;
    }
    setSubmitting(true);
    const r = await createLaundryService(newServiceName.trim(), price, newServiceUnit);
    setSubmitting(false);
    if (r.success) {
      toast.success("Usługa dodana");
      setAddServiceOpen(false);
      setNewServiceName("");
      setNewServicePrice("");
      setNewServiceUnit("szt");
      load();
    } else toast.error(r.error);
  };

  const addToBasket = (s: ServiceRow, qty = 1) => {
    setBasket((prev) => {
      const existing = prev.find((b) => b.id === s.id);
      if (existing)
        return prev.map((b) => (b.id === s.id ? { ...b, quantity: b.quantity + qty } : b));
      return [...prev, { ...s, quantity: qty }];
    });
  };

  const removeFromBasket = (id: string) => setBasket((prev) => prev.filter((b) => b.id !== id));
  const basketTotal = basket.reduce((s, b) => s + b.price * b.quantity, 0);

  const handleCreateOrder = async () => {
    if (!selectedReservationId) {
      toast.error("Wybierz rezerwację");
      return;
    }
    if (!basket.length) {
      toast.error("Dodaj pozycje do zlecenia");
      return;
    }
    setSubmitting(true);
    const r = await createLaundryOrder(
      selectedReservationId,
      basket.map((b) => ({ laundryServiceId: b.id, quantity: b.quantity }))
    );
    setSubmitting(false);
    if (r.success) {
      toast.success("Zlecenie utworzone");
      setNewOrderOpen(false);
      setSelectedReservationId("");
      setBasket([]);
      load();
    } else toast.error(r.error);
  };

  const handleStatusChange = async (orderId: string, status: string) => {
    const r = await updateLaundryOrderStatus(orderId, status);
    if (r.success) {
      toast.success(r.data?.charged ? "Status zaktualizowany, rachunek obciążony" : "Status zaktualizowany");
      load();
    } else toast.error(r.error);
  };

  if (loading) return <p className="text-muted-foreground">Ładowanie…</p>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pralnia</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setAddServiceOpen(true)}>
            Dodaj usługę
          </Button>
          <Button size="sm" onClick={() => setNewOrderOpen(true)}>
            Nowe zlecenie
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold mb-3">Cennik usług</h2>
          {services.length === 0 ? (
            <p className="text-muted-foreground text-sm">Brak usług. Dodaj pozycje do cennika.</p>
          ) : (
            <ul className="rounded-lg border divide-y">
              {services.map((s) => (
                <li key={s.id} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm">{s.name}</span>
                  <span className="text-sm font-medium">
                    {s.price.toFixed(2)} zł / {s.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-3">Zlecenia</h2>
          {orders.length === 0 ? (
            <p className="text-muted-foreground text-sm">Brak zleceń.</p>
          ) : (
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
                      <td className="p-2">
                        {o.roomNumber} · {o.guestName}
                      </td>
                      <td className="p-2">{o.itemCount} szt.</td>
                      <td className="p-2">{o.totalAmount.toFixed(2)} zł</td>
                      <td className="p-2">{STATUS_LABELS[o.status] ?? o.status}</td>
                      <td className="p-2">{new Date(o.requestedAt).toLocaleString("pl-PL")}</td>
                      <td className="p-2">
                        {o.status !== "DELIVERED" && o.status !== "CANCELLED" && (
                          <select
                            value={o.status}
                            onChange={(e) => handleStatusChange(o.id, e.target.value)}
                            className="h-8 rounded border px-2 text-xs"
                          >
                            <option value="PENDING">Oczekujące</option>
                            <option value="PICKED_UP">Odebrane</option>
                            <option value="IN_PROGRESS">W praniu</option>
                            <option value="READY">Gotowe</option>
                            <option value="DELIVERED">Oddane (obciąż rachunek)</option>
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
      </div>

      <Sheet open={addServiceOpen} onOpenChange={setAddServiceOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Dodaj usługę pralni</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleAddService} className="mt-6 space-y-4">
            <div>
              <Label>Nazwa</Label>
              <Input
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
                placeholder="np. Pranie koszuli"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Cena (PLN)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={newServicePrice}
                onChange={(e) => setNewServicePrice(e.target.value)}
                placeholder="0.00"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Jednostka</Label>
              <select
                value={newServiceUnit}
                onChange={(e) => setNewServiceUnit(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3"
              >
                <option value="szt">szt.</option>
                <option value="kg">kg</option>
              </select>
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Zapisywanie…" : "Dodaj"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet open={newOrderOpen} onOpenChange={setNewOrderOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Nowe zlecenie pralni</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <Label>Rezerwacja (pokój · gość)</Label>
              <select
                value={selectedReservationId}
                onChange={(e) => setSelectedReservationId(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— Wybierz —</option>
                {reservations.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.roomNumber} · {r.guestName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Pozycje z cennika</Label>
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto rounded border p-2">
                {services.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>{s.name} — {s.price.toFixed(2)} zł / {s.unit}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => addToBasket(s)}
                    >
                      + Do zlecenia
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            {basket.length > 0 && (
              <>
                <div>
                  <Label>Koszyk</Label>
                  <ul className="mt-2 space-y-1 text-sm">
                    {basket.map((b) => (
                      <li key={b.id} className="flex justify-between items-center">
                        <span>
                          {b.name} × {b.quantity} = {(b.price * b.quantity).toFixed(2)} zł
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive h-7"
                          onClick={() => removeFromBasket(b.id)}
                        >
                          Usuń
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <p className="font-medium mt-2">Razem: {basketTotal.toFixed(2)} zł</p>
                </div>
                <Button
                  onClick={handleCreateOrder}
                  disabled={submitting || !selectedReservationId}
                >
                  {submitting ? "Zapisywanie…" : "Utwórz zlecenie"}
                </Button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
