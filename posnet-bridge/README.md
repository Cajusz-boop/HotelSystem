# POSNET bridge (Windows)

Ta usługa działa jako „mostek” pomiędzy aplikacją hotelową (Next.js) a kasą fiskalną **POSNET Trio Online**.

Na start **nie drukuje** na urządzeniu – tylko przyjmuje zlecenia (JSON) i zapisuje je do katalogu `spool/`.
To pozwala uruchomić integrację end‑to‑end, a następnie w kolejnym kroku podpiąć sterownik POSNET/OPOS/SDK w tym miejscu.

## Uruchomienie

W katalogu głównym projektu:

```bash
npm run posnet:bridge
```

Bridge wystartuje na `http://127.0.0.1:9977`.

## Endpointy

- `GET /health` → `{ ok: true }`
- `POST /fiscal/print` → zapis do spool i zwraca `{ success: true, receiptNumber: "..." }`

## Konfiguracja (ENV)

- `POSNET_BRIDGE_PORT` (domyślnie `9977`)
- `FISCAL_POSNET_API_KEY` (opcjonalnie – jeśli ustawione, wymagany nagłówek `x-api-key`)
- `FISCAL_POSNET_SPOOL_DIR` (opcjonalnie – gdzie zapisywać JSON)

## Następny krok (druk na POSNET)

W `posnet-bridge/server.mjs` w miejscu oznaczonym komentarzem można:

- wywołać sterownik OPOS/UPOS/.NET,
- albo odpalić dedykowany program producenta,
- albo użyć protokołu producenta (jeśli masz dokumentację) do komunikacji przez USB/RS232/WiFi.

