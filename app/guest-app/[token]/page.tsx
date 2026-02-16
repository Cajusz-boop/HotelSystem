"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Key,
  Home,
  Calendar,
  DoorOpen,
  Phone,
  Mail,
  Wifi,
  Car,
  UtensilsCrossed,
  Clock,
  MessageSquare,
  Loader2,
  CheckCircle,
  AlertCircle,
  Copy,
  User,
  CreditCard,
  Send,
} from "lucide-react";
import {
  getGuestAppData,
  generateDigitalKey,
  sendGuestMessage,
  getHotelInfo,
  type GuestAppToken,
  type GuestAppReservation,
} from "@/app/actions/guest-app";

type ActiveTab = "reservations" | "key" | "info" | "contact";

export default function GuestAppPage() {
  const params = useParams();
  const token = params.token as string;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guestData, setGuestData] = useState<GuestAppToken | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("reservations");
  const [selectedReservation, setSelectedReservation] = useState<GuestAppReservation | null>(null);
  
  // Digital key state
  const [generatingKey, setGeneratingKey] = useState(false);
  const [keyGenerated, setKeyGenerated] = useState(false);
  
  // Contact form state
  const [messageCategory, setMessageCategory] = useState<"REQUEST" | "PROBLEM" | "QUESTION" | "FEEDBACK">("REQUEST");
  const [messageText, setMessageText] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const [messageSent, setMessageSent] = useState(false);
  
  // Hotel info
  const [hotelInfo, setHotelInfo] = useState<{
    name: string;
    address: string;
    phone: string;
    email: string;
    checkInTime: string;
    checkOutTime: string;
    wifiName: string | null;
    wifiPassword: string | null;
    parkingInfo: string | null;
    restaurantHours: string | null;
  } | null>(null);
  
  // Load data on mount
  useEffect(() => {
    loadData();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps -- loadData defined below, intentional mount + token
  
  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    const [dataResult, infoResult] = await Promise.all([
      getGuestAppData(token),
      getHotelInfo(),
    ]);
    
    if (dataResult.success) {
      setGuestData(dataResult.data);
      // Auto-select current/upcoming reservation
      const now = new Date();
      const activeRes = dataResult.data.reservations.find((r) => {
        const checkIn = new Date(r.checkIn);
        const checkOut = new Date(r.checkOut);
        return r.status === "CHECKED_IN" || 
          (r.status === "CONFIRMED" && checkIn <= now && checkOut >= now);
      });
      if (activeRes) {
        setSelectedReservation(activeRes);
      } else if (dataResult.data.reservations.length > 0) {
        setSelectedReservation(dataResult.data.reservations[0]);
      }
    } else {
      setError(dataResult.error);
    }
    
    if (infoResult.success) {
      setHotelInfo(infoResult.data);
    }
    
    setLoading(false);
  };
  
  // Generate digital key
  const handleGenerateKey = useCallback(async () => {
    if (!selectedReservation) return;
    
    setGeneratingKey(true);
    const result = await generateDigitalKey(selectedReservation.id, token);
    
    if (result.success) {
      setKeyGenerated(true);
      // Reload data to get updated key
      loadData();
    } else {
      setError(result.error);
    }
    
    setGeneratingKey(false);
  }, [selectedReservation, token]); // eslint-disable-line react-hooks/exhaustive-deps -- loadData stable, no need in deps
  
  // Copy key to clipboard
  const copyKeyToClipboard = useCallback(() => {
    if (selectedReservation?.digitalKeyCode) {
      navigator.clipboard.writeText(selectedReservation.digitalKeyCode);
    }
  }, [selectedReservation]);
  
  // Send message
  const handleSendMessage = useCallback(async () => {
    if (!messageText.trim()) return;
    
    setMessageSending(true);
    const result = await sendGuestMessage(
      token,
      selectedReservation?.id ?? "",
      messageText,
      messageCategory
    );
    
    if (result.success) {
      setMessageSent(true);
      setMessageText("");
      setTimeout(() => setMessageSent(false), 3000);
    } else {
      setError(result.error);
    }
    
    setMessageSending(false);
  }, [token, selectedReservation, messageText, messageCategory]);
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-blue-600 mb-4" />
          <p className="text-muted-foreground">Ładowanie...</p>
        </div>
      </div>
    );
  }
  
  if (error && !guestData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-50 to-white p-6">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h1 className="text-xl font-bold mb-2 text-red-600">Błąd dostępu</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }
  
  if (!guestData) return null;
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-20">
      {/* Header */}
      <header className="bg-blue-600 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Home className="w-6 h-6" />
          <div>
            <h1 className="font-semibold">{hotelInfo?.name ?? "Hotel"}</h1>
            <p className="text-sm text-blue-100">Witaj, {guestData.guestName}</p>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="p-4">
        {/* Reservations Tab */}
        {activeTab === "reservations" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Twoje rezerwacje</h2>
            
            {guestData.reservations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Brak aktywnych rezerwacji
              </div>
            ) : (
              guestData.reservations.map((r) => (
                <div
                  key={r.id}
                  onClick={() => setSelectedReservation(r)}
                  className={`p-4 rounded-xl border ${
                    selectedReservation?.id === r.id
                      ? "border-blue-500 bg-blue-50"
                      : "bg-white"
                  } cursor-pointer transition-colors`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-2xl font-bold text-blue-600">
                        Pokój {r.roomNumber}
                      </div>
                      <div className="text-sm text-muted-foreground">{r.roomType}</div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      r.status === "CHECKED_IN"
                        ? "bg-green-100 text-green-700"
                        : r.status === "CONFIRMED"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-700"
                    }`}>
                      {r.status === "CHECKED_IN" ? "Zameldowany" :
                       r.status === "CONFIRMED" ? "Potwierdzona" :
                       r.status === "CHECKED_OUT" ? "Wymeldowany" : r.status}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>Od: {r.checkIn}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>Do: {r.checkOut}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span>{r.adults} dorosłych{r.children > 0 && `, ${r.children} dzieci`}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span>{r.nights} nocy</span>
                    </div>
                  </div>
                  
                  {r.balanceDue > 0 && (
                    <div className="mt-3 pt-3 border-t flex items-center justify-between">
                      <div className="flex items-center gap-2 text-amber-600">
                        <CreditCard className="w-4 h-4" />
                        <span className="text-sm">Do zapłaty</span>
                      </div>
                      <span className="font-semibold">{r.balanceDue.toFixed(2)} PLN</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
        
        {/* Digital Key Tab */}
        {activeTab === "key" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Klucz cyfrowy</h2>
            
            {selectedReservation ? (
              <div className="bg-white rounded-xl p-6 border">
                <div className="text-center mb-6">
                  <div className="text-muted-foreground mb-1">Pokój</div>
                  <div className="text-4xl font-bold text-blue-600">
                    {selectedReservation.roomNumber}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Piętro {selectedReservation.roomFloor}
                  </div>
                </div>
                
                {selectedReservation.hasDigitalKey && selectedReservation.digitalKeyCode ? (
                  <div className="text-center">
                    <div className="text-muted-foreground mb-2">Twój kod dostępu</div>
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <div className="text-5xl font-mono font-bold tracking-widest text-green-600">
                        {selectedReservation.digitalKeyCode}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyKeyToClipboard}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Ważny: {selectedReservation.digitalKeyValidFrom?.slice(0, 10)} – {selectedReservation.digitalKeyValidTo?.slice(0, 10)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Wprowadź kod na klawiaturze przy drzwiach pokoju
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Key className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">
                      {selectedReservation.status === "CHECKED_IN"
                        ? "Wygeneruj klucz cyfrowy do pokoju"
                        : selectedReservation.status === "CONFIRMED"
                        ? "Klucz będzie dostępny po zameldowaniu"
                        : "Klucz niedostępny dla tej rezerwacji"}
                    </p>
                    {(selectedReservation.status === "CHECKED_IN" ||
                      selectedReservation.status === "CONFIRMED") && (
                      <Button
                        onClick={handleGenerateKey}
                        disabled={generatingKey}
                        className="w-full"
                      >
                        {generatingKey ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Key className="w-4 h-4 mr-2" />
                        )}
                        {keyGenerated ? "Odśwież klucz" : "Generuj klucz"}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Wybierz rezerwację, aby zobaczyć klucz
              </div>
            )}
            
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                {error}
              </div>
            )}
          </div>
        )}
        
        {/* Hotel Info Tab */}
        {activeTab === "info" && hotelInfo && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Informacje o hotelu</h2>
            
            <div className="bg-white rounded-xl p-4 border space-y-4">
              <div className="flex items-start gap-3">
                <Home className="w-5 h-5 text-blue-600 mt-1" />
                <div>
                  <div className="font-medium">{hotelInfo.name}</div>
                  <div className="text-sm text-muted-foreground">{hotelInfo.address}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-blue-600" />
                <a href={`tel:${hotelInfo.phone}`} className="text-blue-600">
                  {hotelInfo.phone}
                </a>
              </div>
              
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-blue-600" />
                <a href={`mailto:${hotelInfo.email}`} className="text-blue-600">
                  {hotelInfo.email}
                </a>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-4 border space-y-4">
              <div className="flex items-start gap-3">
                <DoorOpen className="w-5 h-5 text-green-600 mt-1" />
                <div>
                  <div className="font-medium">Check-in</div>
                  <div className="text-sm text-muted-foreground">od {hotelInfo.checkInTime}</div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <DoorOpen className="w-5 h-5 text-red-600 mt-1" />
                <div>
                  <div className="font-medium">Check-out</div>
                  <div className="text-sm text-muted-foreground">do {hotelInfo.checkOutTime}</div>
                </div>
              </div>
            </div>
            
            {hotelInfo.wifiName && (
              <div className="bg-white rounded-xl p-4 border">
                <div className="flex items-start gap-3">
                  <Wifi className="w-5 h-5 text-blue-600 mt-1" />
                  <div>
                    <div className="font-medium">WiFi</div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Sieć:</span> {hotelInfo.wifiName}
                    </div>
                    {hotelInfo.wifiPassword && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Hasło:</span>{" "}
                        <span className="font-mono">{hotelInfo.wifiPassword}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {hotelInfo.parkingInfo && (
              <div className="bg-white rounded-xl p-4 border">
                <div className="flex items-start gap-3">
                  <Car className="w-5 h-5 text-blue-600 mt-1" />
                  <div>
                    <div className="font-medium">Parking</div>
                    <div className="text-sm text-muted-foreground">{hotelInfo.parkingInfo}</div>
                  </div>
                </div>
              </div>
            )}
            
            {hotelInfo.restaurantHours && (
              <div className="bg-white rounded-xl p-4 border">
                <div className="flex items-start gap-3">
                  <UtensilsCrossed className="w-5 h-5 text-blue-600 mt-1" />
                  <div>
                    <div className="font-medium">Restauracja</div>
                    <div className="text-sm text-muted-foreground">{hotelInfo.restaurantHours}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Contact Tab */}
        {activeTab === "contact" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Kontakt z recepcją</h2>
            
            <div className="bg-white rounded-xl p-4 border space-y-4">
              <div>
                <Label>Kategoria</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {[
                    { value: "REQUEST", label: "Prośba" },
                    { value: "PROBLEM", label: "Problem" },
                    { value: "QUESTION", label: "Pytanie" },
                    { value: "FEEDBACK", label: "Opinia" },
                  ].map((cat) => (
                    <Button
                      key={cat.value}
                      variant={messageCategory === cat.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setMessageCategory(cat.value as typeof messageCategory)}
                    >
                      {cat.label}
                    </Button>
                  ))}
                </div>
              </div>
              
              <div>
                <Label htmlFor="message">Wiadomość</Label>
                <textarea
                  id="message"
                  className="w-full mt-2 p-3 border rounded-lg resize-none h-32"
                  placeholder="Napisz do nas..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                />
              </div>
              
              <Button
                className="w-full"
                onClick={handleSendMessage}
                disabled={messageSending || !messageText.trim()}
              >
                {messageSending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : messageSent ? (
                  <CheckCircle className="w-4 h-4 mr-2" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                {messageSent ? "Wysłano!" : "Wyślij wiadomość"}
              </Button>
            </div>
            
            {hotelInfo && (
              <div className="bg-white rounded-xl p-4 border">
                <p className="text-sm text-muted-foreground mb-3">
                  Lub skontaktuj się bezpośrednio:
                </p>
                <div className="space-y-2">
                  <a
                    href={`tel:${hotelInfo.phone}`}
                    className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg text-blue-600"
                  >
                    <Phone className="w-5 h-5" />
                    <span>{hotelInfo.phone}</span>
                  </a>
                  <a
                    href={`mailto:${hotelInfo.email}`}
                    className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg text-blue-600"
                  >
                    <Mail className="w-5 h-5" />
                    <span>{hotelInfo.email}</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      
      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        {[
          { id: "reservations" as ActiveTab, icon: Calendar, label: "Rezerwacje" },
          { id: "key" as ActiveTab, icon: Key, label: "Klucz" },
          { id: "info" as ActiveTab, icon: Home, label: "Hotel" },
          { id: "contact" as ActiveTab, icon: MessageSquare, label: "Kontakt" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center py-2 px-4 rounded-lg transition-colors ${
              activeTab === tab.id
                ? "text-blue-600 bg-blue-50"
                : "text-muted-foreground"
            }`}
          >
            <tab.icon className="w-5 h-5 mb-1" />
            <span className="text-xs">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
