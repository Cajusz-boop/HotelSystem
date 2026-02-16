"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  getRoomsForManagement,
  createRoom,
  updateRoomActiveForSale,
  updateRoomStatus,
  deleteRoom,
  getRoomTypes,
  ensureRoomTypes,
  getRoomGroups,
  createRoomGroup,
  updateRoomFeatures,
  updateRoom,
  connectRooms,
  disconnectRooms,
  getMaintenanceIssuesForRoom,
  createMaintenanceIssue,
  updateMaintenanceIssueStatus,
  deleteMaintenanceIssue,
  createRoomBlock,
  getRoomBlocksForRoom,
  deleteRoomBlock,
  type RoomForManagement,
  type RoomTypeForCennik,
  type InventoryItem,
  type MaintenanceIssueItem,
  type MaintenanceCategory,
  type MaintenancePriority,
  type MaintenanceStatus,
  type RoomBlockItem,
  type RoomBlockType,
} from "@/app/actions/rooms";
import { getHotelConfig } from "@/app/actions/hotel-config";
import { toast } from "sonner";
import { BedDouble, Plus, Ban, CheckCircle, Trash2, Pencil, X, Tag, Settings2, ImageIcon, ClipboardList, Minus, Link2, Unlink, Wrench, Clock, CheckCircle2 } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  CLEAN: "Czysty",
  DIRTY: "Do sprzątania",
  OOO: "OOO",
  INSPECTION: "Do sprawdzenia",
  INSPECTED: "Sprawdzony",
  CHECKOUT_PENDING: "Oczekuje wymeldowania",
  MAINTENANCE: "Do naprawy",
};

