"use client";

// =============================================================================
// 1. IMPORT DEPENDENCIES & ICONS
// =============================================================================
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  Plus,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Scale,
  Edit,
  Trash2,
  FileText,
  X,
  Calendar,
  CheckSquare,
  Square,
  Check,
  Layers,
  FileSpreadsheet,
  Printer,
  History,
  User,
  Phone,
  Home,
  MapPin,
  GraduationCap,
  QrCode,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import QRScannerModal from "@/components/QRScannerModal";
import { parseQRCodeText } from "@/lib/qrParser";
import { playScanSound } from "@/lib/feedback";

// =============================================================================
// 2. INTERFACE DATA TYPES
// =============================================================================
interface Violation {
  id: string;
  student_id: string;
  student_name: string;
  nis: string;
  category: "Ringan" | "Sedang" | "Berat";
  violation_name: string;
  points: number;
  description?: string;
  sanction?: string;
  status: "Proses" | "Ditindak" | "Selesai";
  recorded_by?: string;
  document_url?: string;
  created_at: string;
}

interface StudentSummary {
  id: string;
  nis: string;
  name: string;
  class: string;
  dorm: string;
  consulate: string;
  guardian_name?: string;
  guardian_phone?: string;
  photo_url?: string | null;
  totalPoints: number;
  violationsCount: number;
}

