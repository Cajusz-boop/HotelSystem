/**
 * Integracja z czytnikiem dokumentów / skanerem ID (MRZ, zdjęcie).
 * API urządzenia lub middleware zwraca odczytane dane z dowodu/paszportu.
 */

export interface IdDocumentData {
  documentType?: string; // ID_CARD, PASSPORT, DRIVING_LICENSE, OTHER
  documentNumber?: string;
  documentExpiry?: string; // YYYY-MM-DD
  documentIssuedBy?: string;
  surname?: string;
  givenNames?: string;
  nationality?: string; // kod ISO np. POL, DEU
  dateOfBirth?: string; // YYYY-MM-DD
  sex?: string; // M, F
  mrz?: string; // pełna linia MRZ (np. 2 lub 3 linie)
  photoBase64?: string; // zdjęcie z dokumentu (base64, opcjonalnie)
}

/**
 * Pobiera ostatni odczyt z czytnika dokumentów.
 * Wymaga ID_SCANNER_API_URL w .env – endpoint GET zwracający JSON z polami dokumentu.
 * Typowa odpowiedź: { documentType, documentNumber, documentExpiry, surname, givenNames, nationality, dateOfBirth, sex, mrz, photoBase64? }
 */
export async function fetchDocumentFromScanner(
  apiUrl?: string | null
): Promise<IdDocumentData | null> {
  const url = (apiUrl || process.env.ID_SCANNER_API_URL || "").trim();
  if (!url) {
    return null;
  }

  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`ID Scanner API error: ${res.status} ${res.statusText}`);
  }

  const raw = (await res.json()) as Record<string, unknown>;
  return normalizeIdDocumentResponse(raw);
}

/**
 * Normalizuje odpowiedź API skanera do IdDocumentData.
 * Obsługuje różne nazwy pól (camelCase, snake_case, wielkość liter).
 */
export function normalizeIdDocumentResponse(raw: Record<string, unknown>): IdDocumentData {
  const get = (... keys: string[]): unknown => {
    for (const k of keys) {
      const v = raw[k];
      if (v !== undefined && v !== null) return v;
    }
    return undefined;
  };
  const str = (v: unknown): string | undefined =>
    typeof v === "string" && v.trim() ? v.trim() : undefined;
  const dateStr = (v: unknown): string | undefined => {
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return v.trim();
    if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
    return undefined;
  };

  return {
    documentType: str(get("documentType", "DocumentType", "type")),
    documentNumber: str(get("documentNumber", "DocumentNumber", "number", "docNumber")),
    documentExpiry: dateStr(get("documentExpiry", "DocumentExpiry", "expiry", "expiryDate")),
    documentIssuedBy: str(get("documentIssuedBy", "DocumentIssuedBy", "issuedBy", "authority")),
    surname: str(get("surname", "Surname", "lastName", "familyName")),
    givenNames: str(get("givenNames", "GivenNames", "firstName", "firstNames")),
    nationality: str(get("nationality", "Nationality", "country", "nationalityCode")),
    dateOfBirth: dateStr(get("dateOfBirth", "DateOfBirth", "birthDate", "dob")),
    sex: str(get("sex", "Sex", "gender")),
    mrz: str(get("mrz", "MRZ", "mrzLine1", "mrzLines")),
    photoBase64: str(get("photoBase64", "PhotoBase64", "photo", "image")),
  };
}

/**
 * Parsuje MRZ (Machine Readable Zone) – TD1 (dowód, 3×30 znaków) lub TD3 (paszport, 2×44 znaków).
 * lines – pełny MRZ (np. "P<POLKOWALSKA<<ANNA<<<<<<<<<<<<<<<<<<<\nABC123456<0POL8501012F3001018<<<<<<<<<<<<<<<6")
 */
