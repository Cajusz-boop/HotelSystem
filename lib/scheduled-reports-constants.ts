export const SCHEDULED_REPORT_TYPES = [
  { value: "MANAGEMENT_DAILY", label: "Raport dobowy (management)" },
  { value: "OCCUPANCY", label: "Raport obłożenia" },
  { value: "REVENUE", label: "Raport przychodów" },
  { value: "COMMISSION_OTA", label: "Raport prowizji OTA" },
] as const;

export type ScheduledReportType = (typeof SCHEDULED_REPORT_TYPES)[number]["value"];
