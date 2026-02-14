"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { completeWebCheckIn } from "@/app/actions/web-check-in";
import Link from "next/link";

interface WebCheckInSignatureProps {
  token: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  roomNumber: string;
}

export function WebCheckInSignature({
  token,
  guestName,
  checkIn,
  checkOut,
  roomNumber,
}: WebCheckInSignatureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
    }
    return ctx;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
    }
  }, []);

  const startDraw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = getCtx();
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      const x =
        "touches" in e
          ? e.touches[0].clientX - rect.left
          : e.clientX - rect.left;
      const y =
        "touches" in e
          ? e.touches[0].clientY - rect.top
          : e.clientY - rect.top;
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
      const x =
        "touches" in e
          ? e.touches[0].clientX - rect.left
          : e.clientX - rect.left;
      const y =
        "touches" in e
          ? e.touches[0].clientY - rect.top
          : e.clientY - rect.top;
      ctx.lineTo(x, y);
      ctx.stroke();
    },
    [isDrawing, getCtx]
  );

  const endDraw = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = getCtx();
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setError(null);
  }, [getCtx]);

  const submit = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    if (!dataUrl || dataUrl.length < 100) {
      setError("Podpisz w polu powyżej (przeciągnij palcem lub myszką).");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await completeWebCheckIn(token, dataUrl);
      if (result.success) {
        setDone(true);
      } else {
        setError(result.error ?? "Błąd meldunku");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd");
    } finally {
      setLoading(false);
    }
  }, [token]);

  if (done) {
    return (
      <div className="max-w-md w-full rounded-lg border bg-card p-8 shadow-sm">
        <h1 className="text-xl font-semibold mb-2 text-green-600">Meldunek zakończony</h1>
        <p className="text-muted-foreground mb-6">
          Karta meldunkowa została podpisana zdalnie. Jesteś zameldowany/a. Do zobaczenia w recepcji!
        </p>
        <Link href="/" className="text-sm text-primary hover:underline">
          ← Zamknij
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md w-full rounded-lg border bg-card p-8 shadow-sm">
      <h1 className="text-xl font-semibold mb-2">Web Check-in</h1>
      <p className="text-muted-foreground mb-4">
        Witaj, <strong>{guestName}</strong>. Pobyt: {checkIn} – {checkOut}, pokój {roomNumber}.
      </p>
      <p className="text-sm text-muted-foreground mb-4">
        Podpisz poniżej (karta meldunkowa). Po zatwierdzeniu zostaniesz zameldowany/a.
      </p>
      <div className="mb-4">
        <canvas
          ref={canvasRef}
          width={400}
          height={160}
          className="w-full max-w-full border border-input rounded-md bg-white touch-none cursor-crosshair"
          style={{ maxHeight: 160 }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        <Button type="button" variant="outline" size="sm" onClick={clear}>
          Wyczyść podpis
        </Button>
        <Button type="button" onClick={submit} disabled={loading}>
          {loading ? "Meldowanie…" : "Potwierdź i zamelduj"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive mb-2">{error}</p>}
      <Link href="/" className="text-sm text-primary hover:underline">
        ← Anuluj
      </Link>
    </div>
  );
}
