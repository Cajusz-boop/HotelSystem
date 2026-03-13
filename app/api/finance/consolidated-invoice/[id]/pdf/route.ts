/**
 * Reeksportuje handler z głównego endpointu invoice.
 * Faktura zbiorcza jest Invoice (sourceType=CONSOLIDATED) — ten sam model.
 * Zachowano dla kompatybilności wstecznej (stare linki).
 */
export { GET } from "@/app/api/finance/invoice/[id]/pdf/route";
