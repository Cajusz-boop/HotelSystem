/**
 * Google Service Account auth z Domain-Wide Delegation (impersonacja użytkownika).
 * Wymaga: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, GOOGLE_IMPERSONATE_USER
 */
import { google } from "googleapis";

export function getGoogleAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !key) {
    throw new Error(
      "Brak GOOGLE_SERVICE_ACCOUNT_EMAIL lub GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY w .env"
    );
  }

  return new google.auth.JWT({
    email,
    key: key.replace(/\\n/g, "\n"),
    scopes: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/spreadsheets",
    ],
    subject: process.env.GOOGLE_IMPERSONATE_USER,
  });
}
