"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listUsersForAdmin,
  updateUserLimits,
  createUser,
  updateUser,
  deleteUser,
  type UserListItem,
} from "@/app/actions/users";
import { toast } from "sonner";
import { Users, ArrowLeft, Save, Plus, Pencil, Trash2 } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  RECEPTION: "Recepcja",
  MANAGER: "Manager",
  HOUSEKEEPING: "Housekeeping",
  OWNER: "Właściciel",
};

const ROLES = Object.entries(ROLE_LABELS);

export default function UzytkownicyPage() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, { maxPercent: string; maxAmount: string; maxVoid: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Dialog states
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);

  // Add form
  const [addEmail, setAddEmail] = useState("");
  const [addName, setAddName] = useState("");
  const [addRole, setAddRole] = useState("RECEPTION");
  const [addPassword, setAddPassword] = useState("");

  // Edit form
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editResetPassword, setEditResetPassword] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    const result = await listUsersForAdmin();
    setLoading(false);
    if (result.success) {
      setUsers(result.data);
      setEditing({});
    } else {
      setError(result.error);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // --- Limits editing (existing) ---

  const setEdit = (userId: string, field: "maxPercent" | "maxAmount" | "maxVoid", value: string) => {
    setEditing((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: value,
      },
    }));
  };

  const getEditValues = (u: UserListItem) => {
    const e = editing[u.id];
    return {
      maxPercent: e?.maxPercent ?? (u.maxDiscountPercent != null ? String(u.maxDiscountPercent) : ""),
      maxAmount: e?.maxAmount ?? (u.maxDiscountAmount != null ? String(u.maxDiscountAmount) : ""),
      maxVoid: e?.maxVoid ?? (u.maxVoidAmount != null ? String(u.maxVoidAmount) : ""),
    };
  };

  const saveLimits = async (u: UserListItem) => {
    const { maxPercent, maxAmount, maxVoid } = getEditValues(u);
    const numPercent = maxPercent.trim() === "" ? null : parseFloat(maxPercent);
    const numAmount = maxAmount.trim() === "" ? null : parseFloat(maxAmount);
    const numVoid = maxVoid.trim() === "" ? null : parseFloat(maxVoid);
    if (numPercent != null && (Number.isNaN(numPercent) || numPercent < 0 || numPercent > 100)) {
      toast.error("Limit % musi być liczbą 0–100");
      return;
    }
    if (numAmount != null && (Number.isNaN(numAmount) || numAmount < 0)) {
      toast.error("Limit rabatu kwotowego musi być liczbą ≥ 0");
      return;
    }
    if (numVoid != null && (Number.isNaN(numVoid) || numVoid < 0)) {
      toast.error("Limit void musi być liczbą ≥ 0");
      return;
    }
    setSavingId(u.id);
    const result = await updateUserLimits(u.id, numPercent, numAmount, numVoid);
    setSavingId(null);
    if (result.success) {
      toast.success("Zapisano limity");
      setEditing((prev) => {
        const next = { ...prev };
        delete next[u.id];
        return next;
      });
      load();
    } else {
      toast.error("error" in result ? result.error : "Błąd");
    }
  };

  // --- Add user ---

  const resetAddForm = () => {
    setAddEmail("");
    setAddName("");
    setAddRole("RECEPTION");
    setAddPassword("");
  };

  const handleAdd = async () => {
    if (!addEmail.trim() || !addName.trim()) {
      toast.error("Email i imię są wymagane.");
      return;
    }
    setDialogLoading(true);
    const result = await createUser({
      email: addEmail,
      name: addName,
      role: addRole,
      password: addPassword || undefined,
    });
    setDialogLoading(false);
    if (result.success) {
      toast.success("Użytkownik utworzony");
      setAddOpen(false);
      resetAddForm();
      load();
    } else {
      toast.error("error" in result ? result.error : "Błąd");
    }
  };

  // --- Edit user ---

  const openEditDialog = (u: UserListItem) => {
    setSelectedUser(u);
    setEditName(u.name);
    setEditRole(u.role);
    setEditResetPassword("");
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!selectedUser) return;
    setDialogLoading(true);
    const result = await updateUser(selectedUser.id, {
      name: editName || undefined,
      role: editRole || undefined,
      resetPassword: editResetPassword || undefined,
    });
    setDialogLoading(false);
    if (result.success) {
      toast.success("Użytkownik zaktualizowany");
      setEditOpen(false);
      setSelectedUser(null);
      load();
    } else {
      toast.error("error" in result ? result.error : "Błąd");
    }
  };

  // --- Delete user ---

  const openDeleteDialog = (u: UserListItem) => {
    setSelectedUser(u);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    setDialogLoading(true);
    const result = await deleteUser(selectedUser.id);
    setDialogLoading(false);
    if (result.success) {
      toast.success("Użytkownik usunięty");
      setDeleteOpen(false);
      setSelectedUser(null);
      load();
    } else {
      toast.error("error" in result ? result.error : "Błąd");
    }
  };

  // --- Render ---

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-muted-foreground">Ładowanie…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-destructive">{error}</p>
        <Link href="/ustawienia">
          <Button variant="outline" className="mt-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Powrót
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Użytkownicy</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => { resetAddForm(); setAddOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Dodaj użytkownika
          </Button>
          <Link href="/ustawienia">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Powrót
            </Button>
          </Link>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Zarządzaj użytkownikami systemu PMS. Limity rabatowe: puste = domyślne z konfiguracji.
      </p>

      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Użytkownik</th>
              <th className="text-left p-3 font-medium">Rola</th>
              <th className="text-left p-3 font-medium">Max rabat %</th>
              <th className="text-left p-3 font-medium">Max rabat (PLN)</th>
              <th className="text-left p-3 font-medium">Max void (PLN)</th>
              <th className="p-3 w-36 text-right font-medium">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const { maxPercent, maxAmount, maxVoid } = getEditValues(u);
              return (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="p-3">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-muted-foreground text-xs">{u.email}</div>
                  </td>
                  <td className="p-3">{ROLE_LABELS[u.role] ?? u.role}</td>
                  <td className="p-3">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      placeholder="np. 10"
                      className="w-24"
                      value={maxPercent}
                      onChange={(e) => setEdit(u.id, "maxPercent", e.target.value)}
                    />
                  </td>
                  <td className="p-3">
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      placeholder="np. 500"
                      className="w-28"
                      value={maxAmount}
                      onChange={(e) => setEdit(u.id, "maxAmount", e.target.value)}
                    />
                  </td>
                  <td className="p-3">
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      placeholder="np. 500"
                      className="w-28"
                      value={maxVoid}
                      onChange={(e) => setEdit(u.id, "maxVoid", e.target.value)}
                    />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => saveLimits(u)}
                        disabled={savingId === u.id}
                        title="Zapisz limity"
                      >
                        {savingId === u.id ? "…" : <Save className="h-4 w-4" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditDialog(u)}
                        title="Edytuj użytkownika"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openDeleteDialog(u)}
                        title="Usuń użytkownika"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Dialog: Dodaj użytkownika */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj użytkownika</DialogTitle>
            <DialogDescription>
              Utwórz nowe konto w systemie PMS. Zostaw hasło puste, jeśli użytkownik będzie logował się tylko przez Google.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="add-email">Email</Label>
              <Input
                id="add-email"
                type="email"
                placeholder="jan.kowalski@labedzhotel.pl"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-name">Imię i nazwisko</Label>
              <Input
                id="add-name"
                placeholder="Jan Kowalski"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Rola</Label>
              <Select value={addRole} onValueChange={setAddRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-password">Hasło (opcjonalne)</Label>
              <Input
                id="add-password"
                type="password"
                placeholder="Puste = logowanie tylko przez Google"
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={handleAdd} disabled={dialogLoading}>
              {dialogLoading ? "Tworzenie…" : "Utwórz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Edytuj użytkownika */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edytuj użytkownika</DialogTitle>
            <DialogDescription>
              {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Imię i nazwisko</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Rola</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-password">Nowe hasło (opcjonalne)</Label>
              <Input
                id="edit-password"
                type="password"
                placeholder="Zostaw puste, aby nie zmieniać"
                value={editResetPassword}
                onChange={(e) => setEditResetPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={handleEdit} disabled={dialogLoading}>
              {dialogLoading ? "Zapisywanie…" : "Zapisz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Potwierdzenie usunięcia */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usunąć użytkownika?</DialogTitle>
            <DialogDescription>
              Czy na pewno chcesz usunąć konto <strong>{selectedUser?.name}</strong> ({selectedUser?.email})? Tej operacji nie można cofnąć.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Anuluj
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={dialogLoading}>
              {dialogLoading ? "Usuwanie…" : "Usuń"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
