"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { sendInvoiceByEmail, sendProformaByEmail } from "@/app/actions/email";
import { toast } from "sonner";

const DEFAULT_INVOICE_SUBJECT = (num: string) =>
  `Faktura ${num} — Karczma Łabędź`;
const DEFAULT_INVOICE_MESSAGE = (num: string, brutto: string) =>
  `Szanowni Państwo,

W załączeniu przesyłamy fakturę ${num} na kwotę ${brutto} zł.

Dziękujemy za skorzystanie z naszych usług.
Zapraszamy ponownie!

Z poważaniem,
Karczma Łabędź
ul. Marsa 2, 14-200 Nowa Wieś
tel. 604 070 908
recepcja@labedzhotel.pl`;

const DEFAULT_PROFORMA_SUBJECT = (num: string) =>
  `Proforma ${num} — Karczma Łabędź`;
const DEFAULT_PROFORMA_MESSAGE = (num: string, brutto: string) =>
  `Szanowni Państwo,

W załączeniu przesyłamy proformę ${num} na kwotę ${brutto} zł.

Prosimy o wpłatę na konto:
Alior Bank
64 2490 0005 0000 4530 3746 8866

Z poważaniem,
Karczma Łabędź
ul. Marsa 2, 14-200 Nowa Wieś
tel. 604 070 908
recepcja@labedzhotel.pl`;

export interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: "invoice" | "proforma";
  documentId: string;
  documentNumber: string;
  amountGross: number;
  defaultEmail?: string;
  amountOverride?: number | null;
  /** Wywoływane przed wysyłką — zapisuje zmiany w dokumencie. Musi zwrócić true aby kontynuować. */
  onBeforeSend?: () => Promise<boolean>;
  onSent?: () => void;
}

export function SendEmailDialog({
  open,
  onOpenChange,
  documentType,
  documentId,
  documentNumber,
  amountGross,
  defaultEmail = "",
  amountOverride,
  onBeforeSend,
  onSent,
}: SendEmailDialogProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [printCopy, setPrintCopy] = useState(true);
  const [sending, setSending] = useState(false);

  const bruttoStr = amountGross.toFixed(2);

  useEffect(() => {
    if (open) {
      setEmail(defaultEmail);
      if (documentType === "invoice") {
        setSubject(DEFAULT_INVOICE_SUBJECT(documentNumber));
        setMessage(DEFAULT_INVOICE_MESSAGE(documentNumber, bruttoStr));
      } else {
        setSubject(DEFAULT_PROFORMA_SUBJECT(documentNumber));
        setMessage(DEFAULT_PROFORMA_MESSAGE(documentNumber, bruttoStr));
      }
      setPrintCopy(true);
    }
  }, [open, defaultEmail, documentType, documentNumber, bruttoStr]);

  const handleSend = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error("Podaj adres email odbiorcy");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error("Podaj poprawny adres email");
      return;
    }

    setSending(true);
    try {
      if (onBeforeSend) {
        const ok = await onBeforeSend();
        if (!ok) {
          setSending(false);
          return;
        }
      }

      if (documentType === "invoice") {
        const res = await sendInvoiceByEmail({
          invoiceId: documentId,
          recipientEmail: trimmedEmail,
          subject: subject.trim(),
          message: message.trim(),
          amountOverride,
        });
        if (!res.success) {
          toast.error(res.error ?? "Błąd wysyłki");
          return;
        }
      } else {
        const res = await sendProformaByEmail({
          proformaId: documentId,
          recipientEmail: trimmedEmail,
          subject: subject.trim(),
          message: message.trim(),
        });
        if (!res.success) {
          toast.error(res.error ?? "Błąd wysyłki");
          return;
        }
      }

      const docLabel = documentType === "invoice" ? "Faktura" : "Proforma";
      toast.success(
        printCopy
          ? `${docLabel} ${documentNumber} wysłana na ${trimmedEmail}. Drukowanie kopii...`
          : `${docLabel} ${documentNumber} wysłana na ${trimmedEmail}.`
      );

      if (printCopy) {
        const apiPath = documentType === "invoice" ? "invoice" : "proforma";
        const url = `/api/finance/${apiPath}/${documentId}/pdf?variant=copy`;
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = url;
        document.body.appendChild(iframe);
        iframe.addEventListener("load", () => {
          iframe.contentWindow?.print();
          setTimeout(() => {
            if (iframe.parentNode) document.body.removeChild(iframe);
          }, 1000);
        });
      }

      onOpenChange(false);
      onSent?.();
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Wyślij na email</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email odbiorcy</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="subject">Temat</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="message">Wiadomość</Label>
            <Textarea
              id="message"
              rows={8}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="printCopy"
              checked={printCopy}
              onCheckedChange={(v) => setPrintCopy(v === true)}
            />
            <Label
              htmlFor="printCopy"
              className="text-sm font-normal cursor-pointer"
            >
              Drukuj kopię dla recepcji
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? "Wysyłanie…" : "Wyślij"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
