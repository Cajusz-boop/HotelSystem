"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  User,
  Calendar,
  DoorOpen,
  CheckCircle,
  ArrowLeft,
  Loader2,
  Moon,
  Users,
  Trash2,
  PenTool,
  Home,
} from "lucide-react";
import {
  searchKioskReservation,
  getKioskReservationById,
  kioskCheckIn,
  getKioskStats,
  type KioskReservation,
} from "@/app/actions/kiosk";

type KioskStep = "welcome" | "search" | "select" | "confirm" | "signature" | "success";

export default function KioskPage() {
  const [step, setStep] = useState<KioskStep>("welcome");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<KioskReservation[]>([]);
  const [selectedReservation, setSelectedReservation] = useState<KioskReservation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Signature canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Check-in result
  const [checkInResult, setCheckInResult] = useState<{ roomNumber: string; checkOutDate: string } | null>(null);
  
  // Stats for welcome screen
  const [stats, setStats] = useState<{ arrivalsToday: number; pendingCheckIns: number } | null>(null);
  
  // Inactivity timeout (return to welcome after 2 minutes)
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const resetTimeout = () => {
      clearTimeout(timeout);
      if (step !== "welcome" && step !== "success") {
        timeout = setTimeout(() => {
          resetKiosk();
        }, 120000); // 2 minutes
      }
    };
    
    resetTimeout();
    window.addEventListener("click", resetTimeout);
    window.addEventListener("touchstart", resetTimeout);
    
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("click", resetTimeout);
      window.removeEventListener("touchstart", resetTimeout);
    };
  }, [step]);
  
  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, []);
  
  const loadStats = async () => {
    const result = await getKioskStats();
    if (result.success) {
      setStats({
        arrivalsToday: result.data.arrivalsToday,
        pendingCheckIns: result.data.pendingCheckIns,
      });
    }
  };
  
  const resetKiosk = useCallback(() => {
    setStep("welcome");
    setSearchQuery("");
    setSearchResults([]);
    setSelectedReservation(null);
    setError(null);
    setCheckInResult(null);
    loadStats();
  }, []);
  
  // Search for reservation
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    setError(null);
    
    const result = await searchKioskReservation(searchQuery);
    
    if (result.success) {
      setSearchResults(result.data);
      if (result.data.length === 0) {
        setError("Nie znaleziono rezerwacji. Sprawdź dane lub skontaktuj się z recepcją.");
      } else if (result.data.length === 1) {
        // Auto-select if only one result
        handleSelectReservation(result.data[0]);
      } else {
        setStep("select");
      }
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };
  
  // Select a reservation
  const handleSelectReservation = async (reservation: KioskReservation) => {
    setLoading(true);
    setError(null);
    
    const result = await getKioskReservationById(reservation.id);
    
    if (result.success) {
      setSelectedReservation(result.data);
      setStep("confirm");
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };
  
  // Canvas drawing functions
  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
    }
    return ctx;
  }, []);
  
  useEffect(() => {
    if (step === "signature") {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
        }
      }
    }
  }, [step]);
  
  const startDraw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = getCtx();
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
      const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
      ctx.beginPath();
      ctx.moveTo(x, y);
      setIsDrawing(true);
    },
    [getCtx]
  );
  
  const draw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = getCtx();
      if (!ctx) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
      const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
      ctx.lineTo(x, y);
      ctx.stroke();
    },
    [isDrawing, getCtx]
  );
  
  const endDraw = useCallback(() => {
    setIsDrawing(false);
  }, []);
  
  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = getCtx();
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [getCtx]);
  
  // Complete check-in
  const handleCheckIn = async () => {
    if (!selectedReservation) return;
    
    const canvas = canvasRef.current;
    let signatureDataUrl: string | undefined;
    
    if (canvas) {
      signatureDataUrl = canvas.toDataURL("image/png");
      // Check if signature is empty (just white)
      if (signatureDataUrl.length < 5000) {
        signatureDataUrl = undefined; // No signature
      }
    }
    
    setLoading(true);
    setError(null);
    
    const result = await kioskCheckIn(selectedReservation.id, signatureDataUrl);
    
    if (result.success) {
      setCheckInResult(result.data);
      setStep("success");
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };
  
  // Return home after success
  useEffect(() => {
    if (step === "success") {
      const timeout = setTimeout(() => {
        resetKiosk();
      }, 15000); // Return to welcome after 15 seconds
      return () => clearTimeout(timeout);
    }
  }, [step, resetKiosk]);
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col">
      {/* Header */}
      <header className="p-4 flex justify-between items-center">
        {step !== "welcome" && step !== "success" && (
          <Button
            variant="ghost"
            size="lg"
            onClick={() => {
              if (step === "search") resetKiosk();
              else if (step === "select") setStep("search");
              else if (step === "confirm") setStep(searchResults.length > 1 ? "select" : "search");
              else if (step === "signature") setStep("confirm");
            }}
            className="text-lg"
          >
            <ArrowLeft className="w-6 h-6 mr-2" />
            Wstecz
          </Button>
        )}
        {step === "welcome" && <div />}
        <div className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("pl-PL", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center p-8">
        {/* Welcome screen */}
        {step === "welcome" && (
          <div className="text-center max-w-2xl">
            <Home className="w-24 h-24 mx-auto mb-6 text-blue-600" />
            <h1 className="text-5xl font-bold mb-4">Witamy w Hotelu</h1>
            <p className="text-2xl text-muted-foreground mb-8">
              Samoobsługowy meldunek
            </p>
            
            {stats && stats.pendingCheckIns > 0 && (
              <p className="text-lg text-muted-foreground mb-8">
                Oczekujących gości: {stats.pendingCheckIns}
              </p>
            )}
            
            <Button
              size="lg"
              className="text-2xl px-12 py-8 h-auto"
              onClick={() => setStep("search")}
            >
              <DoorOpen className="w-8 h-8 mr-4" />
              Rozpocznij meldunek
            </Button>
          </div>
        )}

        {/* Search screen */}
        {step === "search" && (
          <div className="w-full max-w-xl">
            <div className="text-center mb-8">
              <Search className="w-16 h-16 mx-auto mb-4 text-blue-600" />
              <h2 className="text-3xl font-bold mb-2">Znajdź swoją rezerwację</h2>
              <p className="text-lg text-muted-foreground">
                Wpisz nazwisko lub numer rezerwacji
              </p>
            </div>
            
            <div className="space-y-4">
              <Input
                type="text"
                placeholder="Nazwisko lub numer rezerwacji..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="text-2xl h-16 px-6"
                autoFocus
              />
              
              <Button
                size="lg"
                className="w-full text-xl h-16"
                onClick={handleSearch}
                disabled={loading || !searchQuery.trim()}
              >
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                ) : (
                  <Search className="w-6 h-6 mr-2" />
                )}
                Szukaj
              </Button>
              
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-center">
                  {error}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Select reservation screen */}
        {step === "select" && (
          <div className="w-full max-w-2xl">
            <div className="text-center mb-8">
              <Users className="w-16 h-16 mx-auto mb-4 text-blue-600" />
              <h2 className="text-3xl font-bold mb-2">Wybierz rezerwację</h2>
              <p className="text-lg text-muted-foreground">
                Znaleziono {searchResults.length} rezerwacji
              </p>
            </div>
            
            <div className="space-y-4">
              {searchResults.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handleSelectReservation(r)}
                  disabled={loading}
                  className="w-full p-6 bg-card border rounded-xl text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xl font-semibold">{r.guestName}</div>
                      <div className="text-muted-foreground">
                        {r.checkIn} – {r.checkOut} ({r.nights} nocy)
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">
                        Pokój {r.roomNumber}
                      </div>
                      <div className="text-sm text-muted-foreground">{r.roomType}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-center">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Confirm screen */}
        {step === "confirm" && selectedReservation && (
          <div className="w-full max-w-xl">
            <div className="text-center mb-8">
              <User className="w-16 h-16 mx-auto mb-4 text-blue-600" />
              <h2 className="text-3xl font-bold mb-2">Potwierdź dane</h2>
            </div>
            
            <div className="bg-card border rounded-xl p-8 mb-6">
              <div className="text-center mb-6">
                <div className="text-3xl font-bold mb-2">
                  {selectedReservation.guestFirstName} {selectedReservation.guestLastName}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="flex items-center gap-3">
                  <Calendar className="w-8 h-8 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">Przyjazd</div>
                    <div className="text-xl font-semibold">{selectedReservation.checkIn}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Calendar className="w-8 h-8 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">Wyjazd</div>
                    <div className="text-xl font-semibold">{selectedReservation.checkOut}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Moon className="w-8 h-8 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">Liczba nocy</div>
                    <div className="text-xl font-semibold">{selectedReservation.nights}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Users className="w-8 h-8 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">Goście</div>
                    <div className="text-xl font-semibold">
                      {selectedReservation.adults} dorosłych
                      {selectedReservation.children > 0 && `, ${selectedReservation.children} dzieci`}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t text-center">
                <div className="text-muted-foreground">Twój pokój</div>
                <div className="text-5xl font-bold text-blue-600">{selectedReservation.roomNumber}</div>
                <div className="text-lg text-muted-foreground">{selectedReservation.roomType}</div>
              </div>
            </div>
            
            <Button
              size="lg"
              className="w-full text-xl h-16"
              onClick={() => setStep("signature")}
            >
              <PenTool className="w-6 h-6 mr-2" />
              Przejdź do podpisu
            </Button>
            
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-center">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Signature screen */}
        {step === "signature" && selectedReservation && (
          <div className="w-full max-w-xl">
            <div className="text-center mb-6">
              <PenTool className="w-16 h-16 mx-auto mb-4 text-blue-600" />
              <h2 className="text-3xl font-bold mb-2">Podpisz kartę meldunkową</h2>
              <p className="text-lg text-muted-foreground">
                Złóż podpis w polu poniżej
              </p>
            </div>
            
            <div className="mb-6">
              <canvas
                ref={canvasRef}
                width={500}
                height={200}
                className="w-full border-2 border-dashed border-gray-300 rounded-xl bg-white cursor-crosshair touch-none"
                style={{ maxHeight: 200 }}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={endDraw}
              />
            </div>
            
            <div className="flex gap-4 mb-6">
              <Button
                variant="outline"
                size="lg"
                className="flex-1 text-lg h-14"
                onClick={clearSignature}
              >
                <Trash2 className="w-5 h-5 mr-2" />
                Wyczyść
              </Button>
              
              <Button
                size="lg"
                className="flex-1 text-lg h-14"
                onClick={handleCheckIn}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="w-5 h-5 mr-2" />
                )}
                Zamelduj
              </Button>
            </div>
            
            <p className="text-center text-sm text-muted-foreground">
              Podpis jest opcjonalny. Możesz przejść dalej bez podpisu.
            </p>
            
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-center">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Success screen */}
        {step === "success" && checkInResult && (
          <div className="text-center max-w-xl">
            <CheckCircle className="w-32 h-32 mx-auto mb-6 text-green-500" />
            <h2 className="text-4xl font-bold mb-4 text-green-600">Meldunek zakończony!</h2>
            
            <div className="bg-green-50 border border-green-200 rounded-xl p-8 mb-8">
              <div className="text-muted-foreground mb-2">Twój pokój</div>
              <div className="text-7xl font-bold text-green-600 mb-4">
                {checkInResult.roomNumber}
              </div>
              <div className="text-lg text-muted-foreground">
                Wymeldowanie: {checkInResult.checkOutDate}
              </div>
            </div>
            
            <p className="text-xl text-muted-foreground mb-6">
              Życzymy miłego pobytu!
            </p>
            
            <p className="text-sm text-muted-foreground">
              Ekran powróci do strony głównej za kilka sekund...
            </p>
            
            <Button
              variant="outline"
              size="lg"
              className="mt-6"
              onClick={resetKiosk}
            >
              <Home className="w-5 h-5 mr-2" />
              Zakończ
            </Button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-sm text-muted-foreground">
        W razie problemów skontaktuj się z recepcją
      </footer>
    </div>
  );
}
