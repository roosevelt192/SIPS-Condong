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
  Sparkles,
  ChevronDown,
  Info,
  Check,
  X,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Student {
  id: string;
  nis: string;
  full_name: string;
  class_name: string;
  dormitory?: string;
  room?: string;
  room_name?: string;
  kamar?: string;
  asrama?: string;
  rayon?: string;
  komplek?: string;
  dorm?: string;
  nama_kamar?: string;
  consulate?: string;
  konsulat?: string;
  generation?: string;
  angkatan?: string;
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

// Pemetaan Waktu Otomatis Pesantren (WIB)
const PRAYER_SCHEDULE: Record<string, string> = {
  shubuh: "04:30",
  dzuhur: "12:00",
  ashar: "15:15",
  maghrib: "18:00",
  isya: "19:15",
};

// Helper: Deteksi Nama Kamar Santri Komprehensif
const getStudentRoom = (st: any): string => {
  if (!st || typeof st !== "object") return "Belum Diatur";

  const candidates = [
    st.room,
    st.kamar,
    st.dormitory,
    st.asrama,
    st.room_name,
    st.nama_kamar,
    st.dorm,
    st.rayon,
    st.komplek,
    st.room_number,
    st.dormitory_name,
  ];

  for (const val of candidates) {
    if (
      val !== null &&
      val !== undefined &&
      typeof val === "string" &&
      val.trim() !== "" &&
      val.trim().toLowerCase() !== "null" &&
      val.trim().toLowerCase() !== "undefined"
    ) {
      return val.trim();
    }
  }

  return "Belum Diatur";
};

// Helper: Format Tampilan Kamar agar tidak ganda kata "Kamar"
const formatRoomLabel = (roomStr: string): string => {
  if (!roomStr || roomStr === "Belum Diatur") return "Kamar Belum Diatur";
  if (roomStr.toLowerCase().startsWith("kamar")) return roomStr;
  return `Kamar ${roomStr}`;
};

const getStudentConsulate = (st: Student): string => {
  return st.consulate || st.konsulat || "Pusat";
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

  // Modul 1: Input Cepat (Default Shubuh -> 04:30)
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

  // Modul 2: Kalender Kamar
  const [calendarRoom, setCalendarRoom] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [selectedDrawerDate, setSelectedDrawerDate] = useState<string | null>(null);

  // Modul 3: Rekapitulasi & Analitik
  const [rekapPeriod, setRekapPeriod] = useState<"today" | "week" | "month" | "custom">("today");
  const [customStart, setCustomStart] = useState(getTodayDateStr());
  const [customEnd, setCustomEnd] = useState(getTodayDateStr());
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterScopeType, setFilterScopeType] = useState<string>("all");
  const [filterScopeValue, setFilterScopeValue] = useState<string>("all");
  const [isReportRendered, setIsReportRendered] = useState(false);
  const [rekapSearch, setRekapSearch] = useState("");
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  const loadDatabaseData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: stData } = await supabase.from("students").select("*").order("full_name", { ascending: true });
      if (stData && stData.length > 0) {
        setStudents(stData);
        const rooms = Array.from(
          new Set(stData.map((s) => getStudentRoom(s)).filter((r) => r && r !== "Belum Diatur"))
        ).sort();
        if (rooms.length > 0) {
          setInputScopeValue((prev) => (prev ? prev : rooms[0]));
          setCalendarRoom((prev) => (prev ? prev : rooms[0]));
        }
      }

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

  // Daftar Unik Rombel
  const uniqueRooms = useMemo(() => {
    const rooms = Array.from(
      new Set(students.map((s) => getStudentRoom(s)).filter((r) => r && r !== "Belum Diatur"))
    ).sort();
    return rooms.length > 0 ? rooms : ["Belum Diatur"];
  }, [students]);

  const uniqueClasses = useMemo(() => Array.from(new Set(students.map((s) => s.class_name).filter(Boolean))).sort(), [students]);
  const uniqueGenerations = useMemo(() => ["Kelas 7 (Angkatan 1)", "Kelas 8 (Angkatan 2)", "Kelas 9 (Angkatan 3)", "Kelas 10 (Angkatan 4)", "Kelas 11 (Angkatan 5)", "Kelas 12 (Angkatan 6)"], []);
  const uniqueConsulates = useMemo(() => Array.from(new Set(students.map((s) => getStudentConsulate(s)).filter(Boolean))).sort(), [students]);

  // Santri yang cocok dengan filter input
  const targetInputStudents = useMemo(() => {
    if (!isInputLoaded) return [];
    return students.filter((s) => {
      if (inputScopeType === "kamar") return getStudentRoom(s) === inputScopeValue;
      if (inputScopeType === "kelas") return s.class_name === inputScopeValue;
      if (inputScopeType === "konsulat") return getStudentConsulate(s) === inputScopeValue;
      if (inputScopeType === "angkatan") {
        const c = s.class_name?.toUpperCase() || "";
        if (inputScopeValue.includes("7")) return c.includes("VII") || c.includes("7");
        if (inputScopeValue.includes("8")) return c.includes("VIII") || c.includes("8");
        if (inputScopeValue.includes("9")) return c.includes("IX") || c.includes("9");
        if (inputScopeValue.includes("10")) return c.includes("X") || c.includes("10");
        if (inputScopeValue.includes("11")) return c.includes("XI") || c.includes("11");
        if (inputScopeValue.includes("12")) return c.includes("XII") || c.includes("12");
      }
      return true;
    });
  }, [students, isInputLoaded, inputScopeType, inputScopeValue]);

  const filteredSheetStudents = useMemo(() => {
    if (!sheetSearch.trim()) return targetInputStudents;
    return targetInputStudents.filter(
      (s) => s.full_name.toLowerCase().includes(sheetSearch.toLowerCase()) || s.nis.includes(sheetSearch)
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && isInputLoaded && activeModule === "input") {
        e.preventDefault();
        handleSubmitAttendance();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isInputLoaded, activeModule, handleSubmitAttendance]);

  const calendarDaysMatrix = useMemo(() => {
    const totalDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay();

    const days = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push(dateStr);
    }
    return days;
  }, [calendarMonth, calendarYear]);

  const getRoomComplianceForDate = useCallback(
    (dateStr: string) => {
      const sessOnDate = sessions.filter(
        (s) => s.date === dateStr && s.scope_type === "kamar" && s.scope_value === calendarRoom
      );

      const standardSessions = new Set<string>();
      let specialCount = 0;

      sessOnDate.forEach((s) => {
        if (s.category === "sholat_wajib" && s.sub_category) {
          standardSessions.add(s.sub_category);
        } else if (s.category === "cek_malam") {
          standardSessions.add("cek_malam");
        } else if (s.category === "khusus") {
          specialCount++;
        }
      });

      const count = standardSessions.size;
      const isPast = new Date(dateStr) < new Date(getTodayDateStr());

      let badgeType: "complete" | "partial" | "empty" | "future" = "future";
      if (count === 6) badgeType = "complete";
      else if (count > 0 && count < 6) badgeType = "partial";
      else if (count === 0 && isPast) badgeType = "empty";

      return { count, specialCount, badgeType, allSessions: sessOnDate };
    },
    [sessions, calendarRoom]
  );

  const selectedDateCompliance = useMemo(() => {
    if (!selectedDrawerDate) return null;
    return getRoomComplianceForDate(selectedDrawerDate);
  }, [selectedDrawerDate, getRoomComplianceForDate]);

  const filteredSessionsRekap = useMemo(() => {
    if (!isReportRendered) return [];
    return sessions.filter((s) => {
      if (filterCategory !== "all" && s.category !== filterCategory) return false;
      if (filterScopeType !== "all" && s.scope_type !== filterScopeType) return false;
      if (filterScopeValue !== "all" && s.scope_value !== filterScopeValue) return false;

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
        if (filterScopeType === "kamar" && filterScopeValue !== "all") return getStudentRoom(s) === filterScopeValue;
        if (filterScopeType === "kelas" && filterScopeValue !== "all") return s.class_name === filterScopeValue;
        if (filterScopeType === "konsulat" && filterScopeValue !== "all") return getStudentConsulate(s) === filterScopeValue;
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

        const totalSesi = stRecords.length || 1;
        const disciplinePct = stRecords.length === 0 ? 100 : Math.round((h / totalSesi) * 100);

        return {
          student: st,
          hadir: h,
          sakit: s,
          izin: i,
          ghoib: g,
          totalSesi: stRecords.length,
          disciplinePct,
          records: stRecords,
        };
      });
  }, [students, records, filteredSessionIdsRekap, isReportRendered, filterScopeType, filterScopeValue]);

  const kpiMetrics = useMemo(() => {
    if (rekapDataRows.length === 0) return { avgPct: 100, perfectCount: 0, topGhoib: [] };
    const avg = Math.round(rekapDataRows.reduce((acc, r) => acc + r.disciplinePct, 0) / rekapDataRows.length);
    const perfect = rekapDataRows.filter((r) => r.ghoib === 0 && r.totalSesi > 0).length;
    const topGhoib = [...rekapDataRows].filter((r) => r.ghoib > 0).sort((a, b) => b.ghoib - a.ghoib).slice(0, 4);

    return { avgPct: avg, perfectCount: perfect, topGhoib };
  }, [rekapDataRows]);

  // =========================================================================
  // EKSPOR EXCEL INTERAKTIF & BERSIH MENGGUNAKAN EXCELJS (PALETTE EMERALD)
  // =========================================================================
  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SIPS Condong";
    workbook.created = new Date();

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: "thin", color: { argb: "CBD5E1" } },
      left: { style: "thin", color: { argb: "CBD5E1" } },
      bottom: { style: "thin", color: { argb: "CBD5E1" } },
      right: { style: "thin", color: { argb: "CBD5E1" } },
    };

    // -----------------------------------------------------------------------
    // SHEET 1: RINGKASAN AGREGAT EKSEKUTIF
    // -----------------------------------------------------------------------
    const ws1 = workbook.addWorksheet("Ringkasan_Agregat", {
      views: [{ state: "frozen", ySplit: 6, xSplit: 3 }],
    });

    // 1. KOP BANNER UTAMA
    ws1.mergeCells("A1:M1");
    const titleCell = ws1.getCell("A1");
    titleCell.value = "PONDOK PESANTREN RIYADLUL ULUM WADDA'WAH CONDONG";
    titleCell.font = { name: "Segoe UI", size: 13, bold: true, color: { argb: "FFFFFF" } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "064E3B" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    ws1.getRow(1).height = 26;

    ws1.mergeCells("A2:M2");
    const subTitleCell = ws1.getCell("A2");
    subTitleCell.value = "BAGIAN PENGASUHAN SANTRI & KEDISIPLINAN TERPADU (SIPS)";
    subTitleCell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "A7F3D0" } };
    subTitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "043D2E" } };
    subTitleCell.alignment = { horizontal: "center", vertical: "middle" };
    ws1.getRow(2).height = 20;

    ws1.mergeCells("A3:M3");
    const metaCell = ws1.getCell("A3");
    metaCell.value = `Periode: ${rekapPeriod === "today" ? formatDateIndo(getTodayDateStr()) : `${formatDateIndo(customStart)} s/d ${formatDateIndo(customEnd)}`} | Filter: ${filterCategory.toUpperCase()} | Rombel: ${filterScopeType.toUpperCase()} (${filterScopeValue}) | Tanggal Unduh: ${formatDateIndo(getTodayDateStr())}`;
    metaCell.font = { name: "Segoe UI", size: 8.5, italic: true, color: { argb: "475569" } };
    metaCell.alignment = { horizontal: "center", vertical: "middle" };
    metaCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F1F5F9" } };
    ws1.getRow(3).height = 18;

    ws1.getRow(4).height = 6; // Spasi pemisah

    // 2. HEADER TABEL
    const headers1 = [
      "No", "NIS", "Nama Lengkap Santri", "Kamar Santri", "Kelas", "Konsulat / Daerah",
      "Hadir (H)", "Sakit (S)", "Izin (I)", "Ghoib (G)", "Total Sesi", "% Disiplin", "Status Evaluasi"
    ];

    const headerRow = ws1.getRow(5);
    headerRow.values = headers1;
    headerRow.height = 26;
    headerRow.eachCell((cell) => {
      cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "047857" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = thinBorder;
    });

    // 3. BARIS DATA SANTRI
    let totalHadirAll = 0;
    let totalSakitAll = 0;
    let totalIzinAll = 0;
    let totalGhoibAll = 0;

    rekapDataRows.forEach((r, idx) => {
      totalHadirAll += r.hadir;
      totalSakitAll += r.sakit;
      totalIzinAll += r.izin;
      totalGhoibAll += r.ghoib;

      let evaluasi = "Disiplin Sangat Baik";
      if (r.ghoib >= 3) evaluasi = "PERLU PEMBINAAN KHUSUS";
      else if (r.ghoib >= 1) evaluasi = "Peringatan Disiplin";
      else if (r.sakit >= 3) evaluasi = "Perhatian Kesehatan";

      const rowIdx = idx + 6;
      const row = ws1.getRow(rowIdx);
      row.values = [
        idx + 1,
        r.student.nis,
        r.student.full_name,
        formatRoomLabel(getStudentRoom(r.student)),
        r.student.class_name,
        getStudentConsulate(r.student),
        r.hadir,
        r.sakit,
        r.izin,
        r.ghoib,
        r.totalSesi,
        `${r.disciplinePct}%`,
        evaluasi,
      ];
      row.height = 20;

      const isEven = idx % 2 === 1;
      const rowBg = isEven ? "F8FAFC" : "FFFFFF";

      row.eachCell((cell, colNum) => {
        cell.font = { name: "Segoe UI", size: 9 };
        cell.border = thinBorder;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };

        // Alignment
        if ([1, 2, 5].includes(colNum)) {
          cell.alignment = { horizontal: "center", vertical: "middle" };
        } else if ([7, 8, 9, 10, 11, 12].includes(colNum)) {
          cell.alignment = { horizontal: "center", vertical: "middle" };
        } else {
          cell.alignment = { horizontal: "left", vertical: "middle" };
        }

        // Highlight Status
        if (colNum === 7 && r.hadir > 0) {
          cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "047857" } };
        } else if (colNum === 8 && r.sakit > 0) {
          cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "B45309" } };
        } else if (colNum === 9 && r.izin > 0) {
          cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "0284C7" } };
        } else if (colNum === 10 && r.ghoib > 0) {
          cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "BE123C" } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE4E6" } };
        } else if (colNum === 12) {
          cell.font = { name: "Segoe UI", size: 9, bold: true };
          if (r.disciplinePct >= 85) cell.font.color = { argb: "047857" };
          else if (r.disciplinePct >= 70) cell.font.color = { argb: "B45309" };
          else cell.font.color = { argb: "BE123C" };
        }
      });
    });

    // 4. BARIS TOTAL AKUMULASI
    const totalRowIdx = rekapDataRows.length + 6;
    const totalRow = ws1.getRow(totalRowIdx);
    totalRow.values = [
      "TOTAL",
      "-",
      `${rekapDataRows.length} Santri Terdaftar`,
      "-",
      "-",
      "-",
      totalHadirAll,
      totalSakitAll,
      totalIzinAll,
      totalGhoibAll,
      totalHadirAll + totalSakitAll + totalIzinAll + totalGhoibAll,
      `${kpiMetrics.avgPct}% Rata-rata`,
      "-",
    ];
    totalRow.height = 24;
    totalRow.eachCell((cell, colNum) => {
      cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "064E3B" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "DCFCE7" } };
      cell.border = thinBorder;
      cell.alignment = { horizontal: [1, 2, 5, 7, 8, 9, 10, 11, 12].includes(colNum) ? "center" : "left", vertical: "middle" };
    });

    // Atur Lebar Kolom Sheet 1
    ws1.columns = [
      { width: 6 },  // No
      { width: 14 }, // NIS
      { width: 32 }, // Nama Lengkap
      { width: 22 }, // Kamar
      { width: 10 }, // Kelas
      { width: 20 }, // Konsulat
      { width: 11 }, // Hadir
      { width: 11 }, // Sakit
      { width: 11 }, // Izin
      { width: 11 }, // Ghoib
      { width: 13 }, // Total Sesi
      { width: 14 }, // % Disiplin
      { width: 28 }, // Evaluasi
    ];

    // -----------------------------------------------------------------------
    // SHEET 2: MATRIKS DETAIL PER SESI
    // -----------------------------------------------------------------------
    const ws2 = workbook.addWorksheet("Matriks_Presensi_Harian", {
      views: [{ state: "frozen", ySplit: 5, xSplit: 3 }],
    });

    ws2.mergeCells("A1:H1");
    ws2.getCell("A1").value = "MATRIKS REKAPITULASI SESI PRESENSI HARIAN SANTRI";
    ws2.getCell("A1").font = { name: "Segoe UI", size: 12, bold: true, color: { argb: "FFFFFF" } };
    ws2.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "064E3B" } };
    ws2.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
    ws2.getRow(1).height = 24;

    ws2.mergeCells("A2:H2");
    ws2.getCell("A2").value = `Keterangan: H = Hadir (Hijau), S = Sakit (Kuning), I = Izin (Biru), G = Ghoib/Alfa (Merah) | Dicetak: ${formatDateIndo(getTodayDateStr())}`;
    ws2.getCell("A2").font = { name: "Segoe UI", size: 8.5, italic: true, color: { argb: "475569" } };
    ws2.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };
    ws2.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F1F5F9" } };
    ws2.getRow(2).height = 18;

    ws2.getRow(3).height = 6;

    const dynamicSessionCols = filteredSessionsRekap.map(
      (s) => `${s.date.split("-").slice(1).join("/")}\n${s.sub_category ? s.sub_category.toUpperCase() : s.category === "cek_malam" ? "MALAM" : "KHUSUS"}`
    );

    const matrixHeaders = ["No", "NIS", "Nama Santri", "Kamar", "Kelas", ...dynamicSessionCols];
    const mHeaderRow = ws2.getRow(4);
    mHeaderRow.values = matrixHeaders;
    mHeaderRow.height = 30;
    mHeaderRow.eachCell((cell) => {
      cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "0F766E" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = thinBorder;
    });

    rekapDataRows.forEach((r, idx) => {
      const rowVals: any[] = [
        idx + 1,
        r.student.nis,
        r.student.full_name,
        formatRoomLabel(getStudentRoom(r.student)),
        r.student.class_name,
      ];

      filteredSessionsRekap.forEach((sess) => {
        const found = r.records.find((rec) => rec.session_id === sess.id);
        rowVals.push(found ? found.status.charAt(0).toUpperCase() : "-");
      });

      const mRow = ws2.getRow(idx + 5);
      mRow.values = rowVals;
      mRow.height = 19;

      const isEven = idx % 2 === 1;
      const rowBg = isEven ? "F8FAFC" : "FFFFFF";

      mRow.eachCell((cell, colNum) => {
        cell.font = { name: "Segoe UI", size: 9 };
        cell.border = thinBorder;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };

        if (colNum <= 2 || colNum === 5) {
          cell.alignment = { horizontal: "center", vertical: "middle" };
        } else if (colNum === 3 || colNum === 4) {
          cell.alignment = { horizontal: "left", vertical: "middle" };
        } else {
          // Kolom Sesi Status
          cell.alignment = { horizontal: "center", vertical: "middle" };
          const val = cell.value;
          if (val === "H") {
            cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "047857" } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "DCFCE7" } };
          } else if (val === "S") {
            cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "B45309" } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEF3C7" } };
          } else if (val === "I") {
            cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "0284C7" } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E0F2FE" } };
          } else if (val === "G") {
            cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "BE123C" } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE4E6" } };
          }
        }
      });
    });

    // Lebar Kolom Sheet 2
    ws2.columns = [
      { width: 6 },
      { width: 14 },
      { width: 30 },
      { width: 22 },
      { width: 10 },
      ...filteredSessionsRekap.map(() => ({ width: 12 })),
    ];

    // -----------------------------------------------------------------------
    // UNDUH FILE DI BROWSER
    // -----------------------------------------------------------------------
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `Rekap_Presensi_SIPS_${filterScopeValue !== "all" ? filterScopeValue.replace(/\s+/g, "_") : "Semua"}_${getTodayDateStr()}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-20 font-sans">
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 flex items-center space-x-2.5 bg-emerald-950 text-emerald-200 border border-emerald-500/30 px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-md"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span className="text-xs font-bold">{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }
          body {
            background: #fff !important;
            color: #000 !important;
            font-size: 8pt !important;
          }
          aside, header, nav, .no-print, button {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
          }
          th, td {
            border: 1px solid #333 !important;
            padding: 4px !important;
          }
          th {
            background: #f0f0f0 !important;
            font-weight: bold !important;
          }
        }
        @media screen {
          .print-only {
            display: none !important;
          }
        }
      `}</style>

      {/* DOKUMEN CETAK ARSIP */}
      <div className="print-only space-y-4">
        <div className="border-b-2 border-black pb-2 text-center">
          <h2 className="text-sm font-black tracking-wide uppercase">PONDOK PESANTREN RIYADLUL ULUM WADDA'WAH CONDONG</h2>
          <p className="text-[8pt] font-bold">BAGIAN PENGASUHAN SANTRI & KEDISIPLINAN TERPADU (SIPS)</p>
          <p className="text-[7pt] text-gray-600">Jl. Condong No. 01, Setianagara, Cibeureum, Kota Tasikmalaya, Jawa Barat</p>
          <div className="mt-2 inline-block border-y border-black py-0.5 px-4 text-xs font-black uppercase tracking-wider">
            LAPORAN REKAPITULASI PRESENSI KEHADIRAN SANTRI
          </div>
        </div>

        <div className="flex justify-between text-[7.5pt] bg-slate-50 p-2 border border-slate-300">
          <div>
            <p><b>Filter Kategori:</b> {filterCategory.toUpperCase()}</p>
            <p><b>Cakupan Rombel:</b> {filterScopeType.toUpperCase()} - {filterScopeValue}</p>
          </div>
          <div className="text-right">
            <p><b>Periode Rekap:</b> {rekapPeriod === "today" ? formatDateIndo(getTodayDateStr()) : `${formatDateIndo(customStart)} s/d ${formatDateIndo(customEnd)}`}</p>
            <p><b>Tanggal Terbit:</b> {formatDateIndo(getTodayDateStr())}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style={{ width: "25px" }}>No</th>
              <th style={{ width: "70px" }}>NIS</th>
              <th>Nama Lengkap Santri</th>
              <th style={{ width: "80px" }}>Kamar</th>
              <th style={{ width: "50px" }}>Kelas</th>
              <th style={{ width: "30px" }}>H</th>
              <th style={{ width: "30px" }}>S</th>
              <th style={{ width: "30px" }}>I</th>
              <th style={{ width: "30px" }}>G</th>
              <th style={{ width: "45px" }}>% Disiplin</th>
            </tr>
          </thead>
          <tbody>
            {rekapDataRows.map((r, idx) => (
              <tr key={r.student.id}>
                <td align="center">{idx + 1}</td>
                <td align="center">{r.student.nis}</td>
                <td><b>{r.student.full_name}</b></td>
                <td>{getStudentRoom(r.student)}</td>
                <td align="center">{r.student.class_name}</td>
                <td align="center">{r.hadir}</td>
                <td align="center">{r.sakit}</td>
                <td align="center">{r.izin}</td>
                <td align="center">{r.ghoib}</td>
                <td align="right"><b>{r.disciplinePct}%</b></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="grid grid-cols-2 gap-10 pt-8 text-[8pt]">
          <div className="text-center">
            <p>Mengetahui,</p>
            <p className="font-bold">Kepala Bagian Pengasuhan Santri</p>
            <div className="h-16" />
            <p className="font-bold underline">( Ust. H. Tim Pengasuhan )</p>
            <p className="text-[7pt] text-gray-500">NIP. 2026.SIPS.001</p>
          </div>
          <div className="text-center">
            <p>Tasikmalaya, {formatDateIndo(getTodayDateStr())}</p>
            <p className="font-bold">Staf Administrasi & Kedisiplinan</p>
            <div className="h-16" />
            <p className="font-bold underline">( ............................................ )</p>
            <p className="text-[7pt] text-gray-500">Petugas Terverifikasi</p>
          </div>
        </div>
      </div>

      {/* BANNER UTAMA SUPER COLORFUL & INTERAKTIF */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="no-print relative overflow-hidden rounded-[36px] bg-gradient-to-r from-emerald-950 via-[#064e3b] to-teal-950 p-6 sm:p-8 text-white shadow-2xl border border-emerald-500/40"
      >
        {/* Lingkaran Glow Berjalan & Animasi Dinamis */}
        <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-emerald-400/20 blur-[80px] pointer-events-none animate-pulse" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-amber-400/20 blur-[80px] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-black/30 pointer-events-none" />

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="space-y-2.5">
            <div className="inline-flex items-center space-x-2.5 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-emerald-200 text-xs font-extrabold backdrop-blur-xl shadow-lg">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
              </span>
              <span className="tracking-wide uppercase text-[10px]">Live • SIPS Executive Control</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight bg-gradient-to-r from-white via-emerald-100 to-amber-300 bg-clip-text text-transparent drop-shadow-md">
              Presensi &amp; Pengasuhan Santri
            </h1>

            <p className="text-xs sm:text-sm text-emerald-100/90 max-w-2xl font-semibold leading-relaxed">
              Pusat kendali operasional harian: input cepat di lapangan, audit kepatuhan kalender kamar secara visual, dan analitik kedisiplinan global.
            </p>
          </div>

          {/* Tab Switcher Interaktif */}
          <div className="flex p-1.5 rounded-2xl bg-black/50 border border-emerald-400/30 backdrop-blur-2xl shrink-0 shadow-2xl">
            {[
              { id: "input", label: "Input Cepat", icon: CalendarCheck2 },
              { id: "calendar", label: "Kalender Kamar", icon: CalendarIcon },
              { id: "analytics", label: "Rekap & Analitik", icon: BarChart3 },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeModule === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveModule(tab.id as any)}
                  className={`relative flex items-center space-x-2 px-4 py-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    isActive ? "text-emerald-950" : "text-emerald-100/70 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="absolute inset-0 bg-gradient-to-r from-emerald-300 via-teal-300 to-amber-300 rounded-xl shadow-lg shadow-emerald-400/40"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center space-x-2">
                    <Icon className={`w-4 h-4 stroke-[2.5] ${isActive ? "text-emerald-950" : "text-emerald-300"}`} />
                    <span>{tab.label}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* MODUL 1: INPUT PRESENSI CEPAT */}
      {activeModule === "input" && (
        <div className="no-print space-y-6">
          <div className="bg-white dark:bg-[#0c1815] p-6 rounded-[32px] border border-slate-200 dark:border-emerald-900/40 shadow-xs space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Kategori Presensi</label>
                <select
                  value={inputCategory}
                  onChange={(e) => {
                    const cat = e.target.value as any;
                    setInputCategory(cat);
                    setIsInputLoaded(false);

                    if (cat === "cek_malam") {
                      setInputTime("21:30");
                    } else if (cat === "sholat_wajib") {
                      setInputTime(PRAYER_SCHEDULE[inputSubCategory] || "04:30");
                    } else {
                      const now = new Date();
                      setInputTime(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
                    }
                  }}
                  className="w-full h-11 px-3 rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 text-xs font-bold outline-none cursor-pointer"
                >
                  <option value="sholat_wajib">Sholat Wajib (5 Waktu)</option>
                  <option value="cek_malam">Cek Kehadiran Malam</option>
                  <option value="khusus">Presensi Dadakan / Khusus</option>
                </select>
              </div>

              {inputCategory === "khusus" ? (
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Judul / Agenda Khusus</label>
                  <input
                    type="text"
                    value={inputTitle}
                    onChange={(e) => setInputTitle(e.target.value)}
                    placeholder="Contoh: Sidak Kamar Mendadak"
                    className="w-full h-11 px-3.5 rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 text-xs font-bold outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Waktu Sesi</label>
                  <input
                    type="time"
                    value={inputTime}
                    onChange={(e) => setInputTime(e.target.value)}
                    className="w-full h-11 px-3 rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 text-xs font-bold outline-none"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Tanggal Presensi</label>
                <input
                  type="date"
                  value={inputDate}
                  onChange={(e) => setInputDate(e.target.value)}
                  className="w-full h-11 px-3 rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 text-xs font-bold outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Basis Cakupan Rombel</label>
                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-emerald-950/40 rounded-2xl">
                  {(["kamar", "kelas", "angkatan", "konsulat"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => {
                        setInputScopeType(mode);
                        setIsInputLoaded(false);
                        if (mode === "kamar") setInputScopeValue(uniqueRooms[0] || "");
                        if (mode === "kelas") setInputScopeValue(uniqueClasses[0] || "");
                        if (mode === "angkatan") setInputScopeValue(uniqueGenerations[0] || "");
                        if (mode === "konsulat") setInputScopeValue(uniqueConsulates[0] || "");
                      }}
                      className={`py-2 rounded-xl text-[10px] font-black capitalize transition cursor-pointer ${
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
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-emerald-900/30">
                <span className="text-xs font-bold text-slate-400">Pilihan Sholat:</span>
                {(["shubuh", "dzuhur", "ashar", "maghrib", "isya"] as const).map((w) => (
                  <button
                    key={w}
                    onClick={() => {
                      setInputSubCategory(w);
                      setInputTime(PRAYER_SCHEDULE[w]);
                      setIsInputLoaded(false);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black capitalize transition cursor-pointer ${
                      inputSubCategory === w ? "bg-emerald-600 text-white shadow-xs" : "bg-slate-100 dark:bg-emerald-950/40 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-emerald-900/30">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-500">Pilih Unit:</span>
                <select
                  value={inputScopeValue}
                  onChange={(e) => {
                    setInputScopeValue(e.target.value);
                    setIsInputLoaded(false);
                  }}
                  className="h-10 px-3.5 rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 text-xs font-bold outline-none cursor-pointer min-w-48"
                >
                  {inputScopeType === "kamar" &&
                    uniqueRooms.map((r) => (
                      <option key={r} value={r}>
                        {formatRoomLabel(r)}
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
                onClick={handleLoadSheet}
                className="flex items-center justify-center space-x-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black transition shadow-md shadow-emerald-600/30 cursor-pointer"
              >
                <Users className="w-4 h-4" />
                <span>Muat Daftar Santri</span>
              </button>
            </div>
          </div>

          {isInputLoaded ? (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div className="sticky top-4 z-40 bg-white/90 dark:bg-[#0c1815]/90 backdrop-blur-xl p-4 rounded-3xl border border-slate-200 dark:border-emerald-900/50 shadow-lg flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSetAllStatus("hadir")}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl cursor-pointer shadow-xs transition active:scale-95"
                  >
                    ✓ Set Semua Hadir
                  </button>
                  <button
                    onClick={() => handleSetAllStatus("ghoib")}
                    className="px-3.5 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-400 text-xs font-black rounded-xl cursor-pointer border border-rose-500/30 transition active:scale-95"
                  >
                    ✗ Set Semua Ghoib
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-black border border-emerald-500/20">
                    Hadir: {liveCount.hadir}
                  </span>
                  <span className="px-3 py-1 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-black border border-amber-500/20">
                    Sakit: {liveCount.sakit}
                  </span>
                  <span className="px-3 py-1 rounded-xl bg-sky-500/10 text-sky-700 dark:text-sky-300 text-xs font-black border border-sky-500/20">
                    Izin: {liveCount.izin}
                  </span>
                  <span className="px-3 py-1 rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs font-black border border-rose-500/20">
                    Ghoib: {liveCount.ghoib}
                  </span>
                </div>

                <button
                  disabled={isSaving}
                  onClick={handleSubmitAttendance}
                  className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black rounded-xl shadow-md cursor-pointer disabled:opacity-50 transition active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? "Menyimpan..." : "Simpan (Ctrl+Enter)"}</span>
                </button>
              </div>

              <div className="bg-white dark:bg-[#0c1815] rounded-[32px] border border-slate-200 dark:border-emerald-900/40 p-5 shadow-xs space-y-4">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={sheetSearch}
                    onChange={(e) => setSheetSearch(e.target.value)}
                    placeholder="Cari santri di lembar ini..."
                    className="w-full h-9.5 pl-9 pr-3 rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 text-xs font-semibold outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-emerald-900/40 text-slate-400 uppercase text-[10px]">
                        <th className="py-3 px-3 w-10">No</th>
                        <th className="py-3 px-3 w-20">NIS</th>
                        <th className="py-3 px-3">Nama Santri</th>
                        <th className="py-3 px-3 w-28">Kamar</th>
                        <th className="py-3 px-3 w-20">Kelas</th>
                        <th className="py-3 px-3 text-center w-64">Status Presensi</th>
                        <th className="py-3 px-3 w-56">Catatan Singkat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-emerald-900/30">
                      {filteredSheetStudents.map((st, index) => {
                        const currentVal = attendanceSheet[st.id] || { status: "hadir", notes: "" };
                        const bgHighlight =
                          currentVal.status === "hadir"
                            ? "bg-emerald-500/[0.02]"
                            : currentVal.status === "sakit"
                            ? "bg-amber-500/[0.04]"
                            : currentVal.status === "izin"
                            ? "bg-sky-500/[0.04]"
                            : "bg-rose-500/[0.06]";

                        return (
                          <tr key={st.id} className={`transition-colors duration-200 ${bgHighlight}`}>
                            <td className="py-3 px-3 text-slate-400 font-mono">{index + 1}</td>
                            <td className="py-3 px-3 font-mono font-bold text-slate-600">{st.nis}</td>
                            <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">{st.full_name}</td>
                            <td className="py-3 px-3 text-slate-500">{formatRoomLabel(getStudentRoom(st))}</td>
                            <td className="py-3 px-3 text-slate-500">{st.class_name}</td>
                            <td className="py-3 px-3">
                              <div className="grid grid-cols-4 gap-1 bg-slate-100 dark:bg-emerald-950/40 p-1 rounded-2xl">
                                {(["hadir", "sakit", "izin", "ghoib"] as const).map((stKey) => {
                                  const isActive = currentVal.status === stKey;
                                  const colorActive =
                                    stKey === "hadir"
                                      ? "bg-emerald-600 text-white"
                                      : stKey === "sakit"
                                      ? "bg-amber-500 text-white"
                                      : stKey === "izin"
                                      ? "bg-sky-500 text-white"
                                      : "bg-rose-600 text-white";

                                  return (
                                    <button
                                      key={stKey}
                                      onClick={() =>
                                        setAttendanceSheet((prev) => ({
                                          ...prev,
                                          [st.id]: { ...prev[st.id], status: stKey },
                                        }))
                                      }
                                      className={`py-1.5 rounded-xl text-xs font-black uppercase transition-all duration-150 active:scale-95 cursor-pointer ${
                                        isActive ? `${colorActive} shadow-xs` : "text-slate-500 hover:text-black"
                                      }`}
                                    >
                                      {stKey.charAt(0)}
                                    </button>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <input
                                type="text"
                                value={currentVal.notes || ""}
                                onChange={(e) =>
                                  setAttendanceSheet((prev) => ({
                                    ...prev,
                                    [st.id]: {
                                      status: prev[st.id]?.status || "hadir",
                                      notes: e.target.value,
                                    },
                                  }))
                                }
                                placeholder="Opsional (klinik/izin pulang)..."
                                className="w-full h-8 px-2.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 text-xs font-semibold outline-none"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="bg-white dark:bg-[#0c1815] p-16 rounded-[32px] border border-dashed border-slate-200 dark:border-emerald-900/40 text-center space-y-3">
              <div className="w-14 h-14 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <Info className="w-6 h-6 stroke-[2.2]" />
              </div>
              <h3 className="text-sm font-black text-slate-800 dark:text-white">Daftar Santri Belum Dimuat</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Silakan pilih kategori, waktu, dan rombel santri pada panel di atas, lalu tekan tombol <b>"Muat Daftar Santri"</b>.
              </p>
            </div>
          )}
        </div>
      )}

      {/* MODUL 2: MONITORING KALENDER KAMAR */}
      {activeModule === "calendar" && (
        <div className="no-print space-y-6">
          <div className="bg-white dark:bg-[#0c1815] p-6 rounded-[32px] border border-slate-200 dark:border-emerald-900/40 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500">Pilih Kamar:</span>
              <select
                value={calendarRoom}
                onChange={(e) => setCalendarRoom(e.target.value)}
                className="h-10 px-3.5 rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 text-xs font-bold outline-none cursor-pointer"
              >
                {uniqueRooms.map((r) => (
                  <option key={r} value={r}>
                    {formatRoomLabel(r)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (calendarMonth === 0) {
                    setCalendarMonth(11);
                    setCalendarYear((y) => y - 1);
                  } else {
                    setCalendarMonth((m) => m - 1);
                  }
                }}
                className="p-2 rounded-xl bg-slate-100 dark:bg-emerald-950/40 hover:bg-slate-200 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-black min-w-32 text-center">
                {new Date(calendarYear, calendarMonth).toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
              </span>
              <button
                onClick={() => {
                  if (calendarMonth === 11) {
                    setCalendarMonth(0);
                    setCalendarYear((y) => y + 1);
                  } else {
                    setCalendarMonth((m) => m + 1);
                  }
                }}
                className="p-2 rounded-xl bg-slate-100 dark:bg-emerald-950/40 hover:bg-slate-200 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0c1815] p-6 rounded-[32px] border border-slate-200 dark:border-emerald-900/40 shadow-xs">
            <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-bold text-slate-400 mb-3 uppercase">
              {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {calendarDaysMatrix.map((dateStr, idx) => {
                if (!dateStr) return <div key={idx} className="min-h-[88px] sm:h-24 bg-slate-50/50 dark:bg-emerald-950/10 rounded-2xl" />;

                const compliance = getRoomComplianceForDate(dateStr);
                const dayNum = parseInt(dateStr.split("-")[2], 10);
                const isToday = dateStr === getTodayDateStr();

                let badgeStyle = "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700";
                if (compliance.badgeType === "complete") badgeStyle = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
                if (compliance.badgeType === "partial") badgeStyle = "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
                if (compliance.badgeType === "empty") badgeStyle = "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30";

                return (
                  <div
                    key={dateStr}
                    onClick={() => setSelectedDrawerDate(dateStr)}
                    className={`min-h-[88px] sm:h-24 p-1.5 sm:p-2.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between hover:border-emerald-500 shadow-2xs ${
                      isToday ? "border-emerald-600 bg-emerald-50/30 dark:bg-emerald-950/20 ring-1 ring-emerald-500/50" : "border-slate-200/80 dark:border-emerald-900/40 bg-white dark:bg-[#071310]"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className={`text-xs sm:text-sm font-black ${isToday ? "text-emerald-600 dark:text-emerald-400" : "text-slate-800 dark:text-slate-200"}`}>
                        {dayNum}
                      </span>
                      {compliance.specialCount > 0 && (
                        <span className="h-2 w-2 rounded-full bg-purple-500 ring-2 ring-purple-300 dark:ring-purple-900" title="Ada Presensi Khusus" />
                      )}
                    </div>

                    <div className={`px-1 sm:px-2 py-1 rounded-xl text-[9px] sm:text-[10px] font-black border text-center truncate ${badgeStyle}`}>
                      {compliance.badgeType === "complete" && "6/6 Lengkap"}
                      {compliance.badgeType === "partial" && `${compliance.count}/6 Sesi`}
                      {compliance.badgeType === "empty" && "Kosong"}
                      {compliance.badgeType === "future" && "·"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <AnimatePresence>
            {selectedDrawerDate && (
              <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
                <motion.div
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{ type: "spring", damping: 25, stiffness: 200 }}
                  className="w-full max-w-md bg-white dark:bg-[#0c1815] h-full shadow-2xl p-6 flex flex-col justify-between overflow-y-auto"
                >
                  <div className="space-y-6">
                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-emerald-900/40 pb-4">
                      <div>
                        <h3 className="text-sm font-black text-slate-900 dark:text-white">Detail Kepatuhan Sesi</h3>
                        <p className="text-xs text-slate-400">{formatDateIndo(selectedDrawerDate)} • {formatRoomLabel(calendarRoom)}</p>
                      </div>
                      <button onClick={() => setSelectedDrawerDate(null)} className="p-1 rounded-xl hover:bg-slate-100 cursor-pointer">
                        <X className="w-5 h-5 text-slate-400" />
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Baseline 6 Sesi Wajib</h4>
                      {[
                        { key: "shubuh", label: "Sholat Shubuh" },
                        { key: "dzuhur", label: "Sholat Dzuhur" },
                        { key: "ashar", label: "Sholat Ashar" },
                        { key: "maghrib", label: "Sholat Maghrib" },
                        { key: "isya", label: "Sholat Isya" },
                        { key: "cek_malam", label: "Pengecekan Malam" },
                      ].map((item) => {
                        const isRecorded = selectedDateCompliance?.allSessions.find((s) =>
                          item.key === "cek_malam" ? s.category === "cek_malam" : s.sub_category === item.key
                        );

                        return (
                          <div
                            key={item.key}
                            className="p-3 rounded-2xl border border-slate-100 dark:border-emerald-900/30 flex items-center justify-between bg-slate-50/50 dark:bg-emerald-950/20"
                          >
                            <div className="space-y-0.5">
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.label}</p>
                              {isRecorded ? (
                                <p className="text-[10px] text-emerald-600 font-mono">Terekam pukul {isRecorded.time}</p>
                              ) : (
                                <p className="text-[10px] text-rose-500">Belum ada data</p>
                              )}
                            </div>

                            {isRecorded ? (
                              <span className="p-1.5 bg-emerald-500/10 text-emerald-600 rounded-xl border border-emerald-500/20">
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </span>
                            ) : (
                              <button
                                onClick={() => {
                                  setSelectedDrawerDate(null);
                                  setActiveModule("input");
                                  setInputDate(selectedDrawerDate);
                                  setInputScopeType("kamar");
                                  setInputScopeValue(calendarRoom);
                                  if (item.key === "cek_malam") {
                                    setInputCategory("cek_malam");
                                    setInputTime("21:30");
                                  } else {
                                    setInputCategory("sholat_wajib");
                                    setInputSubCategory(item.key as any);
                                    setInputTime(PRAYER_SCHEDULE[item.key] || "04:30");
                                  }
                                }}
                                className="px-2.5 py-1 bg-emerald-600 text-white rounded-xl text-[10px] font-black cursor-pointer shadow-xs"
                              >
                                Input Sekarang
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedDrawerDate(null)}
                    className="w-full py-3 bg-slate-900 text-white rounded-2xl text-xs font-black cursor-pointer"
                  >
                    Tutup Panel
                  </button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* MODUL 3: REKAPITULASI & ANALITIK GLOBAL */}
      {activeModule === "analytics" && (
        <div className="no-print space-y-6">
          <div className="bg-white dark:bg-[#0c1815] p-6 rounded-[32px] border border-slate-200 dark:border-emerald-900/40 shadow-xs space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Periode Waktu</label>
                <select
                  value={rekapPeriod}
                  onChange={(e) => {
                    setRekapPeriod(e.target.value as any);
                    setIsReportRendered(false);
                  }}
                  className="w-full h-10 px-3 rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 text-xs font-bold outline-none cursor-pointer"
                >
                  <option value="today">Hari Ini</option>
                  <option value="week">7 Hari Terakhir</option>
                  <option value="month">30 Hari Terakhir</option>
                  <option value="custom">Rentang Kustom</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Kategori Presensi</label>
                <select
                  value={filterCategory}
                  onChange={(e) => {
                    setFilterCategory(e.target.value);
                    setIsReportRendered(false);
                  }}
                  className="w-full h-10 px-3 rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 text-xs font-bold outline-none cursor-pointer"
                >
                  <option value="all">Semua Kategori</option>
                  <option value="sholat_wajib">Sholat Wajib</option>
                  <option value="cek_malam">Cek Malam</option>
                  <option value="khusus">Presensi Khusus</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Filter Basis Rombel</label>
                <select
                  value={filterScopeType}
                  onChange={(e) => {
                    setFilterScopeType(e.target.value);
                    setFilterScopeValue("all");
                    setIsReportRendered(false);
                  }}
                  className="w-full h-10 px-3 rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 text-xs font-bold outline-none cursor-pointer"
                >
                  <option value="all">Semua Rombel</option>
                  <option value="kamar">Per Kamar</option>
                  <option value="kelas">Per Kelas</option>
                  <option value="konsulat">Per Konsulat</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Pilihan Unit</label>
                <select
                  value={filterScopeValue}
                  onChange={(e) => {
                    setFilterScopeValue(e.target.value);
                    setIsReportRendered(false);
                  }}
                  className="w-full h-10 px-3 rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 text-xs font-bold outline-none cursor-pointer"
                >
                  <option value="all">Semua Unit</option>
                  {filterScopeType === "kamar" &&
                    uniqueRooms.map((r) => (
                      <option key={r} value={r}>
                        {formatRoomLabel(r)}
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
              <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-emerald-950/30 rounded-2xl border border-slate-200 dark:border-emerald-900/40 w-fit">
                <span className="text-[11px] font-bold text-slate-400">Rentang:</span>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => {
                    setCustomStart(e.target.value);
                    setIsReportRendered(false);
                  }}
                  className="h-8 px-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
                />
                <span className="text-xs text-slate-400">s/d</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => {
                    setCustomEnd(e.target.value);
                    setIsReportRendered(false);
                  }}
                  className="h-8 px-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-emerald-900/30">
              <button
                onClick={() => setIsReportRendered(true)}
                className="flex items-center space-x-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black transition cursor-pointer shadow-md shadow-emerald-600/20"
              >
                <RefreshCw className={`w-4 h-4 ${isReportRendered ? "" : "animate-spin"}`} />
                <span>{isReportRendered ? "Perbarui Rekapitulasi" : "Render Data Rekapitulasi"}</span>
              </button>

              {isReportRendered && (
                <>
                  <button
                    onClick={handleExportExcel}
                    className="flex items-center space-x-1.5 px-4 py-2.5 border border-emerald-600/30 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-2xl cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Ekspor Excel (.xlsx)</span>
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="flex items-center space-x-1.5 px-4 py-2.5 bg-slate-900 text-white text-xs font-black rounded-2xl cursor-pointer shadow-md"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Cetak PDF Resmi</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {isReportRendered ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-[#0c1815] p-5 rounded-3xl border border-slate-200 dark:border-emerald-900/40 shadow-xs space-y-2">
                  <span className="text-[10px] font-black uppercase text-slate-400">Rata-Rata Persentase Kehadiran</span>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-black text-emerald-600">{kpiMetrics.avgPct}%</span>
                    <span className="text-xs text-slate-400">seluruh santri</span>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#0c1815] p-5 rounded-3xl border border-slate-200 dark:border-emerald-900/40 shadow-xs space-y-2">
                  <span className="text-[10px] font-black uppercase text-slate-400">100% Disiplin (Nihil Pelanggaran)</span>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-black text-teal-600">{kpiMetrics.perfectCount}</span>
                    <span className="text-xs text-slate-400">santri taat</span>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#0c1815] p-5 rounded-3xl border border-slate-200 dark:border-emerald-900/40 shadow-xs space-y-1">
                  <span className="text-[10px] font-black uppercase text-rose-500">Frekuensi Ghoib Tertinggi</span>
                  <div className="space-y-1 pt-1">
                    {kpiMetrics.topGhoib.length === 0 ? (
                      <p className="text-xs text-slate-400">Tidak ada santri ghoib pada periode ini.</p>
                    ) : (
                      kpiMetrics.topGhoib.map((g) => (
                        <div key={g.student.id} className="flex justify-between text-xs font-bold">
                          <span className="truncate max-w-40">{g.student.full_name}</span>
                          <span className="text-rose-600 font-mono">{g.ghoib}x Ghoib</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-[#0c1815] p-6 rounded-[32px] border border-slate-200 dark:border-emerald-900/40 shadow-xs space-y-4">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={rekapSearch}
                    onChange={(e) => setRekapSearch(e.target.value)}
                    placeholder="Cari santri pada rekap..."
                    className="w-full h-9.5 pl-9 pr-3 rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 text-xs font-semibold outline-none"
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-emerald-900/40 text-slate-400 uppercase text-[10px]">
                        <th className="py-3 px-3 w-10">No</th>
                        <th className="py-3 px-3 w-20">NIS</th>
                        <th className="py-3 px-3">Nama Santri</th>
                        <th className="py-3 px-3">Kamar</th>
                        <th className="py-3 px-3">Kelas</th>
                        <th className="py-3 px-3 text-center">H</th>
                        <th className="py-3 px-3 text-center">S</th>
                        <th className="py-3 px-3 text-center">I</th>
                        <th className="py-3 px-3 text-center">G</th>
                        <th className="py-3 px-3 text-right">Persentase</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-emerald-900/30">
                      {rekapDataRows
                        .filter((r) => r.student.full_name.toLowerCase().includes(rekapSearch.toLowerCase()) || r.student.nis.includes(rekapSearch))
                        .map((row, idx) => {
                          const isExpanded = expandedStudentId === row.student.id;
                          const badgeColor =
                            row.disciplinePct >= 85
                              ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                              : row.disciplinePct >= 70
                              ? "bg-amber-500/10 text-amber-700 border-amber-500/20"
                              : "bg-rose-500/10 text-rose-700 border-rose-500/20";

                          return (
                            <React.Fragment key={row.student.id}>
                              <tr
                                onClick={() => setExpandedStudentId(isExpanded ? null : row.student.id)}
                                className="hover:bg-slate-50/80 dark:hover:bg-emerald-950/20 cursor-pointer transition"
                              >
                                <td className="py-3 px-3 text-slate-400 font-mono">{idx + 1}</td>
                                <td className="py-3 px-3 font-mono font-bold text-slate-600">{row.student.nis}</td>
                                <td className="py-3 px-3 font-bold text-slate-900 dark:text-white flex items-center justify-between">
                                  <span>{row.student.full_name}</span>
                                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                </td>
                                <td className="py-3 px-3 text-slate-500">{formatRoomLabel(getStudentRoom(row.student))}</td>
                                <td className="py-3 px-3 text-slate-500">{row.student.class_name}</td>
                                <td className="py-3 px-3 text-center font-bold text-emerald-600">{row.hadir}</td>
                                <td className="py-3 px-3 text-center font-bold text-amber-600">{row.sakit}</td>
                                <td className="py-3 px-3 text-center font-bold text-sky-600">{row.izin}</td>
                                <td className="py-3 px-3 text-center font-bold text-rose-600">{row.ghoib}</td>
                                <td className="py-3 px-3 text-right">
                                  <span className={`px-2.5 py-1 rounded-xl text-[11px] font-black border ${badgeColor}`}>
                                    {row.disciplinePct}%
                                  </span>
                                </td>
                              </tr>

                              {isExpanded && (
                                <tr>
                                  <td colSpan={10} className="p-4 bg-slate-50/70 dark:bg-emerald-950/20">
                                    <div className="space-y-2">
                                      <p className="text-[11px] font-bold text-slate-500">Histori Absen Santri (Sakit / Izin / Ghoib):</p>
                                      {row.records.filter((rec) => rec.status !== "hadir").length === 0 ? (
                                        <p className="text-xs text-emerald-600 font-bold">✓ Santri hadir lengkap di seluruh sesi terekam.</p>
                                      ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                          {row.records
                                            .filter((rec) => rec.status !== "hadir")
                                            .map((rec) => {
                                              const sessObj = sessions.find((s) => s.id === rec.session_id);
                                              return (
                                                <div key={rec.id} className="p-2.5 rounded-xl border border-slate-200 bg-white text-xs space-y-0.5">
                                                  <div className="flex justify-between font-bold">
                                                    <span>{sessObj?.title || "Sesi"}</span>
                                                    <span className="uppercase text-rose-600 font-black">{rec.status}</span>
                                                  </div>
                                                  <p className="text-[10px] text-slate-400">{sessObj?.date}</p>
                                                  {rec.notes && <p className="text-[10px] text-slate-600 italic">"{rec.notes}"</p>}
                                                </div>
                                              );
                                            })}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#0c1815] p-16 rounded-[32px] border border-dashed border-slate-200 dark:border-emerald-900/40 text-center space-y-3">
              <div className="w-14 h-14 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <Filter className="w-6 h-6 stroke-[2.2]" />
              </div>
              <h3 className="text-sm font-black text-slate-800 dark:text-white">Tentukan Parameter Analitik</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Silakan pilih periode dan rombel pada bar di atas, kemudian klik tombol <b>"Render Data Rekapitulasi"</b>.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}