export default function PokojePage() {
  const [rooms, setRooms] = useState<RoomForManagement[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomTypeForCennik[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNumber, setNewNumber] = useState("");
  const [newType, setNewType] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newBeds, setNewBeds] = useState("1");
  const [adding, setAdding] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [roomGroups, setRoomGroups] = useState<Array<{ id: string; name: string; roomNumbers: string[] }>>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupRooms, setNewGroupRooms] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);
  
  // Edycja cech pokoju
  const [editingRoom, setEditingRoom] = useState<RoomForManagement | null>(null);
  const [editedFeatures, setEditedFeatures] = useState<string[]>([]);
  const [newFeatureInput, setNewFeatureInput] = useState("");
  const [savingFeatures, setSavingFeatures] = useState(false);

  // Edycja szczegółów pokoju (metraż, piętro, budynek, widok, ekspozycja, max osób, opis)
  const [editingDetails, setEditingDetails] = useState<RoomForManagement | null>(null);
  const [editedSurfaceArea, setEditedSurfaceArea] = useState("");
  const [editedFloor, setEditedFloor] = useState("");
  const [editedBuilding, setEditedBuilding] = useState("");
  const [editedView, setEditedView] = useState("");
  const [editedExposure, setEditedExposure] = useState("");
  const [editedMaxOccupancy, setEditedMaxOccupancy] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [editedTechnicalNotes, setEditedTechnicalNotes] = useState("");
  const [editedNextServiceDate, setEditedNextServiceDate] = useState("");
  const [editedNextServiceNote, setEditedNextServiceNote] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);

  // Edycja typów łóżek
  const [editedBedTypes, setEditedBedTypes] = useState<string[]>([]);

  // Edycja wyposażenia (amenities)
  const [editedAmenities, setEditedAmenities] = useState<string[]>([]);

  // Edycja zdjęć pokoju
  const [editingPhotos, setEditingPhotos] = useState<RoomForManagement | null>(null);
  const [editedPhotos, setEditedPhotos] = useState<string[]>([]);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [savingPhotos, setSavingPhotos] = useState(false);

  // Inwentaryzacja wyposażenia
  const [editingInventory, setEditingInventory] = useState<RoomForManagement | null>(null);
  const [editedInventory, setEditedInventory] = useState<InventoryItem[]>([]);
  const [newInventoryItem, setNewInventoryItem] = useState("");
  const [newInventoryCount, setNewInventoryCount] = useState("1");
  const [savingInventory, setSavingInventory] = useState(false);

  // Połączone pokoje
  const [editingConnections, setEditingConnections] = useState<RoomForManagement | null>(null);
  const [selectedRoomToConnect, setSelectedRoomToConnect] = useState("");
  const [connectingRooms, setConnectingRooms] = useState(false);

  // Historia usterek/awarii
  const [maintenanceRoom, setMaintenanceRoom] = useState<RoomForManagement | null>(null);
  const [maintenanceIssues, setMaintenanceIssues] = useState<MaintenanceIssueItem[]>([]);
  const [loadingMaintenance, setLoadingMaintenance] = useState(false);
  const [showNewIssueForm, setShowNewIssueForm] = useState(false);
  const [newIssueTitle, setNewIssueTitle] = useState("");
  const [newIssueDescription, setNewIssueDescription] = useState("");
  const [newIssueCategory, setNewIssueCategory] = useState<MaintenanceCategory>("OTHER");
  const [newIssuePriority, setNewIssuePriority] = useState<MaintenancePriority>("MEDIUM");
  const [newIssueSetOOO, setNewIssueSetOOO] = useState(false);
  const [newIssueIsScheduled, setNewIssueIsScheduled] = useState(false);
  const [newIssueStartDate, setNewIssueStartDate] = useState("");
  const [newIssueEndDate, setNewIssueEndDate] = useState("");
  const [savingIssue, setSavingIssue] = useState(false);

  // Blokady pokoi (remont, konserwacja)
  const [blocksRoom, setBlocksRoom] = useState<RoomForManagement | null>(null);
  const [roomBlocks, setRoomBlocks] = useState<RoomBlockItem[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [showNewBlockForm, setShowNewBlockForm] = useState(false);
  const [newBlockStartDate, setNewBlockStartDate] = useState("");
  const [newBlockEndDate, setNewBlockEndDate] = useState("");
  const [newBlockReason, setNewBlockReason] = useState("");
  const [newBlockType, setNewBlockType] = useState<RoomBlockType>("RENOVATION");
  const [savingBlock, setSavingBlock] = useState(false);

  // ── Inline editing w tabeli ──
  const [inlineEditCell, setInlineEditCell] = useState<{ roomId: string; field: string } | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState<string>("");

  const startInlineEdit = (room: RoomForManagement, field: string) => {
    let val = "";
    switch (field) {
      case "number": val = room.number; break;
      case "type": val = room.type; break;
      case "status": val = room.status; break;
      case "price": val = room.price != null ? String(room.price) : ""; break;
      case "surfaceArea": val = room.surfaceArea != null ? String(room.surfaceArea) : ""; break;
      case "floor": val = room.floor ?? ""; break;
      case "building": val = room.building ?? ""; break;
      case "view": val = room.view ?? ""; break;
      case "maxOccupancy": val = String(room.maxOccupancy ?? 2); break;
    }
    setInlineEditCell({ roomId: room.id, field });
    setInlineEditValue(val);
  };

  const cancelInlineEdit = () => {
    setInlineEditCell(null);
    setInlineEditValue("");
  };

  const saveInlineEdit = async () => {
    if (!inlineEditCell) return;
    const { roomId, field } = inlineEditCell;
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;

    const data: Record<string, unknown> = {};
    const v = inlineEditValue.trim();

    switch (field) {
      case "number": if (v === room.number || !v) { cancelInlineEdit(); return; } data.number = v; break;
      case "type": if (v === room.type || !v) { cancelInlineEdit(); return; } data.type = v; break;
      case "status": {
        if (v === room.status) { cancelInlineEdit(); return; }
        const statusResult = await updateRoomStatus({ roomId, status: v as "CLEAN" | "DIRTY" | "OOO" | "INSPECTION" | "INSPECTED" | "CHECKOUT_PENDING" | "MAINTENANCE" });
        if (statusResult.success) {
          setRooms((prev) => prev.map((rm) => rm.id === roomId ? { ...rm, status: v } : rm));
          toast.success("Status zaktualizowany");
        } else {
          toast.error(statusResult.error ?? "Błąd zmiany statusu");
        }
        cancelInlineEdit();
        return;
      }
      case "price": {
        const num = v ? parseFloat(v) : null;
        if (num === room.price) { cancelInlineEdit(); return; }
        data.price = num;
        break;
      }
      case "surfaceArea": {
        const num = v ? parseFloat(v) : null;
        if (num === room.surfaceArea) { cancelInlineEdit(); return; }
        data.surfaceArea = num;
        break;
      }
      case "floor": if (v === (room.floor ?? "")) { cancelInlineEdit(); return; } data.floor = v || null; break;
      case "building": if (v === (room.building ?? "")) { cancelInlineEdit(); return; } data.building = v || null; break;
      case "view": if (v === (room.view ?? "")) { cancelInlineEdit(); return; } data.view = v || null; break;
      case "maxOccupancy": {
        const num = v ? parseInt(v, 10) : 2;
        if (num === room.maxOccupancy) { cancelInlineEdit(); return; }
        data.maxOccupancy = num;
        break;
      }
      default: cancelInlineEdit(); return;
    }

    const result = await updateRoom(roomId, data as Parameters<typeof updateRoom>[1]);
    if (result.success && result.data) {
      setRooms((prev) => prev.map((r) => (r.id === roomId ? result.data! : r)));
      toast.success("Zapisano");
    } else {
      toast.error("error" in result ? (result.error ?? "Błąd zapisu") : "Błąd zapisu");
    }
    cancelInlineEdit();
  };

  const handleInlineKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); saveInlineEdit(); }
    if (e.key === "Escape") { cancelInlineEdit(); }
  };

  const isEditing = (roomId: string, field: string) =>
    inlineEditCell?.roomId === roomId && inlineEditCell?.field === field;

  // Piętra z konfiguracji hotelu
  const [floorOptions, setFloorOptions] = useState<string[]>([]);

  // Predefiniowane opcje
  const viewOptions = ["", "morze", "góry", "miasto", "parking", "ogród", "basen", "las", "jezioro", "dziedziniec"];
  const exposureOptions = ["", "północ", "południe", "wschód", "zachód", "północny-wschód", "północny-zachód", "południowy-wschód", "południowy-zachód"];
  const bedTypeOptions = ["double", "twin", "single", "king", "queen", "sofa-bed", "bunk"];
  const amenityOptions = ["TV", "minibar", "klimatyzacja", "sejf", "WiFi", "balkon", "wanna", "prysznic", "suszarka", "czajnik", "ekspres do kawy", "lodówka", "żelazko"];
  const inventoryItemSuggestions = ["ręcznik duży", "ręcznik mały", "ręcznik do twarzy", "poduszka", "kołdra", "prześcieradło", "poszewka", "narzuta", "wieszak", "szlafrok", "kapcie", "mydło", "szampon", "żel pod prysznic", "papier toaletowy", "chusteczki", "kubek", "szklanka", "talerz", "sztućce"];

  // Typy blokad pokoi
  const blockTypeOptions: { value: RoomBlockType; label: string }[] = [
    { value: "RENOVATION", label: "Remont" },
    { value: "MAINTENANCE", label: "Konserwacja" },
    { value: "VIP_HOLD", label: "Rezerwacja VIP" },
    { value: "OVERBOOKING", label: "Overbooking" },
    { value: "OTHER", label: "Inne" },
  ];

  // Kategorie i priorytety usterek
  const maintenanceCategoryOptions: { value: MaintenanceCategory; label: string }[] = [
    { value: "ELECTRICAL", label: "Elektryka" },
    { value: "PLUMBING", label: "Hydraulika" },
    { value: "HVAC", label: "Klimatyzacja/Wentylacja" },
    { value: "FURNITURE", label: "Meble" },
    { value: "CLEANING", label: "Czystość" },
    { value: "APPLIANCE", label: "Urządzenia" },
    { value: "OTHER", label: "Inne" },
  ];
  const maintenancePriorityOptions: { value: MaintenancePriority; label: string; color: string }[] = [
    { value: "URGENT", label: "Pilne", color: "text-red-600" },
    { value: "HIGH", label: "Wysoki", color: "text-orange-600" },
    { value: "MEDIUM", label: "Średni", color: "text-yellow-600" },
    { value: "LOW", label: "Niski", color: "text-gray-600" },
  ];
  const maintenanceStatusLabels: Record<MaintenanceStatus, string> = {
    REPORTED: "Zgłoszone",
    IN_PROGRESS: "W realizacji",
    ON_HOLD: "Wstrzymane",
    RESOLVED: "Rozwiązane",
    CANCELLED: "Anulowane",
  };

  // Obsługa edycji zdjęć pokoju
  const openPhotosDialog = (room: RoomForManagement) => {
    setEditingPhotos(room);
    setEditedPhotos([...room.photos]);
    setNewPhotoUrl("");
  };

  const closePhotosDialog = () => {
    setEditingPhotos(null);
    setEditedPhotos([]);
    setNewPhotoUrl("");
  };

  const addPhotoUrl = () => {
    const url = newPhotoUrl.trim();
    if (!url) return;
    if (editedPhotos.includes(url)) {
      toast.error("Ten URL już istnieje.");
      return;
    }
    setEditedPhotos((prev) => [...prev, url]);
    setNewPhotoUrl("");
  };

  const removePhoto = (url: string) => {
    setEditedPhotos((prev) => prev.filter((p) => p !== url));
  };

  const handleSavePhotos = async () => {
    if (!editingPhotos) return;
    setSavingPhotos(true);
    const result = await updateRoom(editingPhotos.id, { photos: editedPhotos });
    setSavingPhotos(false);
    if (result.success) {
      setRooms((prev) =>
        prev.map((r) =>
          r.id === editingPhotos.id ? { ...r, photos: editedPhotos } : r
        )
      );
      toast.success(`Zaktualizowano zdjęcia pokoju ${editingPhotos.number}`);
      closePhotosDialog();
    } else {
      toast.error("error" in result ? (result.error ?? "Błąd zapisu") : "Błąd zapisu");
    }
  };

  // Obsługa inwentaryzacji
  const openInventoryDialog = (room: RoomForManagement) => {
    setEditingInventory(room);
    setEditedInventory([...room.inventory]);
    setNewInventoryItem("");
    setNewInventoryCount("1");
  };

  const closeInventoryDialog = () => {
    setEditingInventory(null);
    setEditedInventory([]);
    setNewInventoryItem("");
    setNewInventoryCount("1");
  };

  const addInventoryItem = () => {
    const itemName = newInventoryItem.trim();
    const count = parseInt(newInventoryCount, 10);
    if (!itemName) {
      toast.error("Wpisz nazwę przedmiotu.");
      return;
    }
    if (isNaN(count) || count < 1) {
      toast.error("Ilość musi być liczbą dodatnią.");
      return;
    }
    // Sprawdź czy już istnieje - jeśli tak, zwiększ ilość
    const existingIdx = editedInventory.findIndex((i) => i.item.toLowerCase() === itemName.toLowerCase());
    if (existingIdx >= 0) {
      setEditedInventory((prev) =>
        prev.map((inv, idx) =>
          idx === existingIdx ? { ...inv, count: inv.count + count } : inv
        )
      );
    } else {
      setEditedInventory((prev) => [...prev, { item: itemName, count }]);
    }
    setNewInventoryItem("");
    setNewInventoryCount("1");
  };

  const updateInventoryItemCount = (item: string, delta: number) => {
    setEditedInventory((prev) =>
      prev.map((inv) =>
        inv.item === item ? { ...inv, count: Math.max(0, inv.count + delta) } : inv
      ).filter((inv) => inv.count > 0)
    );
  };

  const removeInventoryItem = (item: string) => {
    setEditedInventory((prev) => prev.filter((inv) => inv.item !== item));
  };

  const handleSaveInventory = async () => {
    if (!editingInventory) return;
    setSavingInventory(true);
    const result = await updateRoom(editingInventory.id, { inventory: editedInventory });
    setSavingInventory(false);
    if (result.success) {
      setRooms((prev) =>
        prev.map((r) =>
          r.id === editingInventory.id ? { ...r, inventory: editedInventory } : r
        )
      );
      toast.success(`Zaktualizowano inwentaryzację pokoju ${editingInventory.number}`);
      closeInventoryDialog();
    } else {
      toast.error("error" in result ? (result.error ?? "Błąd zapisu") : "Błąd zapisu");
    }
  };

  // Obsługa połączonych pokoi
  const openConnectionsDialog = (room: RoomForManagement) => {
    setEditingConnections(room);
    setSelectedRoomToConnect("");
  };

  const closeConnectionsDialog = () => {
    setEditingConnections(null);
    setSelectedRoomToConnect("");
  };

  const handleConnectRoom = async () => {
    if (!editingConnections || !selectedRoomToConnect) return;
    setConnectingRooms(true);
    const result = await connectRooms(editingConnections.number, selectedRoomToConnect);
    setConnectingRooms(false);
    if (result.success) {
      // Aktualizuj lokalny stan dla obu pokoi
      setRooms((prev) =>
        prev.map((r) => {
          if (r.number === editingConnections.number) {
            return { ...r, connectedRooms: [...r.connectedRooms, selectedRoomToConnect] };
          }
          if (r.number === selectedRoomToConnect) {
            return { ...r, connectedRooms: [...r.connectedRooms, editingConnections.number] };
          }
          return r;
        })
      );
      // Zaktualizuj również editingConnections
      setEditingConnections((prev) =>
        prev ? { ...prev, connectedRooms: [...prev.connectedRooms, selectedRoomToConnect] } : null
      );
      toast.success(`Połączono pokoje ${editingConnections.number} i ${selectedRoomToConnect}`);
      setSelectedRoomToConnect("");
    } else {
      toast.error(result.error ?? "Błąd łączenia pokoi");
    }
  };

  const handleDisconnectRoom = async (targetRoomNumber: string) => {
    if (!editingConnections) return;
    setConnectingRooms(true);
    const result = await disconnectRooms(editingConnections.number, targetRoomNumber);
    setConnectingRooms(false);
    if (result.success) {
      // Aktualizuj lokalny stan dla obu pokoi
      setRooms((prev) =>
        prev.map((r) => {
          if (r.number === editingConnections.number) {
            return { ...r, connectedRooms: r.connectedRooms.filter((n) => n !== targetRoomNumber) };
          }
          if (r.number === targetRoomNumber) {
            return { ...r, connectedRooms: r.connectedRooms.filter((n) => n !== editingConnections.number) };
          }
          return r;
        })
      );
      // Zaktualizuj również editingConnections
      setEditingConnections((prev) =>
        prev ? { ...prev, connectedRooms: prev.connectedRooms.filter((n) => n !== targetRoomNumber) } : null
      );
      toast.success(`Rozłączono pokoje ${editingConnections.number} i ${targetRoomNumber}`);
    } else {
      toast.error(result.error ?? "Błąd rozłączania pokoi");
    }
  };

  // Obsługa historii usterek/awarii
  const openMaintenanceDialog = async (room: RoomForManagement) => {
    setMaintenanceRoom(room);
    setLoadingMaintenance(true);
    setMaintenanceIssues([]);
    setShowNewIssueForm(false);
    resetNewIssueForm();

    const result = await getMaintenanceIssuesForRoom(room.id);
    setLoadingMaintenance(false);
    if (result.success) {
      setMaintenanceIssues(result.data);
    } else {
      toast.error(result.error ?? "Błąd pobierania historii usterek");
    }
  };

  const closeMaintenanceDialog = () => {
    setMaintenanceRoom(null);
    setMaintenanceIssues([]);
    setShowNewIssueForm(false);
    resetNewIssueForm();
  };

  const resetNewIssueForm = () => {
    setNewIssueTitle("");
    setNewIssueDescription("");
    setNewIssueCategory("OTHER");
    setNewIssuePriority("MEDIUM");
    setNewIssueSetOOO(false);
    setNewIssueIsScheduled(false);
    setNewIssueStartDate("");
    setNewIssueEndDate("");
  };

  const handleCreateMaintenanceIssue = async () => {
    if (!maintenanceRoom) return;
    if (!newIssueTitle.trim()) {
      toast.error("Wprowadź tytuł usterki.");
      return;
    }
    setSavingIssue(true);
    const result = await createMaintenanceIssue({
      roomId: maintenanceRoom.id,
      title: newIssueTitle.trim(),
      description: newIssueDescription.trim() || undefined,
      category: newIssueCategory,
      priority: newIssuePriority,
      setRoomOOO: newIssueSetOOO,
      isScheduled: newIssueIsScheduled,
      scheduledStartDate: newIssueIsScheduled ? newIssueStartDate : undefined,
      scheduledEndDate: newIssueIsScheduled ? newIssueEndDate : undefined,
    });
    setSavingIssue(false);
    if (result.success) {
      setMaintenanceIssues((prev) => [result.data, ...prev]);
      if (newIssueSetOOO) {
        // Aktualizuj status pokoju lokalnie
        setRooms((prev) =>
          prev.map((r) =>
            r.id === maintenanceRoom.id ? { ...r, status: "OOO", reason: newIssueTitle.trim() } : r
          )
        );
      }
      toast.success("Zgłoszono usterkę");
      setShowNewIssueForm(false);
      resetNewIssueForm();
    } else {
      toast.error(result.error ?? "Błąd zgłaszania usterki");
    }
  };

  const handleUpdateIssueStatus = async (issueId: string, newStatus: MaintenanceStatus) => {
    const result = await updateMaintenanceIssueStatus(issueId, newStatus, {
      restoreRoomStatus: newStatus === "RESOLVED" ? "DIRTY" : undefined,
    });
    if (result.success) {
      setMaintenanceIssues((prev) =>
        prev.map((i) =>
          i.id === issueId
            ? {
                ...i,
                status: newStatus,
                resolvedAt: newStatus === "RESOLVED" || newStatus === "CANCELLED" ? new Date().toISOString() : i.resolvedAt,
              }
            : i
        )
      );
      // Jeśli zamknięto usterkę która ustawiła OOO, przywróć status pokoju
      const issue = maintenanceIssues.find((i) => i.id === issueId);
      if (
        issue?.roomWasOOO &&
        (newStatus === "RESOLVED" || newStatus === "CANCELLED") &&
        maintenanceRoom
      ) {
        setRooms((prev) =>
          prev.map((r) =>
            r.id === maintenanceRoom.id && r.status === "OOO"
              ? { ...r, status: "DIRTY", reason: undefined }
              : r
          )
        );
      }
      toast.success(`Status usterki zmieniony na: ${maintenanceStatusLabels[newStatus]}`);
    } else {
      toast.error(result.error ?? "Błąd zmiany statusu usterki");
    }
  };

  const handleDeleteIssue = async (issueId: string) => {
    if (!confirm("Czy na pewno chcesz usunąć tę usterkę?")) return;
    const result = await deleteMaintenanceIssue(issueId);
    if (result.success) {
      setMaintenanceIssues((prev) => prev.filter((i) => i.id !== issueId));
      toast.success("Usunięto zgłoszenie usterki");
    } else {
      toast.error(result.error ?? "Błąd usuwania usterki");
    }
  };

  // Obsługa blokad pokoi
  const openBlocksDialog = async (room: RoomForManagement) => {
    setBlocksRoom(room);
    setLoadingBlocks(true);
    setRoomBlocks([]);
    setShowNewBlockForm(false);
    resetNewBlockForm();

    const result = await getRoomBlocksForRoom(room.id);
    setLoadingBlocks(false);
    if (result.success) {
      setRoomBlocks(result.data);
    } else {
      toast.error(result.error ?? "Błąd pobierania blokad");
    }
  };

  const closeBlocksDialog = () => {
    setBlocksRoom(null);
    setRoomBlocks([]);
    setShowNewBlockForm(false);
    resetNewBlockForm();
  };

  const resetNewBlockForm = () => {
    setNewBlockStartDate("");
    setNewBlockEndDate("");
    setNewBlockReason("");
    setNewBlockType("RENOVATION");
  };

  const handleCreateBlock = async () => {
    if (!blocksRoom) return;
    if (!newBlockStartDate || !newBlockEndDate) {
      toast.error("Wprowadź daty blokady.");
      return;
    }
    if (new Date(newBlockEndDate) < new Date(newBlockStartDate)) {
      toast.error("Data zakończenia nie może być wcześniejsza niż data rozpoczęcia.");
      return;
    }
    setSavingBlock(true);
    const result = await createRoomBlock({
      roomNumber: blocksRoom.number,
      startDate: newBlockStartDate,
      endDate: newBlockEndDate,
      reason: newBlockReason.trim() || undefined,
      blockType: newBlockType,
    });
    setSavingBlock(false);
    if (result.success) {
      // Odśwież listę blokad
      const refreshResult = await getRoomBlocksForRoom(blocksRoom.id);
      if (refreshResult.success) {
        setRoomBlocks(refreshResult.data);
      }
      toast.success("Dodano blokadę pokoju");
      setShowNewBlockForm(false);
      resetNewBlockForm();
    } else {
      toast.error(result.error ?? "Błąd tworzenia blokady");
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    if (!confirm("Czy na pewno chcesz usunąć tę blokadę?")) return;
    const result = await deleteRoomBlock(blockId);
    if (result.success) {
      setRoomBlocks((prev) => prev.filter((b) => b.id !== blockId));
      toast.success("Usunięto blokadę pokoju");
    } else {
      toast.error(result.error ?? "Błąd usuwania blokady");
    }
  };

  const numericSort = (a: { number: string }, b: { number: string }) => {
    const na = parseInt(a.number, 10);
    const nb = parseInt(b.number, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    if (!isNaN(na)) return -1;
    if (!isNaN(nb)) return 1;
    return a.number.localeCompare(b.number, "pl");
  };

  const queryClient = useQueryClient();

  const { data: _initialData, isLoading: queryLoading } = useQuery({
    queryKey: ["pokoje-initial"],
    queryFn: async () => {
      await ensureRoomTypes();
      const [roomsRes, typesRes, configRes, groupsRes] = await Promise.all([
        getRoomsForManagement(),
        getRoomTypes(),
        getHotelConfig(),
        getRoomGroups(),
      ]);
      return { roomsRes, typesRes, configRes, groupsRes };
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!_initialData) return;
    const { roomsRes, typesRes, configRes, groupsRes } = _initialData;
    const loadedRooms = roomsRes.success && roomsRes.data ? roomsRes.data : [];
    if (roomsRes.success && roomsRes.data) setRooms([...loadedRooms].sort(numericSort));
    else if (!roomsRes.success) toast.error(roomsRes.error);
    if (typesRes.success && typesRes.data) setRoomTypes(typesRes.data);
    if (groupsRes.success && groupsRes.data) setRoomGroups(groupsRes.data);
    const configFloors = configRes.success ? (configRes.data.floors ?? []) : [];
    const usedFloors = [...new Set(loadedRooms.map((r) => r.floor).filter(Boolean))] as string[];
    setFloorOptions([...new Set([...configFloors, ...usedFloors])]);
    setLoading(false);
  }, [_initialData]);

  const load = useCallback(async () => {
    queryClient.invalidateQueries({ queryKey: ["pokoje-initial"] });
  }, [queryClient]);

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = newNumber.trim();
    const typ = newType.trim();
    if (!num || !typ) {
      toast.error("Wpisz numer i wybierz typ pokoju.");
      return;
    }
    setAdding(true);
    const result = await createRoom({
      number: num,
      type: typ,
      price: newPrice.trim() ? Number(newPrice) : undefined,
      beds: newBeds.trim() ? parseInt(newBeds, 10) : undefined,
    });
    setAdding(false);
    if (result.success && result.data) {
      setRooms((prev) => [...prev, result.data!].sort(numericSort));
      setNewNumber("");
      setNewType("");
      setNewPrice("");
      setNewBeds("1");
      getRoomTypes().then((r) => r.success && r.data && setRoomTypes(r.data));
      toast.success(`Dodano pokój ${result.data.number}`);
    } else {
      toast.error("error" in result ? result.error : "Błąd");
    }
  };

  const handleToggleForSale = async (room: RoomForManagement) => {
    setTogglingId(room.id);
    const result = await updateRoomActiveForSale(room.id, !room.activeForSale);
    setTogglingId(null);
    if (result.success) {
      setRooms((prev) =>
        prev.map((r) =>
          r.id === room.id ? { ...r, activeForSale: !r.activeForSale } : r
        )
      );
      toast.success(
        room.activeForSale
          ? "Pokój wycofany ze sprzedaży"
          : "Pokój przywrócony do sprzedaży"
      );
    } else {
      toast.error("error" in result ? result.error : "Błąd");
    }
  };

  const handleDelete = async (room: RoomForManagement) => {
    if (!confirm(`Czy na pewno usunąć pokój ${room.number}? Operacja możliwa tylko gdy brak rezerwacji.`)) return;
    setDeletingId(room.id);
    const result = await deleteRoom(room.id);
    setDeletingId(null);
    if (result.success) {
      setRooms((prev) => prev.filter((r) => r.id !== room.id));
      toast.success(`Usunięto pokój ${room.number}`);
    } else {
      toast.error("error" in result ? result.error : "Błąd");
    }
  };

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newGroupName.trim();
    const numbers = newGroupRooms.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    if (!name || numbers.length < 2) {
      toast.error("Nazwa i co najmniej 2 numery pokoi (po przecinku) wymagane.");
      return;
    }
    setAddingGroup(true);
    const result = await createRoomGroup(name, numbers);
    setAddingGroup(false);
    if (result.success && result.data) {
      setRoomGroups((prev) => [...prev, result.data!]);
      setNewGroupName("");
      setNewGroupRooms("");
      toast.success(`Dodano grupę "${result.data.name}" (${result.data.roomNumbers.join(", ")})`);
    } else {
      toast.error(result.success ? undefined : result.error);
    }
  };

  // Obsługa edycji cech pokoju
  const openFeaturesDialog = (room: RoomForManagement) => {
    setEditingRoom(room);
    setEditedFeatures([...room.roomFeatures]);
    setNewFeatureInput("");
  };

  const closeFeaturesDialog = () => {
    setEditingRoom(null);
    setEditedFeatures([]);
    setNewFeatureInput("");
  };

  const addFeature = () => {
    const feature = newFeatureInput.trim().toLowerCase();
    if (!feature) return;
    if (editedFeatures.includes(feature)) {
      toast.error("Ta cecha już istnieje.");
      return;
    }
    setEditedFeatures((prev) => [...prev, feature]);
    setNewFeatureInput("");
  };

  const removeFeature = (feature: string) => {
    setEditedFeatures((prev) => prev.filter((f) => f !== feature));
  };

  const handleSaveFeatures = async () => {
    if (!editingRoom) return;
    setSavingFeatures(true);
    const result = await updateRoomFeatures(editingRoom.id, editedFeatures);
    setSavingFeatures(false);
    if (result.success) {
      setRooms((prev) =>
        prev.map((r) =>
          r.id === editingRoom.id ? { ...r, roomFeatures: editedFeatures } : r
        )
      );
      toast.success(`Zaktualizowano cechy pokoju ${editingRoom.number}`);
      closeFeaturesDialog();
    } else {
      toast.error(result.error ?? "Błąd zapisu cech");
    }
  };

  const handleKeyDownFeature = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addFeature();
    }
  };

  // Obsługa edycji szczegółów pokoju (metraż, piętro, budynek, widok, ekspozycja, typy łóżek, amenities, max osób, opis)
  const openDetailsDialog = (room: RoomForManagement) => {
    setEditingDetails(room);
    setEditedSurfaceArea(room.surfaceArea != null ? String(room.surfaceArea) : "");
    setEditedFloor(room.floor ?? "");
    setEditedBuilding(room.building ?? "");
    setEditedView(room.view ?? "");
    setEditedExposure(room.exposure ?? "");
    setEditedBedTypes([...room.bedTypes]);
    setEditedAmenities([...room.amenities]);
    setEditedMaxOccupancy(String(room.maxOccupancy));
    setEditedDescription(room.description ?? "");
    setEditedTechnicalNotes(room.technicalNotes ?? "");
    setEditedNextServiceDate(room.nextServiceDate ?? "");
    setEditedNextServiceNote(room.nextServiceNote ?? "");
  };

  const closeDetailsDialog = () => {
    setEditingDetails(null);
    setEditedSurfaceArea("");
    setEditedFloor("");
    setEditedBuilding("");
    setEditedView("");
    setEditedExposure("");
    setEditedBedTypes([]);
    setEditedAmenities([]);
    setEditedMaxOccupancy("");
    setEditedDescription("");
    setEditedTechnicalNotes("");
    setEditedNextServiceDate("");
    setEditedNextServiceNote("");
  };

  const handleSaveDetails = async () => {
    if (!editingDetails) return;

    const surfaceArea = editedSurfaceArea.trim() ? Number(editedSurfaceArea) : null;
    const floor = editedFloor.trim() || null;
    const building = editedBuilding.trim() || null;
    const view = editedView.trim() || null;
    const exposure = editedExposure.trim() || null;
    const bedTypes = editedBedTypes;
    const amenities = editedAmenities;
    const maxOccupancy = editedMaxOccupancy.trim() ? parseInt(editedMaxOccupancy, 10) : 2;
    const description = editedDescription.trim() || null;
    const technicalNotes = editedTechnicalNotes.trim() || null;
    const nextServiceDate = editedNextServiceDate.trim() || null;
    const nextServiceNote = editedNextServiceNote.trim() || null;

    // Walidacja
    if (surfaceArea != null && (isNaN(surfaceArea) || surfaceArea < 0)) {
      toast.error("Metraż musi być liczbą dodatnią.");
      return;
    }
    if (isNaN(maxOccupancy) || maxOccupancy < 1) {
      toast.error("Maksymalna liczba osób musi być co najmniej 1.");
      return;
    }

    setSavingDetails(true);
    const result = await updateRoom(editingDetails.id, {
      surfaceArea,
      floor,
      building,
      view,
      exposure,
      bedTypes,
      amenities,
      maxOccupancy,
      description,
      technicalNotes,
      nextServiceDate,
      nextServiceNote,
    });
    setSavingDetails(false);

    if (result.success && result.data) {
      setRooms((prev) =>
        prev.map((r) =>
          r.id === editingDetails.id
            ? { ...r, surfaceArea, floor, building, view, exposure, bedTypes, amenities, maxOccupancy, description, technicalNotes, nextServiceDate, nextServiceNote }
            : r
        )
      );
      toast.success(`Zaktualizowano szczegóły pokoju ${editingDetails.number}`);
      closeDetailsDialog();
    } else {
      toast.error("error" in result ? (result.error ?? "Błąd zapisu") : "Błąd zapisu");
    }
  };

  // Predefiniowane cechy do podpowiedzi
  const suggestedFeatures = ["balkon", "widok", "klimatyzacja", "sejf", "minibar", "wifi", "wanna", "prysznic", "tv", "taras"];
  const availableSuggestions = suggestedFeatures.filter(
    (f) => !editedFeatures.includes(f)
  );

  return (
    <div className="flex flex-col gap-6 p-6 pl-[13rem]">
      <div className="flex items-center gap-2">
        <BedDouble className="h-8 w-8" />
        <h1 className="text-2xl font-semibold">Pokoje – zarządzanie</h1>
      </div>
      <p className="text-muted-foreground text-sm">
        Dodawaj pokoje, wycofuj lub przywracaj je do sprzedaży. Pokoje wycofane nie pojawiają się na grafiku ani w dostępności do rezerwacji.
      </p>

      {/* Formularz: nowy pokój */}
      <form
        onSubmit={handleAddRoom}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4"
      >
        <div className="grid w-full max-w-xs gap-2">
          <Label htmlFor="new-number">Numer pokoju</Label>
          <Input
            id="new-number"
            value={newNumber}
            onChange={(e) => setNewNumber(e.target.value)}
            placeholder="np. 101"
            maxLength={20}
          />
        </div>
        <div className="grid w-full max-w-xs gap-2">
          <Label htmlFor="new-type">Typ pokoju</Label>
          {roomTypes.length > 0 ? (
            <select
              id="new-type"
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="">— wybierz —</option>
              {roomTypes.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          ) : (
            <Input
              id="new-type"
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              placeholder="np. Standard, Suite"
              maxLength={50}
            />
          )}
        </div>
        <div className="grid w-full max-w-[120px] gap-2">
          <Label htmlFor="new-price">Cena (opc.)</Label>
          <Input
            id="new-price"
            type="number"
            min={0}
            step={0.01}
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            placeholder="—"
          />
        </div>
        <div className="grid w-full max-w-[80px] gap-2">
          <Label htmlFor="new-beds">Łóżek</Label>
          <Input
            id="new-beds"
            type="number"
            min={1}
            max={50}
            value={newBeds}
            onChange={(e) => setNewBeds(e.target.value)}
            title="1 = cały pokój, &gt;1 = sprzedaż po łóżku (dorm)"
          />
        </div>
        <Button type="submit" disabled={adding}>
          <Plus className="mr-2 h-4 w-4" />
          {adding ? "Dodawanie…" : "Dodaj pokój"}
        </Button>
      </form>

      {/* Lista pokoi */}
      <div className="rounded-lg border border-border bg-card">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Ładowanie…</div>
        ) : rooms.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Brak pokoi. Dodaj pierwszy pokój powyżej.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Numer</th>
                  <th className="px-4 py-3 text-left font-medium">Typ</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Cena</th>
                  <th className="px-4 py-3 text-left font-medium">Metraż</th>
                  <th className="px-4 py-3 text-left font-medium">Piętro</th>
                  <th className="px-4 py-3 text-left font-medium">Budynek</th>
                  <th className="px-4 py-3 text-left font-medium">Widok</th>
                  <th className="px-4 py-3 text-left font-medium">Wyposażenie</th>
                  <th className="px-4 py-3 text-left font-medium">Zdjęcia</th>
                  <th className="px-4 py-3 text-left font-medium">Inwentarz</th>
                  <th className="px-4 py-3 text-left font-medium">Połączone</th>
                  <th className="px-4 py-3 text-left font-medium">Usterki</th>
                  <th className="px-4 py-3 text-left font-medium">Blokady</th>
                  <th className="px-4 py-3 text-left font-medium">Serwis</th>
                  <th className="px-4 py-3 text-left font-medium">Max osób</th>
                  <th className="px-4 py-3 text-left font-medium">Cechy</th>
                  <th className="px-4 py-3 text-left font-medium">Do sprzedaży</th>
                  <th className="px-4 py-3 text-right font-medium">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((r) => (
                  <tr key={r.id} className="border-b border-border">
                    {/* Numer */}
                    <td className="px-4 py-3 font-medium">
                      {isEditing(r.id, "number") ? (
                        <Input
                          autoFocus
                          value={inlineEditValue}
                          onChange={(e) => setInlineEditValue(e.target.value)}
                          onBlur={saveInlineEdit}
                          onKeyDown={handleInlineKeyDown}
                          className="h-7 w-20 text-sm"
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:underline decoration-dashed underline-offset-4"
                          onClick={() => startInlineEdit(r, "number")}
                          title="Kliknij aby edytować"
                        >
                          {r.number}
                        </span>
                      )}
                    </td>
                    {/* Typ */}
                    <td className="px-4 py-3">
                      {isEditing(r.id, "type") ? (
                        roomTypes.length > 0 ? (
                          <select
                            autoFocus
                            value={inlineEditValue}
                            onChange={(e) => { setInlineEditValue(e.target.value); }}
                            onBlur={saveInlineEdit}
                            onKeyDown={handleInlineKeyDown}
                            className="h-7 rounded border border-input bg-background px-2 text-sm"
                          >
                            {roomTypes.map((t) => (
                              <option key={t.id} value={t.name}>{t.name}</option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            autoFocus
                            value={inlineEditValue}
                            onChange={(e) => setInlineEditValue(e.target.value)}
                            onBlur={saveInlineEdit}
                            onKeyDown={handleInlineKeyDown}
                            className="h-7 w-24 text-sm"
                          />
                        )
                      ) : (
                        <span
                          className="cursor-pointer hover:underline decoration-dashed underline-offset-4"
                          onClick={() => startInlineEdit(r, "type")}
                          title="Kliknij aby edytować"
                        >
                          {r.type}
                        </span>
                      )}
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      {isEditing(r.id, "status") ? (
                        <select
                          autoFocus
                          value={inlineEditValue}
                          onChange={(e) => { setInlineEditValue(e.target.value); }}
                          onBlur={saveInlineEdit}
                          onKeyDown={handleInlineKeyDown}
                          className="h-7 rounded border border-input bg-background px-2 text-sm"
                        >
                          {Object.entries(STATUS_LABELS).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className="cursor-pointer hover:underline decoration-dashed underline-offset-4"
                          onClick={() => startInlineEdit(r, "status")}
                          title="Kliknij aby edytować"
                        >
                          {STATUS_LABELS[r.status] ?? r.status}
                        </span>
                      )}
                    </td>
                    {/* Cena */}
                    <td className="px-4 py-3">
                      {isEditing(r.id, "price") ? (
                        <Input
                          autoFocus
                          type="number"
                          min={0}
                          step={0.01}
                          value={inlineEditValue}
                          onChange={(e) => setInlineEditValue(e.target.value)}
                          onBlur={saveInlineEdit}
                          onKeyDown={handleInlineKeyDown}
                          className="h-7 w-24 text-sm"
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:underline decoration-dashed underline-offset-4"
                          onClick={() => startInlineEdit(r, "price")}
                          title="Kliknij aby edytować"
                        >
                          {r.price != null ? `${r.price} PLN` : "—"}
                        </span>
                      )}
                    </td>
                    {/* Metraż */}
                    <td className="px-4 py-3">
                      {isEditing(r.id, "surfaceArea") ? (
                        <Input
                          autoFocus
                          type="number"
                          min={0}
                          step={0.01}
                          value={inlineEditValue}
                          onChange={(e) => setInlineEditValue(e.target.value)}
                          onBlur={saveInlineEdit}
                          onKeyDown={handleInlineKeyDown}
                          className="h-7 w-20 text-sm"
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:underline decoration-dashed underline-offset-4"
                          onClick={() => startInlineEdit(r, "surfaceArea")}
                          title="Kliknij aby edytować"
                        >
                          {r.surfaceArea != null ? `${r.surfaceArea} m²` : "—"}
                        </span>
                      )}
                    </td>
                    {/* Piętro */}
                    <td className="px-4 py-3">
                      {isEditing(r.id, "floor") ? (
                        <select
                          autoFocus
                          value={inlineEditValue}
                          onChange={(e) => { setInlineEditValue(e.target.value); }}
                          onBlur={saveInlineEdit}
                          onKeyDown={handleInlineKeyDown}
                          className="h-7 rounded border border-input bg-background px-2 text-sm"
                        >
                          <option value="">— brak —</option>
                          {floorOptions.map((f) => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className="cursor-pointer hover:underline decoration-dashed underline-offset-4"
                          onClick={() => startInlineEdit(r, "floor")}
                          title="Kliknij aby edytować"
                        >
                          {r.floor ?? "—"}
                        </span>
                      )}
                    </td>
                    {/* Budynek */}
                    <td className="px-4 py-3">
                      {isEditing(r.id, "building") ? (
                        <Input
                          autoFocus
                          value={inlineEditValue}
                          onChange={(e) => setInlineEditValue(e.target.value)}
                          onBlur={saveInlineEdit}
                          onKeyDown={handleInlineKeyDown}
                          className="h-7 w-28 text-sm"
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:underline decoration-dashed underline-offset-4"
                          onClick={() => startInlineEdit(r, "building")}
                          title="Kliknij aby edytować"
                        >
                          {r.building ?? "—"}
                        </span>
                      )}
                    </td>
                    {/* Widok */}
                    <td className="px-4 py-3">
                      {isEditing(r.id, "view") ? (
                        <select
                          autoFocus
                          value={inlineEditValue}
                          onChange={(e) => { setInlineEditValue(e.target.value); }}
                          onBlur={saveInlineEdit}
                          onKeyDown={handleInlineKeyDown}
                          className="h-7 rounded border border-input bg-background px-2 text-sm"
                        >
                          <option value="">— brak —</option>
                          {viewOptions.filter(v => v).map((v) => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className="cursor-pointer hover:underline decoration-dashed underline-offset-4"
                          onClick={() => startInlineEdit(r, "view")}
                          title="Kliknij aby edytować"
                        >
                          {r.view ?? "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1 max-w-[200px]">
                        {r.amenities.length > 0 ? (
                          r.amenities.slice(0, 3).map((am) => (
                            <Badge key={am} variant="outline" className="text-xs">
                              {am}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                        {r.amenities.length > 3 && (
                          <span className="text-xs text-muted-foreground">+{r.amenities.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 px-2"
                        onClick={() => openPhotosDialog(r)}
                        title="Zarządzaj zdjęciami"
                      >
                        <ImageIcon className="h-3.5 w-3.5" />
                        <span className="text-xs">{r.photos.length}</span>
                      </Button>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 px-2"
                        onClick={() => openInventoryDialog(r)}
                        title="Inwentaryzacja pokoju"
                      >
                        <ClipboardList className="h-3.5 w-3.5" />
                        <span className="text-xs">{r.inventory.length > 0 ? r.inventory.reduce((sum, i) => sum + i.count, 0) : 0}</span>
                      </Button>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 px-2"
                        onClick={() => openConnectionsDialog(r)}
                        title="Zarządzaj połączonymi pokojami"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        <span className="text-xs">{r.connectedRooms.length > 0 ? r.connectedRooms.join(", ") : "—"}</span>
                      </Button>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 px-2"
                        onClick={() => openMaintenanceDialog(r)}
                        title="Historia usterek/awarii"
                      >
                        <Wrench className="h-3.5 w-3.5" />
                        <span className="text-xs">Historia</span>
                      </Button>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 px-2"
                        onClick={() => openBlocksDialog(r)}
                        title="Zarządzaj blokadami (remont, konserwacja)"
                      >
                        <Ban className="h-3.5 w-3.5" />
                        <span className="text-xs">Blokady</span>
                      </Button>
                    </td>
                    <td className="px-4 py-3">
                      {r.nextServiceDate ? (
                        <div
                          className={`text-xs ${
                            new Date(r.nextServiceDate) < new Date()
                              ? "text-red-600 font-medium"
                              : new Date(r.nextServiceDate) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                              ? "text-amber-600"
                              : "text-muted-foreground"
                          }`}
                          title={r.nextServiceNote || "Termin serwisu"}
                        >
                          {new Date(r.nextServiceDate).toLocaleDateString("pl-PL")}
                          {r.nextServiceNote && (
                            <span className="block text-xs text-muted-foreground truncate max-w-[100px]">
                              {r.nextServiceNote}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    {/* Max osób */}
                    <td className="px-4 py-3">
                      {isEditing(r.id, "maxOccupancy") ? (
                        <Input
                          autoFocus
                          type="number"
                          min={1}
                          max={20}
                          value={inlineEditValue}
                          onChange={(e) => setInlineEditValue(e.target.value)}
                          onBlur={saveInlineEdit}
                          onKeyDown={handleInlineKeyDown}
                          className="h-7 w-16 text-sm"
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:underline decoration-dashed underline-offset-4"
                          onClick={() => startInlineEdit(r, "maxOccupancy")}
                          title="Kliknij aby edytować"
                        >
                          {r.maxOccupancy}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        {r.roomFeatures.length > 0 ? (
                          r.roomFeatures.map((feat) => (
                            <Badge key={feat} variant="secondary" className="text-xs">
                              {feat}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 ml-1"
                          onClick={() => openFeaturesDialog(r)}
                          title="Edytuj cechy pokoju"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {r.activeForSale ? (
                        <span className="inline-flex items-center gap-1 rounded bg-green-500/15 px-2 py-0.5 text-green-700 dark:text-green-400">
                          <CheckCircle className="h-3.5 w-3.5" /> Tak
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-amber-700 dark:text-amber-400">
                          <Ban className="h-3.5 w-3.5" /> Wycofany
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDetailsDialog(r)}
                          title="Edytuj szczegóły pokoju"
                        >
                          <Settings2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={togglingId === r.id}
                          onClick={() => handleToggleForSale(r)}
                        >
                          {togglingId === r.id
                            ? "…"
                            : r.activeForSale
                              ? "Wycofaj ze sprzedaży"
                              : "Przywróć do sprzedaży"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={deletingId === r.id}
                          onClick={() => handleDelete(r)}
                          className="text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Grupy pokoi (wirtualne, np. Apartament Rodzinny) */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-lg font-semibold">Grupy pokoi (wirtualne)</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Połącz kilka pokoi w jedną „wirtualną” ofertę (np. Apartament Rodzinny = 101+102). Na grafiku przy rezerwacji grupowej można wybrać taką grupę.
        </p>
        <form onSubmit={handleAddGroup} className="mb-4 flex flex-wrap items-end gap-3">
          <div className="grid w-full max-w-[200px] gap-2">
            <Label htmlFor="new-group-name">Nazwa grupy</Label>
            <Input
              id="new-group-name"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="np. Apartament Rodzinny"
            />
          </div>
          <div className="grid w-full max-w-[200px] gap-2">
            <Label htmlFor="new-group-rooms">Numery pokoi (po przecinku)</Label>
            <Input
              id="new-group-rooms"
              value={newGroupRooms}
              onChange={(e) => setNewGroupRooms(e.target.value)}
              placeholder="101, 102"
            />
          </div>
          <Button type="submit" disabled={addingGroup}>
            {addingGroup ? "Dodawanie…" : "Dodaj grupę"}
          </Button>
        </form>
        {roomGroups.length > 0 ? (
          <ul className="list-inside list-disc text-sm">
            {roomGroups.map((g) => (
              <li key={g.id}>
                <strong>{g.name}</strong> ({g.roomNumbers.join(", ")})
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Brak zdefiniowanych grup.</p>
        )}
      </div>

      {/* Dialog edycji cech pokoju */}
      <Dialog open={!!editingRoom} onOpenChange={(open) => !open && closeFeaturesDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Cechy pokoju {editingRoom?.number}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Aktualne cechy */}
            <div>
              <Label className="text-sm font-medium">Aktualne cechy</Label>
              <div className="mt-2 flex flex-wrap gap-2 min-h-[2rem]">
                {editedFeatures.length > 0 ? (
                  editedFeatures.map((feat) => (
                    <Badge
                      key={feat}
                      variant="secondary"
                      className="gap-1 pr-1"
                    >
                      {feat}
                      <button
                        type="button"
                        onClick={() => removeFeature(feat)}
                        className="ml-1 rounded-full hover:bg-muted p-0.5"
                        title="Usuń cechę"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground text-sm">Brak cech</span>
                )}
              </div>
            </div>

            {/* Dodawanie nowej cechy */}
            <div>
              <Label htmlFor="new-feature" className="text-sm font-medium">
                Dodaj cechę
              </Label>
              <div className="mt-2 flex gap-2">
                <Input
                  id="new-feature"
                  value={newFeatureInput}
                  onChange={(e) => setNewFeatureInput(e.target.value)}
                  onKeyDown={handleKeyDownFeature}
                  placeholder="np. balkon, widok, klimatyzacja"
                  className="flex-1"
                />
                <Button type="button" variant="outline" onClick={addFeature}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Podpowiedzi */}
            {availableSuggestions.length > 0 && (
              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  Popularne cechy
                </Label>
                <div className="mt-2 flex flex-wrap gap-1">
                  {availableSuggestions.map((feat) => (
                    <Button
                      key={feat}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setEditedFeatures((prev) => [...prev, feat]);
                      }}
                    >
                      + {feat}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeFeaturesDialog}>
              Anuluj
            </Button>
            <Button onClick={handleSaveFeatures} disabled={savingFeatures}>
              {savingFeatures ? "Zapisywanie…" : "Zapisz cechy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog edycji szczegółów pokoju */}
      <Dialog open={!!editingDetails} onOpenChange={(open) => !open && closeDetailsDialog()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Szczegóły pokoju {editingDetails?.number}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-surface-area" className="text-sm font-medium">
                  Metraż (m²)
                </Label>
                <Input
                  id="edit-surface-area"
                  type="number"
                  min={0}
                  step={0.01}
                  value={editedSurfaceArea}
                  onChange={(e) => setEditedSurfaceArea(e.target.value)}
                  placeholder="np. 25.5"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-floor" className="text-sm font-medium">
                  Piętro
                </Label>
                <select
                  id="edit-floor"
                  value={editedFloor}
                  onChange={(e) => setEditedFloor(e.target.value)}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="">— brak —</option>
                  {floorOptions.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-building" className="text-sm font-medium">
                  Budynek/Skrzydło
                </Label>
                <Input
                  id="edit-building"
                  value={editedBuilding}
                  onChange={(e) => setEditedBuilding(e.target.value)}
                  placeholder="np. A, Główny, Wschodni"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-view" className="text-sm font-medium">
                  Widok
                </Label>
                <select
                  id="edit-view"
                  value={editedView}
                  onChange={(e) => setEditedView(e.target.value)}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="">— brak —</option>
                  {viewOptions.filter(v => v).map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-exposure" className="text-sm font-medium">
                  Ekspozycja okien
                </Label>
                <select
                  id="edit-exposure"
                  value={editedExposure}
                  onChange={(e) => setEditedExposure(e.target.value)}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="">— brak —</option>
                  {exposureOptions.filter(v => v).map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="edit-max-occupancy" className="text-sm font-medium">
                  Maksymalna liczba osób
                </Label>
                <Input
                  id="edit-max-occupancy"
                  type="number"
                  min={1}
                  max={20}
                  value={editedMaxOccupancy}
                  onChange={(e) => setEditedMaxOccupancy(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Typy łóżek */}
            <div>
              <Label className="text-sm font-medium">Typy łóżek</Label>
              <div className="mt-2 flex flex-wrap gap-1 min-h-[2rem]">
                {editedBedTypes.length > 0 ? (
                  editedBedTypes.map((bt, idx) => (
                    <Badge key={`${bt}-${idx}`} variant="secondary" className="gap-1 pr-1">
                      {bt}
                      <button
                        type="button"
                        onClick={() => setEditedBedTypes((prev) => prev.filter((_, i) => i !== idx))}
                        className="ml-1 rounded-full hover:bg-muted p-0.5"
                        title="Usuń"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground text-sm">Brak</span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {bedTypeOptions.map((bt) => (
                  <Button
                    key={bt}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setEditedBedTypes((prev) => [...prev, bt])}
                  >
                    + {bt}
                  </Button>
                ))}
              </div>
            </div>

            {/* Wyposażenie (amenities) */}
            <div>
              <Label className="text-sm font-medium">Wyposażenie pokoju</Label>
              <div className="mt-2 flex flex-wrap gap-1 min-h-[2rem]">
                {editedAmenities.length > 0 ? (
                  editedAmenities.map((am) => (
                    <Badge key={am} variant="outline" className="gap-1 pr-1">
                      {am}
                      <button
                        type="button"
                        onClick={() => setEditedAmenities((prev) => prev.filter((a) => a !== am))}
                        className="ml-1 rounded-full hover:bg-muted p-0.5"
                        title="Usuń"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground text-sm">Brak</span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {amenityOptions.filter((am) => !editedAmenities.includes(am)).map((am) => (
                  <Button
                    key={am}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setEditedAmenities((prev) => [...prev, am])}
                  >
                    + {am}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="edit-description" className="text-sm font-medium">
                Opis marketingowy
              </Label>
              <textarea
                id="edit-description"
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                placeholder="Przestronny pokój z widokiem na ogród..."
                className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[80px]"
              />
            </div>

            <div>
              <Label htmlFor="edit-technical-notes" className="text-sm font-medium">
                Notatki techniczne (wewnętrzne)
              </Label>
              <p className="text-xs text-muted-foreground mb-1">
                Informacje dla personelu – niewidoczne dla gości.
              </p>
              <textarea
                id="edit-technical-notes"
                value={editedTechnicalNotes}
                onChange={(e) => setEditedTechnicalNotes(e.target.value)}
                placeholder="np. wymienić zamek w drzwiach, sprawdzić klimatyzację przed sezonem..."
                className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[80px]"
              />
            </div>

            {/* Termin przeglądu/serwisu */}
            <div className="rounded-lg border p-4 bg-muted/20">
              <Label className="text-sm font-medium">Termin przeglądu/serwisu</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Planowany termin następnego przeglądu lub serwisu pokoju.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="edit-service-date" className="text-xs">Data</Label>
                  <Input
                    id="edit-service-date"
                    type="date"
                    value={editedNextServiceDate}
                    onChange={(e) => setEditedNextServiceDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-service-note" className="text-xs">Opis serwisu</Label>
                  <Input
                    id="edit-service-note"
                    value={editedNextServiceNote}
                    onChange={(e) => setEditedNextServiceNote(e.target.value)}
                    placeholder="np. przegląd klimatyzacji"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDetailsDialog}>
              Anuluj
            </Button>
            <Button onClick={handleSaveDetails} disabled={savingDetails}>
              {savingDetails ? "Zapisywanie…" : "Zapisz szczegóły"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog zarządzania zdjęciami pokoju */}
      <Dialog open={!!editingPhotos} onOpenChange={(open) => !open && closePhotosDialog()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Zdjęcia pokoju {editingPhotos?.number}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Lista zdjęć */}
            <div>
              <Label className="text-sm font-medium">Zdjęcia ({editedPhotos.length})</Label>
              <div className="mt-2 space-y-2 max-h-[300px] overflow-y-auto">
                {editedPhotos.length > 0 ? (
                  editedPhotos.map((url, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
                      <div className="w-16 h-12 bg-muted rounded overflow-hidden flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Pokój ${editingPhotos?.number} - ${idx + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      </div>
                      <span className="flex-1 text-sm truncate" title={url}>
                        {url}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                        onClick={() => removePhoto(url)}
                        title="Usuń zdjęcie"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm">Brak zdjęć</p>
                )}
              </div>
            </div>

            {/* Dodawanie nowego URL */}
            <div>
              <Label htmlFor="new-photo-url" className="text-sm font-medium">
                Dodaj zdjęcie (URL)
              </Label>
              <div className="mt-2 flex gap-2">
                <Input
                  id="new-photo-url"
                  value={newPhotoUrl}
                  onChange={(e) => setNewPhotoUrl(e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addPhotoUrl();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addPhotoUrl}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Wklej URL do zdjęcia. Obsługiwane formaty: JPG, PNG, WebP.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closePhotosDialog}>
              Anuluj
            </Button>
            <Button onClick={handleSavePhotos} disabled={savingPhotos}>
              {savingPhotos ? "Zapisywanie…" : "Zapisz zdjęcia"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog inwentaryzacji pokoju */}
      <Dialog open={!!editingInventory} onOpenChange={(open) => !open && closeInventoryDialog()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Inwentaryzacja pokoju {editingInventory?.number}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Lista przedmiotów */}
            <div>
              <Label className="text-sm font-medium">
                Przedmioty ({editedInventory.length}) – łącznie: {editedInventory.reduce((s, i) => s + i.count, 0)} szt.
              </Label>
              <div className="mt-2 space-y-2 max-h-[250px] overflow-y-auto">
                {editedInventory.length > 0 ? (
                  editedInventory.map((inv) => (
                    <div key={inv.item} className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
                      <span className="flex-1 text-sm">{inv.item}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => updateInventoryItemCount(inv.item, -1)}
                          title="Zmniejsz ilość"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center font-medium">{inv.count}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => updateInventoryItemCount(inv.item, 1)}
                          title="Zwiększ ilość"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                        onClick={() => removeInventoryItem(inv.item)}
                        title="Usuń przedmiot"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm">Brak przedmiotów w inwentarzu</p>
                )}
              </div>
            </div>

            {/* Dodawanie nowego przedmiotu */}
            <div>
              <Label className="text-sm font-medium">Dodaj przedmiot</Label>
              <div className="mt-2 flex gap-2">
                <Input
                  value={newInventoryItem}
                  onChange={(e) => setNewInventoryItem(e.target.value)}
                  placeholder="np. ręcznik duży"
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addInventoryItem();
                    }
                  }}
                />
                <Input
                  type="number"
                  min={1}
                  value={newInventoryCount}
                  onChange={(e) => setNewInventoryCount(e.target.value)}
                  className="w-20"
                  placeholder="Ilość"
                />
                <Button type="button" variant="outline" onClick={addInventoryItem}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Podpowiedzi przedmiotów */}
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Typowe przedmioty</Label>
              <div className="mt-2 flex flex-wrap gap-1 max-h-[100px] overflow-y-auto">
                {inventoryItemSuggestions
                  .filter((item) => !editedInventory.some((i) => i.item.toLowerCase() === item.toLowerCase()))
                  .map((item) => (
                    <Button
                      key={item}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setEditedInventory((prev) => [...prev, { item, count: 1 }]);
                      }}
                    >
                      + {item}
                    </Button>
                  ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeInventoryDialog}>
              Anuluj
            </Button>
            <Button onClick={handleSaveInventory} disabled={savingInventory}>
              {savingInventory ? "Zapisywanie…" : "Zapisz inwentarz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog połączonych pokoi */}
      <Dialog open={!!editingConnections} onOpenChange={(open) => !open && closeConnectionsDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Połączone pokoje – {editingConnections?.number}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pokoje z drzwiami wewnętrznymi (connecting rooms), które mogą być łączone w większą jednostkę.
            </p>

            {/* Aktualne połączenia */}
            <div>
              <Label className="text-sm font-medium">Aktualnie połączone</Label>
              <div className="mt-2 space-y-2">
                {editingConnections && editingConnections.connectedRooms.length > 0 ? (
                  editingConnections.connectedRooms.map((roomNum) => (
                    <div key={roomNum} className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                      <span className="text-sm font-medium">Pokój {roomNum}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDisconnectRoom(roomNum)}
                        disabled={connectingRooms}
                      >
                        <Unlink className="h-3.5 w-3.5" />
                        Rozłącz
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Brak połączonych pokoi</p>
                )}
              </div>
            </div>

            {/* Dodaj nowe połączenie */}
            <div>
              <Label className="text-sm font-medium">Połącz z pokojem</Label>
              <div className="mt-2 flex gap-2">
                <select
                  value={selectedRoomToConnect}
                  onChange={(e) => setSelectedRoomToConnect(e.target.value)}
                  className="flex h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="">— wybierz pokój —</option>
                  {rooms
                    .filter(
                      (r) =>
                        r.number !== editingConnections?.number &&
                        !editingConnections?.connectedRooms.includes(r.number)
                    )
                    .map((r) => (
                      <option key={r.id} value={r.number}>
                        {r.number} ({r.type})
                      </option>
                    ))}
                </select>
                <Button
                  onClick={handleConnectRoom}
                  disabled={!selectedRoomToConnect || connectingRooms}
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  {connectingRooms ? "Łączenie…" : "Połącz"}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeConnectionsDialog}>
              Zamknij
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog historii usterek/awarii */}
      <Dialog open={!!maintenanceRoom} onOpenChange={(open) => !open && closeMaintenanceDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Historia usterek – Pokój {maintenanceRoom?.number}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Przycisk dodania nowej usterki */}
            {!showNewIssueForm ? (
              <Button
                onClick={() => setShowNewIssueForm(true)}
                className="w-full"
                variant="outline"
              >
                <Plus className="mr-2 h-4 w-4" />
                Zgłoś nową usterkę
              </Button>
            ) : (
              /* Formularz nowej usterki */
              <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
                <h4 className="font-medium">Nowe zgłoszenie usterki</h4>

                <div className="space-y-2">
                  <Label htmlFor="issue-title">Tytuł *</Label>
                  <Input
                    id="issue-title"
                    value={newIssueTitle}
                    onChange={(e) => setNewIssueTitle(e.target.value)}
                    placeholder="np. Cieknący kran, Klimatyzacja nie działa"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="issue-desc">Opis (opcjonalnie)</Label>
                  <textarea
                    id="issue-desc"
                    value={newIssueDescription}
                    onChange={(e) => setNewIssueDescription(e.target.value)}
                    placeholder="Szczegółowy opis problemu..."
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Kategoria</Label>
                    <select
                      value={newIssueCategory}
                      onChange={(e) => setNewIssueCategory(e.target.value as MaintenanceCategory)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    >
                      {maintenanceCategoryOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priorytet</Label>
                    <select
                      value={newIssuePriority}
                      onChange={(e) => setNewIssuePriority(e.target.value as MaintenancePriority)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    >
                      {maintenancePriorityOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="set-ooo"
                    checked={newIssueSetOOO}
                    onChange={(e) => setNewIssueSetOOO(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="set-ooo" className="cursor-pointer">
                    Oznacz pokój jako OOO (wyłączony ze sprzedaży)
                  </Label>
                </div>

                {/* Planowana konserwacja */}
                <div className="space-y-3 rounded-md border p-3 bg-muted/20">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is-scheduled"
                      checked={newIssueIsScheduled}
                      onChange={(e) => setNewIssueIsScheduled(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="is-scheduled" className="cursor-pointer font-medium">
                      Planowana konserwacja (z datami OOO)
                    </Label>
                  </div>
                  {newIssueIsScheduled && (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <Label htmlFor="start-date" className="text-xs">Data rozpoczęcia</Label>
                        <Input
                          id="start-date"
                          type="date"
                          value={newIssueStartDate}
                          onChange={(e) => setNewIssueStartDate(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="end-date" className="text-xs">Data zakończenia</Label>
                        <Input
                          id="end-date"
                          type="date"
                          value={newIssueEndDate}
                          onChange={(e) => setNewIssueEndDate(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <p className="col-span-2 text-xs text-muted-foreground">
                        Po zakończeniu konserwacji pokój może zostać automatycznie przywrócony do sprzedaży.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowNewIssueForm(false);
                      resetNewIssueForm();
                    }}
                  >
                    Anuluj
                  </Button>
                  <Button onClick={handleCreateMaintenanceIssue} disabled={savingIssue}>
                    {savingIssue ? "Zapisywanie…" : "Zgłoś usterkę"}
                  </Button>
                </div>
              </div>
            )}

            {/* Lista usterek */}
            {loadingMaintenance ? (
              <p className="text-center text-muted-foreground py-8">Ładowanie historii usterek...</p>
            ) : maintenanceIssues.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Brak zarejestrowanych usterek dla tego pokoju.</p>
            ) : (
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">
                  Wszystkie zgłoszenia ({maintenanceIssues.length})
                </h4>
                {maintenanceIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className={`rounded-lg border p-4 space-y-2 ${
                      issue.status === "RESOLVED" || issue.status === "CANCELLED"
                        ? "bg-muted/20 opacity-70"
                        : issue.priority === "URGENT"
                        ? "border-red-300 bg-red-50/50"
                        : issue.priority === "HIGH"
                        ? "border-orange-200 bg-orange-50/30"
                        : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{issue.title}</span>
                          {issue.isScheduled && (
                            <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                              Planowana
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {maintenanceCategoryOptions.find((c) => c.value === issue.category)?.label ?? issue.category}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              maintenancePriorityOptions.find((p) => p.value === issue.priority)?.color ?? ""
                            }`}
                          >
                            {maintenancePriorityOptions.find((p) => p.value === issue.priority)?.label ?? issue.priority}
                          </Badge>
                        </div>
                        {issue.description && (
                          <p className="text-sm text-muted-foreground mt-1">{issue.description}</p>
                        )}
                      </div>
                      <Badge
                        variant={
                          issue.status === "RESOLVED"
                            ? "default"
                            : issue.status === "IN_PROGRESS"
                            ? "secondary"
                            : issue.status === "CANCELLED"
                            ? "outline"
                            : "destructive"
                        }
                        className="whitespace-nowrap"
                      >
                        {maintenanceStatusLabels[issue.status]}
                      </Badge>
                    </div>

                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                      <span>Zgłoszono: {new Date(issue.reportedAt).toLocaleDateString("pl-PL")}</span>
                      {issue.reportedBy && <span>Przez: {issue.reportedBy}</span>}
                      {issue.assignedTo && <span>Przypisano: {issue.assignedTo}</span>}
                      {issue.resolvedAt && (
                        <span>
                          Zamknięto: {new Date(issue.resolvedAt).toLocaleDateString("pl-PL")}
                        </span>
                      )}
                      {issue.roomWasOOO && (
                        <span className="text-amber-600 font-medium">Pokój był OOO</span>
                      )}
                      {issue.isScheduled && issue.scheduledStartDate && issue.scheduledEndDate && (
                        <span className="text-blue-600 font-medium">
                          Zaplanowano: {new Date(issue.scheduledStartDate).toLocaleDateString("pl-PL")} – {new Date(issue.scheduledEndDate).toLocaleDateString("pl-PL")}
                        </span>
                      )}
                    </div>

                    {/* Akcje */}
                    {issue.status !== "RESOLVED" && issue.status !== "CANCELLED" && (
                      <div className="flex gap-2 pt-2 border-t mt-2">
                        {issue.status === "REPORTED" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateIssueStatus(issue.id, "IN_PROGRESS")}
                            >
                              <Clock className="mr-1 h-3 w-3" />
                              Rozpocznij
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleUpdateIssueStatus(issue.id, "CANCELLED")}
                            >
                              Anuluj
                            </Button>
                          </>
                        )}
                        {issue.status === "IN_PROGRESS" && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleUpdateIssueStatus(issue.id, "RESOLVED")}
                            >
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Zakończ
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateIssueStatus(issue.id, "ON_HOLD")}
                            >
                              Wstrzymaj
                            </Button>
                          </>
                        )}
                        {issue.status === "ON_HOLD" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateIssueStatus(issue.id, "IN_PROGRESS")}
                            >
                              Wznów
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleUpdateIssueStatus(issue.id, "CANCELLED")}
                            >
                              Anuluj
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-auto text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteIssue(issue.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}

                    {/* Notatki rozwiązania */}
                    {issue.resolutionNotes && (
                      <div className="text-sm bg-green-50/50 p-2 rounded mt-2">
                        <span className="font-medium text-green-800">Rozwiązanie:</span> {issue.resolutionNotes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeMaintenanceDialog}>
              Zamknij
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog blokad pokoju (remont/konserwacja) */}
      <Dialog open={!!blocksRoom} onOpenChange={(open) => !open && closeBlocksDialog()}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5" />
              Blokady pokoju – {blocksRoom?.number}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Zarządzaj blokadami pokoju (remont, konserwacja, rezerwacja VIP). Blokady powodują wyłączenie pokoju ze sprzedaży na wskazane daty.
            </p>

            {/* Przycisk dodania nowej blokady */}
            {!showNewBlockForm ? (
              <Button
                onClick={() => setShowNewBlockForm(true)}
                className="w-full"
                variant="outline"
              >
                <Plus className="mr-2 h-4 w-4" />
                Dodaj blokadę
              </Button>
            ) : (
              /* Formularz nowej blokady */
              <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
                <h4 className="font-medium">Nowa blokada</h4>

                <div className="space-y-2">
                  <Label>Typ blokady</Label>
                  <select
                    value={newBlockType}
                    onChange={(e) => setNewBlockType(e.target.value as RoomBlockType)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    {blockTypeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="block-start">Data rozpoczęcia</Label>
                    <Input
                      id="block-start"
                      type="date"
                      value={newBlockStartDate}
                      onChange={(e) => setNewBlockStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="block-end">Data zakończenia</Label>
                    <Input
                      id="block-end"
                      type="date"
                      value={newBlockEndDate}
                      onChange={(e) => setNewBlockEndDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="block-reason">Powód (opcjonalnie)</Label>
                  <Input
                    id="block-reason"
                    value={newBlockReason}
                    onChange={(e) => setNewBlockReason(e.target.value)}
                    placeholder="np. Wymiana okien, malowanie..."
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowNewBlockForm(false);
                      resetNewBlockForm();
                    }}
                  >
                    Anuluj
                  </Button>
                  <Button onClick={handleCreateBlock} disabled={savingBlock}>
                    {savingBlock ? "Zapisywanie…" : "Dodaj blokadę"}
                  </Button>
                </div>
              </div>
            )}

            {/* Lista blokad */}
            {loadingBlocks ? (
              <p className="text-center text-muted-foreground py-8">Ładowanie blokad...</p>
            ) : roomBlocks.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Brak zarejestrowanych blokad dla tego pokoju.</p>
            ) : (
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">
                  Wszystkie blokady ({roomBlocks.length})
                </h4>
                {roomBlocks.map((block) => {
                  const isPast = new Date(block.endDate) < new Date();
                  const isActive = new Date(block.startDate) <= new Date() && new Date(block.endDate) >= new Date();
                  return (
                    <div
                      key={block.id}
                      className={`rounded-lg border p-4 ${
                        isPast
                          ? "bg-muted/20 opacity-60"
                          : isActive
                          ? "border-red-300 bg-red-50/50"
                          : "border-amber-200 bg-amber-50/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant={isPast ? "outline" : isActive ? "destructive" : "secondary"}>
                              {blockTypeOptions.find((t) => t.value === block.blockType)?.label ?? block.blockType}
                            </Badge>
                            {isActive && <Badge variant="destructive">Aktywna</Badge>}
                            {isPast && <Badge variant="outline">Zakończona</Badge>}
                          </div>
                          <p className="text-sm mt-1">
                            {new Date(block.startDate).toLocaleDateString("pl-PL")} – {new Date(block.endDate).toLocaleDateString("pl-PL")}
                          </p>
                          {block.reason && (
                            <p className="text-sm text-muted-foreground mt-1">{block.reason}</p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteBlock(block.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeBlocksDialog}>
              Zamknij
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
