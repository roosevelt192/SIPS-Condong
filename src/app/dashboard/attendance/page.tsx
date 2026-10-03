"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ExcelJS from "exceljs";
import { Html5Qrcode } from "html5-qrcode";
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
  QrCode,
  Fingerprint,
  Clock,
  Eye,
  Edit2,
  Camera,
  CameraOff,
  Unlock,
  Lock,
  Sliders,
  Play,
  Square,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { playScanSound } from "@/lib/feedback";

interface Student {
  id: string;
  nis: string;
  full_name: string;
  class_name: string;
  dorm: string;
  consulate: string;
  entry_year: string;
  photo_url?: string | null;
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

const PRAYER_LIST = ["shubuh", "dzuhur", "ashar", "maghrib", "isya"] as const;

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
  const [activeModule, setActiveModule] = useState<"input" | "kelas6_portal" | "calendar" | "analytics">("input");

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

  // Modul Khusus: Portal Mandiri Kelas 6
  const [portalMode, setPortalMode] = useState<"shubuh" | "dzuhur" | "ashar" | "maghrib" | "isya" | "cek_malam">("shubuh");
  const [scanInputMode, setScanInputMode] = useState<"sensor" | "camera">("camera");
  const [isScannerRunning, setIsScannerRunning] = useState(false);
  const [bypassTimeLock, setBypassTimeLock] = useState(false);
  const [showTimeSettings, setShowTimeSettings] = useState(false);

  const [customTimeWindows, setCustomTimeWindows] = useState<Record<string, { start: string; end: string; label: string }>>({
    shubuh: { start: "04:00", end: "05:00", label: "Sholat Shubuh" },
    dzuhur: { start: "11:45", end: "12:45", label: "Sholat Dzuhur" },
    ashar: { start: "15:00", end: "16:00", label: "Sholat Ashar" },
    maghrib: { start: "17:45", end: "18:45", label: "Sholat Maghrib" },
    isya: { start: "19:00", end: "20:00", label: "Sholat Isya" },
    cek_malam: { start: "21:30", end: "22:00", label: "Presensi Kamar Malam" },
  });

  const [scanInput, setScanInput] = useState("");
  const [portalLog, setPortalLog] = useState<{ id: string; name: string; nis: string; time: string; status: "success" | "rejected"; msg: string; photo?: string | null }[]>([]);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const lastScannedCodeRef = useRef<{ code: string; time: number }>({ code: "", time: 0 });
  const scannedTodaySetRef = useRef<Set<string>>(new Set());

  // Modul 2: Monitoring Kalender
  const [calendarFilterLoaded, setCalendarFilterLoaded] = useState(false);
  const [calCategory, setCalCategory] = useState<string>("all");
  const [calScopeType, setCalScopeType] = useState<"all" | "kamar" | "kelas" | "angkatan" | "konsulat">("all");
  const [calScopeValue, setCalScopeValue] = useState<string>("all");
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [selectedDrawerDate, setSelectedDrawerDate] = useState<string | null>(null);
  const [selectedSessionForEdit, setSelectedSessionForEdit] = useState<AttendanceSession | null>(null);
  const [editingRecordsMap, setEditingRecordsMap] = useState<Record<string, "hadir" | "sakit" | "izin" | "ghoib">>({});
  const [isUpdatingSession, setIsUpdatingSession] = useState(false);

  // Modul 3: Rekap & Analitik
  const [rekapPeriod, setRekapPeriod] = useState<"today" | "week" | "month" | "custom">("week");
  const [customStart, setCustomStart] = useState(getTodayDateStr());
  const [customEnd, setCustomEnd] = useState(getTodayDateStr());
  const [filterCategory, setFilterCategory] = useState<string>("sholat_wajib");
  const [filterScopeType, setFilterScopeType] = useState<"all" | "kamar" | "kelas" | "angkatan" | "konsulat">("all");
  const [filterScopeValue, setFilterScopeValue] = useState<string>("all");
  const [isReportRendered, setIsReportRendered] = useState(false);
  const [rekapSearch, setRekapSearch] = useState("");

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
        photo_url: item.photo_url || item.avatar_url || null,
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

  useEffect(() => {
    scannedTodaySetRef.current.clear();
    setPortalLog([]);
  }, [portalMode]);

  useEffect(() => {
    if (activeModule === "kelas6_portal" && scanInputMode === "sensor" && isScannerRunning) {
      scanInputRef.current?.focus();
    }
  }, [activeModule, scanInputMode, portalMode, isScannerRunning]);

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

  const grade6Students = useMemo(() => {
    return students.filter((s) => {
      const c = s.class_name.toLowerCase();
      return (
        c.startsWith("6") ||
        c.startsWith("vi") ||
        c.startsWith("12") ||
        c.startsWith("xii") ||
        c.includes("kelas 6") ||
        c.includes("kmi 6")
      );
    });
  }, [students]);

  const checkTimeWindowValid = useCallback((mode: string) => {
    if (bypassTimeLock) return true;
    const now = new Date();
    const curTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const windowSetting = customTimeWindows[mode];
    if (!windowSetting) return true;
    return curTime >= windowSetting.start && curTime <= windowSetting.end;
  }, [bypassTimeLock, customTimeWindows]);