export function parseMrz(lines: string): IdDocumentData {
  const raw = lines.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  const arr = raw.split("\n").map((s) => s.replace(/</g, " ").trim());
  const line1 = arr[0] ?? "";
  const line2 = arr[1] ?? "";
  const line3 = arr[2] ?? "";

  let documentType: string | undefined;
  let documentNumber: string | undefined;
  let documentExpiry: string | undefined;
  let nationality: string | undefined;
  let dateOfBirth: string | undefined;
  let sex: string | undefined;
  let surname: string | undefined;
  let givenNames: string | undefined;

  if (line2.length >= 36) {
    documentNumber = (line2.slice(0, 9).replace(/\s/g, "") || undefined);
    nationality = line2.slice(10, 13).replace(/\s/g, "") || undefined;
    const dob = line2.slice(13, 19);
    if (dob.match(/^\d{6}$/)) {
      const y = parseInt(dob.slice(0, 2), 10);
      const yy = y >= 30 ? 1900 + y : 2000 + y;
      dateOfBirth = `${yy}-${dob.slice(2, 4)}-${dob.slice(4, 6)}`;
    }
    sex = line2.slice(20, 21) || undefined;
    const exp = line2.slice(21, 27);
    if (exp.match(/^\d{6}$/)) {
      const ey = parseInt(exp.slice(0, 2), 10);
      const eyy = ey >= 30 ? 1900 + ey : 2000 + ey;
      documentExpiry = `${eyy}-${exp.slice(2, 4)}-${exp.slice(4, 6)}`;
    }
  }

  if (line1.length >= 5) {
    const code = line1[0];
    documentType = code === "P" ? "PASSPORT" : code === "I" || code === "A" ? "ID_CARD" : "OTHER";
    if (line1.length >= 44) {
      const namePart = line1.slice(5, 44).replace(/\s+/g, " ").trim();
      const parts = namePart.split(/\s{2,}/);
      surname = parts[0]?.replace(/\s/g, " ").trim();
      givenNames = parts.slice(1).join(" ").replace(/\s/g, " ").trim() || undefined;
    } else if (line1.length >= 30 && line3.length >= 30) {
      const namePart = (line1.slice(5, 30) + " " + line3.slice(0, 30)).replace(/\s+/g, " ").trim();
      const parts = namePart.split(/\s{2,}/);
      surname = parts[0]?.replace(/\s/g, " ").trim();
      givenNames = parts.slice(1).join(" ").replace(/\s/g, " ").trim() || undefined;
    }
  }

  if (line3.length >= 9 && !documentNumber) {
    documentNumber = line3.slice(0, 9).replace(/\s/g, "") || undefined;
  }

  return {
    documentType,
    documentNumber,
    documentExpiry,
    surname,
    givenNames,
    nationality,
    dateOfBirth,
    sex,
    mrz: raw || undefined,
  };
}

/**
 * OCR dokumentu z obrazu – wysyła zdjęcie do zewnętrznego API (np. Tesseract, Google Vision), zwraca IdDocumentData.
 * Wymaga ID_OCR_API_URL w .env. POST body: { "image": "data:image/jpeg;base64,..." } lub multipart. Odpowiedź: { "mrz": "..." } lub pełny obiekt dokumentu.
 */
export async function ocrDocumentFromImage(imageBase64: string): Promise<IdDocumentData> {
  const url = process.env.ID_OCR_API_URL?.trim();
  if (!url) {
    throw new Error("Skonfiguruj ID_OCR_API_URL w .env (endpoint OCR dla zdjęć dokumentów).");
  }

  const body = JSON.stringify({
    image: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body,
  });
  if (!res.ok) {
    throw new Error(`OCR API error: ${res.status} ${res.statusText}`);
  }

  const raw = (await res.json()) as Record<string, unknown>;
  const mrz = typeof raw.mrz === "string" ? raw.mrz : typeof raw.text === "string" ? raw.text : undefined;
  if (mrz) {
    return parseMrz(mrz);
  }
  return normalizeIdDocumentResponse(raw);
}

/**
 * Mapuje IdDocumentData na pola Guest (do aktualizacji gościa przy meldunku).
 */
export function idDocumentToGuestFields(
  doc: IdDocumentData
): {
  documentType?: string;
  documentNumber?: string;
  documentExpiry?: Date | null;
  documentIssuedBy?: string;
  mrz?: string;
  name?: string;
  dateOfBirth?: Date | null;
  nationality?: string;
  gender?: string;
} {
  const name = [doc.givenNames, doc.surname].filter(Boolean).join(" ") || undefined;
  const documentExpiry = doc.documentExpiry ? new Date(doc.documentExpiry + "T00:00:00Z") : undefined;
  const dateOfBirth = doc.dateOfBirth ? new Date(doc.dateOfBirth + "T00:00:00Z") : undefined;
  return {
    documentType: doc.documentType ?? undefined,
    documentNumber: doc.documentNumber ?? undefined,
    documentExpiry: documentExpiry ?? null,
    documentIssuedBy: doc.documentIssuedBy ?? undefined,
    mrz: doc.mrz ?? undefined,
    name: name || undefined,
    dateOfBirth: dateOfBirth ?? null,
    nationality: doc.nationality ?? undefined,
    gender: doc.sex ?? undefined,
  };
}
