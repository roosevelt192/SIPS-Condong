"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ExcelJS from "exceljs";
import {
  CalendarCheck2,
  Calendar as CalendarIcon,
  BarChart3,
  Search,
  CheckCircle2,
  Save,
  Printer,
  FileSpreadsheet,
  Users,
  ChevronLeft,
  ChevronRight,
  Filter,
  Info,
  Check,
  X,
  RefreshCw,
  Sparkles,
  Building2,
  ShieldCheck,
  Eye,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Student {
  id: string;
  nis: string;
  full_name: string;
  class_name: string;
  dorm: string;
  consulate: string;
  entry_year: string;
  status?: string;
}

interface AttendanceSession {
  id: string;
  category: "sholat_wajib" | "cek_malam" | "khusus";
  sub_category?: "shubuh" | "dzuhur" | "ashar" | "maghrib" | "isya" | null;
  title?: string;
  date: string;
  time: string;
  scope_type: "kamar" | "kelas" | "angkatan" | "konsulat";
  scope_value: string;
  created_by?: string;
  created_at?: string;
}

interface AttendanceRecord {
  id?: number;
  session_id: string;
  student_id: string;
  status: "hadir" | "sakit" | "izin" | "ghoib";
  notes?: string;
}

const PRAYER_SCHEDULE: Record<string, string> = {
  shubuh: "04:30",
  dzuhur: "12:00",
  ashar: "15:15",
  maghrib: "18:00",
  isya: "19:15",
};

const formatDateIndo = (dateStr: string) => {
  if (!dateStr) return "-";
  try {
    const clean = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
    const [y, m, d] = clean.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

const getTodayDateStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function AttendanceDashboardPage() {
  const [activeModule, setActiveModule] = useState<"input" | "calendar" | "analytics">("input");

  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState("");

  // Modul 1: Input Cepat
  const [inputCategory, setInputCategory] = useState<"sholat_wajib" | "cek_malam" | "khusus">("sholat_wajib");
  const [inputSubCategory, setInputSubCategory] = useState<"shubuh" | "dzuhur" | "ashar" | "maghrib" | "isya">("shubuh");
  const [inputTitle, setInputTitle] = useState("");
  const [inputDate, setInputDate] = useState(getTodayDateStr());
  const [inputTime, setInputTime] = useState("04:30");
  const [inputScopeType, setInputScopeType] = useState<"kamar" | "kelas" | "angkatan" | "konsulat">("kamar");
  const [inputScopeValue, setInputScopeValue] = useState("");
  const [isInputLoaded, setIsInputLoaded] = useState(false);
  const [attendanceSheet, setAttendanceSheet] = useState<Record<string, { status: "hadir" | "sakit" | "izin" | "ghoib"; notes: string }>>({});
  const [sheetSearch, setSheetSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Modul 2: Monitoring Kalender
  const [calendarScope, setCalendarScope] = useState<string>("all");
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [selectedDrawerDate, setSelectedDrawerDate] = useState<string | null>(null);

  // Modul 3: Rekap & Analitik
  const [rekapPeriod, setRekapPeriod] = useState<"today" | "week" | "month" | "custom">("today");
  const [customStart, setCustomStart] = useState(getTodayDateStr());
  const [customEnd, setCustomEnd] = useState(getTodayDateStr());
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterScopeType, setFilterScopeType] = useState<"all" | "kamar" | "kelas" | "angkatan" | "konsulat">("all");
  const [filterScopeValue, setFilterScopeValue] = useState<string>("all");
  const [isReportRendered, setIsReportRendered] = useState(false);
  const [rekapSearch, setRekapSearch] = useState("");

  // Pemuatan data penuh melebihi batas 1000 baris
  const loadDatabaseData = useCallback(async () => {
    setLoading(true);
    try {
      let allStudents: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await supabase.from("students").select("*").range(from, to);
        if (error) throw error;
        if (data && data.length > 0) {
          allStudents = [...allStudents, ...data];
          if (data.length < pageSize) hasMore = false;
          else page++;
        } else {
          hasMore = false;
        }
      }

      const formattedStudents: Student[] = allStudents.map((item: any) => ({
        id: String(item.id),
        nis: (item.nis || item.nomor_induk || "-").trim(),
        full_name: (item.full_name || item.nama_lengkap || item.nama_santri || item.name || item.nama || "Santri").trim(),
        class_name: (item.class || item.kelas || item.class_name || item.rombel || "-").trim(),
        dorm: (item.dorm || item.kamar_asrama || item.asrama || item.rayon || item.kamar || "-").trim(),
        consulate: (item.consulate || item.asal_konsulat || item.konsulat || item.kota_asal || "Konsulat Tasikmalaya").trim(),
        entry_year: String(item.entry_year || item.tahun_masuk || "2026").trim(),
        status: item.status || "active",
      }));

      formattedStudents.sort((a, b) => a.full_name.localeCompare(b.full_name, "id"));
      setStudents(formattedStudents);

      const { data: sessData } = await supabase.from("attendance_sessions").select("*").order("date", { ascending: false });
      if (sessData) setSessions(sessData);

      const { data: recData } = await supabase.from("attendance_records").select("*");
      if (recData) setRecords(recData);
    } catch (err) {
      console.error("Gagal sinkron data presensi:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDatabaseData();
  }, [loadDatabaseData]);

  // Daftar Unit Dinamis yang Bersih & Terurut
  const uniqueRooms = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.dorm && s.dorm !== "-") set.add(s.dorm);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "id"));
  }, [students]);

  const uniqueClasses = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.class_name && s.class_name !== "-") set.add(s.class_name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "id"));
  }, [students]);

  const uniqueGenerations = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      const gradePart = s.class_name.split(" ")[0]?.trim();
      if (gradePart && gradePart !== "-") set.add(`Tingkat ${gradePart}`);
      if (s.entry_year && s.entry_year !== "-") set.add(`Angkatan ${s.entry_year}`);
    });
    return Array.from(set).sort();
  }, [students]);

  const uniqueConsulates = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.consulate && s.consulate !== "-") set.add(s.consulate);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "id"));
  }, [students]);

  // Inisialisasi default scope value saat mode berganti
  useEffect(() => {
    if (inputScopeType === "kamar") setInputScopeValue(uniqueRooms[0] || "");
    if (inputScopeType === "kelas") setInputScopeValue(uniqueClasses[0] || "");
    if (inputScopeType === "angkatan") setInputScopeValue(uniqueGenerations[0] || "");
    if (inputScopeType === "konsulat") setInputScopeValue(uniqueConsulates[0] || "");
  }, [inputScopeType, uniqueRooms, uniqueClasses, uniqueGenerations, uniqueConsulates]);

  // Santri yang cocok dengan cakupan terpilih (Input Cepat)
  const targetInputStudents = useMemo(() => {
    return students.filter((s) => {
      if (inputScopeType === "kamar") return s.dorm.toLowerCase() === inputScopeValue.toLowerCase();
      if (inputScopeType === "kelas") return s.class_name.toLowerCase() === inputScopeValue.toLowerCase();
      if (inputScopeType === "konsulat") return s.consulate.toLowerCase() === inputScopeValue.toLowerCase();
      if (inputScopeType === "angkatan") {
        if (inputScopeValue.startsWith("Tingkat ")) {
          const targetGrade = inputScopeValue.replace("Tingkat ", "").trim().toLowerCase();
          const studentGrade = s.class_name.split(" ")[0]?.trim().toLowerCase();
          return studentGrade === targetGrade;
        }
        if (inputScopeValue.startsWith("Angkatan ")) {
          const targetYear = inputScopeValue.replace("Angkatan ", "").trim();
          return s.entry_year === targetYear;
        }
      }
      return true;
    });
  }, [students, inputScopeType, inputScopeValue]);

  const filteredSheetStudents = useMemo(() => {
    if (!sheetSearch.trim()) return targetInputStudents;
    const q = sheetSearch.toLowerCase().trim();
    return targetInputStudents.filter(
      (s) => s.full_name.toLowerCase().includes(q) || s.nis.includes(q)
    );
  }, [targetInputStudents, sheetSearch]);

  const handleLoadSheet = () => {
    const initMap: Record<string, { status: "hadir" | "sakit" | "izin" | "ghoib"; notes: string }> = {};
    targetInputStudents.forEach((st) => {
      initMap[st.id] = { status: "hadir", notes: "" };
    });
    setAttendanceSheet(initMap);
    setIsInputLoaded(true);
  };

  const liveCount = useMemo(() => {
    let hadir = 0, sakit = 0, izin = 0, ghoib = 0;
    targetInputStudents.forEach((s) => {
      const st = attendanceSheet[s.id]?.status || "hadir";
      if (st === "hadir") hadir++;
      if (st === "sakit") sakit++;
      if (st === "izin") izin++;
      if (st === "ghoib") ghoib++;
    });
    return { hadir, sakit, izin, ghoib, total: targetInputStudents.length };
  }, [targetInputStudents, attendanceSheet]);

  const handleSetAllStatus = (newStatus: "hadir" | "ghoib") => {
    const updated = { ...attendanceSheet };
    targetInputStudents.forEach((s) => {
      updated[s.id] = { ...updated[s.id], status: newStatus };
    });
    setAttendanceSheet(updated);
  };

  const handleSubmitAttendance = useCallback(async () => {
    if (targetInputStudents.length === 0) {
      alert("Daftar santri masih kosong!");
      return;
    }
    setIsSaving(true);
    try {
      const sessionTitle =
        inputCategory === "khusus"
          ? inputTitle || "Presensi Khusus"
          : inputCategory === "cek_malam"
          ? "Pengecekan Kamar Malam"
          : `Sholat ${inputSubCategory.charAt(0).toUpperCase() + inputSubCategory.slice(1)}`;

      const { data: createdSess, error: sessErr } = await supabase
        .from("attendance_sessions")
        .insert({
          category: inputCategory,
          sub_category: inputCategory === "sholat_wajib" ? inputSubCategory : null,
          title: sessionTitle,
          date: inputDate,
          time: inputTime,
          scope_type: inputScopeType,
          scope_value: inputScopeValue,
        })
        .select()
        .single();

      if (sessErr) throw sessErr;

      const recordsPayload = targetInputStudents.map((st) => ({
        session_id: createdSess.id,
        student_id: st.id,
        status: attendanceSheet[st.id]?.status || "hadir",
        notes: attendanceSheet[st.id]?.notes || null,
      }));

      const { error: recErr } = await supabase.from("attendance_records").insert(recordsPayload);
      if (recErr) throw recErr;

      setToastMsg(`Presensi "${sessionTitle}" berhasil tersimpan.`);
      setTimeout(() => setToastMsg(""), 4000);
      setIsInputLoaded(false);
      loadDatabaseData();
    } catch (err: any) {
      alert("Kendala simpan presensi: " + (err.message || "Gagal menyimpan"));
    } finally {
      setIsSaving(false);
    }
  }, [targetInputStudents, inputCategory, inputTitle, inputSubCategory, inputDate, inputTime, inputScopeType, inputScopeValue, attendanceSheet, loadDatabaseData]);

  // Kalender Matrix
  const calendarDaysMatrix = useMemo(() => {
    const totalDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay();

    const days = [];
    for (let i = 0; i < firstDayIndex; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push(dateStr);
    }
    return days;
  }, [calendarMonth, calendarYear]);

  const getDayAttendanceSummary = useCallback(
    (dateStr: string) => {
      const sessOnDate = sessions.filter((s) => {
        if (s.date !== dateStr) return false;
        if (calendarScope !== "all" && s.scope_value.toLowerCase() !== calendarScope.toLowerCase()) return false;
        return true;
      });

      const totalSesi = sessOnDate.length;
      const hasSpecial = sessOnDate.some((s) => s.category === "khusus");
      const isPast = new Date(dateStr) < new Date(getTodayDateStr());

      return { totalSesi, hasSpecial, isPast, sessions: sessOnDate };
    },
    [sessions, calendarScope]
  );

  // Rekapitulasi Data Santri Terfilter
  const filteredSessionsRekap = useMemo(() => {
    if (!isReportRendered) return [];
    return sessions.filter((s) => {
      if (filterCategory !== "all" && s.category !== filterCategory) return false;
      if (filterScopeType !== "all" && s.scope_type !== filterScopeType) return false;
      if (filterScopeValue !== "all" && s.scope_value.toLowerCase() !== filterScopeValue.toLowerCase()) return false;

      if (rekapPeriod === "today") return s.date === getTodayDateStr();
      if (rekapPeriod === "week") {
        const pastWeek = new Date();
        pastWeek.setDate(pastWeek.getDate() - 7);
        return new Date(s.date) >= pastWeek;
      }
      if (rekapPeriod === "month") {
        const pastMonth = new Date();
        pastMonth.setDate(pastMonth.getDate() - 30);
        return new Date(s.date) >= pastMonth;
      }
      if (rekapPeriod === "custom") {
        return s.date >= customStart && s.date <= customEnd;
      }
      return true;
    });
  }, [sessions, isReportRendered, filterCategory, filterScopeType, filterScopeValue, rekapPeriod, customStart, customEnd]);

  const filteredSessionIdsRekap = useMemo(() => new Set(filteredSessionsRekap.map((s) => s.id)), [filteredSessionsRekap]);

  const rekapDataRows = useMemo(() => {
    if (!isReportRendered) return [];

    return students
      .filter((s) => {
        if (filterScopeType === "kamar" && filterScopeValue !== "all") {
          return s.dorm.toLowerCase() === filterScopeValue.toLowerCase();
        }
        if (filterScopeType === "kelas" && filterScopeValue !== "all") {
          return s.class_name.toLowerCase() === filterScopeValue.toLowerCase();
        }
        if (filterScopeType === "konsulat" && filterScopeValue !== "all") {
          return s.consulate.toLowerCase() === filterScopeValue.toLowerCase();
        }
        if (filterScopeType === "angkatan" && filterScopeValue !== "all") {
          if (filterScopeValue.startsWith("Tingkat ")) {
            const tg = filterScopeValue.replace("Tingkat ", "").trim().toLowerCase();
            return s.class_name.split(" ")[0]?.trim().toLowerCase() === tg;
          }
          if (filterScopeValue.startsWith("Angkatan ")) {
            const ty = filterScopeValue.replace("Angkatan ", "").trim();
            return s.entry_year === ty;
          }
        }
        return true;
      })
      .map((st) => {
        const stRecords = records.filter(
          (r) => r.student_id === st.id && (filteredSessionIdsRekap.size === 0 || filteredSessionIdsRekap.has(r.session_id))
        );

        let h = 0, s = 0, i = 0, g = 0;
        stRecords.forEach((r) => {
          if (r.status === "hadir") h++;
          if (r.status === "sakit") s++;
          if (r.status === "izin") i++;
          if (r.status === "ghoib") g++;
        });

        const totalSesi = stRecords.length;
        const disciplinePct = totalSesi === 0 ? 100 : Math.round((h / totalSesi) * 100);

        return {
          student: st,
          hadir: h,
          sakit: s,
          izin: i,
          ghoib: g,
          totalSesi,
          disciplinePct,
        };
      });
  }, [students, records, filteredSessionIdsRekap, isReportRendered, filterScopeType, filterScopeValue]);

  const kpiMetrics = useMemo(() => {
    if (rekapDataRows.length === 0) return { avgPct: 100, perfectCount: 0, warningCount: 0 };
    const avg = Math.round(rekapDataRows.reduce((acc, r) => acc + r.disciplinePct, 0) / rekapDataRows.length);
    const perfect = rekapDataRows.filter((r) => r.ghoib === 0 && r.totalSesi > 0).length;
    const warning = rekapDataRows.filter((r) => r.ghoib >= 3).length;
    return { avgPct: avg, perfectCount: perfect, warningCount: warning };
  }, [rekapDataRows]);

  // ================= EXPORT EXCEL PROFESIONAL =================
  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SIPS Pengasuhan Santri";
    workbook.created = new Date();

    const ws = workbook.addWorksheet("Rekap_Presensi", {
      views: [{ state: "frozen", ySplit: 5, xSplit: 3 }],
    });

    const borderStyle: Partial<ExcelJS.Borders> = {
      top: { style: "thin", color: { argb: "CBD5E1" } },
      left: { style: "thin", color: { argb: "CBD5E1" } },
      bottom: { style: "thin", color: { argb: "CBD5E1" } },
      right: { style: "thin", color: { argb: "CBD5E1" } },
    };

    // Header Kop Resmi
    ws.mergeCells("A1:K1");
    const titleCell = ws.getCell("A1");
    titleCell.value = "PONDOK PESANTREN CONDONG - SISTEM INFORMASI PENGASUHAN SANTRI (SIPS)";
    titleCell.font = { name: "Segoe UI", size: 12, bold: true, color: { argb: "FFFFFF" } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "064E3B" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 24;

    ws.mergeCells("A2:K2");
    const subCell = ws.getCell("A2");
    subCell.value = `Laporan Rekapitulasi Presensi Santri | Periode: ${rekapPeriod.toUpperCase()} | Cakupan: ${filterScopeType.toUpperCase()} (${filterScopeValue}) | Tanggal Unduh: ${formatDateIndo(getTodayDateStr())}`;
    subCell.font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "064E3B" } };
    subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D1FAE5" } };
    subCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(2).height = 18;

    ws.addRow([]);

    // Header Kolom
    const headers = ["NO", "NIS", "NAMA SANTRI", "KAMAR", "KELAS", "KONSULAT", "HADIR (H)", "SAKIT (S)", "IZIN (I)", "GHOIB (G)", "% DISIPLIN"];
    const hRow = ws.getRow(4);
    hRow.values = headers;
    hRow.height = 24;
    hRow.eachCell((c) => {
      c.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "047857" } };
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.border = borderStyle;
    });

    rekapDataRows.forEach((r, idx) => {
      const row = ws.getRow(idx + 5);
      row.values = [
        idx + 1,
        r.student.nis,
        r.student.full_name,
        r.student.dorm,
        r.student.class_name,
        r.student.consulate,
        r.hadir,
        r.sakit,
        r.izin,
        r.ghoib,
        `${r.disciplinePct}%`,
      ];
      row.height = 19;
      const isEven = idx % 2 === 1;
      row.eachCell((cell, colNum) => {
        cell.font = { name: "Segoe UI", size: 9 };
        cell.border = borderStyle;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isEven ? "F8FAFC" : "FFFFFF" } };
        cell.alignment = { horizontal: [1, 2, 5, 7, 8, 9, 10, 11].includes(colNum) ? "center" : "left", vertical: "middle" };
      });
    });

    ws.columns = [
      { width: 6 }, { width: 14 }, { width: 30 }, { width: 20 }, { width: 12 }, { width: 22 },
      { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 14 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Rekap_Presensi_SIPS_${filterScopeValue.replace(/\s+/g, "_")}_${getTodayDateStr()}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // ================= CETAK DOKUMEN PDF RESMI =================
  const handlePrintOfficialPDF = () => {
    const existingIframe = document.getElementById("sips-report-print-frame");
    if (existingIframe) existingIframe.remove();

    const iframe = document.createElement("iframe");
    iframe.id = "sips-report-print-frame";
    iframe.style.position = "fixed";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Laporan_Presensi_Pengasuhan_${getTodayDateStr()}</title>
          <style>
            @page { size: A4 portrait; margin: 12mm 15mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, sans-serif; }
            body { color: #000; font-size: 8.5pt; }
            .header-kop { text-align: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 10px; }
            .header-kop h2 { font-size: 11pt; font-weight: 900; text-transform: uppercase; }
            .header-kop p { font-size: 8pt; color: #333; margin-top: 1px; }
            .meta-box { width: 100%; border: 1px solid #999; padding: 6px 8px; margin-bottom: 12px; font-size: 7.5pt; display: flex; justify-content: space-between; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 8pt; }
            th, td { border: 1px solid #444; padding: 4px 6px; }
            th { background-color: #f0fdf4; font-weight: bold; text-align: center; }
            .ttd-box { display: flex; justify-content: space-between; margin-top: 30px; font-size: 8pt; text-align: center; }
            .ttd-col { width: 40%; }
            .ttd-space { height: 50px; }
          </style>
        </head>
        <body>
          <div class="header-kop">
            <h2>PONDOK PESANTREN CONDONG</h2>
            <p>BAGIAN PENGASUHAN SANTRI & KEDISIPLINAN TERPADU (SIPS)</p>
            <p style="font-size: 7pt; color: #666;">Cibeureum, Kota Tasikmalaya, Jawa Barat - Telp. (0265) 331578</p>
          </div>
          <div class="meta-box">
            <div>
              <p><b>Filter Cakupan:</b> ${filterScopeType.toUpperCase()} - ${filterScopeValue}</p>
              <p><b>Kategori Sesi:</b> ${filterCategory.toUpperCase()}</p>
            </div>
            <div style="text-align: right;">
              <p><b>Periode Rekap:</b> ${rekapPeriod.toUpperCase()} (${rekapPeriod === "custom" ? `${customStart} s/d ${customEnd}` : formatDateIndo(getTodayDateStr())})</p>
              <p><b>Total Santri:</b> ${rekapDataRows.length} Orang</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 25px;">No</th>
                <th style="width: 70px;">NIS</th>
                <th>Nama Santri</th>
                <th style="width: 80px;">Kamar</th>
                <th style="width: 50px;">Kelas</th>
                <th style="width: 30px;">H</th>
                <th style="width: 30px;">S</th>
                <th style="width: 30px;">I</th>
                <th style="width: 30px;">G</th>
                <th style="width: 45px;">% Disiplin</th>
              </tr>
            </thead>
            <tbody>
              ${rekapDataRows
                .map(
                  (r, idx) => `
                <tr>
                  <td align="center">${idx + 1}</td>
                  <td align="center">${r.student.nis}</td>
                  <td><b>${r.student.full_name}</b></td>
                  <td>${r.student.dorm}</td>
                  <td align="center">${r.student.class_name}</td>
                  <td align="center">${r.hadir}</td>
                  <td align="center">${r.sakit}</td>
                  <td align="center">${r.izin}</td>
                  <td align="center" style="color: ${r.ghoib > 0 ? '#b91c1c' : '#000'}; font-weight: ${r.ghoib > 0 ? 'bold' : 'normal'}">${r.ghoib}</td>
                  <td align="right"><b>${r.disciplinePct}%</b></td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
          <div class="ttd-box">
            <div class="ttd-col">
              <p>Mengetahui,</p>
              <p><b>Kepala Bagian Pengasuhan</b></p>
              <div class="ttd-space"></div>
              <p><u>( Ust. Pengasuhan Santri )</u></p>
            </div>
            <div class="ttd-col">
              <p>Tasikmalaya, ${formatDateIndo(getTodayDateStr())}</p>
              <p><b>Staf Kedisiplinan & Tarbiyah</b></p>
              <div class="ttd-space"></div>
              <p><u>( ............................................ )</u></p>
            </div>
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 400);
  };

  return (
    <div className="space-y-6 pb-20 font-sans">
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 flex items-center space-x-2 bg-emerald-950 text-emerald-200 border border-emerald-500/30 px-4 py-2.5 rounded-2xl shadow-xl backdrop-blur-md text-xs font-bold"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= HEADER UTAMA PRESENSI ================= */}
      <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-r from-emerald-950 via-[#064e3b] to-teal-950 p-6 sm:p-8 text-white shadow-xl border border-emerald-500/40">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-emerald-200 text-[10px] font-black uppercase tracking-wider backdrop-blur-xl">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span>SISTEM INFORMASI PENGASUHAN SANTRI</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
              Presensi Pengasuhan Santri
            </h1>
            <p className="text-xs text-emerald-100/85 max-w-xl font-medium">
              Pencatatan presensi sholat berjamaah, pengecekan kamar malam, kalender pemantauan berkala, dan rekapitulasi kedisiplinan santri mukim.
            </p>
          </div>

          {/* Switcher Tab Modul */}
          <div className="flex p-1.5 rounded-2xl bg-black/40 border border-emerald-400/30 backdrop-blur-xl shrink-0">
            {[
              { id: "input", label: "Input Cepat", icon: CalendarCheck2 },
              { id: "calendar", label: "Kalender Pemantauan", icon: CalendarIcon },
              { id: "analytics", label: "Rekap & Analitik", icon: BarChart3 },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeModule === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveModule(tab.id as any)}
                  className={`flex items-center space-x-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? "bg-emerald-500 text-slate-950 shadow-md font-black"
                      : "text-emerald-100/70 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ================= MODUL 1: INPUT CEPAT PRESENSI ================= */}
      {activeModule === "input" && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-[#0c1815] p-5 sm:p-6 rounded-[32px] border border-slate-200 dark:border-emerald-900/40 shadow-xs space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-500">Kategori Kegiatan</label>
                <select
                  value={inputCategory}
                  onChange={(e) => {
                    const cat = e.target.value as any;
                    setInputCategory(cat);
                    setIsInputLoaded(false);
                    if (cat === "cek_malam") setInputTime("21:30");
                    else if (cat === "sholat_wajib") setInputTime(PRAYER_SCHEDULE[inputSubCategory] || "04:30");
                  }}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 font-bold outline-none cursor-pointer"
                >
                  <option value="sholat_wajib">Sholat Berjamaah</option>
                  <option value="cek_malam">Cek Kamar Malam</option>
                  <option value="khusus">Kegiatan / Agenda Khusus</option>
                </select>
              </div>

              {inputCategory === "khusus" ? (
                <div className="space-y-1">
                  <label className="font-bold text-slate-500">Nama Agenda Khusus</label>
                  <input
                    type="text"
                    value={inputTitle}
                    onChange={(e) => setInputTitle(e.target.value)}
                    placeholder="Contoh: Sidak Disiplin Kamar"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 font-semibold outline-none"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="font-bold text-slate-500">Waktu Pelaksanaan</label>
                  <input
                    type="time"
                    value={inputTime}
                    onChange={(e) => setInputTime(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 font-bold outline-none"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="font-bold text-slate-500">Tanggal Pelaksanaan</label>
                <input
                  type="date"
                  value={inputDate}
                  onChange={(e) => setInputDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 font-bold outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-500">Kelompok Santri</label>
                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-emerald-950/40 rounded-xl">
                  {(["kamar", "kelas", "angkatan", "konsulat"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setInputScopeType(mode);
                        setIsInputLoaded(false);
                      }}
                      className={`py-1.5 rounded-lg text-[10px] font-black capitalize transition cursor-pointer ${
                        inputScopeType === mode ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:text-black"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {inputCategory === "sholat_wajib" && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-emerald-900/30 text-xs">
                <span className="font-bold text-slate-400">Waktu Sholat:</span>
                {(["shubuh", "dzuhur", "ashar", "maghrib", "isya"] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => {
                      setInputSubCategory(w);
                      setInputTime(PRAYER_SCHEDULE[w]);
                      setIsInputLoaded(false);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black capitalize transition cursor-pointer ${
                      inputSubCategory === w
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-slate-100 dark:bg-emerald-950/40 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-emerald-900/30">
              <div className="flex items-center gap-2.5 text-xs">
                <span className="font-bold text-slate-500">Pilih {inputScopeType}:</span>
                <select
                  value={inputScopeValue}
                  onChange={(e) => {
                    setInputScopeValue(e.target.value);
                    setIsInputLoaded(false);
                  }}
                  className="h-10 px-3.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 font-bold outline-none cursor-pointer min-w-56"
                >
                  {inputScopeType === "kamar" &&
                    uniqueRooms.map((r) => (
                      <option key={r} value={r}>
                        Kamar {r}
                      </option>
                    ))}
                  {inputScopeType === "kelas" &&
                    uniqueClasses.map((c) => (
                      <option key={c} value={c}>
                        Kelas {c}
                      </option>
                    ))}
                  {inputScopeType === "angkatan" &&
                    uniqueGenerations.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  {inputScopeType === "konsulat" &&
                    uniqueConsulates.map((k) => (
                      <option key={k} value={k}>
                        Konsulat {k}
                      </option>
                    ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleLoadSheet}
                className="inline-flex items-center justify-center space-x-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black transition shadow-md shadow-emerald-600/30 cursor-pointer"
              >
                <Users className="w-4 h-4" />
                <span>Buka Lembar Presensi ({targetInputStudents.length} Santri)</span>
              </button>
            </div>
          </div>

          {isInputLoaded ? (
            <div className="space-y-4">
              <div className="bg-white/95 dark:bg-[#0c1815]/95 backdrop-blur-xl p-4 rounded-3xl border border-slate-200 dark:border-emerald-900/50 shadow-md flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSetAllStatus("hadir")}
                    className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-black rounded-xl cursor-pointer shadow-xs active:scale-95 transition"
                  >
                    ✓ Hadir Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAllStatus("ghoib")}
                    className="px-3 py-1.5 bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 text-xs font-black rounded-xl cursor-pointer active:scale-95 transition"
                  >
                    ✗ Ghoib Semua
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-black border border-emerald-500/20">
                    Hadir: {liveCount.hadir}
                  </span>
                  <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 font-black border border-amber-500/20">
                    Sakit: {liveCount.sakit}
                  </span>
                  <span className="px-2.5 py-1 rounded-xl bg-sky-500/10 text-sky-700 dark:text-sky-300 font-black border border-sky-500/20">
                    Izin: {liveCount.izin}
                  </span>
                  <span className="px-2.5 py-1 rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-300 font-black border border-rose-500/20">
                    Ghoib: {liveCount.ghoib}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSubmitAttendance}
                  className="flex items-center space-x-1.5 px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black rounded-xl shadow-md cursor-pointer disabled:opacity-50 active:scale-95 transition"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? "Menyimpan..." : "Simpan Presensi"}</span>
                </button>
              </div>

              <div className="bg-white dark:bg-[#0c1815] rounded-[32px] border border-slate-200 dark:border-emerald-900/40 p-5 shadow-xs space-y-3">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={sheetSearch}
                    onChange={(e) => setSheetSearch(e.target.value)}
                    placeholder="Cari santri di daftar ini..."
                    className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 text-xs font-semibold outline-none"
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-emerald-900/40 text-slate-400 uppercase text-[10px]">
                        <th className="py-2.5 px-3 w-10">No</th>
                        <th className="py-2.5 px-3 w-20">NIS</th>
                        <th className="py-2.5 px-3">Nama Lengkap</th>
                        <th className="py-2.5 px-3 w-24">Kamar</th>
                        <th className="py-2.5 px-3 w-20">Kelas</th>
                        <th className="py-2.5 px-3 text-center w-60">Status Kehadiran</th>
                        <th className="py-2.5 px-3 w-52">Catatan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-emerald-900/30 font-medium">
                      {filteredSheetStudents.map((st, index) => {
                        const currentVal = attendanceSheet[st.id] || { status: "hadir", notes: "" };
                        return (
                          <tr key={st.id} className="hover:bg-slate-50/50 dark:hover:bg-emerald-950/20">
                            <td className="py-2.5 px-3 text-slate-400 font-mono">{index + 1}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-600">{st.nis}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{st.full_name}</td>
                            <td className="py-2.5 px-3 text-slate-500">{st.dorm}</td>
                            <td className="py-2.5 px-3 text-slate-500">{st.class_name}</td>
                            <td className="py-2.5 px-3">
                              <div className="grid grid-cols-4 gap-1 bg-slate-100 dark:bg-emerald-950/40 p-1 rounded-xl">
                                {(["hadir", "sakit", "izin", "ghoib"] as const).map((stKey) => {
                                  const isActive = currentVal.status === stKey;
                                  const colorMap = {
                                    hadir: "bg-emerald-600 text-white",
                                    sakit: "bg-amber-500 text-white",
                                    izin: "bg-sky-500 text-white",
                                    ghoib: "bg-rose-600 text-white",
                                  };
                                  return (
                                    <button
                                      key={stKey}
                                      type="button"
                                      onClick={() =>
                                        setAttendanceSheet((prev) => ({
                                          ...prev,
                                          [st.id]: { ...prev[st.id], status: stKey },
                                        }))
                                      }
                                      className={`py-1 rounded-lg text-xs font-black uppercase transition ${
                                        isActive ? colorMap[stKey] : "text-slate-500 hover:text-black"
                                      }`}
                                    >
                                      {stKey.charAt(0)}
                                    </button>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <input
                                type="text"
                                value={currentVal.notes || ""}
                                onChange={(e) =>
                                  setAttendanceSheet((prev) => ({
                                    ...prev,
                                    [st.id]: { ...prev[st.id], notes: e.target.value },
                                  }))
                                }
                                placeholder="Ket. izin/sakit..."
                                className="w-full h-7.5 px-2.5 rounded-lg border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 text-xs outline-none"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#0c1815] p-12 rounded-[32px] border border-dashed border-slate-200 dark:border-emerald-900/40 text-center space-y-2">
              <Info className="w-8 h-8 text-emerald-600 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Lembar Presensi Belum Dibuka</h3>
              <p className="text-xs text-slate-400">Pilih unit santri di atas lalu klik tombol <b>Buka Lembar Presensi</b>.</p>
            </div>
          )}
        </div>
      )}

      {/* ================= MODUL 2: KALENDER PEMANTAUAN PRESENSI ================= */}
      {activeModule === "calendar" && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-[#0c1815] p-5 rounded-[32px] border border-slate-200 dark:border-emerald-900/40 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs">
              <span className="font-bold text-slate-500">Filter Kamar:</span>
              <select
                value={calendarScope}
                onChange={(e) => setCalendarScope(e.target.value)}
                className="h-10 px-3.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 font-bold outline-none cursor-pointer min-w-48"
              >
                <option value="all">Semua Kamar Asrama</option>
                {uniqueRooms.map((r) => (
                  <option key={r} value={r}>
                    Kamar {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (calendarMonth === 0) {
                    setCalendarMonth(11);
                    setCalendarYear((y) => y - 1);
                  } else setCalendarMonth((m) => m - 1);
                }}
                className="p-2 rounded-xl bg-slate-100 dark:bg-emerald-950/40 hover:bg-slate-200 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-black min-w-32 text-center">
                {new Date(calendarYear, calendarMonth).toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (calendarMonth === 11) {
                    setCalendarMonth(0);
                    setCalendarYear((y) => y + 1);
                  } else setCalendarMonth((m) => m + 1);
                }}
                className="p-2 rounded-xl bg-slate-100 dark:bg-emerald-950/40 hover:bg-slate-200 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0c1815] p-5 sm:p-6 rounded-[32px] border border-slate-200 dark:border-emerald-900/40 shadow-xs">
            <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-bold text-slate-400 mb-2.5 uppercase">
              {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {calendarDaysMatrix.map((dateStr, idx) => {
                if (!dateStr) return <div key={idx} className="h-20 bg-slate-50/40 dark:bg-emerald-950/10 rounded-2xl" />;

                const summary = getDayAttendanceSummary(dateStr);
                const dayNum = parseInt(dateStr.split("-")[2], 10);
                const isToday = dateStr === getTodayDateStr();

                return (
                  <div
                    key={dateStr}
                    onClick={() => setSelectedDrawerDate(dateStr)}
                    className={`h-20 p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between hover:border-emerald-500 ${
                      isToday
                        ? "border-emerald-600 bg-emerald-50/30 dark:bg-emerald-950/30"
                        : "border-slate-200/80 dark:border-emerald-900/40 bg-white dark:bg-[#071310]"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className={`text-xs font-black ${isToday ? "text-emerald-600" : "text-slate-800 dark:text-slate-200"}`}>
                        {dayNum}
                      </span>
                      {summary.hasSpecial && (
                        <span className="h-2 w-2 rounded-full bg-purple-500 ring-2 ring-purple-300" title="Ada Kegiatan Khusus" />
                      )}
                    </div>

                    <div
                      className={`py-0.5 px-1 rounded-lg text-[9px] font-black text-center truncate ${
                        summary.totalSesi > 0
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : summary.isPast
                          ? "bg-slate-100 text-slate-400"
                          : "text-slate-300"
                      }`}
                    >
                      {summary.totalSesi > 0 ? `${summary.totalSesi} Sesi` : summary.isPast ? "Kosong" : "·"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Drawer Detail Hari Terpilih */}
          <AnimatePresence>
            {selectedDrawerDate && (
              <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
                <motion.div
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  className="w-full max-w-md bg-white dark:bg-[#0c1815] h-full shadow-2xl p-6 flex flex-col justify-between overflow-y-auto"
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-emerald-900/40 pb-3">
                      <div>
                        <h3 className="text-sm font-black text-slate-900 dark:text-white">Rekap Sesi Terlaksana</h3>
                        <p className="text-xs text-slate-400">{formatDateIndo(selectedDrawerDate)}</p>
                      </div>
                      <button type="button" onClick={() => setSelectedDrawerDate(null)} className="p-1 rounded-xl hover:bg-slate-100 cursor-pointer">
                        <X className="w-5 h-5 text-slate-400" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      {sessions.filter((s) => s.date === selectedDrawerDate).length === 0 ? (
                        <p className="text-xs text-slate-400 py-6 text-center">Tidak ada sesi presensi yang tercatat pada tanggal ini.</p>
                      ) : (
                        sessions
                          .filter((s) => s.date === selectedDrawerDate)
                          .map((s) => (
                            <div key={s.id} className="p-3 rounded-2xl border border-slate-200 dark:border-emerald-900/40 bg-slate-50 dark:bg-emerald-950/20 text-xs space-y-1">
                              <div className="flex justify-between font-bold text-slate-900 dark:text-white">
                                <span>{s.title}</span>
                                <span className="font-mono text-emerald-600">{s.time} WIB</span>
                              </div>
                              <p className="text-[10px] text-slate-400">
                                Cakupan: <span className="font-bold text-slate-600 capitalize">{s.scope_type} - {s.scope_value}</span>
                              </p>
                            </div>
                          ))
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedDrawerDate(null)}
                    className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black cursor-pointer"
                  >
                    Tutup
                  </button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ================= MODUL 3: LAPORAN & REKAPITULASI KEDISIPLINAN ================= */}
      {activeModule === "analytics" && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-[#0c1815] p-5 sm:p-6 rounded-[32px] border border-slate-200 dark:border-emerald-900/40 shadow-xs space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-500">Rentang Waktu</label>
                <select
                  value={rekapPeriod}
                  onChange={(e) => {
                    setRekapPeriod(e.target.value as any);
                    setIsReportRendered(false);
                  }}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 font-bold outline-none cursor-pointer"
                >
                  <option value="today">Hari Ini</option>
                  <option value="week">7 Hari Terakhir</option>
                  <option value="month">30 Hari Terakhir</option>
                  <option value="custom">Rentang Kustom</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-500">Kategori Kegiatan</label>
                <select
                  value={filterCategory}
                  onChange={(e) => {
                    setFilterCategory(e.target.value);
                    setIsReportRendered(false);
                  }}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 font-bold outline-none cursor-pointer"
                >
                  <option value="all">Semua Kategori</option>
                  <option value="sholat_wajib">Sholat Berjamaah</option>
                  <option value="cek_malam">Cek Malam</option>
                  <option value="khusus">Presensi Khusus</option>
                </select>
              </div>

              {/* Filter Rombel Utama */}
              <div className="space-y-1">
                <label className="font-bold text-slate-500">Filter Basis Rombel</label>
                <select
                  value={filterScopeType}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setFilterScopeType(val);
                    setFilterScopeValue("all");
                    setIsReportRendered(false);
                  }}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 font-bold outline-none cursor-pointer"
                >
                  <option value="all">Semua Santri (Global)</option>
                  <option value="kamar">Per Kamar Asrama</option>
                  <option value="kelas">Per Kelas</option>
                  <option value="angkatan">Per Angkatan / Tingkat</option>
                  <option value="konsulat">Per Konsulat Wilayah</option>
                </select>
              </div>

              {/* Dropdown Pilihan Unit Dinamis */}
              <div className="space-y-1">
                <label className="font-bold text-slate-500">
                  {filterScopeType === "all" ? "Pilihan Unit (Otomatis)" : `Pilih ${filterScopeType.toUpperCase()}`}
                </label>
                <select
                  disabled={filterScopeType === "all"}
                  value={filterScopeValue}
                  onChange={(e) => {
                    setFilterScopeValue(e.target.value);
                    setIsReportRendered(false);
                  }}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 font-bold outline-none cursor-pointer disabled:opacity-50"
                >
                  <option value="all">Semua {filterScopeType !== "all" ? filterScopeType : "Unit"}</option>
                  {filterScopeType === "kamar" &&
                    uniqueRooms.map((r) => (
                      <option key={r} value={r}>
                        Kamar {r}
                      </option>
                    ))}
                  {filterScopeType === "kelas" &&
                    uniqueClasses.map((c) => (
                      <option key={c} value={c}>
                        Kelas {c}
                      </option>
                    ))}
                  {filterScopeType === "angkatan" &&
                    uniqueGenerations.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  {filterScopeType === "konsulat" &&
                    uniqueConsulates.map((k) => (
                      <option key={k} value={k}>
                        Konsulat {k}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {rekapPeriod === "custom" && (
              <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-emerald-950/30 rounded-xl border border-slate-200 dark:border-emerald-900/40 w-fit text-xs">
                <span className="font-bold text-slate-400">Dari:</span>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => {
                    setCustomStart(e.target.value);
                    setIsReportRendered(false);
                  }}
                  className="h-8 px-2 rounded-lg border border-slate-200 bg-white font-semibold"
                />
                <span className="text-slate-400">s/d</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => {
                    setCustomEnd(e.target.value);
                    setIsReportRendered(false);
                  }}
                  className="h-8 px-2 rounded-lg border border-slate-200 bg-white font-semibold"
                />
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-emerald-900/30">
              <button
                type="button"
                onClick={() => setIsReportRendered(true)}
                className="flex items-center space-x-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black transition cursor-pointer shadow-md shadow-emerald-600/20"
              >
                <Eye className="w-4 h-4" />
                <span>Tampilkan Data Rekapitulasi</span>
              </button>

              {isReportRendered && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="flex items-center space-x-1.5 px-4 py-2.5 border border-emerald-600/30 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-2xl cursor-pointer shadow-xs hover:bg-emerald-100"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Unduh Excel (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintOfficialPDF}
                    className="flex items-center space-x-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-2xl cursor-pointer shadow-md"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Cetak PDF Resmi</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Tampilan Data Setelah Ditekan Tampilkan */}
          {isReportRendered ? (
            <div className="space-y-4">
              {/* KPI Ringkas */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="bg-white dark:bg-[#0c1815] p-5 rounded-3xl border border-slate-200 dark:border-emerald-900/40 shadow-xs">
                  <span className="text-[10px] font-black uppercase text-slate-400">Rata-Rata Kehadiran</span>
                  <p className="text-3xl font-black text-emerald-600 mt-1">{kpiMetrics.avgPct}%</p>
                </div>
                <div className="bg-white dark:bg-[#0c1815] p-5 rounded-3xl border border-slate-200 dark:border-emerald-900/40 shadow-xs">
                  <span className="text-[10px] font-black uppercase text-slate-400">100% Disiplin (Taat Penuh)</span>
                  <p className="text-3xl font-black text-teal-600 mt-1">{kpiMetrics.perfectCount} Santri</p>
                </div>
                <div className="bg-white dark:bg-[#0c1815] p-5 rounded-3xl border border-slate-200 dark:border-emerald-900/40 shadow-xs">
                  <span className="text-[10px] font-black uppercase text-rose-500">Peringatan Disiplin (≥3 Ghoib)</span>
                  <p className="text-3xl font-black text-rose-600 mt-1">{kpiMetrics.warningCount} Santri</p>
                </div>
              </div>

              {/* Tabel Rekap Santri */}
              <div className="bg-white dark:bg-[#0c1815] p-5 sm:p-6 rounded-[32px] border border-slate-200 dark:border-emerald-900/40 shadow-xs space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={rekapSearch}
                      onChange={(e) => setRekapSearch(e.target.value)}
                      placeholder="Cari santri di lembar rekap..."
                      className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 text-xs font-semibold outline-none"
                    />
                  </div>
                  <span className="text-xs text-slate-400">
                    Menampilkan <strong>{rekapDataRows.length} Santri</strong>
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-emerald-900/40 text-slate-400 uppercase text-[10px]">
                        <th className="py-3 px-3 w-10">No</th>
                        <th className="py-3 px-3 w-24">NIS</th>
                        <th className="py-3 px-3">Nama Santri</th>
                        <th className="py-3 px-3">Kamar</th>
                        <th className="py-3 px-3">Kelas</th>
                        <th className="py-3 px-3 text-center">H</th>
                        <th className="py-3 px-3 text-center">S</th>
                        <th className="py-3 px-3 text-center">I</th>
                        <th className="py-3 px-3 text-center">G</th>
                        <th className="py-3 px-3 text-right">% Disiplin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-emerald-900/30 font-medium">
                      {rekapDataRows
                        .filter((r) => r.student.full_name.toLowerCase().includes(rekapSearch.toLowerCase()) || r.student.nis.includes(rekapSearch))
                        .map((row, idx) => (
                          <tr key={row.student.id} className="hover:bg-slate-50/50 dark:hover:bg-emerald-950/20">
                            <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-600">{row.student.nis}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{row.student.full_name}</td>
                            <td className="py-2.5 px-3 text-slate-500">{row.student.dorm}</td>
                            <td className="py-2.5 px-3 text-slate-500">{row.student.class_name}</td>
                            <td className="py-2.5 px-3 text-center font-bold text-emerald-600">{row.hadir}</td>
                            <td className="py-2.5 px-3 text-center font-bold text-amber-600">{row.sakit}</td>
                            <td className="py-2.5 px-3 text-center font-bold text-sky-600">{row.izin}</td>
                            <td className="py-2.5 px-3 text-center font-bold text-rose-600">{row.ghoib}</td>
                            <td className="py-2.5 px-3 text-right">
                              <span
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${
                                  row.disciplinePct >= 85
                                    ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                                    : row.disciplinePct >= 70
                                    ? "bg-amber-500/10 text-amber-700 border-amber-500/20"
                                    : "bg-rose-500/10 text-rose-700 border-rose-500/20"
                                }`}
                              >
                                {row.disciplinePct}%
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#0c1815] p-12 rounded-[32px] border border-dashed border-slate-200 dark:border-emerald-900/40 text-center space-y-2">
              <Filter className="w-7 h-7 text-emerald-600 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Pilih Parameter Rekapitulasi</h3>
              <p className="text-xs text-slate-400">
                Tentukan cakupan rombel dan rentang waktu di atas, lalu klik <b>Tampilkan Data Rekapitulasi</b> untuk melihat hasil.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}