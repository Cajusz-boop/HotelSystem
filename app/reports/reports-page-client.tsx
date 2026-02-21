"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getManagementReportData,
  getCommissionReport,
  type ManagementReportData,
  type CommissionReportData,
} from "@/app/actions/finance";
import { getKpiReport, getOccupancyReport, getOccupancyForecastReport, getYearOverYearReport, getMonthOverMonthReport, getCashShiftReport, getBankReconciliationReport, getRevParReport, getAdrReport, getRevenueReport, getRevenueBySegmentReport, getRevenueBySourceReport, getRevenueByChannelReport, getRevenueByGuestSegmentReport, getRevenueByRateCodeReport, getRevenueByRoomTypeReport, getReservationsPeriodReport, getNoShowReport, getCancellationReport, getDailyCheckInsReport, getDailyCheckOutsReport, getInHouseGuestsReport, getHousekeepingWorkloadReport, getMaintenanceIssuesReport, getVipGuestsReport, getBirthdayReport, type KpiReport, type OccupancyReport, type RevParReport, type AdrReport, type RevenueReport, type RevenueBySegmentReport, type RevenueBySourceReport, type RevenueByChannelReport, type RevenueByGuestSegmentReport, type RevenueByRateCodeReport, type RevenueByRoomTypeReport, type ReservationsPeriodReport, type NoShowReport, type CancellationReport, type DailyCheckInsReport, type DailyCheckOutsReport, type InHouseGuestsReport, type HousekeepingWorkloadReport, type MaintenanceIssuesReport, type VipGuestsReport, type BirthdayReport, type YearOverYearReport, type MonthOverMonthReport, type CashShiftReport, type BankReconciliationReport } from "@/app/actions/dashboard";
import { getMealReport, getMealCountByDateReport, type MealCountByDateReport } from "@/app/actions/meals";
import { getMinibarConsumptionReport, type MinibarConsumptionReport } from "@/app/actions/minibar";
import Link from "next/link";
import { FileText, Printer, BarChart3, History, LogIn, User, FileDown, Mail } from "lucide-react";
import { exportToExcel } from "@/lib/export-excel";
import {
  listScheduledReports,
  createScheduledReport,
  updateScheduledReport,
  deleteScheduledReport,
  sendReportByEmail,
  type ScheduledReportRow,
} from "@/app/actions/scheduled-reports";
import { SCHEDULED_REPORT_TYPES } from "@/lib/scheduled-reports-constants";

function formatDateForInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function thirtyDaysAgo(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d;
}

function canShowReport(permissions: string[] | null, code: string): boolean {
  if (!permissions || permissions.length === 0) return true;
  return permissions.includes(code);
}