export default function ViolationsDashboardPage() {
  // ===========================================================================
  // 3. STATE MANAGEMENT
  // ===========================================================================
  const [violations, setViolations] = useState<Violation[]>([]);
  const [studentsMap, setStudentsMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // Scanner Modal State
  const [showScanner, setShowScanner] = useState(false);

  // Filter & Search States (Halaman Utama)
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "Proses" | "Ditindak" | "Selesai">("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState<"all" | "7days" | "30days" | "semester" | "custom">("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "points_high" | "points_low" | "name_asc">("newest");

  // Selection State (Multi Checkbox)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Single Action States
  const [itemToDelete, setItemToDelete] = useState<Violation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingItem, setEditingItem] = useState<Violation | null>(null);
  const [editStatus, setEditStatus] = useState<"Proses" | "Ditindak" | "Selesai">("Proses");
  const [editSanction, setEditSanction] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Batch (Massal) States
  const [showBatchEditModal, setShowBatchEditModal] = useState(false);
  const [batchStatus, setBatchStatus] = useState<"Proses" | "Ditindak" | "Selesai">("Ditindak");
  const [batchSanction, setBatchSanction] = useState("");
  const [updateSanctionToo, setUpdateSanctionToo] = useState(false);
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  // Individual Student Tracking (Dossier Modal)
  const [selectedStudentForDossier, setSelectedStudentForDossier] = useState<StudentSummary | null>(null);
  const [dossierPeriodFilter, setDossierPeriodFilter] = useState<"all" | "7days" | "30days" | "semester">("all");

  // ===========================================================================
  // 4. FETCH DATA VIOLATIONS & STUDENTS
  // ===========================================================================
  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: stData } = await supabase.from("students").select("*");
      const stLookup: Record<string, any> = {};
      (stData || []).forEach((st: any) => {
        const nisKey = String(st.nis || "").trim();
        stLookup[nisKey] = {
          id: st.id,
          name: st.full_name || st.name || st.nama || "Santri",
          class: st.kelas || st.class_name || st.class || "-",
          dorm: st.kamar_asrama || st.dorm || st.room || st.asrama || "-",
          consulate: st.asal_konsulat || st.consulate || st.origin_region || "-",
          guardian_name: st.nama_lengkap_wali || st.guardian_name || st.nama_wali || "-",
          phone: st.no_whatsapp || st.guardian_phone || st.phone || "-",
          photo_url: st.photo_url || st.foto || null,
        };
      });
      setStudentsMap(stLookup);

      const { data: vData, error } = await supabase
        .from("violations")
        .select("*")
        .order("created_at", { ascending: false })
        .range(0, 999);

      if (error) throw error;
      setViolations(vData || []);
      setSelectedIds([]);
    } catch (err: any) {
      console.warn("Gagal memuat catatan pelanggaran:", err.message);
    } finally {
      setLoading(false);
    }
  }

  // ===========================================================================
  // 5. SCANNER QR CODE HANDLER
  // ===========================================================================
  const handleScanSuccess = async (rawDecodedText: string) => {
    setShowScanner(false);
    const { searchKey, nis, id } = parseQRCodeText(rawDecodedText);
    const targetNis = (nis || searchKey).trim();

    let studentMeta = studentsMap[targetNis];

    if (!studentMeta && targetNis) {
      const { data: st } = await supabase
        .from("students")
        .select("*")
        .or(`nis.eq.${targetNis},id.eq.${id || targetNis}`)
        .maybeSingle();

      if (st) {
        studentMeta = {
          id: st.id,
          name: st.full_name || st.name || st.nama || "Santri",
          class: st.kelas || st.class_name || st.class || "-",
          dorm: st.kamar_asrama || st.dorm || st.room || st.asrama || "-",
          consulate: st.asal_konsulat || st.consulate || st.origin_region || "-",
          guardian_name: st.nama_lengkap_wali || st.guardian_name || st.nama_wali || "-",
          phone: st.no_whatsapp || st.guardian_phone || st.phone || "-",
          photo_url: st.photo_url || st.foto || null,
        };
      }
    }

    if (studentMeta) {
      playScanSound("success");
      const allStudentViolations = violations.filter(
        (item) => item.nis === targetNis || item.student_id === studentMeta.id
      );
      const totalPts = allStudentViolations.reduce(
        (acc, curr) => acc + (Number(curr.points) || 0),
        0
      );

      setSelectedStudentForDossier({
        id: studentMeta.id,
        nis: targetNis,
        name: studentMeta.name,
        class: studentMeta.class,
        dorm: studentMeta.dorm,
        consulate: studentMeta.consulate,
        guardian_name: studentMeta.guardian_name,
        guardian_phone: studentMeta.phone,
        photo_url: studentMeta.photo_url,
        totalPoints: totalPts,
        violationsCount: allStudentViolations.length,
      });
      setDossierPeriodFilter("all");
    } else {
      playScanSound("error");
      setSearchQuery(targetNis);
    }
  };

  // ===========================================================================
  // 6. FILTERING, PERIOD & SORTING LOGIC
  // ===========================================================================
  const filteredViolations = useMemo(() => {
    const now = new Date();

    return violations
      .filter((v) => {
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch =
          q === "" ||
          v.student_name.toLowerCase().includes(q) ||
          v.nis.toLowerCase().includes(q) ||
          v.violation_name.toLowerCase().includes(q);

        const matchesTab = activeTab === "all" || v.status === activeTab;
        const matchesCategory = filterCategory === "all" || v.category === filterCategory;

        let matchesPeriod = true;
        const createdAt = new Date(v.created_at);

        if (filterPeriod === "7days") {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(now.getDate() - 7);
          matchesPeriod = createdAt >= sevenDaysAgo;
        } else if (filterPeriod === "30days") {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(now.getDate() - 30);
          matchesPeriod = createdAt >= thirtyDaysAgo;
        } else if (filterPeriod === "semester") {
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(now.getMonth() - 6);
          matchesPeriod = createdAt >= sixMonthsAgo;
        } else if (filterPeriod === "custom") {
          if (customStartDate) {
            matchesPeriod = matchesPeriod && createdAt >= new Date(`${customStartDate}T00:00:00`);
          }
          if (customEndDate) {
            matchesPeriod = matchesPeriod && createdAt <= new Date(`${customEndDate}T23:59:59`);
          }
        }

        return matchesSearch && matchesTab && matchesCategory && matchesPeriod;
      })
      .sort((a, b) => {
        if (sortBy === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (sortBy === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (sortBy === "points_high") return Number(b.points) - Number(a.points);
        if (sortBy === "points_low") return Number(a.points) - Number(b.points);
        if (sortBy === "name_asc") return a.student_name.localeCompare(b.student_name);
        return 0;
      });
  }, [violations, searchQuery, activeTab, filterCategory, filterPeriod, customStartDate, customEndDate, sortBy]);

  const stats = useMemo(() => {
    const totalCases = violations.length;
    const totalPoints = violations.reduce((acc, curr) => acc + (Number(curr.points) || 0), 0);
    const inProcess = violations.filter((v) => v.status === "Proses").length;
    const heavyCases = violations.filter((v) => v.category === "Berat").length;
    return { totalCases, totalPoints, inProcess, heavyCases };
  }, [violations]);

  const isAllFilteredSelected = useMemo(() => {
    if (filteredViolations.length === 0) return false;
    return filteredViolations.every((v) => selectedIds.includes(v.id));
  }, [filteredViolations, selectedIds]);

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      const filteredIdSet = new Set(filteredViolations.map((v) => v.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
    } else {
      const newIds = new Set([...selectedIds, ...filteredViolations.map((v) => v.id)]);
      setSelectedIds(Array.from(newIds));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // ===========================================================================
  // 7. EXPORT CSV & PRINT ACTIONS
  // ===========================================================================
  const handleExportCSV = () => {
    if (filteredViolations.length === 0) {
      alert("Tidak ada data pelanggaran untuk diekspor.");
      return;
    }

    const headers = [
      "No",
      "Tanggal",
      "NIS",
      "Nama Santri",
      "Kelas",
      "Kamar Asrama",
      "Konsulat Asal",
      "Kategori",
      "Bentuk Pelanggaran",
      "Poin Disiplin",
      "Bentuk Sanksi / Takzir",
      "Keterangan / Kronologi",
      "Status",
      "Dicatat Oleh",
    ];

    const rows = filteredViolations.map((v, idx) => {
      const meta = studentsMap[v.nis] || {};
      const dateFormatted = new Date(v.created_at).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      return [
        idx + 1,
        dateFormatted,
        `'${v.nis}`,
        `"${v.student_name.replace(/"/g, '""')}"`,
        `"${meta.class || "-"}"`,
        `"${meta.dorm || "-"}"`,
        `"${meta.consulate || "-"}"`,
        v.category,
        `"${v.violation_name.replace(/"/g, '""')}"`,
        v.points,
        `"${(v.sanction || "-").replace(/"/g, '""')}"`,
        `"${(v.description || "-").replace(/"/g, '""')}"`,
        v.status,
        `"${v.recorded_by || "Bagian Pengasuhan"}"`,
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().split("T")[0];

    link.setAttribute("href", url);
    link.setAttribute("download", `Rekap_Pelanggaran_Santri_${dateStr}_(${filteredViolations.length}_Data).csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintGlobalReport = () => {
    window.print();
  };

  // ===========================================================================
  // 8. INDIVIDUAL TRACKING & CETAK RAPOR SANTRI
  // ===========================================================================
  const handleOpenStudentDossier = (v: Violation) => {
    const meta = studentsMap[v.nis] || {};
    const allStudentViolations = violations.filter((item) => item.nis === v.nis);
    const totalPts = allStudentViolations.reduce((acc, curr) => acc + (Number(curr.points) || 0), 0);

    setSelectedStudentForDossier({
      id: v.student_id,
      nis: v.nis,
      name: v.student_name,
      class: meta.class || "-",
      dorm: meta.dorm || "-",
      consulate: meta.consulate || "-",
      guardian_name: meta.guardian_name || "-",
      guardian_phone: meta.phone || "-",
      photo_url: meta.photo_url || null,
      totalPoints: totalPts,
      violationsCount: allStudentViolations.length,
    });
    setDossierPeriodFilter("all");
  };

  const studentDossierViolations = useMemo(() => {
    if (!selectedStudentForDossier) return [];
    const now = new Date();

    return violations.filter((v) => {
      if (v.nis !== selectedStudentForDossier.nis) return false;
      const createdAt = new Date(v.created_at);

      if (dossierPeriodFilter === "7days") {
        const d = new Date();
        d.setDate(now.getDate() - 7);
        return createdAt >= d;
      }
      if (dossierPeriodFilter === "30days") {
        const d = new Date();
        d.setDate(now.getDate() - 30);
        return createdAt >= d;
      }
      if (dossierPeriodFilter === "semester") {
        const d = new Date();
        d.setMonth(now.getMonth() - 6);
        return createdAt >= d;
      }
      return true;
    });
  }, [violations, selectedStudentForDossier, dossierPeriodFilter]);

  const dossierFilteredPoints = useMemo(() => {
    return studentDossierViolations.reduce((acc, curr) => acc + (Number(curr.points) || 0), 0);
  }, [studentDossierViolations]);

  const handlePrintStudentDossier = () => {
    if (!selectedStudentForDossier) return;
    const prevTitle = document.title;
    const periodLabel =
      dossierPeriodFilter === "7days"
        ? "1_Minggu_Terakhir"
        : dossierPeriodFilter === "30days"
        ? "1_Bulan_Terakhir"
        : dossierPeriodFilter === "semester"
        ? "1_Semester_Terakhir"
        : "Selama_Mondok";

    document.title = `Rapor_Disiplin_${selectedStudentForDossier.name.replace(/\s+/g, "_")}_(${periodLabel})`;
    window.print();
    setTimeout(() => {
      document.title = prevTitle;
    }, 1000);
  };

  // ===========================================================================
  // 9. DELETE & EDIT ACTION HANDLERS
  // ===========================================================================
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("violations").delete().eq("id", itemToDelete.id);
      if (error) throw error;
      playScanSound("success");
      setViolations((prev) => prev.filter((v) => v.id !== itemToDelete.id));
      setSelectedIds((prev) => prev.filter((id) => id !== itemToDelete.id));
      setItemToDelete(null);
    } catch (err: any) {
      playScanSound("error");
      alert("Gagal menghapus: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("violations")
        .update({ status: editStatus, sanction: editSanction.trim() })
        .eq("id", editingItem.id);
      if (error) throw error;
      playScanSound("success");
      await fetchData();
      setEditingItem(null);
    } catch (err: any) {
      playScanSound("error");
      alert("Gagal memperbarui: " + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveBatchEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) return;
    setIsBatchUpdating(true);
    try {
      const payload: any = { status: batchStatus };
      if (updateSanctionToo && batchSanction.trim()) payload.sanction = batchSanction.trim();
      const { error } = await supabase.from("violations").update(payload).in("id", selectedIds);
      if (error) throw error;
      playScanSound("success");
      await fetchData();
      setShowBatchEditModal(false);
      setSelectedIds([]);
    } catch (err: any) {
      playScanSound("error");
      alert("Gagal edit massal: " + err.message);
    } finally {
      setIsBatchUpdating(false);
    }
  };

  const handleConfirmBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsBatchDeleting(true);
    try {
      const { error } = await supabase.from("violations").delete().in("id", selectedIds);
      if (error) throw error;
      playScanSound("success");
      setViolations((prev) => prev.filter((v) => !selectedIds.includes(v.id)));
      setSelectedIds([]);
      setShowBatchDeleteModal(false);
    } catch (err: any) {
      playScanSound("error");
      alert("Gagal hapus massal: " + err.message);
    } finally {
      setIsBatchDeleting(false);
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto font-sans relative pb-24">
      {/* ================= STRICT CSS PRINT ENGINE ================= */}
      <style jsx global>{`
        @media print {
          aside,
          header,
          nav,
          footer,
          .print\\:hidden,
          .no-print {
            display: none !important;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 10mm !important;
          }
          #printable-individual-dossier,
          #printable-report-area {
            display: block !important;
          }
        }
      `}</style>

      {/* ================= HEADER HERO BANNER ================= */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 p-4 sm:p-5 shadow-sm backdrop-blur-xl print:hidden">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="flex items-center space-x-3.5 min-w-0">
            <Link
              href="/dashboard"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 transition active:scale-95"
              title="Kembali ke Dashboard"
            >
              <ArrowLeft className="h-4 w-4 stroke-[2.4]" />
            </Link>

            <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-amber-600 text-white shadow-md shadow-rose-500/20">
              <ShieldAlert className="h-6 w-6 stroke-[2.3]" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg lg:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Biro Pelanggaran &amp; Kedisiplinan
                </h1>
                <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 border border-rose-500/20 whitespace-nowrap">
                  Tarbiyah Board
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                Rekapitulasi berkas disiplin, tracking rekam jejak santri, dan ekspor data komprehensif
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap self-start xl:self-center">
            <button
              type="button"
              onClick={fetchData}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 shadow-xs transition hover:border-rose-500/50 hover:text-rose-500 active:scale-95 cursor-pointer"
              title="Segarkan Data"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-rose-500" : ""}`} />
            </button>

            {/* SCAN QR KTS BUTTON */}
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="inline-flex items-center space-x-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 px-3 py-2 text-xs font-bold transition active:scale-95 shadow-xs whitespace-nowrap cursor-pointer"
              title="Pindai QR KTS untuk membuka rekam jejak santri secara instan"
            >
              <QrCode className="h-4 w-4" />
              <span>Scan QR KTS</span>
              <Sparkles className="h-3 w-3 opacity-60 animate-pulse" />
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center space-x-1.5 rounded-xl border border-emerald-600/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-3 py-2 text-xs font-bold transition active:scale-95 shadow-xs whitespace-nowrap cursor-pointer"
              title="Unduh format CSV/Excel"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Ekspor Excel</span>
            </button>

            <button
              type="button"
              onClick={handlePrintGlobalReport}
              className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 transition active:scale-95 shadow-xs whitespace-nowrap cursor-pointer"
              title="Cetak format Laporan"
            >
              <Printer className="h-4 w-4" />
              <span>Cetak Laporan</span>
            </button>

            <Link
              href="/dashboard/violations/create"
              className="inline-flex items-center space-x-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 px-3.5 py-2 text-xs font-black text-white shadow-md shadow-rose-500/20 transition active:scale-95 whitespace-nowrap cursor-pointer"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>Catat Pelanggaran</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ================= KARTU METRIK REKAPITULASI ================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 print:hidden">
        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 p-4 sm:p-5 shadow-xs backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Kasus</span>
            <div className="h-8 w-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
              <Scale className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-2 font-mono">{stats.totalCases}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Rekapitulasi Global</p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 p-4 sm:p-5 shadow-xs backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Akumulasi Poin</span>
            <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Flame className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-500 mt-2 font-mono">{stats.totalPoints}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Beban Poin Tercatat</p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 p-4 sm:p-5 shadow-xs backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Dalam Proses</span>
            <div className="h-8 w-8 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-2 font-mono">{stats.inProcess}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Menunggu Pembinaan</p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 p-4 sm:p-5 shadow-xs backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Pelanggaran Berat</span>
            <div className="h-8 w-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-rose-500 mt-2 font-mono">{stats.heavyCases}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Tindak Lanjut SP</p>
        </div>
      </div>

      {/* ================= TOOLBAR FILTER ================= */}
      <div className="space-y-2.5 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-lg group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 transition-colors group-focus-within:text-rose-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama santri, NIS, atau bentuk pelanggaran..."
              className="h-10 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 pl-10 pr-4 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none transition focus:border-rose-500 focus:ring-1 focus:ring-rose-500 shadow-xs"
            />
          </div>

          <div className="flex items-center overflow-x-auto gap-1 rounded-2xl bg-slate-100/90 dark:bg-slate-950/70 p-1 border border-slate-200 dark:border-slate-800 text-xs font-bold self-start md:self-auto">
            {[
              { id: "all", label: "Semua", count: violations.length },
              { id: "Proses", label: "Proses", count: violations.filter((v) => v.status === "Proses").length },
              { id: "Ditindak", label: "Ditindak", count: violations.filter((v) => v.status === "Ditindak").length },
              { id: "Selesai", label: "Selesai", count: violations.filter((v) => v.status === "Selesai").length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all duration-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  activeTab === tab.id ? "bg-rose-500 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="relative">
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value as any)}
              className="h-10 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-rose-500 cursor-pointer shadow-xs"
            >
              <option value="all">Periode: Semua Waktu</option>
              <option value="7days">1 Minggu Terakhir (7 Hari)</option>
              <option value="30days">1 Bulan Terakhir (30 Hari)</option>
              <option value="semester">1 Semester Terakhir (6 Bulan)</option>
              <option value="custom">Rentang Tanggal Khusus...</option>
            </select>
          </div>

          <div className="relative">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="h-10 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-rose-500 cursor-pointer shadow-xs"
            >
              <option value="all">Semua Kategori</option>
              <option value="Ringan">Kategori: Ringan</option>
              <option value="Sedang">Kategori: Sedang</option>
              <option value="Berat">Kategori: Berat</option>
            </select>
          </div>

          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-10 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-rose-500 cursor-pointer shadow-xs"
            >
              <option value="newest">Urutkan: Kasus Terbaru</option>
              <option value="oldest">Urutkan: Kasus Terlama</option>
              <option value="points_high">Poin Tertinggi (Beban Berat)</option>
              <option value="points_low">Poin Terendah</option>
              <option value="name_asc">Nama Santri (A - Z)</option>
            </select>
          </div>
        </div>

        {filterPeriod === "custom" && (
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3 text-xs animate-in fade-in">
            <span className="font-bold text-slate-700 dark:text-slate-300">Dari:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="h-8 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 font-bold text-slate-900 dark:text-white outline-none"
            />
            <span className="font-bold text-slate-700 dark:text-slate-300">Sampai:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="h-8 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 font-bold text-slate-900 dark:text-white outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setCustomStartDate("");
                setCustomEndDate("");
              }}
              className="text-xs text-rose-500 hover:underline font-bold ml-auto cursor-pointer"
            >
              Reset Tanggal
            </button>
          </div>
        )}
      </div>

      {/* ================= DATA PELANGGARAN: RESPONSIVE DUAL VIEW ================= */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 shadow-xl shadow-slate-200/30 dark:shadow-black/40 backdrop-blur-xl print:hidden">
        
        {/* TAMPILAN 1: MOBILE CARD LIST (Layar HP < md) */}
        <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800/60">
          <div className="p-3 bg-slate-50/90 dark:bg-slate-950/60 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="inline-flex items-center space-x-2 text-xs font-bold text-slate-600 dark:text-slate-300"
            >
              {isAllFilteredSelected ? (
                <CheckSquare className="h-4 w-4 text-rose-500" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              <span>Pilih Semua ({filteredViolations.length})</span>
            </button>
          </div>

          {loading ? (
            <div className="py-16 text-center text-slate-400">
              <RefreshCw className="h-7 w-7 animate-spin mx-auto mb-2 text-rose-500" />
              <span className="text-xs font-semibold">Memuat rekaman kedisiplinan...</span>
            </div>
          ) : filteredViolations.length === 0 ? (
            <div className="py-16 text-center text-slate-400 p-6 space-y-3">
              <ShieldAlert className="h-10 w-10 mx-auto text-slate-400 opacity-40" />
              <div>
                <p className="font-bold text-sm text-slate-700 dark:text-slate-300">Tidak ada catatan pelanggaran</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Tidak ditemukan data kedisiplinan yang sesuai filter.</p>
              </div>
            </div>
          ) : (
            filteredViolations.map((v) => {
              const isSelected = selectedIds.includes(v.id);
              const meta = studentsMap[v.nis] || {};

              return (
                <div
                  key={v.id}
                  className={`p-4 space-y-3 transition-colors ${
                    isSelected ? "bg-rose-500/[0.08] dark:bg-rose-950/30" : "hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(v.id)}
                      className="mt-1 rounded text-rose-600 focus:ring-rose-500 cursor-pointer h-4 w-4 shrink-0"
                    />

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <div className="relative h-9 w-9 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-black text-xs overflow-hidden flex items-center justify-center">
                            {meta.photo_url ? (
                              <img src={meta.photo_url} alt={v.student_name} className="h-full w-full object-cover" />
                            ) : (
                              v.student_name.charAt(0)
                            )}
                          </div>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => handleOpenStudentDossier(v)}
                              className="font-extrabold text-sm text-slate-900 dark:text-white truncate hover:underline text-left block"
                            >
                              {v.student_name}
                            </button>
                            <p className="font-mono text-[11px] text-slate-500">
                              NIS: <strong className="text-cyan-600 dark:text-cyan-400">{v.nis}</strong> • {meta.class || "-"}
                            </p>
                          </div>
                        </div>

                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-black font-mono bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-lg shrink-0">
                          +{v.points}
                        </span>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-950/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
                        <p className="font-bold text-xs text-slate-900 dark:text-white leading-tight">
                          {v.violation_name}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <span
                            className={`rounded-md px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider ${
                              v.category === "Berat"
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                : v.category === "Sedang"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                : "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20"
                            }`}
                          >
                            {v.category}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(v.created_at).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                        {v.sanction && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 pt-1">
                            <strong className="text-slate-400">Takzir:</strong> {v.sanction}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1 text-xs">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            v.status === "Proses"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                              : v.status === "Ditindak"
                              ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          }`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          <span>{v.status}</span>
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenStudentDossier(v)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-cyan-500"
                            title="Rekam Jejak"
                          >
                            <History className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingItem(v);
                              setEditStatus(v.status);
                              setEditSanction(v.sanction || "");
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-amber-500"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setItemToDelete(v)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-rose-500"
                            title="Hapus"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* TAMPILAN 2: DESKTOP TABLE VIEW (Layar md ke atas) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/90 dark:bg-slate-950/60 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none">
                <th className="py-4 px-3 w-10 text-center">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="p-1 rounded-md text-slate-400 hover:text-rose-500 transition cursor-pointer"
                  >
                    {isAllFilteredSelected ? (
                      <CheckSquare className="h-4 w-4 text-rose-500" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="py-4 px-4 font-bold">Santri &amp; Identitas</th>
                <th className="py-4 px-4 font-bold">Pelanggaran &amp; Kategori</th>
                <th className="py-4 px-4 font-bold text-center">Beban Poin</th>
                <th className="py-4 px-4 font-bold">Bentuk Sanksi / Takzir</th>
                <th className="py-4 px-4 text-center font-bold">Status</th>
                <th className="py-4 px-4 text-right font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <RefreshCw className="h-7 w-7 animate-spin mx-auto mb-2 text-rose-500" />
                    <span className="text-xs font-semibold">Memuat rekaman kedisiplinan santri...</span>
                  </td>
                </tr>
              ) : filteredViolations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400 space-y-3">
                    <ShieldAlert className="h-10 w-10 mx-auto text-slate-400 opacity-40" />
                    <div>
                      <p className="font-bold text-sm text-slate-700 dark:text-slate-300">Tidak ada catatan pelanggaran</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Tidak ditemukan data kedisiplinan yang sesuai filter.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredViolations.map((v) => {
                  const isSelected = selectedIds.includes(v.id);
                  const meta = studentsMap[v.nis] || {};

                  return (
                    <tr
                      key={v.id}
                      className={`group transition-all duration-200 ${
                        isSelected
                          ? "bg-rose-500/[0.08] dark:bg-rose-950/30"
                          : "hover:bg-rose-500/[0.03] dark:hover:bg-rose-500/[0.02]"
                      }`}
                    >
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(v.id)}
                          className="rounded text-rose-600 focus:ring-rose-500 cursor-pointer h-4 w-4"
                        />
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="relative h-9 w-9 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-black text-xs group-hover:scale-105 transition-transform overflow-hidden flex items-center justify-center">
                            {meta.photo_url ? (
                              <img src={meta.photo_url} alt={v.student_name} className="h-full w-full object-cover" />
                            ) : (
                              v.student_name.charAt(0)
                            )}
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => handleOpenStudentDossier(v)}
                              className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors hover:underline text-left cursor-pointer"
                              title="Klik untuk melihat seluruh riwayat pelanggaran santri ini"
                            >
                              {v.student_name}
                            </button>
                            <p className="font-mono text-[11px] text-slate-500">
                              NIS: <span className="font-bold">{v.nis}</span> • {meta.class || "-"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-extrabold text-slate-900 dark:text-white leading-tight">
                          {v.violation_name}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                              v.category === "Berat"
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                : v.category === "Sedang"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                : "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20"
                            }`}
                          >
                            {v.category}
                          </span>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                            <Calendar className="h-3 w-3" />
                            {new Date(v.created_at).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                          {v.document_url && (
                            <a
                              href={v.document_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline"
                            >
                              <FileText className="h-3 w-3" />
                              <span>Bukti Dokumen</span>
                            </a>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-black font-mono bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          +{v.points}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-800 dark:text-slate-200">
                          {v.sanction || "-"}
                        </p>
                        {v.description && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                            {v.description}
                          </p>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                            v.status === "Proses"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                              : v.status === "Ditindak"
                              ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          }`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          <span>{v.status}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            type="button"
                            onClick={() => handleOpenStudentDossier(v)}
                            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-cyan-500 hover:border-cyan-500/40 hover:bg-cyan-500/10 transition active:scale-90 cursor-pointer"
                            title="Lihat Rekam Jejak Santri"
                          >
                            <History className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingItem(v);
                              setEditStatus(v.status);
                              setEditSanction(v.sanction || "");
                            }}
                            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-amber-500 hover:border-amber-500/40 hover:bg-amber-500/10 transition active:scale-90 cursor-pointer"
                            title="Ubah Status & Sanksi"
                          >
                            <Edit className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setItemToDelete(v)}
                            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-rose-500 hover:border-rose-500/40 hover:bg-rose-500/10 transition active:scale-90 cursor-pointer"
                            title="Hapus Catatan Pelanggaran"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= FLOATING BATCH ACTION BAR ================= */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-2xl bg-slate-900/95 border border-slate-800 text-white px-5 py-3.5 rounded-3xl shadow-2xl backdrop-blur-xl flex items-center justify-between gap-4 animate-in slide-in-from-bottom-5 duration-200 print:hidden">
          <div className="flex items-center space-x-3">
            <span className="h-7 w-7 rounded-xl bg-rose-500 text-white flex items-center justify-center font-black text-xs">
              {selectedIds.length}
            </span>
            <span className="text-xs font-bold text-slate-200">Pelanggaran Terpilih</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowBatchEditModal(true)}
              className="inline-flex items-center space-x-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 px-3.5 py-2 text-xs font-bold transition active:scale-95 cursor-pointer"
            >
              <Edit className="h-3.5 w-3.5" />
              <span>Edit Status Massal</span>
            </button>

            <button
              type="button"
              onClick={() => setShowBatchDeleteModal(true)}
              className="inline-flex items-center space-x-1.5 rounded-xl bg-rose-600/20 text-rose-300 border border-rose-600/30 hover:bg-rose-600/30 px-3.5 py-2 text-xs font-bold transition active:scale-95 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Hapus Massal</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-slate-400 hover:text-white p-2 rounded-xl transition cursor-pointer"
              title="Batalkan Pilihan"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL DOSSIER REKAM JEJAK SANTRI (DENGAN TOMBOL INPUT PELANGGARAN INSTAN) ================= */}
      {selectedStudentForDossier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 sm:p-6 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200 print:hidden">
          <div className="w-full max-w-3xl my-auto overflow-hidden rounded-[32px] border border-slate-800 bg-slate-900 text-white space-y-5 p-6 sm:p-8 shadow-2xl animate-in zoom-in-95">
            {/* Header Profil Santri */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between border-b border-slate-800 pb-5 gap-5">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
                <div className="relative h-[115px] w-[90px] shrink-0 rounded-2xl overflow-hidden border-2 border-cyan-500/50 bg-slate-800 shadow-xl flex items-center justify-center">
                  {selectedStudentForDossier.photo_url ? (
                    <img
                      src={selectedStudentForDossier.photo_url}
                      alt={selectedStudentForDossier.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <User className="h-10 w-10 stroke-[1.5]" />
                      <span className="text-[9px] font-bold mt-1 uppercase text-slate-500">No Photo</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
                    <h2 className="text-lg sm:text-xl font-black text-white">
                      {selectedStudentForDossier.name}
                    </h2>
                    <span className="rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 font-mono text-xs font-bold">
                      NIS: {selectedStudentForDossier.nis}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-300 pt-1">
                    <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                      <GraduationCap className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Kelas: <strong>{selectedStudentForDossier.class}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                      <Home className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Asrama: <strong>{selectedStudentForDossier.dorm}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                      <MapPin className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Konsulat: <strong>{selectedStudentForDossier.consulate}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                      <Phone className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Wali: <strong>{selectedStudentForDossier.guardian_phone || "-"}</strong></span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedStudentForDossier(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition cursor-pointer self-end sm:self-auto"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Statistik Ringkas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
                <p className="text-slate-400 text-[10px] uppercase font-bold">Kasus Periode Ini</p>
                <p className="text-lg font-black text-white font-mono mt-0.5">{studentDossierViolations.length} Kasus</p>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
                <p className="text-slate-400 text-[10px] uppercase font-bold">Poin Periode Ini</p>
                <p className="text-lg font-black text-rose-400 font-mono mt-0.5">+{dossierFilteredPoints} Poin</p>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
                <p className="text-slate-400 text-[10px] uppercase font-bold">Selesai Dibina</p>
                <p className="text-lg font-black text-emerald-400 font-mono mt-0.5">
                  {studentDossierViolations.filter((v) => v.status === "Selesai").length} Kasus
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
                <p className="text-slate-400 text-[10px] uppercase font-bold">Status Disiplin</p>
                <p className="text-xs font-bold text-amber-300 mt-1">Dalam Pengawasan</p>
              </div>
            </div>

            {/* Filter Periode Timeline Santri */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-800">
              <div className="flex items-center space-x-1 text-xs font-bold text-slate-400">
                <History className="h-4 w-4 text-cyan-400" />
                <span>Riwayat Periode:</span>
              </div>

              <div className="flex items-center overflow-x-auto gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
                {[
                  { id: "all", label: "Selama Mondok" },
                  { id: "7days", label: "1 Minggu Terakhir" },
                  { id: "30days", label: "1 Bulan Terakhir" },
                  { id: "semester", label: "1 Semester Terakhir" },
                ].map((btn) => (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => setDossierPeriodFilter(btn.id as any)}
                    className={`px-3 py-1 rounded-lg transition text-[11px] whitespace-nowrap cursor-pointer ${
                      dossierPeriodFilter === btn.id
                        ? "bg-cyan-500 text-slate-950 font-black shadow-xs"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            {/* List Kronologis Rekam Jejak Pelanggaran Santri */}
            <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2.5 pr-1">
              {studentDossierViolations.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs font-medium">
                  Tidak ada catatan pelanggaran pada periode ini.
                </div>
              ) : (
                studentDossierViolations.map((v, i) => (
                  <div
                    key={v.id}
                    className="p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-1.5 text-xs hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-[10px] text-slate-400">#{i + 1}</span>
                        <span className="font-bold text-white text-sm">{v.violation_name}</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          v.category === "Berat"
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            : v.category === "Sedang"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                        }`}>
                          {v.category}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-rose-400">+{v.points} Poin</span>
                    </div>

                    <p className="text-slate-300 text-xs">
                      <span className="text-slate-500 font-semibold">Takzir/Sanksi:</span> {v.sanction || "-"}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-900">
                      <span>Tanggal: {new Date(v.created_at).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}</span>
                      <span className="font-bold text-slate-300">Status: {v.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer Modal: Tombol Input Pelanggaran Instan, Cetak Rapor, & Tutup */}
            <div className="flex flex-col sm:flex-row items-center justify-between pt-3 border-t border-slate-800 gap-2.5">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Link
                  href={`/dashboard/violations/create?nis=${selectedStudentForDossier.nis}`}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-black text-xs shadow-md shadow-rose-500/20 transition active:scale-95 cursor-pointer"
                >
                  <Plus className="h-4 w-4 stroke-[2.5]" />
                  <span>+ Catat Pelanggaran Santri Ini</span>
                </Link>

                <button
                  type="button"
                  onClick={handlePrintStudentDossier}
                  disabled={studentDossierViolations.length === 0}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition active:scale-95 disabled:opacity-40 cursor-pointer"
                >
                  <Printer className="h-4 w-4 stroke-[2.5]" />
                  <span>Cetak Rapor</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedStudentForDossier(null)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Tutup Rapor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL EDIT MASSAL ================= */}
      {showBatchEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/95 p-6 text-white space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">Edit {selectedIds.length} Pelanggaran Sekaligus</h3>
                  <p className="text-[11px] text-slate-400">Pembaruan status massal santri terpilih</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchEditModal(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBatchEdit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-300">Ubah Status Pembinaan Menjadi:</label>
                <select
                  value={batchStatus}
                  onChange={(e) => setBatchStatus(e.target.value as any)}
                  className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 font-bold text-amber-400 outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="Proses">Dalam Proses</option>
                  <option value="Ditindak">Sudah Ditindak</option>
                  <option value="Selesai">Selesai Dibina</option>
                </select>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-300">
                  <input
                    type="checkbox"
                    checked={updateSanctionToo}
                    onChange={(e) => setUpdateSanctionToo(e.target.checked)}
                    className="rounded text-amber-500 focus:ring-amber-500 h-4 w-4"
                  />
                  <span>Perbarui Bentuk Sanksi / Takzir Massal</span>
                </label>

                {updateSanctionToo && (
                  <textarea
                    rows={2}
                    value={batchSanction}
                    onChange={(e) => setBatchSanction(e.target.value)}
                    placeholder="Tuliskan sanksi baru untuk semua santri yang dipilih..."
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white outline-none focus:border-amber-500"
                  />
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBatchEditModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isBatchUpdating}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  {isBatchUpdating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 stroke-[3]" />}
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL HAPUS MASSAL ================= */}
      {showBatchDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-6 text-white space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center space-x-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/30">
                <Trash2 className="h-6 w-6 stroke-[2.3]" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Hapus {selectedIds.length} Catatan?</h3>
                <p className="text-xs text-slate-400">Data pelanggaran yang dipilih akan dihapus permanen</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
              Apakah Anda yakin ingin menghapus <strong>{selectedIds.length} catatan kedisiplinan</strong> sekaligus?
            </p>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowBatchDeleteModal(false)}
                disabled={isBatchDeleting}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmBatchDelete}
                disabled={isBatchDeleting}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                {isBatchDeleting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                <span>Ya, Hapus Semua</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL HAPUS SINGLE ================= */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-slate-800 bg-slate-900/95 p-6 text-white space-y-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/30 shadow-lg shadow-rose-500/10 animate-pulse">
                  <AlertTriangle className="h-6 w-6 stroke-[2.3]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white leading-tight">Hapus Catatan Disiplin?</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Data pelanggaran santri akan dihapus permanen</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="text-slate-400 hover:text-white rounded-xl p-1 hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Santri:</span>
                <span className="font-extrabold text-white text-sm">{itemToDelete.student_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">NIS:</span>
                <span className="font-mono font-bold text-cyan-400">{itemToDelete.nis}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-800/80 pt-2">
                <span className="text-slate-400">Pelanggaran:</span>
                <span className="font-semibold text-rose-300 text-right max-w-[220px] truncate">
                  {itemToDelete.violation_name}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                disabled={isDeleting}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 py-3 text-xs font-bold text-slate-300 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 inline-flex items-center justify-center space-x-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 py-3 text-xs font-black text-white shadow-lg shadow-rose-600/30 transition disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                <span>Ya, Hapus Data</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL EDIT SINGLE ================= */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-slate-800 bg-slate-900/95 p-6 text-white space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <Edit className="h-5 w-5 text-amber-400" />
                <div>
                  <h3 className="font-black text-sm text-white">Tindak Lanjut Pelanggaran</h3>
                  <p className="text-[11px] text-slate-400">{editingItem.student_name} ({editingItem.nis})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-300">Status Pembinaan</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 font-bold text-amber-400 outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="Proses">Dalam Proses</option>
                  <option value="Ditindak">Sudah Ditindak</option>
                  <option value="Selesai">Selesai Dibina</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">Bentuk Sanksi / Takzir</label>
                <textarea
                  rows={3}
                  value={editSanction}
                  onChange={(e) => setEditSanction(e.target.value)}
                  placeholder="Keterangan takzir atau tindak lanjut pembinaan..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-white outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-md transition flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  {isUpdating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= TEMPLATE CETAK 1: RAPOR SANTRI PER-INDIVIDU ================= */}
      {selectedStudentForDossier && (
        <div id="printable-individual-dossier" style={{ display: "none" }}>
          <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: "10px", marginBottom: "15px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: "900", textTransform: "uppercase" }}>
              PONDOK PESANTREN RIYADLUL &apos;ULUM WADDA&apos;WAH CONDONG
            </h2>
            <h3 style={{ fontSize: "13px", fontWeight: "800", marginTop: "2px" }}>
              SURAT REKAPITULASI PEMBINAAN &amp; KEDISIPLINAN SANTRI
            </h3>
            <p style={{ fontSize: "9.5px", color: "#475569", marginTop: "2px" }}>
              Bagian Pengasuhan Santri (Tarbiyah &amp; Disiplin) • Cibeureum - Setianegara - Kota Tasikmalaya
            </p>
          </div>

          <table style={{ width: "100%", fontSize: "10.5px", marginBottom: "12px", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ width: "120px", fontWeight: "bold", padding: "2px 0" }}>Nama Lengkap</td>
                <td style={{ width: "10px" }}>:</td>
                <td style={{ fontWeight: "bold", textTransform: "uppercase" }}>{selectedStudentForDossier.name}</td>
                <td style={{ width: "110px", fontWeight: "bold", padding: "2px 0" }}>Kamar / Asrama</td>
                <td style={{ width: "10px" }}>:</td>
                <td>{selectedStudentForDossier.dorm}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: "bold", padding: "2px 0" }}>Nomor Induk (NIS)</td>
                <td>:</td>
                <td style={{ fontFamily: "monospace", fontWeight: "bold" }}>{selectedStudentForDossier.nis}</td>
                <td style={{ fontWeight: "bold", padding: "2px 0" }}>Konsulat Asal</td>
                <td>:</td>
                <td>{selectedStudentForDossier.consulate}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: "bold", padding: "2px 0" }}>Kelas / Jenjang</td>
                <td>:</td>
                <td>{selectedStudentForDossier.class}</td>
                <td style={{ fontWeight: "bold", padding: "2px 0" }}>Wali Santri / WA</td>
                <td>:</td>
                <td>{selectedStudentForDossier.guardian_phone || "-"}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: "bold", padding: "2px 0" }}>Periode Laporan</td>
                <td>:</td>
                <td colSpan={4} style={{ fontWeight: "bold", color: "#0f172a" }}>
                  {dossierPeriodFilter === "7days"
                    ? "1 Minggu Terakhir (7 Hari)"
                    : dossierPeriodFilter === "30days"
                    ? "1 Bulan Terakhir (30 Hari)"
                    : dossierPeriodFilter === "semester"
                    ? "1 Semester Terakhir (6 Bulan)"
                    : "Selama Masa Studi / Mondok"}
                </td>
              </tr>
            </tbody>
          </table>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", marginBottom: "15px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f1f5f9" }}>
                <th style={{ border: "1px solid #000", padding: "5px 3px", textAlign: "center", width: "25px" }}>No</th>
                <th style={{ border: "1px solid #000", padding: "5px", textAlign: "left", width: "80px" }}>Tanggal</th>
                <th style={{ border: "1px solid #000", padding: "5px", textAlign: "left" }}>Bentuk Pelanggaran</th>
                <th style={{ border: "1px solid #000", padding: "5px", textAlign: "center", width: "55px" }}>Kategori</th>
                <th style={{ border: "1px solid #000", padding: "5px", textAlign: "center", width: "40px" }}>Poin</th>
                <th style={{ border: "1px solid #000", padding: "5px", textAlign: "left" }}>Sanksi / Tindak Lanjut</th>
                <th style={{ border: "1px solid #000", padding: "5px", textAlign: "center", width: "65px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {studentDossierViolations.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ border: "1px solid #000", padding: "12px", textAlign: "center", fontStyle: "italic" }}>
                    Tidak ada catatan pelanggaran pada periode ini.
                  </td>
                </tr>
              ) : (
                studentDossierViolations.map((v, i) => (
                  <tr key={v.id}>
                    <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>{i + 1}</td>
                    <td style={{ border: "1px solid #000", padding: "4px" }}>
                      {new Date(v.created_at).toLocaleDateString("id-ID")}
                    </td>
                    <td style={{ border: "1px solid #000", padding: "4px" }}>
                      <strong>{v.violation_name}</strong>
                    </td>
                    <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>{v.category}</td>
                    <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center", fontWeight: "bold" }}>+{v.points}</td>
                    <td style={{ border: "1px solid #000", padding: "4px" }}>{v.sanction || "-"}</td>
                    <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>{v.status}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: "#f8fafc", fontWeight: "bold" }}>
                <td colSpan={4} style={{ border: "1px solid #000", padding: "5px", textAlign: "right" }}>
                  TOTAL AKUMULASI BEBAN POIN PERIODE INI:
                </td>
                <td style={{ border: "1px solid #000", padding: "5px", textAlign: "center", color: "#b91c1c" }}>
                  +{dossierFilteredPoints}
                </td>
                <td colSpan={2} style={{ border: "1px solid #000", padding: "5px" }}>
                  Total: {studentDossierViolations.length} Kasus Pelanggaran
                </td>
              </tr>
            </tfoot>
          </table>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "25px", fontSize: "10.5px", padding: "0 15px" }}>
            <div style={{ textAlign: "center" }}>
              <p>Mengetahui,</p>
              <p style={{ fontWeight: "bold" }}>Orang Tua / Wali Santri</p>
              <div style={{ height: "45px" }} />
              <p style={{ fontWeight: "bold", textDecoration: "underline" }}>( ........................................ )</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p>Tasikmalaya, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
              <p style={{ fontWeight: "bold" }}>Bagian Pengasuhan Santri</p>
              <div style={{ height: "45px" }} />
              <p style={{ fontWeight: "bold", textDecoration: "underline" }}>( Ust. Pengasuhan Santri )</p>
            </div>
          </div>
        </div>
      )}

      {/* ================= TEMPLATE CETAK 2: LAPORAN GLOBAL SEMUA SANTRI ================= */}
      {!selectedStudentForDossier && (
        <div id="printable-report-area" style={{ display: "none" }}>
          <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: "10px", marginBottom: "15px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: "900", textTransform: "uppercase" }}>
              PONDOK PESANTREN RIYADLUL &apos;ULUM WADDA&apos;WAH CONDONG
            </h2>
            <h3 style={{ fontSize: "14px", fontWeight: "800", marginTop: "2px" }}>
              LAPORAN REKAPITULASI PELANGGARAN &amp; KEDISIPLINAN SANTRI
            </h3>
            <p style={{ fontSize: "10px", color: "#475569", marginTop: "2px" }}>
              Cibeureum - Setianegara - Kota Tasikmalaya • Dicetak pada: {new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}
            </p>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f1f5f9", border: "1px solid #000" }}>
                <th style={{ border: "1px solid #000", padding: "6px 4px", textAlign: "center", width: "25px" }}>No</th>
                <th style={{ border: "1px solid #000", padding: "6px", textAlign: "left" }}>Santri &amp; NIS</th>
                <th style={{ border: "1px solid #000", padding: "6px", textAlign: "left" }}>Kelas / Asrama</th>
                <th style={{ border: "1px solid #000", padding: "6px", textAlign: "left" }}>Bentuk Pelanggaran</th>
                <th style={{ border: "1px solid #000", padding: "6px", textAlign: "center", width: "40px" }}>Poin</th>
                <th style={{ border: "1px solid #000", padding: "6px", textAlign: "left" }}>Takzir / Sanksi</th>
                <th style={{ border: "1px solid #000", padding: "6px", textAlign: "center", width: "60px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredViolations.map((v, i) => {
                const meta = studentsMap[v.nis] || {};
                return (
                  <tr key={v.id} style={{ border: "1px solid #000" }}>
                    <td style={{ border: "1px solid #000", padding: "5px", textAlign: "center" }}>{i + 1}</td>
                    <td style={{ border: "1px solid #000", padding: "5px" }}>
                      <strong>{v.student_name}</strong>
                      <div style={{ fontSize: "8.5px", color: "#475569" }}>NIS: {v.nis}</div>
                    </td>
                    <td style={{ border: "1px solid #000", padding: "5px" }}>
                      {meta.class || "-"} / {meta.dorm || "-"}
                    </td>
                    <td style={{ border: "1px solid #000", padding: "5px" }}>
                      <strong>{v.violation_name}</strong>
                      <div style={{ fontSize: "8.5px", color: "#64748b" }}>
                        Kategori: {v.category} • {new Date(v.created_at).toLocaleDateString("id-ID")}
                      </div>
                    </td>
                    <td style={{ border: "1px solid #000", padding: "5px", textAlign: "center", fontWeight: "bold" }}>
                      +{v.points}
                    </td>
                    <td style={{ border: "1px solid #000", padding: "5px" }}>
                      {v.sanction || "-"}
                    </td>
                    <td style={{ border: "1px solid #000", padding: "5px", textAlign: "center" }}>
                      {v.status}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "30px", fontSize: "11px", padding: "0 20px" }}>
            <div style={{ textAlign: "center" }}>
              <p>Mengetahui,</p>
              <p style={{ fontWeight: "bold" }}>Kepala Bagian Pengasuhan Santri</p>
              <div style={{ height: "50px" }} />
              <p style={{ fontWeight: "bold", textDecoration: "underline" }}>( ........................................ )</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p>Tasikmalaya, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
              <p style={{ fontWeight: "bold" }}>Petugas Pencatat Kedisiplinan</p>
              <div style={{ height: "50px" }} />
              <p style={{ fontWeight: "bold", textDecoration: "underline" }}>( Ust. Pengasuhan Santri )</p>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL SCANNER KTS ================= */}
      <QRScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScanSuccess={handleScanSuccess}
        title="Pemindai KTS Santri (Kedisiplinan)"
        description="Arahkan kamera ke QR Code KTS santri untuk melihat berkas disiplin"
      />
    </div>
  );
}