  const handleProcessScanKelas6 = useCallback(async (rawCode: string) => {
    if (!rawCode || !rawCode.trim()) return;

    let clean = rawCode.trim();
    if (clean.startsWith("{") && clean.endsWith("}")) {
      try {
        const parsed = JSON.parse(clean);
        clean = String(parsed.nis || parsed.id || clean).trim();
      } catch {}
    }
    clean = clean.replace(/^(SIPS-|NIS:?|\s+)/i, "").trim();

    const nowTs = Date.now();
    if (lastScannedCodeRef.current.code === clean && nowTs - lastScannedCodeRef.current.time < 2500) {
      return;
    }
    lastScannedCodeRef.current = { code: clean, time: nowTs };

    setScanInput("");

    const matched = grade6Students.find(
      (s) =>
        s.nis.toLowerCase() === clean.toLowerCase() ||
        s.id.toLowerCase() === clean.toLowerCase() ||
        clean.toLowerCase().includes(s.nis.toLowerCase()) ||
        s.full_name.toLowerCase() === clean.toLowerCase()
    );

    const nowTimeStr = new Date().toLocaleTimeString("id-ID");

    if (!matched) {
      playScanSound("error");
      setPortalLog((prev) => [
        { id: Math.random().toString(), name: "Tidak Dikenal", nis: clean, time: nowTimeStr, status: "rejected", msg: "Bukan santri kelas 6 atau kartu tidak ditemukan." },
        ...prev,
      ]);
      return;
    }

    if (scannedTodaySetRef.current.has(matched.id)) {
      playScanSound("error");
      setPortalLog((prev) => [
        {
          id: Math.random().toString(),
          name: matched.full_name,
          nis: matched.nis,
          time: nowTimeStr,
          status: "rejected",
          msg: "Santri ini sudah berhasil diabsen pada sesi ini.",
          photo: matched.photo_url,
        },
        ...prev,
      ]);
      return;
    }

    const isValidWindow = checkTimeWindowValid(portalMode);
    if (!isValidWindow) {
      playScanSound("error");
      const win = customTimeWindows[portalMode];
      setPortalLog((prev) => [
        {
          id: Math.random().toString(),
          name: matched.full_name,
          nis: matched.nis,
          time: nowTimeStr,
          status: "rejected",
          msg: `Portal Terkunci! Jadwal: ${win.start} - ${win.end} WIB.`,
          photo: matched.photo_url,
        },
        ...prev,
      ]);
      return;
    }

    try {
      const today = getTodayDateStr();
      const currentWin = customTimeWindows[portalMode];
      const sessionTitle = portalMode === "cek_malam" ? "Presensi Kamar Malam Kelas 6" : `Sholat ${currentWin.label} Kelas 6`;

      let targetSession = sessions.find(
        (s) => s.date === today && s.category === (portalMode === "cek_malam" ? "cek_malam" : "sholat_wajib") && s.scope_value === "Kelas 6"
      );

      if (!targetSession) {
        const { data: newSess, error: errSess } = await supabase
          .from("attendance_sessions")
          .insert({
            category: portalMode === "cek_malam" ? "cek_malam" : "sholat_wajib",
            sub_category: portalMode === "cek_malam" ? null : portalMode,
            title: sessionTitle,
            date: today,
            time: new Date().toTimeString().slice(0, 5),
            scope_type: "angkatan",
            scope_value: "Kelas 6",
          })
          .select()
          .single();

        if (errSess) throw errSess;
        targetSession = newSess;
        setSessions((prev) => [newSess, ...prev]);
      }

      const { error: recErr } = await supabase.from("attendance_records").upsert(
        {
          session_id: targetSession!.id,
          student_id: matched.id,
          status: "hadir",
          notes: "Verifikasi Mandiri Kelas 6",
        },
        { onConflict: "session_id,student_id" }
      );

      if (recErr) throw recErr;

      scannedTodaySetRef.current.add(matched.id);

      playScanSound("success");
      setPortalLog((prev) => [
        {
          id: Math.random().toString(),
          name: matched.full_name,
          nis: matched.nis,
          time: nowTimeStr,
          status: "success",
          msg: `Hadir diverifikasi (${matched.class_name} • ${matched.dorm})`,
          photo: matched.photo_url,
        },
        ...prev,
      ]);
      loadDatabaseData();
    } catch (e: any) {
      playScanSound("error");
      setPortalLog((prev) => [
        { id: Math.random().toString(), name: matched.full_name, nis: matched.nis, time: nowTimeStr, status: "rejected", msg: e.message || "Gagal simpan" },
        ...prev,
      ]);
    }
  }, [grade6Students, portalMode, customTimeWindows, sessions, checkTimeWindowValid, loadDatabaseData]);

  // ================= PENGAKTIFAN HTML5-QRCODE SCANNER AMAN =================
  useEffect(() => {
    const readerDivId = "sips-qr-reader-container";
    let isMounted = true;

    if (activeModule === "kelas6_portal" && scanInputMode === "camera" && isScannerRunning) {
      const qrScanner = new Html5Qrcode(readerDivId);
      html5QrCodeRef.current = qrScanner;

      qrScanner
        .start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            if (isMounted && decodedText) {
              handleProcessScanKelas6(decodedText);
            }
          },
          () => {}
        )
        .catch((err) => {
          console.warn("Gagal inisialisasi Html5Qrcode:", err);
          if (isMounted) {
            setIsScannerRunning(false);
          }
        });
    }

