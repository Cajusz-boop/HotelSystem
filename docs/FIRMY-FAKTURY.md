# Firmy i faktury

## Firmy do meldunku (auto-uzupełnianie po NIP)

Przy **meldunku** (Check-in) można podać **NIP firmy** – dane uzupełnią się automatycznie z **Wykazu podatników VAT** (API Ministerstwa Finansów).

1. W formularzu meldunku w sekcji **„Firma (do meldunku / faktury)”** wpisz NIP (10 cyfr).
2. Kliknij **„Pobierz dane”** – system wywołuje API WL (`https://wl-api.mf.gov.pl`) i wypełnia nazwę, adres, kod pocztowy, miasto.
3. Możesz poprawić dane ręcznie przed zapisem.
4. Po zapisaniu rezerwacji firma jest zapisana w bazie (tabela `Company`) i powiązana z rezerwacją (`Reservation.companyId`).

**Uwaga:** API WL ma limit ok. 100 zapytań dziennie (metoda search). W razie braku podmiotu lub błędu API zobaczysz komunikat w formularzu.

### Pełna nazwa firmy (np. „Karczma Łabędź Łukasz Wojenkowski”)

W **Wykazie VAT (WL)** jest tylko **nazwa z rejestru VAT** (np. „ŁUKASZ WOJENKOWSKI”). **Pełna nazwa** z nazwą handlową (jak na [wyszukiwarka firm biznes.gov.pl](https://biznes.gov.pl/pl/wyszukiwarka-firm/)) pochodzi z **CEIDG** (Centralna Ewidencja Działalności Gospodarczej).

- **Priorytet bazy:** przy „Pobierz dane” system **najpierw** sprawdza, czy w bazie jest już firma o tym NIP (np. z poprzedniego meldunku). Jeśli tak – zwraca jej dane (w tym pełną nazwę). **Wystarczy raz dopisać pełną nazwę i zapisać rezerwację** – przy kolejnym wpisaniu tego samego NIP „Pobierz dane” zwróci już pełną nazwę z bazy.
- **Bez zapisanej firmy:** po „Pobierz dane” wpada nazwa z WL; możesz **ręcznie uzupełnić** pole „Nazwa firmy” (np. dopisać „Karczma Łabędź”) i zapisać – od następnego razu będzie z bazy.
- **Opcjonalnie (API):** ustaw w `.env` **`NIP_FULL_NAME_URL`** – adres API/proxy zwracający JSON z polem **`name`** lub **`nazwa`** (pełna nazwa z CEIDG). Przykład: `NIP_FULL_NAME_URL=https://twoj-proxy.example.com/nip/{nip}`.

## Druk faktury na POSNET

Dla rezerwacji z **powiązaną firmą** można wydrukować **fakturę na kasie fiskalnej (POSNET)**.

1. Na **grafiku rezerwacji** (Front Office) kliknij prawym przyciskiem na pasek rezerwacji.
2. Wybierz **„Drukuj fakturę (POSNET)”**.
3. System wysyła do bridge (lub kasy) dane faktury: nabywca (firma z meldunku), pozycje (transakcje z rezerwacji), suma.

Jeśli rezerwacja **nie ma** powiązanej firmy, pojawi się błąd: *„Brak firmy przy rezerwacji – wpisz NIP przy meldunku i zapisz rezerwację z firmą.”*

### Bridge (POSNET)

- **Paragony:** `POST /fiscal/print`
- **Faktury:** `POST /fiscal/invoice` (JSON: `reservationId`, `company`, `items`, `totalAmount`)

Bridge zapisuje zlecenia do `posnet-bridge/spool/` (paragony i faktury). W następnym kroku można podpiąć sterownik POSNET, aby faktycznie drukować na urządzeniu.
