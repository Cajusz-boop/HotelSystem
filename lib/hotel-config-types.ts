/** Typy i stałe dla konfiguracji hotelu – w osobnym pliku, bo pliki "use server" mogą eksportować tylko async funkcje. */

export type HotelConfigData = {
  name: string;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  nip: string | null;
  krs: string | null;
  logoUrl: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  defaultCheckInTime: string | null;
  defaultCheckOutTime: string | null;
  floors: string[];
};

export type CustomFormFieldType = "text" | "number" | "date" | "select" | "checkbox";

export type CustomFormField = {
  id: string;
  key: string;
  label: string;
  type: CustomFormFieldType;
  required: boolean;
  order: number;
  options?: string[];
};

export type FormType = "CHECK_IN" | "RESERVATION" | "GUEST";

export type FormFieldsConfig = Partial<Record<FormType, CustomFormField[]>>;

export const FORM_TYPE_LABELS: Record<FormType, string> = {
  CHECK_IN: "Meldunek (check-in)",
  RESERVATION: "Rezerwacja",
  GUEST: "Karta gościa",
};