export function ReportsPageClient({
  permissions,
}: {
  permissions: string[] | null;
}) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const [dateStr, setDateStr] = useState(formatDateForInput(yesterday));
  const [report, setReport] = useState<ManagementReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [kpiFrom, setKpiFrom] = useState(() => formatDateForInput(thirtyDaysAgo()));
  const [kpiTo, setKpiTo] = useState(formatDateForInput(new Date()));
  const [kpi, setKpi] = useState<KpiReport | null>(null);
  const [kpiLoading, setKpiLoading] = useState(false);

  const [gusFrom, setGusFrom] = useState(() => formatDateForInput(thirtyDaysAgo()));
  const [gusTo, setGusTo] = useState(formatDateForInput(new Date()));
  const [policeDate, setPoliceDate] = useState(formatDateForInput(new Date()));

  const [mealReportDate, setMealReportDate] = useState(formatDateForInput(new Date()));
  const [mealReport, setMealReport] = useState<Extract<Awaited<ReturnType<typeof getMealReport>>, { success: true }>["data"] | null>(null);
  const [mealReportLoading, setMealReportLoading] = useState(false);

  const [mealCountFrom, setMealCountFrom] = useState(() => formatDateForInput(thirtyDaysAgo()));
  const [mealCountTo, setMealCountTo] = useState(formatDateForInput(new Date()));
  const [mealCountReport, setMealCountReport] = useState<MealCountByDateReport | null>(null);
  const [mealCountLoading, setMealCountLoading] = useState(false);

  const [minibarFrom, setMinibarFrom] = useState(() => formatDateForInput(thirtyDaysAgo()));
  const [minibarTo, setMinibarTo] = useState(formatDateForInput(new Date()));
  const [minibarReport, setMinibarReport] = useState<MinibarConsumptionReport | null>(null);
  const [minibarReportLoading, setMinibarReportLoading] = useState(false);

  const [occFrom, setOccFrom] = useState(() => formatDateForInput(thirtyDaysAgo()));
  const [occTo, setOccTo] = useState(formatDateForInput(new Date()));
  const [occupancyReport, setOccupancyReport] = useState<OccupancyReport | null>(null);
  const [occLoading, setOccLoading] = useState(false);

  const [revParFrom, setRevParFrom] = useState(() => formatDateForInput(thirtyDaysAgo()));
  const [revParTo, setRevParTo] = useState(formatDateForInput(new Date()));
  const [revParReport, setRevParReport] = useState<RevParReport | null>(null);
  const [revParLoading, setRevParLoading] = useState(false);

  const [adrFrom, setAdrFrom] = useState(() => formatDateForInput(thirtyDaysAgo()));
  const [adrTo, setAdrTo] = useState(formatDateForInput(new Date()));
  const [adrReport, setAdrReport] = useState<AdrReport | null>(null);
  const [adrLoading, setAdrLoading] = useState(false);

  const [revReportFrom, setRevReportFrom] = useState(() => formatDateForInput(thirtyDaysAgo()));
  const [revReportTo, setRevReportTo] = useState(formatDateForInput(new Date()));
  const [revenueReport, setRevenueReport] = useState<RevenueReport | null>(null);
  const [revenueReportLoading, setRevenueReportLoading] = useState(false);

  const [segReportFrom, setSegReportFrom] = useState(() => formatDateForInput(thirtyDaysAgo()));
  const [segReportTo, setSegReportTo] = useState(formatDateForInput(new Date()));
  const [segmentReport, setSegmentReport] = useState<RevenueBySegmentReport | null>(null);
  const [segmentReportLoading, setSegmentReportLoading] = useState(false);

  const [sourceReportFrom, setSourceReportFrom] = useState(() => formatDateForInput(thirtyDaysAgo()));
  const [sourceReportTo, setSourceReportTo] = useState(formatDateForInput(new Date()));
  const [sourceReport, setSourceReport] = useState<RevenueBySourceReport | null>(null);
  const [sourceReportLoading, setSourceReportLoading] = useState(false);

  const [channelReportFrom, setChannelReportFrom] = useState(() => formatDateForInput(thirtyDaysAgo()));
  const [channelReportTo, setChannelReportTo] = useState(formatDateForInput(new Date()));
  const [channelReport, setChannelReport] = useState<RevenueByChannelReport | null>(null);
  const [channelReportLoading, setChannelReportLoading] = useState(false);

  const [guestSegReportFrom, setGuestSegReportFrom] = useState(() => formatDateForInput(thirtyDaysAgo()));
  const [guestSegReportTo, setGuestSegReportTo] = useState(formatDateForInput(new Date()));
  const [guestSegReport, setGuestSegReport] = useState<RevenueByGuestSegmentReport | null>(null);
  const [guestSegReportLoading, setGuestSegReportLoading] = useState(false);

  const [rateCodeReportFrom, setRateCodeReportFrom] = useState(() => formatDateForInput(thirtyDaysAgo()));
  const [rateCodeReportTo, setRateCodeReportTo] = useState(formatDateForInput(new Date()));
  const [rateCodeReport, setRateCodeReport] = useState<RevenueByRateCodeReport | null>(null);
  const [rateCodeReportLoading, setRateCodeReportLoading] = useState(false);

  const [roomTypeReportFrom, setRoomTypeReportFrom] = useState(() => formatDateForInput(thirtyDaysAgo()));
  const [roomTypeReportTo, setRoomTypeReportTo] = useState(formatDateForInput(new Date()));
  const [roomTypeReport, setRoomTypeReport] = useState<RevenueByRoomTypeReport | null>(null);
  const [roomTypeReportLoading, setRoomTypeReportLoading] = useState(false);

  const [periodReportFrom, setPeriodReportFrom] = useState(() => formatDateForInput(thirtyDaysAgo()));
  const [periodReportTo, setPeriodReportTo] = useState(formatDateForInput(new Date()));
  const [periodReport, setPeriodReport] = useState<ReservationsPeriodReport | null>(null);
  const [periodReportLoading, setPeriodReportLoading] = useState(false);

  const [noShowReportFrom, setNoShowReportFrom] = useState(() => formatDateForInput(thirtyDaysAgo()));
  const [noShowReportTo, setNoShowReportTo] = useState(formatDateForInput(new Date()));
  const [noShowReport, setNoShowReport] = useState<NoShowReport | null>(null);
  const [noShowReportLoading, setNoShowReportLoading] = useState(false);

  const [cancellationReportFrom, setCancellationReportFrom] = useState(() => formatDateForInput(thirtyDaysAgo()));
  const [cancellationReportTo, setCancellationReportTo] = useState(formatDateForInput(new Date()));
  const [cancellationReport, setCancellationReport] = useState<CancellationReport | null>(null);
  const [cancellationReportLoading, setCancellationReportLoading] = useState(false);

  const [dailyCheckInsFrom, setDailyCheckInsFrom] = useState(() => formatDateForInput(thirtyDaysAgo()));
  const [dailyCheckInsTo, setDailyCheckInsTo] = useState(formatDateForInput(new Date()));
  const [dailyCheckInsReport, setDailyCheckInsReport] = useState<DailyCheckInsReport | null>(null);
  const [dailyCheckInsLoading, setDailyCheckInsLoading] = useState(false);

  const [dailyCheckOutsFrom, setDailyCheckOutsFrom] = useState(() => formatDateForInput(thirtyDaysAgo()));
  const [dailyCheckOutsTo, setDailyCheckOutsTo] = useState(formatDateForInput(new Date()));
  const [dailyCheckOutsReport, setDailyCheckOutsReport] = useState<DailyCheckOutsReport | null>(null);
  const [dailyCheckOutsLoading, setDailyCheckOutsLoading] = useState(false);

  const [inHouseReport, setInHouseReport] = useState<InHouseGuestsReport | null>(null);
  const [inHouseReportLoading, setInHouseReportLoading] = useState(false);

  const [housekeepingFrom, setHousekeepingFrom] = useState(() => formatDateForInput(thirtyDaysAgo()));
  const [housekeepingTo, setHousekeepingTo] = useState(formatDateForInput(new Date()));
  const [housekeepingReport, setHousekeepingReport] = useState<HousekeepingWorkloadReport | null>(null);
  const [housekeepingLoading, setHousekeepingLoading] = useState(false);

  const [maintenanceFrom, setMaintenanceFrom] = useState(() => formatDateForInput(thirtyDaysAgo()));
  const [maintenanceTo, setMaintenanceTo] = useState(formatDateForInput(new Date()));
  const [maintenanceReport, setMaintenanceReport] = useState<MaintenanceIssuesReport | null>(null);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);

  const [vipFrom, setVipFrom] = useState(() => formatDateForInput(thirtyDaysAgo()));
  const [vipTo, setVipTo] = useState(formatDateForInput(new Date()));
  const [vipReport, setVipReport] = useState<VipGuestsReport | null>(null);
  const [vipReportLoading, setVipReportLoading] = useState(false);

  const [birthdayFrom, setBirthdayFrom] = useState(() => formatDateForInput(new Date()));
  const [birthdayTo, setBirthdayTo] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return formatDateForInput(d);
  });
  const [birthdayReport, setBirthdayReport] = useState<BirthdayReport | null>(null);
  const [birthdayReportLoading, setBirthdayReportLoading] = useState(false);

  const [forecastDays, setForecastDays] = useState<30 | 90>(30);
  const [forecastReport, setForecastReport] = useState<OccupancyReport | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);

  const [yoyYear, setYoyYear] = useState(new Date().getFullYear());
  const [yoyReport, setYoyReport] = useState<YearOverYearReport | null>(null);
  const [yoyLoading, setYoyLoading] = useState(false);

  const [momYear, setMomYear] = useState(new Date().getFullYear());
  const [momMonth, setMomMonth] = useState(new Date().getMonth() + 1);
  const [momReport, setMomReport] = useState<MonthOverMonthReport | null>(null);
  const [momLoading, setMomLoading] = useState(false);

  const [cashShiftFrom, setCashShiftFrom] = useState(() => formatDateForInput(thirtyDaysAgo()));
  const [cashShiftTo, setCashShiftTo] = useState(formatDateForInput(new Date()));
  const [cashShiftReport, setCashShiftReport] = useState<CashShiftReport | null>(null);
  const [cashShiftLoading, setCashShiftLoading] = useState(false);

  const [bankRecFrom, setBankRecFrom] = useState(() => formatDateForInput(thirtyDaysAgo()));
  const [bankRecTo, setBankRecTo] = useState(formatDateForInput(new Date()));
  const [bankRecReport, setBankRecReport] = useState<BankReconciliationReport | null>(null);
  const [bankRecLoading, setBankRecLoading] = useState(false);

  const [commissionOtaFrom, setCommissionOtaFrom] = useState(() => formatDateForInput(thirtyDaysAgo()));
  const [commissionOtaTo, setCommissionOtaTo] = useState(formatDateForInput(new Date()));
  const [commissionOtaReport, setCommissionOtaReport] = useState<CommissionReportData | null>(null);
  const [commissionOtaLoading, setCommissionOtaLoading] = useState(false);

  const [scheduledReports, setScheduledReports] = useState<ScheduledReportRow[]>([]);
  const [scheduledReportsLoading, setScheduledReportsLoading] = useState(false);
  const [schedReportType, setSchedReportType] = useState("MANAGEMENT_DAILY");
  const [schedScheduleType, setSchedScheduleType] = useState<"DAILY" | "WEEKLY">("DAILY");
  const [schedTime, setSchedTime] = useState("08:00");
  const [schedDayOfWeek, setSchedDayOfWeek] = useState(1);
  const [schedEmails, setSchedEmails] = useState("");
  const [schedSubmitting, setSchedSubmitting] = useState(false);
  const [sendEmailLoading, setSendEmailLoading] = useState(false);

  const showManagement = canShowReport(permissions, "reports.management");
  const showKpi = canShowReport(permissions, "reports.kpi");
  const showMeals = canShowReport(permissions, "reports.meals");
  const showOfficial = canShowReport(permissions, "reports.official");

  const loadKpi = async () => {
    setKpiLoading(true);
    const result = await getKpiReport(kpiFrom, kpiTo);
    setKpiLoading(false);
    setKpi(result.success ? result.data : null);
  };

  const loadMealReport = async () => {
    setMealReportLoading(true);
    const result = await getMealReport(mealReportDate);
    setMealReportLoading(false);
    setMealReport(result.success ? result.data : null);
  };

  const loadMealCountByDateReport = async () => {
    setMealCountLoading(true);
    const result = await getMealCountByDateReport(mealCountFrom, mealCountTo);
    setMealCountLoading(false);
    setMealCountReport(result.success ? result.data : null);
  };

  const loadMinibarReport = async () => {
    setMinibarReportLoading(true);
    const result = await getMinibarConsumptionReport(minibarFrom, minibarTo);
    setMinibarReportLoading(false);
    setMinibarReport(result.success ? result.data : null);
  };

  const loadOccupancyReport = async () => {
    setOccLoading(true);
    const result = await getOccupancyReport(occFrom, occTo);
    setOccLoading(false);
    setOccupancyReport(result.success ? result.data : null);
  };

  const loadRevParReport = async () => {
    setRevParLoading(true);
    const result = await getRevParReport(revParFrom, revParTo);
    setRevParLoading(false);
    setRevParReport(result.success ? result.data : null);
  };

  const loadAdrReport = async () => {
    setAdrLoading(true);
    const result = await getAdrReport(adrFrom, adrTo);
    setAdrLoading(false);
    setAdrReport(result.success ? result.data : null);
  };

  const loadRevenueReport = async () => {
    setRevenueReportLoading(true);
    const result = await getRevenueReport(revReportFrom, revReportTo);
    setRevenueReportLoading(false);
    setRevenueReport(result.success ? result.data : null);
  };

  const loadSegmentReport = async () => {
    setSegmentReportLoading(true);
    const result = await getRevenueBySegmentReport(segReportFrom, segReportTo);
    setSegmentReportLoading(false);
    setSegmentReport(result.success ? result.data : null);
  };

  const loadSourceReport = async () => {
    setSourceReportLoading(true);
    const result = await getRevenueBySourceReport(sourceReportFrom, sourceReportTo);
    setSourceReportLoading(false);
    setSourceReport(result.success ? result.data : null);
  };

  const loadCommissionOtaReport = async () => {
    setCommissionOtaLoading(true);
    const result = await getCommissionReport(commissionOtaFrom, commissionOtaTo);
    setCommissionOtaLoading(false);
    setCommissionOtaReport(result.success ? result.data : null);
  };

  const loadChannelReport = async () => {
    setChannelReportLoading(true);
    const result = await getRevenueByChannelReport(channelReportFrom, channelReportTo);
    setChannelReportLoading(false);
    setChannelReport(result.success ? result.data : null);
  };

  const loadGuestSegReport = async () => {
    setGuestSegReportLoading(true);
    const result = await getRevenueByGuestSegmentReport(guestSegReportFrom, guestSegReportTo);
    setGuestSegReportLoading(false);
    setGuestSegReport(result.success ? result.data : null);
  };

  const loadRateCodeReport = async () => {
    setRateCodeReportLoading(true);
    const result = await getRevenueByRateCodeReport(rateCodeReportFrom, rateCodeReportTo);
    setRateCodeReportLoading(false);
    setRateCodeReport(result.success ? result.data : null);
  };

  const loadRoomTypeReport = async () => {
    setRoomTypeReportLoading(true);
    const result = await getRevenueByRoomTypeReport(roomTypeReportFrom, roomTypeReportTo);
    setRoomTypeReportLoading(false);
    setRoomTypeReport(result.success ? result.data : null);
  };

  const loadPeriodReport = async () => {
    setPeriodReportLoading(true);
    const result = await getReservationsPeriodReport(periodReportFrom, periodReportTo);
    setPeriodReportLoading(false);
    setPeriodReport(result.success ? result.data : null);
  };

  const loadNoShowReport = async () => {
    setNoShowReportLoading(true);
    const result = await getNoShowReport(noShowReportFrom, noShowReportTo);
    setNoShowReportLoading(false);
    setNoShowReport(result.success ? result.data : null);
  };

  const loadCancellationReport = async () => {
    setCancellationReportLoading(true);
    const result = await getCancellationReport(cancellationReportFrom, cancellationReportTo);
    setCancellationReportLoading(false);
    setCancellationReport(result.success ? result.data : null);
  };

  const loadDailyCheckInsReport = async () => {
    setDailyCheckInsLoading(true);
    const result = await getDailyCheckInsReport(dailyCheckInsFrom, dailyCheckInsTo);
    setDailyCheckInsLoading(false);
    setDailyCheckInsReport(result.success ? result.data : null);
  };

  const loadDailyCheckOutsReport = async () => {
    setDailyCheckOutsLoading(true);
    const result = await getDailyCheckOutsReport(dailyCheckOutsFrom, dailyCheckOutsTo);
    setDailyCheckOutsLoading(false);
    setDailyCheckOutsReport(result.success ? result.data : null);
  };

  const loadInHouseReport = async () => {
    setInHouseReportLoading(true);
    const result = await getInHouseGuestsReport();
    setInHouseReportLoading(false);
    setInHouseReport(result.success ? result.data : null);
  };

  const loadHousekeepingReport = async () => {
    setHousekeepingLoading(true);
    const result = await getHousekeepingWorkloadReport(housekeepingFrom, housekeepingTo);
    setHousekeepingLoading(false);
    setHousekeepingReport(result.success ? result.data : null);
  };

  const loadMaintenanceReport = async () => {
    setMaintenanceLoading(true);
    const result = await getMaintenanceIssuesReport(maintenanceFrom, maintenanceTo);
    setMaintenanceLoading(false);
    setMaintenanceReport(result.success ? result.data : null);
  };

  const loadVipReport = async () => {
    setVipReportLoading(true);
    const result = await getVipGuestsReport(vipFrom, vipTo);
    setVipReportLoading(false);
    setVipReport(result.success ? result.data : null);
  };

  const loadBirthdayReport = async () => {
    setBirthdayReportLoading(true);
    const result = await getBirthdayReport(birthdayFrom, birthdayTo);
    setBirthdayReportLoading(false);
    setBirthdayReport(result.success ? result.data : null);
  };

  const loadForecastReport = async () => {
    setForecastLoading(true);
    const result = await getOccupancyForecastReport(forecastDays);
    setForecastLoading(false);
    setForecastReport(result.success ? result.data : null);
  };

  const loadYoYReport = async () => {
    setYoyLoading(true);
    const result = await getYearOverYearReport(yoyYear);
    setYoyLoading(false);
    setYoyReport(result.success ? result.data : null);
  };

  const loadMoMReport = async () => {
    setMomLoading(true);
    const result = await getMonthOverMonthReport(momYear, momMonth);
    setMomLoading(false);
    setMomReport(result.success ? result.data : null);
  };

  const loadCashShiftReport = async () => {
    setCashShiftLoading(true);
    const result = await getCashShiftReport(cashShiftFrom, cashShiftTo);
    setCashShiftLoading(false);
    setCashShiftReport(result.success ? result.data : null);
  };

  const loadBankRecReport = async () => {
    setBankRecLoading(true);
    const result = await getBankReconciliationReport(bankRecFrom, bankRecTo);
    setBankRecLoading(false);
    setBankRecReport(result.success ? result.data : null);
  };

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    const result = await getManagementReportData(dateStr);
    setLoading(false);
    if (result.success && result.data) {
      setReport(result.data);
    } else {
      setError(result.success ? null : result.error ?? "Błąd");
      setReport(null);
    }
  };

  useEffect(() => {
    if (showManagement) loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showManagement]);

  const loadScheduledReports = async () => {
    setScheduledReportsLoading(true);
    const result = await listScheduledReports();
    setScheduledReportsLoading(false);
    if (result.success) setScheduledReports(result.data);
  };

  useEffect(() => {
    if (showKpi) loadScheduledReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showKpi]);

  const handleAddScheduledReport = async () => {
    setSchedSubmitting(true);
    const result = await createScheduledReport({
      reportType: schedReportType,
      scheduleType: schedScheduleType,
      scheduleTime: schedTime,
      scheduleDayOfWeek: schedScheduleType === "WEEKLY" ? schedDayOfWeek : null,
      recipientEmails: schedEmails,
    });
    setSchedSubmitting(false);
    if (result.success) {
      setScheduledReports((prev) => [result.data!, ...prev]);
      setSchedEmails("");
    } else {
      if (typeof window !== "undefined") window.alert(result.error);
    }
  };

  const handleToggleScheduledReport = async (id: string, enabled: boolean) => {
    const result = await updateScheduledReport(id, { enabled: !enabled });
    if (result.success) setScheduledReports((prev) => prev.map((r) => (r.id === id ? result.data! : r)));
  };

  const handleDeleteScheduledReport = async (id: string) => {
    if (!confirm("Usunąć ten harmonogram?")) return;
    const result = await deleteScheduledReport(id);
    if (result.success) setScheduledReports((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSendReportByEmail = async (
    reportType: string,
    options: { date?: string; dateFrom?: string; dateTo?: string }
  ) => {
    const emails = window.prompt("Adres(y) e-mail (po przecinku):");
    if (!emails?.trim()) return;
    setSendEmailLoading(true);
    const result = await sendReportByEmail(reportType, options, emails.trim());
    setSendEmailLoading(false);
    if (result.success) window.alert("Raport wysłany e-mailem.");
    else window.alert(result.error ?? "Błąd wysyłki.");
  };

  const handlePrint = () => {
    window.print();
  };

  const currency = report?.currency ?? "PLN";
  const vatPercent = report?.vatPercent ?? 0;

  const handleExportCsv = () => {
    if (!report) return;
    const headers = ["Data/czas", "Typ", `Kwota (${currency})`, "Status"];
    const rows = report.transactions.map((t) => [
      new Date(t.createdAt).toLocaleString("pl-PL"),
      t.type,
      t.amount.toFixed(2),
      t.isReadOnly ? "Zamknięta" : "Otwarta",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `raport-${report.date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-semibold">Raporty</h1>
        {typeof window !== "undefined" && (window as unknown as { __E2E_TEST__?: boolean }).__E2E_TEST__ && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="export-10k-report"
            onClick={() => {
              const rows = Array.from({ length: 10000 }, (_, i) => ({
                Lp: i + 1,
                KolumnaA: `Wiersz ${i + 1}`,
                Data: new Date().toISOString().slice(0, 10),
                Wartość: Math.round(Math.random() * 10000) / 100,
              }));
              void exportToExcel(rows, "Raport 10k", "raport-10k-test.xlsx");
            }}
          >
            <FileDown className="mr-2 h-4 w-4" />
            Export 10k (test)
          </Button>
        )}
        <Link href="/reports/audit-trail">
          <Button variant="outline" size="sm">
            <History className="mr-2 h-4 w-4" />
            Audit Trail
          </Button>
        </Link>
        <Link href="/reports/logins">
          <Button variant="outline" size="sm">
            <LogIn className="mr-2 h-4 w-4" />
            Logowania
          </Button>
        </Link>
        <Link href="/reports/user-actions">
          <Button variant="outline" size="sm">
            <User className="mr-2 h-4 w-4" />
            Akcje użytkowników
          </Button>
        </Link>
      </div>

      {showManagement && (
        <>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label htmlFor="report-date">Data raportu dobowego</Label>
                <Input
                  id="report-date"
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="mt-1 w-44"
                />
              </div>
              <Button type="button" onClick={() => loadReport()} disabled={loading}>
                <FileText className="mr-2 h-4 w-4" />
                {loading ? "Ładowanie…" : "Pobierz raport"}
              </Button>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Raport dobowy transakcji. Wybierz datę i pobierz raport. Eksport CSV/Excel lub Drukuj (Zapisz jako PDF).
          </p>

          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {report && (
            <div className="report-print-area rounded-lg border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-2 print:mb-2">
                <h2 className="text-lg font-semibold">
                  Raport dobowy – {report.date}
                </h2>
                <div className="flex items-center gap-2 print:hidden">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleSendReportByEmail("MANAGEMENT_DAILY", { date: report.date })}
                    disabled={sendEmailLoading}
                    aria-label="Wyślij e-mailem"
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Wyślij e-mailem
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleExportCsv}
                    aria-label="Eksport CSV"
                  >
                    Eksport CSV
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handlePrint}
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    Drukuj / Zapisz jako PDF
                  </Button>
                </div>
              </div>
              <div className="mb-4 rounded-md border bg-muted/20 px-4 py-3 print:mb-2">
                <h3 className="mb-2 text-sm font-semibold">Raport kasowy (dzienny ruch)</h3>
                <div className="grid gap-1 text-sm sm:grid-cols-2">
                  <p>
                    <strong>Wpływy (KP):</strong>{" "}
                    {((report.byType["ROOM"] ?? 0) + (report.byType["DEPOSIT"] ?? 0)).toFixed(2)} {currency}
                    <span className="ml-1 text-muted-foreground">
                      (ROOM: {(report.byType["ROOM"] ?? 0).toFixed(2)}, DEPOSIT: {(report.byType["DEPOSIT"] ?? 0).toFixed(2)})
                    </span>
                  </p>
                  <p>
                    <strong>Wypływy (KW):</strong>{" "}
                    {Math.abs(report.byType["VOID"] ?? 0).toFixed(2)} {currency}
                  </p>
                  <p className="font-medium">
                    <strong>Saldo dnia:</strong> {report.totalAmount.toFixed(2)} {currency}
                  </p>
                </div>
              </div>
              <div className="mb-2 text-sm font-semibold">Raport kasowy (dzienny) – zestawienie KP/KW</div>
              <div className="mb-4 grid gap-2 text-sm print:mb-2">
                <p>
                  <strong>Liczba transakcji:</strong> {report.transactionCount}
                </p>
                <p>
                  <strong>Suma:</strong> {report.totalAmount.toFixed(2)} {currency}
                </p>
                {vatPercent > 0 && (
                  <p className="text-muted-foreground">
                    <strong>VAT (z konfiguracji cennika):</strong> {vatPercent}%
                  </p>
                )}
                {Object.keys(report.byType).length > 0 && (
                  <p>
                    <strong>Według typu:</strong>{" "}
                    {Object.entries(report.byType)
                      .map(([type, sum]) => `${type}: ${sum.toFixed(2)} ${currency}`)
                      .join(", ")}
                  </p>
                )}
              </div>
              {report.transactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 text-left font-medium">Data/czas</th>
                        <th className="py-2 text-left font-medium">Typ</th>
                        <th className="py-2 text-right font-medium">Kwota ({currency})</th>
                        <th className="py-2 text-left font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.transactions.map((t) => (
                        <tr key={t.id} className="border-b border-border/50">
                          <td className="py-1.5">
                            {new Date(t.createdAt).toLocaleString("pl-PL")}
                          </td>
                          <td className="py-1.5">{t.type}</td>
                          <td className="py-1.5 text-right">
                            {t.amount.toFixed(2)}
                          </td>
                          <td className="py-1.5">
                            {t.isReadOnly ? "Zamknięta (Night Audit)" : "Otwarta"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Brak transakcji w wybranym dniu.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {showKpi && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" />
            KPI (Occupancy, ADR, RevPAR)
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="kpi-from">Od</Label>
              <Input
                id="kpi-from"
                type="date"
                value={kpiFrom}
                onChange={(e) => setKpiFrom(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <div>
              <Label htmlFor="kpi-to">Do</Label>
              <Input
                id="kpi-to"
                type="date"
                value={kpiTo}
                onChange={(e) => setKpiTo(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <Button type="button" onClick={loadKpi} disabled={kpiLoading}>
              {kpiLoading ? "Ładowanie…" : "Pobierz KPI"}
            </Button>
          </div>
          {kpi && (
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-md border bg-muted/30 px-4 py-3">
                <p className="text-sm font-medium text-muted-foreground">Obłożenie</p>
                <p className="text-xl font-semibold">{kpi.occupancyPercent}%</p>
              </div>
              <div className="rounded-md border bg-muted/30 px-4 py-3">
                <p className="text-sm font-medium text-muted-foreground">ADR</p>
                <p className="text-xl font-semibold">
                  {kpi.adr != null ? `${kpi.adr.toFixed(2)} PLN` : "—"}
                </p>
              </div>
              <div className="rounded-md border bg-muted/30 px-4 py-3">
                <p className="text-sm font-medium text-muted-foreground">RevPAR</p>
                <p className="text-xl font-semibold">
                  {kpi.revPar != null ? `${kpi.revPar.toFixed(2)} PLN` : "—"}
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {showKpi && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" />
            Raport obłożenia (Occupancy Report %)
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="occ-from">Od</Label>
              <Input
                id="occ-from"
                type="date"
                value={occFrom}
                onChange={(e) => setOccFrom(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <div>
              <Label htmlFor="occ-to">Do</Label>
              <Input
                id="occ-to"
                type="date"
                value={occTo}
                onChange={(e) => setOccTo(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <Button type="button" onClick={loadOccupancyReport} disabled={occLoading}>
              {occLoading ? "Ładowanie…" : "Pobierz raport obłożenia"}
            </Button>
          </div>
          {occupancyReport && (
            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="text-sm text-muted-foreground">
                  Średnie obłożenie w okresie: <strong>{occupancyReport.avgOccupancyPercent}%</strong>
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void exportToExcel(
                      occupancyReport.days.map((r) => ({
                        Data: r.date,
                        "Zajęte pokoje": r.occupiedRooms,
                        "Łącznie pokoi": r.totalRooms,
                        "Obłożenie %": r.occupancyPercent,
                      })),
                      "Raport obłożenia",
                      `raport-oblozenia-${occFrom}-${occTo}.xlsx`
                    )
                  }
                >
                  <FileDown className="h-4 w-4 mr-1" />
                  Eksportuj do Excel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleSendReportByEmail("OCCUPANCY", { dateFrom: occFrom, dateTo: occTo })}
                  disabled={sendEmailLoading}
                >
                  <Mail className="h-4 w-4 mr-1" />
                  Wyślij e-mailem
                </Button>
              </div>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Data</th>
                      <th className="text-right py-2 px-2">Zajęte</th>
                      <th className="text-right py-2 px-2">Łącznie</th>
                      <th className="text-right py-2 px-2">Obłożenie %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {occupancyReport.days.map((row) => (
                      <tr key={row.date} className="border-b border-border/50">
                        <td className="py-1.5 px-2">{row.date}</td>
                        <td className="text-right py-1.5 px-2">{row.occupiedRooms}</td>
                        <td className="text-right py-1.5 px-2">{row.totalRooms}</td>
                        <td className="text-right py-1.5 px-2 font-medium">{row.occupancyPercent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {showKpi && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" />
            Raport RevPAR (Revenue Per Available Room)
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="revpar-from">Od</Label>
              <Input
                id="revpar-from"
                type="date"
                value={revParFrom}
                onChange={(e) => setRevParFrom(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <div>
              <Label htmlFor="revpar-to">Do</Label>
              <Input
                id="revpar-to"
                type="date"
                value={revParTo}
                onChange={(e) => setRevParTo(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <Button type="button" onClick={loadRevParReport} disabled={revParLoading}>
              {revParLoading ? "Ładowanie…" : "Pobierz raport RevPAR"}
            </Button>
          </div>
          {revParReport && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">
                Łączny przychód z pokoi: <strong>{revParReport.totalRevenue.toFixed(2)} PLN</strong> · Średni RevPAR: <strong>{revParReport.avgRevPar.toFixed(2)} PLN</strong>
              </p>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Data</th>
                      <th className="text-right py-2 px-2">Przychód (PLN)</th>
                      <th className="text-right py-2 px-2">Dostępne pokoje</th>
                      <th className="text-right py-2 px-2">RevPAR (PLN)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revParReport.days.map((row) => (
                      <tr key={row.date} className="border-b border-border/50">
                        <td className="py-1.5 px-2">{row.date}</td>
                        <td className="text-right py-1.5 px-2">{row.roomRevenue.toFixed(2)}</td>
                        <td className="text-right py-1.5 px-2">{row.totalRooms}</td>
                        <td className="text-right py-1.5 px-2 font-medium">{row.revPar.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {showKpi && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" />
            Raport ADR (Average Daily Rate)
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="adr-from">Od</Label>
              <Input
                id="adr-from"
                type="date"
                value={adrFrom}
                onChange={(e) => setAdrFrom(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <div>
              <Label htmlFor="adr-to">Do</Label>
              <Input
                id="adr-to"
                type="date"
                value={adrTo}
                onChange={(e) => setAdrTo(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <Button type="button" onClick={loadAdrReport} disabled={adrLoading}>
              {adrLoading ? "Ładowanie…" : "Pobierz raport ADR"}
            </Button>
          </div>
          {adrReport && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">
                Łączny przychód: <strong>{adrReport.totalRevenue.toFixed(2)} PLN</strong> · Sprzedane pokojo-noce: <strong>{adrReport.totalSoldRoomNights}</strong> · Średni ADR: <strong>{adrReport.avgAdr != null ? `${adrReport.avgAdr.toFixed(2)} PLN` : "—"}</strong>
              </p>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Data</th>
                      <th className="text-right py-2 px-2">Przychód (PLN)</th>
                      <th className="text-right py-2 px-2">Sprzedane noce</th>
                      <th className="text-right py-2 px-2">ADR (PLN)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adrReport.days.map((row) => (
                      <tr key={row.date} className="border-b border-border/50">
                        <td className="py-1.5 px-2">{row.date}</td>
                        <td className="text-right py-1.5 px-2">{row.roomRevenue.toFixed(2)}</td>
                        <td className="text-right py-1.5 px-2">{row.soldRoomNights}</td>
                        <td className="text-right py-1.5 px-2 font-medium">{row.adr != null ? row.adr.toFixed(2) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {showKpi && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" />
            Raport przychodów (Revenue Report)
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="rev-report-from">Od</Label>
              <Input
                id="rev-report-from"
                type="date"
                value={revReportFrom}
                onChange={(e) => setRevReportFrom(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <div>
              <Label htmlFor="rev-report-to">Do</Label>
              <Input
                id="rev-report-to"
                type="date"
                value={revReportTo}
                onChange={(e) => setRevReportTo(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <Button type="button" onClick={loadRevenueReport} disabled={revenueReportLoading}>
              {revenueReportLoading ? "Ładowanie…" : "Pobierz raport przychodów"}
            </Button>
          </div>
          {revenueReport && (
            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="text-sm text-muted-foreground">
                  Łączny przychód w okresie: <strong>{revenueReport.total.toFixed(2)} PLN</strong>
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void exportToExcel(
                      revenueReport.byType.map((r) => ({
                        Typ: r.type,
                        "Kwota (PLN)": r.amount,
                      })),
                      "Raport przychodów",
                      `raport-przychodow-${revReportFrom}-${revReportTo}.xlsx`
                    )
                  }
                >
                  <FileDown className="h-4 w-4 mr-1" />
                  Eksportuj do Excel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleSendReportByEmail("REVENUE", { dateFrom: revReportFrom, dateTo: revReportTo })}
                  disabled={sendEmailLoading}
                >
                  <Mail className="h-4 w-4 mr-1" />
                  Wyślij e-mailem
                </Button>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Typ</th>
                    <th className="text-right py-2 px-2">Kwota (PLN)</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueReport.byType.map((row) => (
                    <tr key={row.type} className="border-b border-border/50">
                      <td className="py-1.5 px-2">{row.type}</td>
                      <td className="text-right py-1.5 px-2 font-medium">{row.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {showKpi && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" />
            Raport przychodów wg segmentu rynkowego
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="seg-report-from">Od</Label>
              <Input
                id="seg-report-from"
                type="date"
                value={segReportFrom}
                onChange={(e) => setSegReportFrom(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <div>
              <Label htmlFor="seg-report-to">Do</Label>
              <Input
                id="seg-report-to"
                type="date"
                value={segReportTo}
                onChange={(e) => setSegReportTo(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <Button type="button" onClick={loadSegmentReport} disabled={segmentReportLoading}>
              {segmentReportLoading ? "Ładowanie…" : "Pobierz raport wg segmentu"}
            </Button>
          </div>
          {segmentReport && (
            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="text-sm text-muted-foreground">
                  Łączny przychód: <strong>{segmentReport.total.toFixed(2)} PLN</strong>
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void exportToExcel(
                      segmentReport.bySegment.map((r) => ({
                        Segment: r.segment,
                        Rezerwacji: r.reservationCount,
                        "Kwota (PLN)": r.amount,
                      })),
                      "Przychody wg segmentu",
                      `przychody-wg-segmentu-${segReportFrom}-${segReportTo}.xlsx`
                    )
                  }
                >
                  <FileDown className="h-4 w-4 mr-1" />
                  Eksportuj do Excel
                </Button>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Segment</th>
                    <th className="text-right py-2 px-2">Rezerwacji</th>
                    <th className="text-right py-2 px-2">Kwota (PLN)</th>
                  </tr>
                </thead>
                <tbody>
                  {segmentReport.bySegment.map((row) => (
                    <tr key={row.segment} className="border-b border-border/50">
                      <td className="py-1.5 px-2">{row.segment}</td>
                      <td className="text-right py-1.5 px-2">{row.reservationCount}</td>
                      <td className="text-right py-1.5 px-2 font-medium">{row.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {showKpi && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" />
            Raport przychodów wg źródła rezerwacji (OTA, telefon, strona)
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="source-report-from">Od</Label>
              <Input
                id="source-report-from"
                type="date"
                value={sourceReportFrom}
                onChange={(e) => setSourceReportFrom(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <div>
              <Label htmlFor="source-report-to">Do</Label>
              <Input
                id="source-report-to"
                type="date"
                value={sourceReportTo}
                onChange={(e) => setSourceReportTo(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <Button type="button" onClick={loadSourceReport} disabled={sourceReportLoading}>
              {sourceReportLoading ? "Ładowanie…" : "Pobierz raport wg źródła"}
            </Button>
          </div>
          {sourceReport && (
            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="text-sm text-muted-foreground">
                  Łączny przychód: <strong>{sourceReport.total.toFixed(2)} PLN</strong>
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void exportToExcel(
                      sourceReport.bySource.map((r) => ({
                        Źródło: r.source,
                        Rezerwacji: r.reservationCount,
                        "Kwota (PLN)": r.amount,
                      })),
                      "Przychody wg źródła",
                      `przychody-wg-zrodla-${sourceReportFrom}-${sourceReportTo}.xlsx`
                    )
                  }
                >
                  <FileDown className="h-4 w-4 mr-1" />
                  Eksportuj do Excel
                </Button>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Źródło</th>
                    <th className="text-right py-2 px-2">Rezerwacji</th>
                    <th className="text-right py-2 px-2">Kwota (PLN)</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceReport.bySource.map((row) => (
                    <tr key={row.source} className="border-b border-border/50">
                      <td className="py-1.5 px-2">{row.source}</td>
                      <td className="text-right py-1.5 px-2">{row.reservationCount}</td>
                      <td className="text-right py-1.5 px-2 font-medium">{row.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {showKpi && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" />
            Raport prowizji OTA (biura podróży, agenci)
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Prowizje dla agentów (OTA, biura podróży) wg daty wymeldowania w okresie.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="commission-ota-from">Od (wymeldowanie)</Label>
              <Input
                id="commission-ota-from"
                type="date"
                value={commissionOtaFrom}
                onChange={(e) => setCommissionOtaFrom(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <div>
              <Label htmlFor="commission-ota-to">Do (wymeldowanie)</Label>
              <Input
                id="commission-ota-to"
                type="date"
                value={commissionOtaTo}
                onChange={(e) => setCommissionOtaTo(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <Button type="button" onClick={loadCommissionOtaReport} disabled={commissionOtaLoading}>
              {commissionOtaLoading ? "Ładowanie…" : "Pobierz raport prowizji OTA"}
            </Button>
          </div>
          {commissionOtaReport && (
            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="text-sm text-muted-foreground">
                  Łączny przychód: <strong>{commissionOtaReport.totalRevenue.toFixed(2)} {commissionOtaReport.currency}</strong>
                  {" · "}
                  Łączna prowizja: <strong>{commissionOtaReport.totalCommission.toFixed(2)} {commissionOtaReport.currency}</strong>
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void exportToExcel(
                      commissionOtaReport.rows.map((r) => ({
                        "Agent / OTA": `${r.agentName} (${r.agentCode})`,
                        "% prowizji": r.commissionPercent,
                        Rezerwacji: r.reservationCount,
                        [`Przychód (${commissionOtaReport.currency})`]: r.totalRevenue,
                        [`Prowizja (${commissionOtaReport.currency})`]: r.totalCommission,
                      })),
                      "Raport prowizji OTA",
                      `raport-prowizji-ota-${commissionOtaFrom}-${commissionOtaTo}.xlsx`
                    )
                  }
                >
                  <FileDown className="h-4 w-4 mr-1" />
                  Eksportuj do Excel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleSendReportByEmail("COMMISSION_OTA", { dateFrom: commissionOtaFrom, dateTo: commissionOtaTo })}
                  disabled={sendEmailLoading}
                >
                  <Mail className="h-4 w-4 mr-1" />
                  Wyślij e-mailem
                </Button>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Agent / OTA</th>
                    <th className="text-center py-2 px-2">% prowizji</th>
                    <th className="text-right py-2 px-2">Rezerwacji</th>
                    <th className="text-right py-2 px-2">Przychód ({commissionOtaReport.currency})</th>
                    <th className="text-right py-2 px-2">Prowizja ({commissionOtaReport.currency})</th>
                  </tr>
                </thead>
                <tbody>
                  {commissionOtaReport.rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-muted-foreground">
                        Brak rezerwacji z przypisanym agentem w wybranym okresie.
                      </td>
                    </tr>
                  ) : (
                    commissionOtaReport.rows.map((row) => (
                      <tr key={row.agentId} className="border-b border-border/50">
                        <td className="py-1.5 px-2">{row.agentName} ({row.agentCode})</td>
                        <td className="text-center py-1.5 px-2">{row.commissionPercent.toFixed(1)}%</td>
                        <td className="text-right py-1.5 px-2">{row.reservationCount}</td>
                        <td className="text-right py-1.5 px-2 font-medium">{row.totalRevenue.toFixed(2)}</td>
                        <td className="text-right py-1.5 px-2 font-medium">{row.totalCommission.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {commissionOtaReport.rows.length > 0 && (
                  <tfoot>
                    <tr className="border-t font-medium">
                      <td className="py-2 px-2" colSpan={3}>Razem</td>
                      <td className="text-right py-2 px-2">{commissionOtaReport.totalRevenue.toFixed(2)}</td>
                      <td className="text-right py-2 px-2">{commissionOtaReport.totalCommission.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </section>
      )}

      {showKpi && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" />
            Raport przychodów wg kanału (Booking.com, Expedia, bezpośrednie)
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="channel-report-from">Od</Label>
              <Input
                id="channel-report-from"
                type="date"
                value={channelReportFrom}
                onChange={(e) => setChannelReportFrom(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <div>
              <Label htmlFor="channel-report-to">Do</Label>
              <Input
                id="channel-report-to"
                type="date"
                value={channelReportTo}
                onChange={(e) => setChannelReportTo(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <Button type="button" onClick={loadChannelReport} disabled={channelReportLoading}>
              {channelReportLoading ? "Ładowanie…" : "Pobierz raport wg kanału"}
            </Button>
          </div>
          {channelReport && (
            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="text-sm text-muted-foreground">
                  Łączny przychód: <strong>{channelReport.total.toFixed(2)} PLN</strong>
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void exportToExcel(
                      channelReport.byChannel.map((r) => ({
                        Kanał: r.channel,
                        Rezerwacji: r.reservationCount,
                        "Kwota (PLN)": r.amount,
                      })),
                      "Przychody wg kanału",
                      `przychody-wg-kanalu-${channelReportFrom}-${channelReportTo}.xlsx`
                    )
                  }
                >
                  <FileDown className="h-4 w-4 mr-1" />
                  Eksportuj do Excel
                </Button>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Kanał</th>
                    <th className="text-right py-2 px-2">Rezerwacji</th>
                    <th className="text-right py-2 px-2">Kwota (PLN)</th>
                  </tr>
                </thead>
                <tbody>
                  {channelReport.byChannel.map((row) => (
                    <tr key={row.channel} className="border-b border-border/50">
                      <td className="py-1.5 px-2">{row.channel}</td>
                      <td className="text-right py-1.5 px-2">{row.reservationCount}</td>
                      <td className="text-right py-1.5 px-2 font-medium">{row.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {showKpi && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" />
            Raport przychodów wg segmentu gościa (biznes, leisure, grupy)
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="guest-seg-report-from">Od</Label>
              <Input
                id="guest-seg-report-from"
                type="date"
                value={guestSegReportFrom}
                onChange={(e) => setGuestSegReportFrom(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <div>
              <Label htmlFor="guest-seg-report-to">Do</Label>
              <Input
                id="guest-seg-report-to"
                type="date"
                value={guestSegReportTo}
                onChange={(e) => setGuestSegReportTo(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <Button type="button" onClick={loadGuestSegReport} disabled={guestSegReportLoading}>
              {guestSegReportLoading ? "Ładowanie…" : "Pobierz raport wg segmentu gościa"}
            </Button>
          </div>
          {guestSegReport && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">
                Łączny przychód: <strong>{guestSegReport.total.toFixed(2)} PLN</strong>
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Segment gościa</th>
                    <th className="text-right py-2 px-2">Rezerwacji</th>
                    <th className="text-right py-2 px-2">Kwota (PLN)</th>
                  </tr>
                </thead>
                <tbody>
                  {guestSegReport.byGuestSegment.map((row) => (
                    <tr key={row.guestSegment} className="border-b border-border/50">
                      <td className="py-1.5 px-2">{row.guestSegment}</td>
                      <td className="text-right py-1.5 px-2">{row.reservationCount}</td>
                      <td className="text-right py-1.5 px-2 font-medium">{row.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {showKpi && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" />
            Raport przychodów wg kodu stawki (BB, RO, HB)
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="rate-code-report-from">Od</Label>
              <Input
                id="rate-code-report-from"
                type="date"
                value={rateCodeReportFrom}
                onChange={(e) => setRateCodeReportFrom(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <div>
              <Label htmlFor="rate-code-report-to">Do</Label>
              <Input
                id="rate-code-report-to"
                type="date"
                value={rateCodeReportTo}
                onChange={(e) => setRateCodeReportTo(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <Button type="button" onClick={loadRateCodeReport} disabled={rateCodeReportLoading}>
              {rateCodeReportLoading ? "Ładowanie…" : "Pobierz raport wg kodu stawki"}
            </Button>
          </div>
          {rateCodeReport && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">
                Łączny przychód: <strong>{rateCodeReport.total.toFixed(2)} PLN</strong>
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Kod stawki</th>
                    <th className="text-right py-2 px-2">Rezerwacji</th>
                    <th className="text-right py-2 px-2">Kwota (PLN)</th>
                  </tr>
                </thead>
                <tbody>
                  {rateCodeReport.byRateCode.map((row) => (
                    <tr key={row.rateCode} className="border-b border-border/50">
                      <td className="py-1.5 px-2">{row.rateCode}</td>
                      <td className="text-right py-1.5 px-2">{row.reservationCount}</td>
                      <td className="text-right py-1.5 px-2 font-medium">{row.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {showKpi && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" />
            Raport przychodów wg typu pokoju (Revenue by room type)
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="room-type-report-from">Od</Label>
              <Input
                id="room-type-report-from"
                type="date"
                value={roomTypeReportFrom}
                onChange={(e) => setRoomTypeReportFrom(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <div>
              <Label htmlFor="room-type-report-to">Do</Label>
              <Input
                id="room-type-report-to"
                type="date"
                value={roomTypeReportTo}
                onChange={(e) => setRoomTypeReportTo(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <Button type="button" onClick={loadRoomTypeReport} disabled={roomTypeReportLoading}>
              {roomTypeReportLoading ? "Ładowanie…" : "Pobierz raport wg typu pokoju"}
            </Button>
          </div>
          {roomTypeReport && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">
                Łączny przychód: <strong>{roomTypeReport.total.toFixed(2)} PLN</strong>
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Typ pokoju</th>
                    <th className="text-right py-2 px-2">Rezerwacji</th>
                    <th className="text-right py-2 px-2">Kwota (PLN)</th>
                  </tr>
                </thead>
                <tbody>
                  {roomTypeReport.byRoomType.map((row) => (
                    <tr key={row.roomType} className="border-b border-border/50">
                      <td className="py-1.5 px-2">{row.roomType}</td>
                      <td className="text-right py-1.5 px-2">{row.reservationCount}</td>
                      <td className="text-right py-1.5 px-2 font-medium">{row.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {showKpi && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" />
            Raport rezerwacji w okresie X–Y
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="period-report-from">Od</Label>
              <Input
                id="period-report-from"
                type="date"
                value={periodReportFrom}
                onChange={(e) => setPeriodReportFrom(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <div>
              <Label htmlFor="period-report-to">Do</Label>
              <Input
                id="period-report-to"
                type="date"
                value={periodReportTo}
                onChange={(e) => setPeriodReportTo(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <Button type="button" onClick={loadPeriodReport} disabled={periodReportLoading}>
              {periodReportLoading ? "Ładowanie…" : "Pobierz raport rezerwacji"}
            </Button>
          </div>
          {periodReport && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">
                Liczba rezerwacji: <strong>{periodReport.totalCount}</strong>
              </p>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Potw.</th>
                      <th className="text-left py-2 px-2">Gość</th>
                      <th className="text-left py-2 px-2">Pokój</th>
                      <th className="text-left py-2 px-2">Typ</th>
                      <th className="text-left py-2 px-2">Zameldowanie</th>
                      <th className="text-left py-2 px-2">Wymeldowanie</th>
                      <th className="text-left py-2 px-2">Status</th>
                      <th className="text-right py-2 px-2">Kwota (PLN)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodReport.reservations.map((row) => (
                      <tr key={row.id} className="border-b border-border/50">
                        <td className="py-1.5 px-2">{row.confirmationNumber ?? "—"}</td>
                        <td className="py-1.5 px-2">{row.guestName}</td>
                        <td className="py-1.5 px-2">{row.roomNumber}</td>
                        <td className="py-1.5 px-2">{row.roomType}</td>
                        <td className="py-1.5 px-2">{row.checkIn}</td>
                        <td className="py-1.5 px-2">{row.checkOut}</td>
                        <td className="py-1.5 px-2">{row.status}</td>
                        <td className="text-right py-1.5 px-2 font-medium">{row.totalAmount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {showKpi && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" />
            Raport no-show (goście, którzy nie przyjechali)
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="no-show-report-from">Od (data zameldowania)</Label>
              <Input
                id="no-show-report-from"
                type="date"
                value={noShowReportFrom}
                onChange={(e) => setNoShowReportFrom(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <div>
              <Label htmlFor="no-show-report-to">Do</Label>
              <Input
                id="no-show-report-to"
                type="date"
                value={noShowReportTo}
                onChange={(e) => setNoShowReportTo(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <Button type="button" onClick={loadNoShowReport} disabled={noShowReportLoading}>
              {noShowReportLoading ? "Ładowanie…" : "Pobierz raport no-show"}
            </Button>
          </div>
          {noShowReport && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">
                Liczba no-show: <strong>{noShowReport.totalCount}</strong>
              </p>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Potw.</th>
                      <th className="text-left py-2 px-2">Gość</th>
                      <th className="text-left py-2 px-2">Pokój</th>
                      <th className="text-left py-2 px-2">Zameldowanie</th>
                      <th className="text-left py-2 px-2">Wymeldowanie</th>
                      <th className="text-left py-2 px-2">Źródło</th>
                      <th className="text-left py-2 px-2">Kanał</th>
                    </tr>
                  </thead>
                  <tbody>
                    {noShowReport.reservations.map((row) => (
                      <tr key={row.id} className="border-b border-border/50">
                        <td className="py-1.5 px-2">{row.confirmationNumber ?? "—"}</td>
                        <td className="py-1.5 px-2">{row.guestName}</td>
                        <td className="py-1.5 px-2">{row.roomNumber}</td>
                        <td className="py-1.5 px-2">{row.checkIn}</td>
                        <td className="py-1.5 px-2">{row.checkOut}</td>
                        <td className="py-1.5 px-2">{row.source ?? "—"}</td>
                        <td className="py-1.5 px-2">{row.channel ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {showKpi && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" />
            Raport anulacji (cancellation report with reasons)
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="cancellation-report-from">Od (data anulowania)</Label>
              <Input
                id="cancellation-report-from"
                type="date"
                value={cancellationReportFrom}
                onChange={(e) => setCancellationReportFrom(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <div>
              <Label htmlFor="cancellation-report-to">Do</Label>
              <Input
                id="cancellation-report-to"
                type="date"
                value={cancellationReportTo}
                onChange={(e) => setCancellationReportTo(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <Button type="button" onClick={loadCancellationReport} disabled={cancellationReportLoading}>
              {cancellationReportLoading ? "Ładowanie…" : "Pobierz raport anulacji"}
            </Button>
          </div>
          {cancellationReport && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">
                Liczba anulacji: <strong>{cancellationReport.totalCount}</strong>
              </p>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Potw.</th>
                      <th className="text-left py-2 px-2">Gość</th>
                      <th className="text-left py-2 px-2">Pokój</th>
                      <th className="text-left py-2 px-2">Zameldowanie</th>
                      <th className="text-left py-2 px-2">Wymeldowanie</th>
                      <th className="text-left py-2 px-2">Data anulowania</th>
                      <th className="text-left py-2 px-2">Kod</th>
                      <th className="text-left py-2 px-2">Powód</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cancellationReport.reservations.map((row) => (
                      <tr key={row.id} className="border-b border-border/50">
                        <td className="py-1.5 px-2">{row.confirmationNumber ?? "—"}</td>
                        <td className="py-1.5 px-2">{row.guestName}</td>
                        <td className="py-1.5 px-2">{row.roomNumber}</td>
                        <td className="py-1.5 px-2">{row.checkIn}</td>
                        <td className="py-1.5 px-2">{row.checkOut}</td>
                        <td className="py-1.5 px-2">{row.cancelledAt ?? "—"}</td>
                        <td className="py-1.5 px-2">{row.cancellationCode ?? "—"}</td>
                        <td className="py-1.5 px-2">{row.cancellationReason ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {showKpi && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" />
            Raport dziennych check-in-ów
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="daily-checkins-from">Od (data zameldowania)</Label>
              <Input
                id="daily-checkins-from"
                type="date"
                value={dailyCheckInsFrom}
                onChange={(e) => setDailyCheckInsFrom(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <div>
              <Label htmlFor="daily-checkins-to">Do</Label>
              <Input
                id="daily-checkins-to"
                type="date"
                value={dailyCheckInsTo}
                onChange={(e) => setDailyCheckInsTo(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <Button type="button" onClick={loadDailyCheckInsReport} disabled={dailyCheckInsLoading}>
              {dailyCheckInsLoading ? "Ładowanie…" : "Pobierz raport check-in-ów"}
            </Button>
          </div>
          {dailyCheckInsReport && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">
                Łącznie check-in-ów: <strong>{dailyCheckInsReport.totalCount}</strong>
              </p>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto space-y-4">
                {dailyCheckInsReport.dates.map((dateKey) => (
                  <div key={dateKey}>
                    <h3 className="text-sm font-medium mb-1 sticky top-0 bg-muted/90 py-1 px-2 rounded">
                      {dateKey} ({dailyCheckInsReport.byDate[dateKey].length})
                    </h3>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2">Potw.</th>
                          <th className="text-left py-2 px-2">Gość</th>
                          <th className="text-left py-2 px-2">Pokój</th>
                          <th className="text-left py-2 px-2">Typ</th>
                          <th className="text-left py-2 px-2">Wymeldowanie</th>
                          <th className="text-left py-2 px-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyCheckInsReport.byDate[dateKey].map((row) => (
                          <tr key={row.id} className="border-b border-border/50">
                            <td className="py-1.5 px-2">{row.confirmationNumber ?? "—"}</td>
                            <td className="py-1.5 px-2">{row.guestName}</td>
                            <td className="py-1.5 px-2">{row.roomNumber}</td>
                            <td className="py-1.5 px-2">{row.roomType}</td>
                            <td className="py-1.5 px-2">{row.checkOut}</td>
                            <td className="py-1.5 px-2">{row.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {showKpi && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" />
            Raport dziennych check-out-ów
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="daily-checkouts-from">Od (data wymeldowania)</Label>
              <Input
                id="daily-checkouts-from"
                type="date"
                value={dailyCheckOutsFrom}
                onChange={(e) => setDailyCheckOutsFrom(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <div>
              <Label htmlFor="daily-checkouts-to">Do</Label>
              <Input
                id="daily-checkouts-to"
                type="date"
                value={dailyCheckOutsTo}
                onChange={(e) => setDailyCheckOutsTo(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <Button type="button" onClick={loadDailyCheckOutsReport} disabled={dailyCheckOutsLoading}>
              {dailyCheckOutsLoading ? "Ładowanie…" : "Pobierz raport check-out-ów"}
            </Button>
          </div>
          {dailyCheckOutsReport && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">
                Łącznie check-out-ów: <strong>{dailyCheckOutsReport.totalCount}</strong>
              </p>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto space-y-4">
                {dailyCheckOutsReport.dates.map((dateKey) => (
                  <div key={dateKey}>
                    <h3 className="text-sm font-medium mb-1 sticky top-0 bg-muted/90 py-1 px-2 rounded">
                      {dateKey} ({dailyCheckOutsReport.byDate[dateKey].length})
                    </h3>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2">Potw.</th>
                          <th className="text-left py-2 px-2">Gość</th>
                          <th className="text-left py-2 px-2">Pokój</th>
                          <th className="text-left py-2 px-2">Typ</th>
                          <th className="text-left py-2 px-2">Zameldowanie</th>
                          <th className="text-left py-2 px-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyCheckOutsReport.byDate[dateKey].map((row) => (
                          <tr key={row.id} className="border-b border-border/50">
                            <td className="py-1.5 px-2">{row.confirmationNumber ?? "—"}</td>
                            <td className="py-1.5 px-2">{row.guestName}</td>
                            <td className="py-1.5 px-2">{row.roomNumber}</td>
                            <td className="py-1.5 px-2">{row.roomType}</td>
                            <td className="py-1.5 px-2">{row.checkIn}</td>
                            <td className="py-1.5 px-2">{row.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {showKpi && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" />
            In-house guests (aktualni goście)
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <Button type="button" onClick={loadInHouseReport} disabled={inHouseReportLoading}>
              {inHouseReportLoading ? "Ładowanie…" : "Pobierz raport aktualnych gości"}
            </Button>
          </div>
          {inHouseReport && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">
                Liczba gości: <strong>{inHouseReport.totalCount}</strong>
              </p>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Potw.</th>
                      <th className="text-left py-2 px-2">Gość</th>
                      <th className="text-left py-2 px-2">Pokój</th>
                      <th className="text-left py-2 px-2">Typ</th>
                      <th className="text-left py-2 px-2">Zameldowanie</th>
                      <th className="text-left py-2 px-2">Wymeldowanie</th>
                      <th className="text-right py-2 px-2">Nocy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inHouseReport.reservations.map((row) => (
                      <tr key={row.id} className="border-b border-border/50">
                        <td className="py-1.5 px-2">{row.confirmationNumber ?? "—"}</td>
                        <td className="py-1.5 px-2">{row.guestName}</td>
                        <td className="py-1.5 px-2">{row.roomNumber}</td>
                        <td className="py-1.5 px-2">{row.roomType}</td>
                        <td className="py-1.5 px-2">{row.checkIn}</td>
                        <td className="py-1.5 px-2">{row.checkOut}</td>
                        <td className="text-right py-1.5 px-2">{row.nights}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {showKpi && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" />
            Raport sprzątania (housekeeping workload – kto, kiedy, ile pokoi)
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="housekeeping-from">Od</Label>
              <Input
                id="housekeeping-from"
                type="date"
                value={housekeepingFrom}
                onChange={(e) => setHousekeepingFrom(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <div>
              <Label htmlFor="housekeeping-to">Do</Label>
              <Input
                id="housekeeping-to"
                type="date"
                value={housekeepingTo}
                onChange={(e) => setHousekeepingTo(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <Button type="button" onClick={loadHousekeepingReport} disabled={housekeepingLoading}>
              {housekeepingLoading ? "Ładowanie…" : "Pobierz raport sprzątania"}
            </Button>
          </div>
          {housekeepingReport && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">
                Łącznie pokoi: <strong>{housekeepingReport.totalRooms}</strong>
              </p>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto space-y-4">
                {housekeepingReport.dates.map((dateKey) => (
                  <div key={dateKey}>
                    <h3 className="text-sm font-medium mb-1 sticky top-0 bg-muted/90 py-1 px-2 rounded">
                      {dateKey}
                    </h3>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2">Pokojowa</th>
                          <th className="text-right py-2 px-2">Liczba pokoi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {housekeepingReport.byDate[dateKey].map((row) => (
                          <tr key={row.housekeeper} className="border-b border-border/50">
                            <td className="py-1.5 px-2">{row.housekeeper}</td>
                            <td className="text-right py-1.5 px-2">{row.roomCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {showKpi && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" />
            Raport minibar (zużycie)
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="minibar-from">Od</Label>
              <Input
                id="minibar-from"
                type="date"
                value={minibarFrom}
                onChange={(e) => setMinibarFrom(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <div>
              <Label htmlFor="minibar-to">Do</Label>
              <Input
                id="minibar-to"
                type="date"
                value={minibarTo}
                onChange={(e) => setMinibarTo(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <Button type="button" onClick={loadMinibarReport} disabled={minibarReportLoading}>
              {minibarReportLoading ? "Ładowanie…" : "Pobierz raport minibaru"}
            </Button>
          </div>
          {minibarReport && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">
                Łączna kwota: <strong>{minibarReport.totalAmount.toFixed(2)} PLN</strong> ({minibarReport.totalRecords} pozycji)
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Pozycja</th>
                    <th className="text-right py-2 px-2">Ilość</th>
                    <th className="text-right py-2 px-2">Kwota (PLN)</th>
                  </tr>
                </thead>
                <tbody>
                  {minibarReport.byItem.map((row) => (
                    <tr key={row.itemName} className="border-b border-border/50">
                      <td className="py-1.5 px-2">{row.itemName}</td>
                      <td className="text-right py-1.5 px-2">{row.totalQuantity}</td>
                      <td className="text-right py-1.5 px-2 font-medium">{row.totalAmount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {showKpi && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" />
            Raport usterek
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="maintenance-from">Od (data zgłoszenia)</Label>
              <Input
                id="maintenance-from"
                type="date"
                value={maintenanceFrom}
                onChange={(e) => setMaintenanceFrom(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <div>
              <Label htmlFor="maintenance-to">Do</Label>
              <Input
                id="maintenance-to"
                type="date"
                value={maintenanceTo}
                onChange={(e) => setMaintenanceTo(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <Button type="button" onClick={loadMaintenanceReport} disabled={maintenanceLoading}>
              {maintenanceLoading ? "Ładowanie…" : "Pobierz raport usterek"}
            </Button>
          </div>
          {maintenanceReport && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">
                Liczba usterek: <strong>{maintenanceReport.totalCount}</strong>
              </p>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Pokój</th>
                      <th className="text-left py-2 px-2">Opis</th>
                      <th className="text-left py-2 px-2">Kategoria</th>
                      <th className="text-left py-2 px-2">Priorytet</th>
                      <th className="text-left py-2 px-2">Status</th>
                      <th className="text-left py-2 px-2">Zgłoszono</th>
                      <th className="text-left py-2 px-2">Rozwiązano</th>
                    </tr>
                  </thead>
                  <tbody>
                    {maintenanceReport.issues.map((row) => (
                      <tr key={row.id} className="border-b border-border/50">
                        <td className="py-1.5 px-2">{row.roomNumber}</td>
                        <td className="py-1.5 px-2">{row.title}</td>
                        <td className="py-1.5 px-2">{row.category}</td>
                        <td className="py-1.5 px-2">{row.priority}</td>
                        <td className="py-1.5 px-2">{row.status}</td>
                        <td className="py-1.5 px-2">{row.reportedAt}</td>
                        <td className="py-1.5 px-2">{row.resolvedAt ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {showKpi && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" />
            Raport prognozowany (forecast – expected occupancy next 30/90 days)
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="forecast-days">Prognoza na (dni)</Label>
              <select
                id="forecast-days"
                value={forecastDays}
                onChange={(e) => setForecastDays(Number(e.target.value) as 30 | 90)}
                className="mt-1 h-9 w-24 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value={30}>30</option>
                <option value={90}>90</option>
              </select>
            </div>
            <Button type="button" onClick={loadForecastReport} disabled={forecastLoading}>
              {forecastLoading ? "Ładowanie…" : "Pobierz prognozę obłożenia"}
            </Button>
          </div>
          {forecastReport && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">
                Średnie obłożenie w okresie: <strong>{forecastReport.avgOccupancyPercent.toFixed(1)}%</strong>
              </p>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Data</th>
                      <th className="text-right py-2 px-2">Zajęte pokoje</th>
                      <th className="text-right py-2 px-2">Łącznie pokoi</th>
                      <th className="text-right py-2 px-2">Obłożenie %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecastReport.days.map((row) => (
                      <tr key={row.date} className="border-b border-border/50">
                        <td className="py-1.5 px-2">{row.date}</td>
                        <td className="text-right py-1.5 px-2">{row.occupiedRooms}</td>
                        <td className="text-right py-1.5 px-2">{row.totalRooms}</td>
                        <td className="text-right py-1.5 px-2 font-medium">{row.occupancyPercent.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {showKpi && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" />
            Raport porównawczy rok-do-roku (YoY)
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="yoy-year">Rok</Label>
              <Input
                id="yoy-year"
                type="number"
                min={2020}
                max={2030}
                value={yoyYear}
                onChange={(e) => setYoyYear(Number(e.target.value) || new Date().getFullYear())}
                className="mt-1 w-24"
              />
            </div>
            <Button type="button" onClick={loadYoYReport} disabled={yoyLoading}>
              {yoyLoading ? "Ładowanie…" : "Pobierz raport YoY"}
            </Button>
          </div>
          {yoyReport && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">
                Śr. obłożenie: {yoyReport.thisYearAvgOccupancy.toFixed(1)}% ({yoyReport.year}) vs {yoyReport.lastYearAvgOccupancy.toFixed(1)}% ({yoyReport.lastYear}) · Przychód: {yoyReport.thisYearTotalRevenue.toFixed(2)} vs {yoyReport.lastYearTotalRevenue.toFixed(2)} PLN
              </p>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Miesiąc</th>
                      <th className="text-right py-2 px-2">Obł. % (ten rok)</th>
                      <th className="text-right py-2 px-2">Obł. % (poprz.)</th>
                      <th className="text-right py-2 px-2">Δ obł.</th>
                      <th className="text-right py-2 px-2">Przychód (ten rok)</th>
                      <th className="text-right py-2 px-2">Przychód (poprz.)</th>
                      <th className="text-right py-2 px-2">Δ przych.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yoyReport.byMonth.map((row) => (
                      <tr key={row.month} className="border-b border-border/50">
                        <td className="py-1.5 px-2">{row.month}</td>
                        <td className="text-right py-1.5 px-2">{row.thisYearOccupancy.toFixed(1)}%</td>
                        <td className="text-right py-1.5 px-2">{row.lastYearOccupancy.toFixed(1)}%</td>
                        <td className="text-right py-1.5 px-2">{row.occupancyChangePercent != null ? `${row.occupancyChangePercent >= 0 ? "+" : ""}${row.occupancyChangePercent}%` : "—"}</td>
                        <td className="text-right py-1.5 px-2">{row.thisYearRevenue.toFixed(2)}</td>
                        <td className="text-right py-1.5 px-2">{row.lastYearRevenue.toFixed(2)}</td>
                        <td className="text-right py-1.5 px-2">{row.revenueChangePercent != null ? `${row.revenueChangePercent >= 0 ? "+" : ""}${row.revenueChangePercent}%` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {showKpi && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" />
            Raport porównawczy miesiąc-do-miesiąca
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="mom-year">Rok</Label>
              <Input
                id="mom-year"
                type="number"
                min={2020}
                max={2030}
                value={momYear}
                onChange={(e) => setMomYear(Number(e.target.value) || new Date().getFullYear())}
                className="mt-1 w-24"
              />
            </div>
            <div>
              <Label htmlFor="mom-month">Miesiąc</Label>
              <select
                id="mom-month"
                value={momMonth}
                onChange={(e) => setMomMonth(Number(e.target.value))}
                className="mt-1 h-9 w-32 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                  <option key={m} value={m}>{m}. {["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"][m - 1]}</option>
                ))}
              </select>
            </div>
            <Button type="button" onClick={loadMoMReport} disabled={momLoading}>
              {momLoading ? "Ładowanie…" : "Pobierz raport MoM"}
            </Button>
          </div>
          {momReport && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-md border bg-muted/30 px-4 py-3">
                <p className="text-sm font-medium text-muted-foreground">Obłożenie</p>
                <p className="text-xl font-semibold">
                  {momReport.thisMonthOccupancy.toFixed(1)}% ({momReport.year}-{String(momReport.month).padStart(2, "0")}) vs {momReport.lastMonthOccupancy.toFixed(1)}% ({momReport.lastYear}-{String(momReport.lastMonth).padStart(2, "0")})
                </p>
                <p className="text-sm">{momReport.occupancyChangePercent != null ? `Δ ${momReport.occupancyChangePercent >= 0 ? "+" : ""}${momReport.occupancyChangePercent}%` : "—"}</p>
              </div>
              <div className="rounded-md border bg-muted/30 px-4 py-3">
                <p className="text-sm font-medium text-muted-foreground">Przychód (PLN)</p>
                <p className="text-xl font-semibold">
                  {momReport.thisMonthRevenue.toFixed(2)} vs {momReport.lastMonthRevenue.toFixed(2)}
                </p>
                <p className="text-sm">{momReport.revenueChangePercent != null ? `Δ ${momReport.revenueChangePercent >= 0 ? "+" : ""}${momReport.revenueChangePercent}%` : "—"}</p>
              </div>
            </div>
          )}
        </section>
      )}

      {showKpi && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" />
            Raport kasowy (cash report by shift)
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="cash-shift-from">Od (data otwarcia zmiany)</Label>
              <Input
                id="cash-shift-from"
                type="date"
                value={cashShiftFrom}
                onChange={(e) => setCashShiftFrom(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <div>
              <Label htmlFor="cash-shift-to">Do</Label>
              <Input
                id="cash-shift-to"
                type="date"
                value={cashShiftTo}
                onChange={(e) => setCashShiftTo(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <Button type="button" onClick={loadCashShiftReport} disabled={cashShiftLoading}>
              {cashShiftLoading ? "Ładowanie…" : "Pobierz raport kasowy"}
            </Button>
          </div>
          {cashShiftReport && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">
                Liczba zmian: <strong>{cashShiftReport.totalCount}</strong>
              </p>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Otwarcie</th>
                      <th className="text-left py-2 px-2">Zamknięcie</th>
                      <th className="text-right py-2 px-2">Stan otwarcia</th>
                      <th className="text-right py-2 px-2">Stan zamknięcia</th>
                      <th className="text-right py-2 px-2">Oczekiwany</th>
                      <th className="text-right py-2 px-2">Różnica</th>
                      <th className="text-left py-2 px-2">Otworzył</th>
                      <th className="text-left py-2 px-2">Zamknął</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashShiftReport.shifts.map((row) => (
                      <tr key={row.id} className="border-b border-border/50">
                        <td className="py-1.5 px-2">{row.openedAt}</td>
                        <td className="py-1.5 px-2">{row.closedAt ?? "—"}</td>
                        <td className="text-right py-1.5 px-2">{row.openingBalance.toFixed(2)}</td>
                        <td className="text-right py-1.5 px-2">{row.closingBalance != null ? row.closingBalance.toFixed(2) : "—"}</td>
                        <td className="text-right py-1.5 px-2">{row.expectedCashAtClose != null ? row.expectedCashAtClose.toFixed(2) : "—"}</td>
                        <td className="text-right py-1.5 px-2">{row.difference != null ? row.difference.toFixed(2) : "—"}</td>
                        <td className="py-1.5 px-2">{row.openedByName ?? "—"}</td>
                        <td className="py-1.5 px-2">{row.closedByName ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {showKpi && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" />
            Raport bankowy (bank reconciliation)
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="bank-rec-from">Od</Label>
              <Input
                id="bank-rec-from"
                type="date"
                value={bankRecFrom}
                onChange={(e) => setBankRecFrom(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <div>
              <Label htmlFor="bank-rec-to">Do</Label>
              <Input
                id="bank-rec-to"
                type="date"
                value={bankRecTo}
                onChange={(e) => setBankRecTo(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <Button type="button" onClick={loadBankRecReport} disabled={bankRecLoading}>
              {bankRecLoading ? "Ładowanie…" : "Pobierz raport bankowy"}
            </Button>
          </div>
          {bankRecReport && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">
                Łączna kwota: <strong>{bankRecReport.totalAmount.toFixed(2)} PLN</strong> ({bankRecReport.totalCount} transakcji)
              </p>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Data</th>
                      <th className="text-right py-2 px-2">Liczba transakcji</th>
                      <th className="text-right py-2 px-2">Suma (PLN)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankRecReport.byDate.map((row) => (
                      <tr key={row.date} className="border-b border-border/50">
                        <td className="py-1.5 px-2">{row.date}</td>
                        <td className="text-right py-1.5 px-2">{row.transactionCount}</td>
                        <td className="text-right py-1.5 px-2 font-medium">{row.totalAmount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {showKpi && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" />
            Raport gości VIP
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="vip-from">Od (zameldowanie/wymeldowanie)</Label>
              <Input
                id="vip-from"
                type="date"
                value={vipFrom}
                onChange={(e) => setVipFrom(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <div>
              <Label htmlFor="vip-to">Do</Label>
              <Input
                id="vip-to"
                type="date"
                value={vipTo}
                onChange={(e) => setVipTo(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <Button type="button" onClick={loadVipReport} disabled={vipReportLoading}>
              {vipReportLoading ? "Ładowanie…" : "Pobierz raport VIP"}
            </Button>
          </div>
          {vipReport && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">
                Liczba rezerwacji VIP: <strong>{vipReport.totalCount}</strong>
              </p>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Potw.</th>
                      <th className="text-left py-2 px-2">Gość</th>
                      <th className="text-left py-2 px-2">Email</th>
                      <th className="text-left py-2 px-2">Telefon</th>
                      <th className="text-left py-2 px-2">Poziom VIP</th>
                      <th className="text-left py-2 px-2">Pokój</th>
                      <th className="text-left py-2 px-2">Zameldowanie</th>
                      <th className="text-left py-2 px-2">Wymeldowanie</th>
                      <th className="text-left py-2 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vipReport.guests.map((row) => (
                      <tr key={row.id} className="border-b border-border/50">
                        <td className="py-1.5 px-2">{row.confirmationNumber ?? "—"}</td>
                        <td className="py-1.5 px-2">{row.guestName}</td>
                        <td className="py-1.5 px-2">{row.email ?? "—"}</td>
                        <td className="py-1.5 px-2">{row.phone ?? "—"}</td>
                        <td className="py-1.5 px-2">{row.vipLevel ?? "—"}</td>
                        <td className="py-1.5 px-2">{row.roomNumber}</td>
                        <td className="py-1.5 px-2">{row.checkIn}</td>
                        <td className="py-1.5 px-2">{row.checkOut}</td>
                        <td className="py-1.5 px-2">{row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {showKpi && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" />
            Raport urodzin gości (birthday report)
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="birthday-from">Od (daty w okresie)</Label>
              <Input
                id="birthday-from"
                type="date"
                value={birthdayFrom}
                onChange={(e) => setBirthdayFrom(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <div>
              <Label htmlFor="birthday-to">Do</Label>
              <Input
                id="birthday-to"
                type="date"
                value={birthdayTo}
                onChange={(e) => setBirthdayTo(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <Button type="button" onClick={loadBirthdayReport} disabled={birthdayReportLoading}>
              {birthdayReportLoading ? "Ładowanie…" : "Pobierz raport urodzin"}
            </Button>
          </div>
          {birthdayReport && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">
                Liczba gości z urodzinami w okresie: <strong>{birthdayReport.totalCount}</strong>
              </p>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Gość</th>
                      <th className="text-left py-2 px-2">Email</th>
                      <th className="text-left py-2 px-2">Telefon</th>
                      <th className="text-left py-2 px-2">Data urodzin</th>
                      <th className="text-left py-2 px-2">Urodziny w okresie (data)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {birthdayReport.guests.map((row) => (
                      <tr key={row.id} className="border-b border-border/50">
                        <td className="py-1.5 px-2">{row.guestName}</td>
                        <td className="py-1.5 px-2">{row.email ?? "—"}</td>
                        <td className="py-1.5 px-2">{row.phone ?? "—"}</td>
                        <td className="py-1.5 px-2">{row.dateOfBirth}</td>
                        <td className="py-1.5 px-2">{row.birthdayInPeriod}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {showMeals && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" />
            Raport posiłków (ile śniadań, obiadów, kolacji)
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="meal-report-date">Data</Label>
              <Input
                id="meal-report-date"
                type="date"
                value={mealReportDate}
                onChange={(e) => setMealReportDate(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <Button type="button" onClick={loadMealReport} disabled={mealReportLoading}>
              {mealReportLoading ? "Ładowanie…" : "Pobierz raport posiłków"}
            </Button>
          </div>
          {mealReport && (
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-md border bg-muted/30 px-4 py-3">
                <p className="text-sm font-medium text-muted-foreground">Śniadania</p>
                <p className="text-xl font-semibold">
                  {mealReport.consumed.breakfast} / {mealReport.expected.breakfast} (oczek.)
                </p>
              </div>
              <div className="rounded-md border bg-muted/30 px-4 py-3">
                <p className="text-sm font-medium text-muted-foreground">Obiady</p>
                <p className="text-xl font-semibold">
                  {mealReport.consumed.lunch} / {mealReport.expected.lunch} (oczek.)
                </p>
              </div>
              <div className="rounded-md border bg-muted/30 px-4 py-3">
                <p className="text-sm font-medium text-muted-foreground">Kolacje</p>
                <p className="text-xl font-semibold">
                  {mealReport.consumed.dinner} / {mealReport.expected.dinner} (oczek.)
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {showMeals && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" />
            Raport posiłków wg daty (meal count by date – śniadania, obiady, kolacje)
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="meal-count-from">Od</Label>
              <Input
                id="meal-count-from"
                type="date"
                value={mealCountFrom}
                onChange={(e) => setMealCountFrom(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <div>
              <Label htmlFor="meal-count-to">Do</Label>
              <Input
                id="meal-count-to"
                type="date"
                value={mealCountTo}
                onChange={(e) => setMealCountTo(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <Button type="button" onClick={loadMealCountByDateReport} disabled={mealCountLoading}>
              {mealCountLoading ? "Ładowanie…" : "Pobierz raport wg dat"}
            </Button>
          </div>
          {mealCountReport && (
            <div className="mt-4 overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Data</th>
                    <th className="text-right py-2 px-2">Śniadania (oczek./skons.)</th>
                    <th className="text-right py-2 px-2">Obiady (oczek./skons.)</th>
                    <th className="text-right py-2 px-2">Kolacje (oczek./skons.)</th>
                  </tr>
                </thead>
                <tbody>
                  {mealCountReport.byDate.map((row) => (
                    <tr key={row.date} className="border-b border-border/50">
                      <td className="py-1.5 px-2">{row.date}</td>
                      <td className="text-right py-1.5 px-2">{row.consumed.breakfast} / {row.expected.breakfast}</td>
                      <td className="text-right py-1.5 px-2">{row.consumed.lunch} / {row.expected.lunch}</td>
                      <td className="text-right py-1.5 px-2">{row.consumed.dinner} / {row.expected.dinner}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {showKpi && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" />
            Harmonogram raportów (scheduled reports)
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Zaplanuj automatyczne generowanie i wysyłkę raportów e-mailem. Endpoint cron: <code className="text-xs bg-muted px-1 rounded">GET /api/cron/scheduled-reports</code> (Bearer CRON_SECRET).
          </p>
          <div className="mb-4 p-4 rounded-lg border bg-muted/30">
            <h3 className="text-sm font-medium mb-2">Dodaj harmonogram</h3>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <Label className="text-xs">Raport</Label>
                <select
                  data-testid="sched-report-type"
                  className="mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={schedReportType}
                  onChange={(e) => setSchedReportType(e.target.value)}
                >
                  {SCHEDULED_REPORT_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Częstotliwość</Label>
                <select
                  className="mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={schedScheduleType}
                  onChange={(e) => setSchedScheduleType(e.target.value as "DAILY" | "WEEKLY")}
                >
                  <option value="DAILY">Codziennie</option>
                  <option value="WEEKLY">Co tydzień</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Godzina</Label>
                <Input type="time" className="mt-1 w-28" value={schedTime} onChange={(e) => setSchedTime(e.target.value)} />
              </div>
              {schedScheduleType === "WEEKLY" && (
                <div>
                  <Label className="text-xs">Dzień tygodnia</Label>
                  <select
                    className="mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={schedDayOfWeek}
                    onChange={(e) => setSchedDayOfWeek(Number(e.target.value))}
                  >
                    <option value={0}>Niedziela</option>
                    <option value={1}>Poniedziałek</option>
                    <option value={2}>Wtorek</option>
                    <option value={3}>Środa</option>
                    <option value={4}>Czwartek</option>
                    <option value={5}>Piątek</option>
                    <option value={6}>Sobota</option>
                  </select>
                </div>
              )}
              <div className="min-w-[200px]">
                <Label className="text-xs">E-mail (adresy po przecinku)</Label>
                <Input data-testid="sched-emails" className="mt-1" value={schedEmails} onChange={(e) => setSchedEmails(e.target.value)} placeholder="a@h.pl, b@h.pl" />
              </div>
              <Button data-testid="sched-add-btn" type="button" onClick={handleAddScheduledReport} disabled={schedSubmitting}>
                {schedSubmitting ? "Zapisywanie…" : "Dodaj"}
              </Button>
            </div>
          </div>
          {scheduledReportsLoading ? (
            <p className="text-sm text-muted-foreground">Ładowanie listy…</p>
          ) : scheduledReports.length === 0 ? (
            <p className="text-sm text-muted-foreground">Brak zaplanowanych raportów.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Raport</th>
                  <th className="text-left py-2 px-2">Harmonogram</th>
                  <th className="text-left py-2 px-2">Adresy</th>
                  <th className="text-left py-2 px-2">Ostatnie uruchomienie</th>
                  <th className="text-right py-2 px-2">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {scheduledReports.map((r) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="py-1.5 px-2">{SCHEDULED_REPORT_TYPES.find((t) => t.value === r.reportType)?.label ?? r.reportType}</td>
                    <td className="py-1.5 px-2">
                      {r.scheduleType === "DAILY" ? "Codziennie" : ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "Sb"][r.scheduleDayOfWeek ?? 0]} o {r.scheduleTime}
                    </td>
                    <td className="py-1.5 px-2">{r.recipientEmails}</td>
                    <td className="py-1.5 px-2">{r.lastRunAt ? new Date(r.lastRunAt).toLocaleString("pl-PL") : "—"}</td>
                    <td className="py-1.5 px-2 text-right">
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleToggleScheduledReport(r.id, r.enabled)}>
                        {r.enabled ? "Wyłącz" : "Włącz"}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteScheduledReport(r.id)}>
                        Usuń
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {showOfficial && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <FileText className="h-5 w-5" />
            Raporty urzędowe
          </h2>
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="mb-2 text-sm font-medium">Raport GUS (noclegi, goście)</p>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <Label className="text-xs">Od</Label>
                  <Input
                    type="date"
                    id="gusFrom"
                    value={gusFrom}
                    onChange={(e) => setGusFrom(e.target.value)}
                    className="mt-1 w-36"
                  />
                </div>
                <div>
                  <Label className="text-xs">Do</Label>
                  <Input
                    type="date"
                    id="gusTo"
                    value={gusTo}
                    onChange={(e) => setGusTo(e.target.value)}
                    className="mt-1 w-36"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    window.open(
                      `/api/reports/gus?from=${encodeURIComponent(gusFrom)}&to=${encodeURIComponent(gusTo)}`,
                      "_blank"
                    )
                  }
                >
                  Pobierz GUS (CSV)
                </Button>
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Raport policyjny (melding gości)</p>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <Label className="text-xs">Data</Label>
                  <Input
                    type="date"
                    id="policeDate"
                    value={policeDate}
                    onChange={(e) => setPoliceDate(e.target.value)}
                    className="mt-1 w-36"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    window.open(
                      `/api/reports/police?date=${encodeURIComponent(policeDate)}`,
                      "_blank"
                    )
                  }
                >
                  Pobierz raport policyjny (CSV)
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {!showManagement && !showKpi && !showMeals && !showOfficial && (
        <p className="text-sm text-muted-foreground">
          Nie masz uprawnień do żadnego raportu.
        </p>
      )}
    </div>
  );
}
