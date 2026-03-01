"use client";

import { useEffect, useState, useCallback } from "react";
import { WifiOff, Wifi, ArrowRight } from "lucide-react";

const MAIN_SERVER = "https://hotel.karczma-labedz.pl";
const LOCAL_SERVER = "http://10.119.169.20:3000";
const CHECK_INTERVAL = 30000; // 30 sekund
const REDIRECT_DELAY = 5000; // 5 sekund przed przekierowaniem

type ConnectionStatus = "online" | "offline" | "checking" | "local";

export function ConnectionMonitor() {
  const [status, setStatus] = useState<ConnectionStatus>("checking");
  const [isOnLocalServer, setIsOnLocalServer] = useState(false);
  const [mainServerAvailable, setMainServerAvailable] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  // Sprawdź czy jesteśmy na serwerze lokalnym
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isLocal =
        window.location.hostname === "10.119.169.20" ||
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";
      setIsOnLocalServer(isLocal);
    }
  }, []);

  // Funkcja sprawdzająca dostępność serwera
  const checkServer = useCallback(async (url: string): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      await fetch(`${url}/api/health`, {
        method: "HEAD",
        mode: "no-cors",
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return true;
    } catch {
      return false;
    }
  }, []);

  // Główna logika monitorowania
  useEffect(() => {
    let redirectTimeout: NodeJS.Timeout | undefined;
    let countdownInterval: NodeJS.Timeout | undefined;

    const checkConnection = async () => {
      if (isOnLocalServer) {
        // Jesteśmy na serwerze lokalnym - sprawdź czy główny serwer jest dostępny
        const mainAvailable = await checkServer(MAIN_SERVER);
        setMainServerAvailable(mainAvailable);

        if (mainAvailable && !dismissed) {
          setShowBanner(true);
          setStatus("local");
        } else {
          setStatus("local");
        }
      } else {
        // Jesteśmy na głównym serwerze - sprawdź połączenie
        const isOnline = navigator.onLine;

        if (!isOnline) {
          setStatus("offline");
          setShowBanner(true);
          setCountdown(REDIRECT_DELAY / 1000);

          // Countdown przed przekierowaniem
          countdownInterval = setInterval(() => {
            setCountdown((prev) => {
              if (prev <= 1) {
                clearInterval(countdownInterval);
                window.location.href = LOCAL_SERVER;
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        } else {
          // Sprawdź czy główny serwer odpowiada
          const mainAvailable = await checkServer(MAIN_SERVER);

          if (!mainAvailable) {
            setStatus("offline");
            setShowBanner(true);
            setCountdown(REDIRECT_DELAY / 1000);

            countdownInterval = setInterval(() => {
              setCountdown((prev) => {
                if (prev <= 1) {
                  clearInterval(countdownInterval);
                  window.location.href = LOCAL_SERVER;
                  return 0;
                }
                return prev - 1;
              });
            }, 1000);
          } else {
            setStatus("online");
            setShowBanner(false);
          }
        }
      }
    };

    // Pierwsze sprawdzenie po krótkim opóźnieniu
    const initialCheck = setTimeout(checkConnection, 2000);

    // Regularne sprawdzanie
    const intervalId = setInterval(checkConnection, CHECK_INTERVAL);

    // Nasłuchuj zmian stanu sieci
    const handleOnline = () => checkConnection();
    const handleOffline = () => checkConnection();

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      clearTimeout(initialCheck);
      clearInterval(intervalId);
      if (redirectTimeout) clearTimeout(redirectTimeout);
      if (countdownInterval) clearInterval(countdownInterval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [isOnLocalServer, checkServer, dismissed]);

  const handleGoToMain = () => {
    window.location.href = MAIN_SERVER;
  };

  const handleStayLocal = () => {
    setDismissed(true);
    setShowBanner(false);
  };

  const handleCancelRedirect = () => {
    setCountdown(0);
    setShowBanner(false);
  };

  if (!showBanner) return null;

  // Banner dla serwera lokalnego - internet wrócił
  if (isOnLocalServer && mainServerAvailable) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] bg-green-600 text-white px-4 py-3 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Wifi className="w-5 h-5" />
            <div>
              <p className="font-medium">Internet dostępny!</p>
              <p className="text-sm opacity-90">
                Główny serwer jest online. Możesz wrócić do wersji w chmurze.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleStayLocal}
              className="px-3 py-1.5 text-sm bg-green-700 hover:bg-green-800 rounded transition-colors"
            >
              Zostań lokalnie
            </button>
            <button
              onClick={handleGoToMain}
              className="px-3 py-1.5 text-sm bg-white text-green-700 hover:bg-green-50 rounded font-medium flex items-center gap-1 transition-colors"
            >
              Przejdź do chmury
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Banner dla głównego serwera - brak połączenia
  if (!isOnLocalServer && status === "offline") {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] bg-red-600 text-white px-4 py-3 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <WifiOff className="w-5 h-5 animate-pulse" />
            <div>
              <p className="font-medium">Brak połączenia z internetem!</p>
              <p className="text-sm opacity-90">
                {countdown > 0
                  ? `Przełączam na serwer lokalny za ${countdown}s...`
                  : "Przekierowuję na serwer lokalny..."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancelRedirect}
              className="px-3 py-1.5 text-sm bg-red-700 hover:bg-red-800 rounded transition-colors"
            >
              Anuluj
            </button>
            <button
              onClick={() => (window.location.href = LOCAL_SERVER)}
              className="px-3 py-1.5 text-sm bg-white text-red-700 hover:bg-red-50 rounded font-medium flex items-center gap-1 transition-colors"
            >
              Przejdź teraz
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