    return () => {
      isMounted = false;
      const currentScanner = html5QrCodeRef.current;
      if (currentScanner) {
        try {
          if (currentScanner.isScanning) {
            currentScanner
              .stop()
              .then(() => {
                currentScanner.clear();
              })
              .catch(() => {});
          } else {
            currentScanner.clear();
          }
        } catch {}
        html5QrCodeRef.current = null;
      }
    };
  }, [activeModule, scanInputMode, isScannerRunning, handleProcessScanKelas6]);

  const handleRemoveLogItem = (logId: string) => {
    setPortalLog((prev) => prev.filter((item) => item.id !== logId));
  };

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
    return targetInputStudents.filter((s) => s.full_name.toLowerCase().includes(q) || s.nis.includes(q));
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
        if (calCategory !== "all" && s.category !== calCategory) return false;
        if (calScopeType !== "all" && s.scope_type !== calScopeType) return false;
        if (calScopeValue !== "all" && s.scope_value.toLowerCase() !== calScopeValue.toLowerCase()) return false;
        return true;
      });

      const totalSesi = sessOnDate.length;
      const isPast = new Date(dateStr) < new Date(getTodayDateStr());
      return { totalSesi, isPast, sessions: sessOnDate };
    },
    [sessions, calCategory, calScopeType, calScopeValue]
  );

  // FUNGSI UTAMA: MEMUAT SELURUH SANTRI DALAM CAKUPAN SESI UNTUK DIPERIKSA / DI-EDIT
  const handleOpenEditSession = (sess: AttendanceSession) => {
    setSelectedSessionForEdit(sess);

    // Filter santri sesuai dengan scope sesi (kamar, kelas, angkatan, atau konsulat)
    const matchedSessionStudents = students.filter((s) => {
      if (!sess.scope_value || sess.scope_value === "all") return true;
      const val = sess.scope_value.toLowerCase();
      if (sess.scope_type === "kamar") return s.dorm.toLowerCase() === val;
      if (sess.scope_type === "kelas") return s.class_name.toLowerCase() === val;
      if (sess.scope_type === "konsulat") return s.consulate.toLowerCase() === val;
      if (sess.scope_type === "angkatan") {
        if (val.startsWith("tingkat ")) {
          const tg = val.replace("tingkat ", "").trim();
          return s.class_name.split(" ")[0]?.trim().toLowerCase() === tg;
        }
        if (val.startsWith("angkatan ")) {
          const ty = val.replace("angkatan ", "").trim();
          return s.entry_year === ty;
        }
        return s.entry_year === val || s.class_name.toLowerCase().includes(val);
      }
      return true;
    });

    const recs = records.filter((r) => r.session_id === sess.id);
    const recMap = new Map(recs.map((r) => [r.student_id, r.status]));

    const map: Record<string, "hadir" | "sakit" | "izin" | "ghoib"> = {};
    matchedSessionStudents.forEach((st) => {
      // Jika sudah tercatat gunakan statusnya, jika belum set default "hadir" agar lengkap
      map[st.id] = (recMap.get(st.id) as any) || "hadir";
    });

    setEditingRecordsMap(map);
  };

  const handleSaveUpdatedSession = async () => {
    if (!selectedSessionForEdit) return;
    setIsUpdatingSession(true);
    try {
      const updates = Object.entries(editingRecordsMap).map(([sId, status]) => ({
        session_id: selectedSessionForEdit.id,
        student_id: sId,
        status,
      }));

      const { error } = await supabase.from("attendance_records").upsert(updates, { onConflict: "session_id,student_id" });
      if (error) throw error;

      setToastMsg("Perubahan presensi berhasil diperbarui.");
      setTimeout(() => setToastMsg(""), 4000);
      setSelectedSessionForEdit(null);
      loadDatabaseData();
    } catch (e: any) {
      alert("Gagal memperbarui sesi: " + e.message);
    } finally {
      setIsUpdatingSession(false);
    }
  };

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

  const activeDaysCount = useMemo(() => {
    if (rekapPeriod === "today") return 1;
    if (rekapPeriod === "week") return 7;
    if (rekapPeriod === "month") return 30;
    if (rekapPeriod === "custom") {
      const d1 = new Date(customStart).getTime();
      const d2 = new Date(customEnd).getTime();
      const diff = Math.abs(d2 - d1);
      return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
    }
    return 7;
  }, [rekapPeriod, customStart, customEnd]);

  const calculatedTotalTarget = useMemo(() => {
    if (filterCategory === "sholat_wajib") return activeDaysCount * 5;
    if (filterCategory === "cek_malam") return activeDaysCount * 1;
    return filteredSessionsRekap.length > 0 ? filteredSessionsRekap.length : activeDaysCount;
  }, [filterCategory, activeDaysCount, filteredSessionsRekap]);

  const rekapDataRows = useMemo(() => {
    if (!isReportRendered) return [];

    const sessMap = new Map<string, AttendanceSession>(
      filteredSessionsRekap.map((s: AttendanceSession) => [s.id, s])
    );

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
        const stRecords = records.filter((r) => r.student_id === st.id && sessMap.has(r.session_id));

        let h = 0, s = 0, i = 0, g = 0;
        const prayerHadirCount: Record<string, number> = {
          shubuh: 0,
          dzuhur: 0,
          ashar: 0,
          maghrib: 0,
          isya: 0,
        };

        const absentDetails: { day: string; date: string; sessionTitle: string; statusText: string; type: "sakit" | "izin" | "ghoib" }[] = [];

        stRecords.forEach((r) => {
          const sess = sessMap.get(r.session_id);
          const dt = sess ? new Date(sess.date) : new Date();
          const dayName = dt.toLocaleDateString("id-ID", { weekday: "long" });
          const dateStr = dt.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
          const subCat = (sess?.sub_category || "").toLowerCase();

          if (r.status === "hadir") {
            h++;
            if (subCat && prayerHadirCount[subCat] !== undefined) {
              prayerHadirCount[subCat]++;
            }
          }
          if (r.status === "sakit") {
            s++;
            absentDetails.push({
              day: dayName,
              date: dateStr,
              sessionTitle: sess?.title || "Sesi",
              statusText: "Sakit",
              type: "sakit",
            });
          }
          if (r.status === "izin") {
            i++;
            absentDetails.push({
              day: dayName,
              date: dateStr,
              sessionTitle: sess?.title || "Sesi",
              statusText: "Izin",
              type: "izin",
            });
          }
          if (r.status === "ghoib") {
            g++;
            absentDetails.push({
              day: dayName,
              date: dateStr,
              sessionTitle: sess?.title || "Sesi",
              statusText: "Ghoib (Alpha)",
              type: "ghoib",
            });
          }
        });

        const target = calculatedTotalTarget;
        const disciplinePct = target === 0 ? 100 : Math.min(100, Math.round((h / target) * 100));

        return {
          student: st,
          hadir: h,
          sakit: s,
          izin: i,
          ghoib: g,
          totalRecords: stRecords.length,
          targetSessions: target,
          targetPerPrayer: activeDaysCount,
          prayerHadirCount,
          absentDetails,
          disciplinePct,
        };
      });
  }, [students, records, filteredSessionsRekap, isReportRendered, filterScopeType, filterScopeValue, calculatedTotalTarget, activeDaysCount]);

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const isSholat = filterCategory === "sholat_wajib";
    const ws = workbook.addWorksheet("Rekap_Presensi", { views: [{ state: "frozen", ySplit: 5, xSplit: 3 }] });

    const totalCol = isSholat ? 16 : 12;

    ws.mergeCells(1, 1, 1, totalCol);
    const tCell = ws.getCell(1, 1);
    tCell.value = "PONDOK PESANTREN CONDONG - SISTEM INFORMASI PENGASUHAN SANTRI (SIPS)";
    tCell.font = { name: "Segoe UI", size: 12, bold: true, color: { argb: "FFFFFF" } };
    tCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "064E3B" } };
    tCell.alignment = { horizontal: "center", vertical: "middle" };

    ws.mergeCells(2, 1, 2, totalCol);
    const subCell = ws.getCell(2, 1);
    subCell.value = `Laporan Rekapitulasi Presensi • Periode: ${rekapPeriod.toUpperCase()} (${activeDaysCount} Hari Aktif) • Target: ${calculatedTotalTarget} Sesi ${
      isSholat ? `(Masing-masing Sholat Target: ${activeDaysCount} Hari)` : ""
    } • Cakupan: ${filterScopeType.toUpperCase()} (${filterScopeValue})`;
    subCell.font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "064E3B" } };
    subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D1FAE5" } };
    subCell.alignment = { horizontal: "center", vertical: "middle" };

    let headers = ["NO", "NIS", "NAMA SANTRI", "KAMAR", "KELAS"];
    if (isSholat) {
      headers = [
        ...headers,
        `SHUBUH (${activeDaysCount})`,
        `DZUHUR (${activeDaysCount})`,
        `ASHAR (${activeDaysCount})`,
        `MAGHRIB (${activeDaysCount})`,
        `ISYA (${activeDaysCount})`,
        "TOTAL HADIR",
        "SAKIT",
        "IZIN",
        "GHOIB",
        "RINCIAN KETIDAKHADIRAN",
        "% DISIPLIN",
      ];
    } else {
      headers = [
        ...headers,
        "TARGET SESI",
        "HADIR (H)",
        "SAKIT (S)",
        "IZIN (I)",
        "GHOIB (G)",
        "RINCIAN KETIDAKHADIRAN",
        "% DISIPLIN",
      ];
    }

    ws.getRow(4).values = headers;
    ws.getRow(4).eachCell((c) => {
      c.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "047857" } };
      c.alignment = { horizontal: "center", vertical: "middle" };
    });

    rekapDataRows.forEach((r, idx) => {
      const absentText =
        r.totalRecords === 0
          ? "Belum ada catatan presensi"
          : r.absentDetails.length === 0
          ? "Nihil (Hadir Lengkap)"
          : r.absentDetails.map((a) => `${a.day}, ${a.date} - ${a.sessionTitle} (${a.statusText})`).join("; ");

      if (isSholat) {
        ws.addRow([
          idx + 1,
          r.student.nis,
          r.student.full_name,
          r.student.dorm,
          r.student.class_name,
          `${r.prayerHadirCount.shubuh}/${r.targetPerPrayer}`,
          `${r.prayerHadirCount.dzuhur}/${r.targetPerPrayer}`,
          `${r.prayerHadirCount.ashar}/${r.targetPerPrayer}`,
          `${r.prayerHadirCount.maghrib}/${r.targetPerPrayer}`,
          `${r.prayerHadirCount.isya}/${r.targetPerPrayer}`,
          `${r.hadir}/${r.targetSessions}`,
          r.sakit,
          r.izin,
          r.ghoib,
          absentText,
          `${r.disciplinePct}%`,
        ]);
      } else {
        ws.addRow([
          idx + 1,
          r.student.nis,
          r.student.full_name,
          r.student.dorm,
          r.student.class_name,
          r.targetSessions,
          r.hadir,
          r.sakit,
          r.izin,
          r.ghoib,
          absentText,
          `${r.disciplinePct}%`,
        ]);
      }
    });

    ws.columns = [
      { width: 6 }, { width: 14 }, { width: 28 }, { width: 18 }, { width: 12 },
      { width: 14 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 },
      { width: 36 }, { width: 12 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Rekap_Presensi_${filterCategory}_${getTodayDateStr()}.xlsx`;
    a.click();
  };

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

    const isSholat = filterCategory === "sholat_wajib";

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Laporan_Presensi_${getTodayDateStr()}</title>
          <style>
            @page { size: A4 landscape; margin: 8mm 10mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, sans-serif; }
            body { color: #000; font-size: 7.5pt; }
            .kop { text-align: center; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 6px; }
            .kop h2 { font-size: 11pt; font-weight: 900; }
            .meta { display: flex; justify-content: space-between; font-size: 7pt; margin-bottom: 6px; border: 1px solid #ccc; padding: 4px 6px; }
            table { width: 100%; border-collapse: collapse; margin-top: 4px; }
            th, td { border: 1px solid #444; padding: 3px 5px; font-size: 7pt; }
            th { background: #f0fdf4; text-align: center; }
            .badge-ghoib { color: #dc2626; font-weight: bold; }
            .badge-sakit { color: #d97706; }
            .badge-izin { color: #0284c7; }
            .ttd-box { display: flex; justify-content: space-between; margin-top: 20px; text-align: center; font-size: 7.5pt; }
          </style>
        </head>
        <body>
          <div class="kop">
            <h2>PONDOK PESANTREN CONDONG TASIKMALAYA</h2>
            <p>LAPORAN REKAPITULASI PRESENSI & KEDISIPLINAN SANTRI (SIPS)</p>
          </div>
          <div class="meta">
            <div>
              <p><b>Kategori Kegiatan:</b> ${filterCategory.toUpperCase()}</p>
              <p><b>Cakupan Santri:</b> ${filterScopeType.toUpperCase()} (${filterScopeValue})</p>
            </div>
            <div style="text-align: right;">
              <p><b>Periode Pemantauan:</b> ${rekapPeriod.toUpperCase()} (${activeDaysCount} Hari Aktif)</p>
              <p><b>Target Seharusnya:</b> ${calculatedTotalTarget} Sesi ${
      isSholat ? `(Masing-masing Sholat Target: ${activeDaysCount} Hari)` : ""
    }</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th width="18">No</th>
                <th width="55">NIS</th>
                <th>Nama Santri</th>
                <th width="65">Kamar</th>
                <th width="40">Kelas</th>
                ${
                  isSholat
                    ? `
                  <th width="42">Shubuh<br/>(${activeDaysCount})</th>
                  <th width="42">Dzuhur<br/>(${activeDaysCount})</th>
                  <th width="42">Ashar<br/>(${activeDaysCount})</th>
                  <th width="42">Maghrib<br/>(${activeDaysCount})</th>
                  <th width="42">Isya<br/>(${activeDaysCount})</th>
                  <th width="40">Total</th>
                  <th width="20">S</th>
                  <th width="20">I</th>
                  <th width="20">G</th>
                `
                    : `
                  <th width="45">Target</th>
                  <th width="25">H</th>
                  <th width="25">S</th>
                  <th width="25">I</th>
                  <th width="25">G</th>
                `
                }
                <th>Rincian Ketidakhadiran</th>
                <th width="45">% Disiplin</th>
              </tr>
            </thead>
            <tbody>
              ${rekapDataRows
                .map((r, idx) => {
                  const absentHtml =
                    r.totalRecords === 0
                      ? `<span style="color: #888;">Belum ada catatan presensi</span>`
                      : r.absentDetails.length === 0
                      ? `<span style="color: #059669; font-weight: bold;">Nihil (Hadir Lengkap)</span>`
                      : r.absentDetails
                          .map((a) => {
                            const cls = a.type === "ghoib" ? "badge-ghoib" : a.type === "sakit" ? "badge-sakit" : "badge-izin";
                            return `<span class="${cls}">• ${a.day}, ${a.date} - ${a.sessionTitle} (${a.statusText})</span>`;
                          })
                          .join("<br/>");

                  if (isSholat) {
                    return `
                      <tr>
                        <td align="center">${idx + 1}</td>
                        <td align="center">${r.student.nis}</td>
                        <td><b>${r.student.full_name}</b></td>
                        <td>${r.student.dorm}</td>
                        <td align="center">${r.student.class_name}</td>
                        <td align="center">${r.prayerHadirCount.shubuh}/${r.targetPerPrayer}</td>
                        <td align="center">${r.prayerHadirCount.dzuhur}/${r.targetPerPrayer}</td>
                        <td align="center">${r.prayerHadirCount.ashar}/${r.targetPerPrayer}</td>
                        <td align="center">${r.prayerHadirCount.maghrib}/${r.targetPerPrayer}</td>
                        <td align="center">${r.prayerHadirCount.isya}/${r.targetPerPrayer}</td>
                        <td align="center"><b>${r.hadir}/${r.targetSessions}</b></td>
                        <td align="center">${r.sakit}</td>
                        <td align="center">${r.izin}</td>
                        <td align="center" style="color: ${r.ghoib > 0 ? "red" : "black"}; font-weight: ${r.ghoib > 0 ? "bold" : "normal"}">${r.ghoib}</td>
                        <td>${absentHtml}</td>
                        <td align="right"><b>${r.disciplinePct}%</b></td>
                      </tr>
                    `;
                  } else {
                    return `
                      <tr>
                        <td align="center">${idx + 1}</td>
                        <td align="center">${r.student.nis}</td>
                        <td><b>${r.student.full_name}</b></td>
                        <td>${r.student.dorm}</td>
                        <td align="center">${r.student.class_name}</td>
                        <td align="center">${r.targetSessions}</td>
                        <td align="center">${r.hadir}</td>
                        <td align="center">${r.sakit}</td>
                        <td align="center">${r.izin}</td>
                        <td align="center" style="color: ${r.ghoib > 0 ? "red" : "black"}; font-weight: ${r.ghoib > 0 ? "bold" : "normal"}">${r.ghoib}</td>
                        <td>${absentHtml}</td>
                        <td align="right"><b>${r.disciplinePct}%</b></td>
                      </tr>
                    `;
                  }
                })
                .join("")}
            </tbody>
          </table>
          <div class="ttd-box">
            <div>
              <p>Mengetahui,</p>
              <p><b>Wali Kelas / Asrama</b></p>
              <div style="height: 35px;"></div>
              <p>( .................................... )</p>
            </div>
            <div>
              <p>Tasikmalaya, ${formatDateIndo(getTodayDateStr())}</p>
              <p><b>Bagian Pengasuhan Santri</b></p>
              <div style="height: 35px;"></div>
              <p>( .................................... )</p>
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

  const isPrayerReport = filterCategory === "sholat_wajib";

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

      {/* HEADER UTAMA */}
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
              Pencatatan presensi sholat berjamaah, cek kamar malam, portal mandiri kelas 6, kalender pemantauan berkala, dan rekapitulasi kedisiplinan.
            </p>
          </div>

          <div className="flex p-1.5 rounded-2xl bg-black/40 border border-emerald-400/30 backdrop-blur-xl shrink-0 flex-wrap gap-1">
            {[
              { id: "input", label: "Input Cepat", icon: CalendarCheck2 },
              { id: "kelas6_portal", label: "Portal Kelas 6", icon: QrCode },
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
                    isActive ? "bg-emerald-500 text-slate-950 shadow-md font-black" : "text-emerald-100/70 hover:text-white hover:bg-white/10"
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

      {/* ================= MODUL 1: INPUT CEPAT (DEFAULT PERTAMA KALI DIBUKA) ================= */}
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
                    else if (cat === "sholat_wajib") setInputTime(customTimeWindows[inputSubCategory]?.start || "04:30");
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
                      setInputTime(customTimeWindows[w]?.start || "04:30");
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
                  {inputScopeType === "kamar" && uniqueRooms.map((r) => <option key={r} value={r}>Kamar {r}</option>)}
                  {inputScopeType === "kelas" && uniqueClasses.map((c) => <option key={c} value={c}>Kelas {c}</option>)}
                  {inputScopeType === "angkatan" && uniqueGenerations.map((g) => <option key={g} value={g}>{g}</option>)}
                  {inputScopeType === "konsulat" && uniqueConsulates.map((k) => <option key={k} value={k}>Konsulat {k}</option>)}
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
                    onClick={() => {
                      const updated = { ...attendanceSheet };
                      targetInputStudents.forEach((s) => {
                        updated[s.id] = { ...updated[s.id], status: "hadir" };
                      });
                      setAttendanceSheet(updated);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-black rounded-xl cursor-pointer shadow-xs active:scale-95 transition"
                  >
                    ✓ Hadir Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...attendanceSheet };
                      targetInputStudents.forEach((s) => {
                        updated[s.id] = { ...updated[s.id], status: "ghoib" };
                      });
                      setAttendanceSheet(updated);
                    }}
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

      {/* ================= MODUL KHUSUS: PORTAL SCAN MANDIRI KELAS 6 ================= */}
      {activeModule === "kelas6_portal" && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-[#0c1815] p-6 rounded-[32px] border border-slate-200 dark:border-emerald-900/40 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-emerald-900/30 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Fingerprint className="w-5 h-5 text-emerald-600" />
                  <span>Portal Scan QR & Sensor Fingerprint (Santri Akhir / Kelas 6)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Klik tombol <strong>Mulai Scanner</strong> untuk mengaktifkan pemindai kamera atau sensor USB.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setBypassTimeLock(!bypassTimeLock)}
                  className={`inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    bypassTimeLock
                      ? "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300"
                      : "bg-slate-50 dark:bg-emerald-950/30 border-slate-200 dark:border-emerald-900/50 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {bypassTimeLock ? <Unlock className="w-3.5 h-3.5 text-amber-600" /> : <Lock className="w-3.5 h-3.5 text-slate-400" />}
                  <span>{bypassTimeLock ? "Bypass Waktu: AKTIF" : "Buka Paksa Portal"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowTimeSettings(!showTimeSettings)}
                  className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-emerald-950/40 hover:bg-slate-200 border border-slate-200 dark:border-emerald-900/40 text-slate-700 dark:text-slate-200 transition cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Atur Jam Buka</span>
                </button>
              </div>
            </div>

            {showTimeSettings && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-emerald-950/30 border border-slate-200 dark:border-emerald-900/40 space-y-3 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-800 dark:text-slate-200">Kustomisasi Jam Buka/Tutup Portal:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(customTimeWindows).map(([key, win]) => (
                    <div key={key} className="p-2.5 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-1.5">
                      <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300 capitalize">{win.label}</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="time"
                          value={win.start}
                          onChange={(e) =>
                            setCustomTimeWindows((prev) => ({
                              ...prev,
                              [key]: { ...prev[key], start: e.target.value },
                            }))
                          }
                          className="h-8 px-2 rounded-lg border bg-slate-50 dark:bg-slate-800 font-mono font-bold text-xs"
                        />
                        <span className="text-slate-400">s/d</span>
                        <input
                          type="time"
                          value={win.end}
                          onChange={(e) =>
                            setCustomTimeWindows((prev) => ({
                              ...prev,
                              [key]: { ...prev[key], end: e.target.value },
                            }))
                          }
                          className="h-8 px-2 rounded-lg border bg-slate-50 dark:bg-slate-800 font-mono font-bold text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/40 space-y-2">
                <label className="font-bold text-slate-500">Pilih Sesi Kegiatan Yang Berlangsung:</label>
                <select
                  value={portalMode}
                  onChange={(e) => setPortalMode(e.target.value as any)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-slate-900 font-bold text-xs outline-none cursor-pointer"
                >
                  <option value="shubuh">Sholat Shubuh ({customTimeWindows.shubuh.start} - {customTimeWindows.shubuh.end})</option>
                  <option value="dzuhur">Sholat Dzuhur ({customTimeWindows.dzuhur.start} - {customTimeWindows.dzuhur.end})</option>
                  <option value="ashar">Sholat Ashar ({customTimeWindows.ashar.start} - {customTimeWindows.ashar.end})</option>
                  <option value="maghrib">Sholat Maghrib ({customTimeWindows.maghrib.start} - {customTimeWindows.maghrib.end})</option>
                  <option value="isya">Sholat Isya ({customTimeWindows.isya.start} - {customTimeWindows.isya.end})</option>
                  <option value="cek_malam">Presensi Kamar Malam ({customTimeWindows.cek_malam.start} - {customTimeWindows.cek_malam.end})</option>
                </select>
              </div>

              <div
                className={`p-4 rounded-2xl border flex flex-col justify-between ${
                  checkTimeWindowValid(portalMode)
                    ? "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500/40 text-emerald-900 dark:text-emerald-200"
                    : "bg-rose-50/80 dark:bg-rose-950/40 border-rose-500/40 text-rose-900 dark:text-rose-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    <span>Status Jendela Portal Saat Ini:</span>
                  </span>
                  <span
                    className={`font-mono font-black uppercase text-[10px] px-2.5 py-0.5 rounded-full border ${
                      checkTimeWindowValid(portalMode) ? "bg-emerald-600 text-white border-emerald-700" : "bg-rose-600 text-white border-rose-700"
                    }`}
                  >
                    {checkTimeWindowValid(portalMode) ? "PORTAL TERBUKA" : "PORTAL TERKUNCI"}
                  </span>
                </div>
                <p className="text-[11px] mt-2 opacity-90">
                  {checkTimeWindowValid(portalMode)
                    ? `Santri kelas 6 dipersilakan melakukan verifikasi kehadiran.`
                    : `Di luar waktu resmi. Scan akan ditolak kecuali mengaktifkan 'Buka Paksa'.`}
                </p>
              </div>
            </div>

            {/* Tombol Kontrol Nyalakan / Matikan Scanner */}
            <div className="space-y-3 pt-1">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900 text-white border border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className={`h-3 w-3 rounded-full ${isScannerRunning ? "bg-emerald-400 animate-ping" : "bg-rose-500"}`} />
                  <div>
                    <h4 className="font-bold text-xs text-white">Status Mesin Pemindai: {isScannerRunning ? "AKTIF & BERJALAN" : "NONAKTIF (STANDBY)"}</h4>
                    <p className="text-[11px] text-slate-400">Klik tombol untuk mulai atau berhenti memindai.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsScannerRunning(!isScannerRunning)}
                    className={`inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-black transition cursor-pointer shadow-lg ${
                      isScannerRunning
                        ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30"
                        : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30"
                    }`}
                  >
                    {isScannerRunning ? (
                      <>
                        <Square className="w-4 h-4 fill-current" />
                        <span>Matikan Scanner</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>Mulai Scanner (Aktifkan)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Pilihan Metode Input */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-emerald-900/30 pb-2">
                <span className="text-xs font-black text-slate-700 dark:text-slate-300">Metode Input:</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setScanInputMode("camera")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      scanInputMode === "camera"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Kamera Webcam</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScanInputMode("sensor")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      scanInputMode === "sensor"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <Fingerprint className="w-3.5 h-3.5" />
                    <span>Sensor USB / Barcode KTS</span>
                  </button>
                </div>
              </div>

              {/* Tampilan Kamera Live Scanner (html5-qrcode container) */}
              {scanInputMode === "camera" ? (
                <div className="p-5 rounded-3xl bg-slate-950 text-white flex flex-col items-center justify-center space-y-3 border border-slate-800 shadow-xl">
                  <div
                    id="sips-qr-reader-container"
                    className={`w-full max-w-sm rounded-2xl overflow-hidden bg-black border-2 border-emerald-500/60 flex items-center justify-center shadow-inner ${
                      isScannerRunning ? "block min-h-[280px]" : "hidden"
                    }`}
                  />

                  {!isScannerRunning && (
                    <div className="w-full max-w-sm h-48 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center text-center p-4 space-y-2 text-slate-400">
                      <CameraOff className="w-8 h-8 text-slate-500" />
                      <p className="text-xs">Kamera dalam keadaan mati. Klik <strong>Mulai Scanner</strong> di atas untuk mengaktifkan.</p>
                    </div>
                  )}

                  <p className="text-xs text-emerald-300 font-bold text-center">
                    Arahkan QR KTS Santri ke dalam kotak kamera untuk verifikasi instan.
                  </p>
                </div>
              ) : (
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/40 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Tempelkan sidik jari pada sensor USB atau scan kartu KTS:</span>
                    <span className={`text-[10px] font-mono font-bold ${isScannerRunning ? "text-emerald-600 animate-pulse" : "text-rose-500"}`}>
                      {isScannerRunning ? "● Scanner Siap" : "○ Scanner Mati"}
                    </span>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (isScannerRunning) handleProcessScanKelas6(scanInput);
                    }}
                    className="flex gap-2"
                  >
                    <div className="relative flex-1">
                      <QrCode className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        ref={scanInputRef}
                        type="text"
                        disabled={!isScannerRunning}
                        value={scanInput}
                        onChange={(e) => setScanInput(e.target.value)}
                        placeholder={isScannerRunning ? "Tempel jari di sensor atau ketik NIS santri..." : "Nyalakan scanner terlebih dahulu..."}
                        className="w-full h-12 pl-10 pr-4 rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-slate-900 text-sm font-mono font-bold outline-none focus:border-emerald-500 disabled:opacity-50"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!isScannerRunning}
                      className="px-6 h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs cursor-pointer active:scale-95 transition disabled:opacity-50"
                    >
                      Verifikasi
                    </button>
                  </form>
                </div>
              )}
            </div>

            <div className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Riwayat Verifikasi Santri Sesi Ini ({portalLog.length})
                </h4>
                {portalLog.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPortalLog([])}
                    className="text-[11px] text-slate-400 hover:text-rose-500 font-medium cursor-pointer"
                  >
                    Bersihkan Riwayat Layar
                  </button>
                )}
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto">
                {portalLog.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs italic border border-dashed rounded-2xl">
                    Belum ada santri kelas 6 yang melakukan verifikasi pada sesi ini.
                  </div>
                ) : (
                  portalLog.map((log) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs ${
                        log.status === "success"
                          ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-500/30 text-emerald-900 dark:text-emerald-200"
                          : "bg-rose-50/70 dark:bg-rose-950/20 border-rose-500/30 text-rose-900 dark:text-rose-200"
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0 border">
                          {log.photo ? (
                            <img src={log.photo} alt={log.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-bold text-slate-600 text-sm">{log.name.charAt(0)}</span>
                          )}
                        </div>

                        <div>
                          <p className="font-extrabold text-sm">{log.name} <span className="font-mono text-xs opacity-75">({log.nis})</span></p>
                          <p className="text-[11px] opacity-80 mt-0.5">{log.msg}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="font-mono font-bold text-xs">{log.time}</span>
                          <p className={`text-[10px] font-black uppercase mt-0.5 ${log.status === "success" ? "text-emerald-600" : "text-rose-600"}`}>
                            {log.status === "success" ? "TERVERIFIKASI" : "DITOLAK"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveLogItem(log.id)}
                          className="p-1.5 rounded-xl hover:bg-rose-500/20 text-rose-500 transition cursor-pointer"
                          title="Hapus dari riwayat"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODUL 2: KALENDER PEMANTAUAN ================= */}
      {activeModule === "calendar" && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-[#0c1815] p-5 sm:p-6 rounded-[32px] border border-slate-200 dark:border-emerald-900/40 shadow-xs space-y-3.5">
            <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-2">
              <Filter className="w-4 h-4 text-emerald-600" />
              <span>1. Tentukan Parameter Kalender Pemantauan</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-500">Kategori Sesi</label>
                <select
                  value={calCategory}
                  onChange={(e) => {
                    setCalCategory(e.target.value);
                    setCalendarFilterLoaded(false);
                  }}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 font-bold outline-none cursor-pointer"
                >
                  <option value="all">Semua Data (Sholat 5 Waktu, Cek Malam, & Khusus)</option>
                  <option value="sholat_wajib">Sholat 5 Waktu Saja</option>
                  <option value="cek_malam">Cek Kamar Malam Saja</option>
                  <option value="khusus">Presensi Khusus Saja</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-500">Basis Unit</label>
                <select
                  value={calScopeType}
                  onChange={(e) => {
                    setCalScopeType(e.target.value as any);
                    setCalScopeValue("all");
                    setCalendarFilterLoaded(false);
                  }}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 font-bold outline-none cursor-pointer"
                >
                  <option value="all">Semua Unit Santri (Global)</option>
                  <option value="kamar">Per Kamar Asrama</option>
                  <option value="kelas">Per Kelas</option>
                  <option value="angkatan">Per Angkatan / Tingkat</option>
                  <option value="konsulat">Per Konsulat</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-500">Pilihan Spesifik</label>
                <select
                  disabled={calScopeType === "all"}
                  value={calScopeValue}
                  onChange={(e) => {
                    setCalScopeValue(e.target.value);
                    setCalendarFilterLoaded(false);
                  }}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 font-bold outline-none cursor-pointer disabled:opacity-50"
                >
                  <option value="all">Semua {calScopeType !== "all" ? calScopeType : "Unit"}</option>
                  {calScopeType === "kamar" && uniqueRooms.map((r) => <option key={r} value={r}>Kamar {r}</option>)}
                  {calScopeType === "kelas" && uniqueClasses.map((c) => <option key={c} value={c}>Kelas {c}</option>)}
                  {calScopeType === "angkatan" && uniqueGenerations.map((g) => <option key={g} value={g}>{g}</option>)}
                  {calScopeType === "konsulat" && uniqueConsulates.map((k) => <option key={k} value={k}>Konsulat {k}</option>)}
                </select>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setCalendarFilterLoaded(true)}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black cursor-pointer shadow-md transition"
              >
                Tampilkan Kalender Pemantauan
              </button>
            </div>
          </div>

          {calendarFilterLoaded ? (
            <div className="bg-white dark:bg-[#0c1815] p-5 sm:p-6 rounded-[32px] border border-slate-200 dark:border-emerald-900/40 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
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
                <span className="text-sm font-black">
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

              <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-bold text-slate-400 uppercase">
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
                        isToday ? "border-emerald-600 bg-emerald-50/30 dark:bg-emerald-950/30" : "border-slate-200/80 dark:border-emerald-900/40 bg-white dark:bg-[#071310]"
                      }`}
                    >
                      <span className={`text-xs font-black ${isToday ? "text-emerald-600" : "text-slate-800 dark:text-slate-200"}`}>
                        {dayNum}
                      </span>
                      <div
                        className={`py-0.5 px-1 rounded-lg text-[9px] font-black text-center truncate ${
                          summary.totalSesi > 0 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : summary.isPast ? "bg-slate-100 text-slate-400" : "text-slate-300"
                        }`}
                      >
                        {summary.totalSesi > 0 ? `${summary.totalSesi} Sesi Tercatat` : summary.isPast ? "Kosong" : "·"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#0c1815] p-12 rounded-[32px] border border-dashed border-slate-200 dark:border-emerald-900/40 text-center space-y-2">
              <CalendarIcon className="w-8 h-8 text-emerald-600 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Pilih Parameter Kalender</h3>
              <p className="text-xs text-slate-400">Pilih kategori sesi dan rombel di atas lalu klik <b>Tampilkan Kalender Pemantauan</b>.</p>
            </div>
          )}

          {/* Drawer Detail & Edit Hari */}
          <AnimatePresence>
            {selectedDrawerDate && (
              <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
                <motion.div
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  className="w-full max-w-lg bg-white dark:bg-[#0c1815] h-full shadow-2xl p-6 flex flex-col justify-between overflow-y-auto"
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-emerald-900/40 pb-3">
                      <div>
                        <h3 className="text-sm font-black text-slate-900 dark:text-white">Detail Presensi Harian</h3>
                        <p className="text-xs text-slate-400">{formatDateIndo(selectedDrawerDate)}</p>
                      </div>
                      <button type="button" onClick={() => setSelectedDrawerDate(null)} className="p-1 rounded-xl hover:bg-slate-100 cursor-pointer">
                        <X className="w-5 h-5 text-slate-400" />
                      </button>
                    </div>

                    {selectedSessionForEdit ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b">
                          <span className="font-bold text-xs">Edit Presensi: {selectedSessionForEdit.title}</span>
                          <button
                            type="button"
                            onClick={() => setSelectedSessionForEdit(null)}
                            className="text-xs text-slate-400 hover:underline"
                          >
                            Kembali
                          </button>
                        </div>
                        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                          {Object.entries(editingRecordsMap).map(([sId, currentStatus]) => {
                            const st = students.find((s) => s.id === sId);
                            return (
                              <div key={sId} className="p-2.5 rounded-xl border bg-slate-50 dark:bg-emerald-950/20 text-xs flex items-center justify-between">
                                <div>
                                  <p className="font-bold">{st?.full_name || "Santri"}</p>
                                  <p className="text-[10px] text-slate-400">{st?.dorm} • {st?.class_name}</p>
                                </div>
                                <div className="grid grid-cols-4 gap-1">
                                  {(["hadir", "sakit", "izin", "ghoib"] as const).map((stk) => (
                                    <button
                                      key={stk}
                                      type="button"
                                      onClick={() => setEditingRecordsMap((prev) => ({ ...prev, [sId]: stk }))}
                                      className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                                        currentStatus === stk ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"
                                      }`}
                                    >
                                      {stk.charAt(0)}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <button
                          type="button"
                          disabled={isUpdatingSession}
                          onClick={handleSaveUpdatedSession}
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black cursor-pointer"
                        >
                          {isUpdatingSession ? "Menyimpan..." : "Simpan Perubahan Sesi"}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {sessions.filter((s) => s.date === selectedDrawerDate).length === 0 ? (
                          <p className="text-xs text-slate-400 py-6 text-center">Tidak ada sesi presensi pada tanggal ini.</p>
                        ) : (
                          sessions
                            .filter((s) => s.date === selectedDrawerDate)
                            .map((s) => {
                              // Menghitung total target santri sesuai scope sesi
                              const matchedCount = students.filter((st) => {
                                if (!s.scope_value || s.scope_value === "all") return true;
                                const val = s.scope_value.toLowerCase();
                                if (s.scope_type === "kamar") return st.dorm.toLowerCase() === val;
                                if (s.scope_type === "kelas") return st.class_name.toLowerCase() === val;
                                if (s.scope_type === "konsulat") return st.consulate.toLowerCase() === val;
                                if (s.scope_type === "angkatan") {
                                  if (val.startsWith("tingkat ")) {
                                    const tg = val.replace("tingkat ", "").trim();
                                    return st.class_name.split(" ")[0]?.trim().toLowerCase() === tg;
                                  }
                                  if (val.startsWith("angkatan ")) {
                                    const ty = val.replace("angkatan ", "").trim();
                                    return st.entry_year === ty;
                                  }
                                  return st.entry_year === val || st.class_name.toLowerCase().includes(val);
                                }
                                return true;
                              }).length;

                              const recs = records.filter((r) => r.session_id === s.id);
                              const h = recs.filter((r) => r.status === "hadir").length;
                              const g = recs.filter((r) => r.status === "ghoib").length;

                              return (
                                <div key={s.id} className="p-3 rounded-2xl border bg-slate-50 dark:bg-emerald-950/20 text-xs space-y-1.5">
                                  <div className="flex justify-between font-bold">
                                    <span>{s.title}</span>
                                    <span className="font-mono text-emerald-600">{s.time} WIB</span>
                                  </div>
                                  <p className="text-[10px] text-slate-400">
                                    Cakupan: <strong className="capitalize">{s.scope_type} - {s.scope_value}</strong> • <strong>Total Target: {matchedCount} Santri</strong>
                                  </p>
                                  <p className="text-[10px] text-emerald-600 font-semibold">
                                    Hadir: {h} • Ghoib: {g}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditSession(s)}
                                    className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-600 hover:underline pt-1 cursor-pointer"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                    <span>Lihat & Edit Status Seluruh Santri ({matchedCount} Orang)</span>
                                  </button>
                                </div>
                              );
                            })
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDrawerDate(null);
                      setSelectedSessionForEdit(null);
                    }}
                    className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black cursor-pointer mt-4"
                  >
                    Tutup
                  </button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ================= MODUL 3: REKAPITULASI & ANALITIK ================= */}
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
                  <option value="today">Hari Ini (1 Hari)</option>
                  <option value="week">1 Minggu Terakhir (7 Hari)</option>
                  <option value="month">1 Bulan Terakhir (30 Hari)</option>
                  <option value="custom">Rentang Waktu Kustom</option>
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
                  <option value="sholat_wajib">Sholat Berjamaah (Detail 5 Waktu)</option>
                  <option value="cek_malam">Cek Malam</option>
                  <option value="khusus">Presensi Khusus</option>
                  <option value="all">Semua Kategori</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-500">Filter Basis Rombel</label>
                <select
                  value={filterScopeType}
                  onChange={(e) => {
                    setFilterScopeType(e.target.value as any);
                    setFilterScopeValue("all");
                    setIsReportRendered(false);
                  }}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 font-bold outline-none cursor-pointer"
                >
                  <option value="all">Semua Santri (Global)</option>
                  <option value="kamar">Per Kamar Asrama</option>
                  <option value="kelas">Per Kelas</option>
                  <option value="angkatan">Per Angkatan / Tingkat</option>
                  <option value="konsulat">Per Konsulat</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-500">Pilih Unit Spesifik</label>
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
                  {filterScopeType === "kamar" && uniqueRooms.map((r) => <option key={r} value={r}>Kamar {r}</option>)}
                  {filterScopeType === "kelas" && uniqueClasses.map((c) => <option key={c} value={c}>Kelas {c}</option>)}
                  {filterScopeType === "angkatan" && uniqueGenerations.map((g) => <option key={g} value={g}>{g}</option>)}
                  {filterScopeType === "konsulat" && uniqueConsulates.map((k) => <option key={k} value={k}>Konsulat {k}</option>)}
                </select>
              </div>
            </div>

            {rekapPeriod === "custom" && (
              <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-emerald-950/30 rounded-xl border w-fit text-xs">
                <span className="font-bold text-slate-400">Dari:</span>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => {
                    setCustomStart(e.target.value);
                    setIsReportRendered(false);
                  }}
                  className="h-8 px-2 rounded-lg border bg-white font-semibold"
                />
                <span className="text-slate-400">s/d</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => {
                    setCustomEnd(e.target.value);
                    setIsReportRendered(false);
                  }}
                  className="h-8 px-2 rounded-lg border bg-white font-semibold"
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
                    className="flex items-center space-x-1.5 px-4 py-2.5 border border-emerald-600/30 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-2xl cursor-pointer hover:bg-emerald-100"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Unduh Excel (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintOfficialPDF}
                    className="flex items-center space-x-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-2xl cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Cetak PDF Resmi</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* HASIL DATA REKAPITULASI */}
          {isReportRendered && (
            <div className="bg-white dark:bg-[#0c1815] p-5 sm:p-6 rounded-[32px] border border-slate-200 dark:border-emerald-900/40 shadow-xs space-y-4">
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
                <div className="text-xs text-slate-500 font-medium">
                  Periode: <strong className="text-emerald-700 dark:text-emerald-400">{activeDaysCount} Hari Aktif</strong> • Target Seharusnya:{" "}
                  <strong className="text-emerald-700 dark:text-emerald-400">
                    {isPrayerReport ? `${calculatedTotalTarget} Sesi (Tiap Waktu: ${activeDaysCount} Kali)` : `${calculatedTotalTarget} Sesi`}
                  </strong>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-emerald-900/40 text-slate-400 uppercase text-[10px]">
                      <th className="py-3 px-3 w-10">No</th>
                      <th className="py-3 px-3 w-24">NIS</th>
                      <th className="py-3 px-3 min-w-[160px]">Nama Santri</th>
                      <th className="py-3 px-3">Kamar</th>
                      <th className="py-3 px-3">Kelas</th>
                      
                      {isPrayerReport ? (
                        <>
                          <th className="py-3 px-2 text-center bg-emerald-50/50 dark:bg-emerald-950/20">
                            Shubuh<br/><span className="text-[9px] font-mono text-emerald-600">({activeDaysCount})</span>
                          </th>
                          <th className="py-3 px-2 text-center bg-emerald-50/50 dark:bg-emerald-950/20">
                            Dzuhur<br/><span className="text-[9px] font-mono text-emerald-600">({activeDaysCount})</span>
                          </th>
                          <th className="py-3 px-2 text-center bg-emerald-50/50 dark:bg-emerald-950/20">
                            Ashar<br/><span className="text-[9px] font-mono text-emerald-600">({activeDaysCount})</span>
                          </th>
                          <th className="py-3 px-2 text-center bg-emerald-50/50 dark:bg-emerald-950/20">
                            Maghrib<br/><span className="text-[9px] font-mono text-emerald-600">({activeDaysCount})</span>
                          </th>
                          <th className="py-3 px-2 text-center bg-emerald-50/50 dark:bg-emerald-950/20">
                            Isya<br/><span className="text-[9px] font-mono text-emerald-600">({activeDaysCount})</span>
                          </th>
                          <th className="py-3 px-2 text-center">Total Hadir</th>
                          <th className="py-3 px-2 text-center">S</th>
                          <th className="py-3 px-2 text-center">I</th>
                          <th className="py-3 px-2 text-center">G</th>
                        </>
                      ) : (
                        <>
                          <th className="py-3 px-3 text-center">Target Sesi</th>
                          <th className="py-3 px-3 text-center">H</th>
                          <th className="py-3 px-3 text-center">S</th>
                          <th className="py-3 px-3 text-center">I</th>
                          <th className="py-3 px-3 text-center">G</th>
                        </>
                      )}

                      <th className="py-3 px-3 min-w-[220px]">Rincian Ketidakhadiran</th>
                      <th className="py-3 px-3 text-right">% Disiplin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-emerald-900/30 font-medium">
                    {rekapDataRows
                      .filter((r) => r.student.full_name.toLowerCase().includes(rekapSearch.toLowerCase()) || r.student.nis.includes(rekapSearch))
                      .map((row, idx) => (
                        <tr key={row.student.id} className="hover:bg-slate-50/50 dark:hover:bg-emerald-950/20">
                          <td className="py-3 px-3 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-600">{row.student.nis}</td>
                          <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">{row.student.full_name}</td>
                          <td className="py-3 px-3 text-slate-500">{row.student.dorm}</td>
                          <td className="py-3 px-3 text-slate-500">{row.student.class_name}</td>

                          {isPrayerReport ? (
                            <>
                              {PRAYER_LIST.map((p) => {
                                const val = row.prayerHadirCount[p];
                                const isFull = val >= row.targetPerPrayer;
                                return (
                                  <td key={p} className="py-3 px-2 text-center font-mono">
                                    <span
                                      className={`px-1.5 py-0.5 rounded-md text-[11px] font-bold ${
                                        isFull ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 bg-rose-50 dark:bg-rose-950/40"
                                      }`}
                                    >
                                      {val}/{row.targetPerPrayer}
                                    </span>
                                  </td>
                                );
                              })}
                              <td className="py-3 px-2 text-center font-bold text-emerald-700 dark:text-emerald-300 font-mono">
                                {row.hadir}/{row.targetSessions}
                              </td>
                              <td className="py-3 px-2 text-center font-bold text-amber-600">{row.sakit}</td>
                              <td className="py-3 px-2 text-center font-bold text-sky-600">{row.izin}</td>
                              <td className="py-3 px-2 text-center font-bold text-rose-600">{row.ghoib}</td>
                            </>
                          ) : (
                            <>
                              <td className="py-3 px-3 text-center font-bold font-mono text-emerald-700">{row.targetSessions}</td>
                              <td className="py-3 px-3 text-center font-bold text-emerald-600">{row.hadir}</td>
                              <td className="py-3 px-3 text-center font-bold text-amber-600">{row.sakit}</td>
                              <td className="py-3 px-3 text-center font-bold text-sky-600">{row.izin}</td>
                              <td className="py-3 px-3 text-center font-bold text-rose-600">{row.ghoib}</td>
                            </>
                          )}

                          <td className="py-3 px-3">
                            {row.totalRecords === 0 ? (
                              <span className="text-[11px] text-slate-400 italic">Belum ada catatan presensi</span>
                            ) : row.absentDetails.length === 0 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                ✓ Nihil (Hadir Lengkap)
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {row.absentDetails.map((a, aIdx) => (
                                  <span
                                    key={aIdx}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                      a.type === "ghoib"
                                        ? "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50"
                                        : a.type === "sakit"
                                        ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50"
                                        : "bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900/50"
                                    }`}
                                  >
                                    <strong>{a.day}, {a.date}</strong> - {a.sessionTitle} ({a.statusText})
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3 text-right">
                            <span
                              className={`px-2.5 py-1 rounded-xl text-[10px] font-black border ${
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
          )}
        </div>
      )}
    </div>
  );
}