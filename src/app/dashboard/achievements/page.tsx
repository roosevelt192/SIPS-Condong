"use client";

// =============================================================================
// 1. IMPORT DEPENDENCIES & ICONS
// =============================================================================
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Trophy,
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
  Medal,
  Award,
  Globe2,
  Sparkles,
  ExternalLink,
  ArrowLeft,
  Star,
  Save,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// =============================================================================
// 2. INTERFACE DATA TYPES
// =============================================================================
interface AchievementRecord {
  id: string;
  student_id?: string;
  student_name: string;
  nis: string;
  title: string;
  category: string;
  level: string;
  reward_points: number;
  appreciation?: string;
  description?: string;
  certificate_url?: string;
  event_date: string;
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
  totalRewardPoints: number;
  achievementsCount: number;
}

interface RawStudent {
  id: string;
  nis: string;
  full_name?: string;
  name?: string;
  nama?: string;
  kelas?: string;
  class_name?: string;
  class?: string;
  kamar_asrama?: string;
  dorm?: string;
  room?: string;
  asrama?: string;
  asal_konsulat?: string;
  consulate?: string;
  origin_region?: string;
  nama_lengkap_wali?: string;
  guardian_name?: string;
  nama_wali?: string;
  no_whatsapp?: string;
  guardian_phone?: string;
  phone?: string;
  photo_url?: string | null;
  foto?: string | null;
}

export default function AchievementsPage() {
  // ===========================================================================
  // 3. STATE MANAGEMENT
  // ===========================================================================
  const [achievements, setAchievements] = useState<AchievementRecord[]>([]);
  const [rawStudents, setRawStudents] = useState<RawStudent[]>([]);
  const [studentsMap, setStudentsMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState<"all" | "7days" | "30days" | "semester" | "custom">("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "points_high" | "points_low" | "name_asc">("newest");

  // Selection State (Multi Checkbox)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Single Delete State
  const [itemToDelete, setItemToDelete] = useState<AchievementRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal Catat Prestasi Baru (Create Modal)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createSearchStudent, setCreateSearchStudent] = useState("");
  const [selectedStudentForCreate, setSelectedStudentForCreate] = useState<RawStudent | null>(null);
  const [createTitle, setCreateTitle] = useState("");
  const [createCategory, setCreateCategory] = useState("Tahfidz / Al-Qur'an");
  const [createLevel, setCreateLevel] = useState("Kabupaten / Kota");
  const [createEventDate, setCreateEventDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [createRewardPoints, setCreateRewardPoints] = useState<number>(20);
  const [createAppreciation, setCreateAppreciation] = useState("Piagam Penghargaan");
  const [createDescription, setCreateDescription] = useState("");
  const [createCertificateUrl, setCreateCertificateUrl] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Comprehensive Edit Modal State
  const [editingItem, setEditingItem] = useState<AchievementRecord | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("Tahfidz / Al-Qur'an");
  const [editLevel, setEditLevel] = useState("Kabupaten / Kota");
  const [editEventDate, setEditEventDate] = useState("");
  const [editRewardPoints, setEditRewardPoints] = useState<number>(20);
  const [editAppreciation, setEditAppreciation] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [editError, setEditError] = useState("");

  // Batch (Massal) States
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  // Individual Student Tracking (Dossier Modal)
  const [selectedStudentForDossier, setSelectedStudentForDossier] = useState<StudentSummary | null>(null);
  const [dossierPeriodFilter, setDossierPeriodFilter] = useState<"all" | "7days" | "30days" | "semester">("all");

  // ===========================================================================
  // 4. FETCH DATA ACHIEVEMENTS & STUDENTS
  // ===========================================================================
  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: stData } = await supabase.from("students").select("*");
      if (stData) setRawStudents(stData);

      const stLookup: Record<string, any> = {};
      (stData || []).forEach((st: any) => {
        const nisKey = String(st.nis || "").trim();
        stLookup[nisKey] = {
          class: st.kelas || st.class_name || st.class || "-",
          dorm: st.kamar_asrama || st.dorm || st.room || st.asrama || "-",
          consulate: st.asal_konsulat || st.consulate || st.origin_region || "-",
          guardian_name: st.nama_lengkap_wali || st.guardian_name || st.nama_wali || "-",
          phone: st.no_whatsapp || st.guardian_phone || st.phone || "-",
          photo_url: st.photo_url || st.foto || null,
        };
      });
      setStudentsMap(stLookup);

      const { data: achData, error } = await supabase
        .from("achievements")
        .select("*")
        .order("created_at", { ascending: false })
        .range(0, 999);

      if (error) throw error;
      setAchievements(achData || []);
      setSelectedIds([]);
    } catch (err: any) {
      console.warn("Gagal memuat catatan prestasi:", err.message);
    } finally {
      setLoading(false);
    }
  }

  // Auto-point sesuai level prestasi
  const handleLevelPointCalculation = (lvl: string, isEdit = false) => {
    let pts = 20;
    if (lvl === "Internal Pondok") pts = 10;
    else if (lvl === "Kabupaten / Kota") pts = 20;
    else if (lvl === "Provinsi") pts = 35;
    else if (lvl === "Nasional") pts = 50;
    else if (lvl === "Internasional") pts = 100;

    if (isEdit) {
      setEditLevel(lvl);
      setEditRewardPoints(pts);
    } else {
      setCreateLevel(lvl);
      setCreateRewardPoints(pts);
    }
  };

  // ===========================================================================
  // 5. FILTERING, PERIOD & SORTING LOGIC
  // ===========================================================================
  const filteredAchievements = useMemo(() => {
    const now = new Date();

    return achievements
      .filter((a) => {
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch =
          q === "" ||
          a.student_name.toLowerCase().includes(q) ||
          a.nis.toLowerCase().includes(q) ||
          a.title.toLowerCase().includes(q);

        const matchesCategory = filterCategory === "all" || a.category === filterCategory;
        const matchesLevel = filterLevel === "all" || a.level === filterLevel;

        let matchesPeriod = true;
        const targetDate = new Date(a.event_date || a.created_at);

        if (filterPeriod === "7days") {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(now.getDate() - 7);
          matchesPeriod = targetDate >= sevenDaysAgo;
        } else if (filterPeriod === "30days") {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(now.getDate() - 30);
          matchesPeriod = targetDate >= thirtyDaysAgo;
        } else if (filterPeriod === "semester") {
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(now.getMonth() - 6);
          matchesPeriod = targetDate >= sixMonthsAgo;
        } else if (filterPeriod === "custom") {
          if (customStartDate) {
            matchesPeriod = matchesPeriod && targetDate >= new Date(`${customStartDate}T00:00:00`);
          }
          if (customEndDate) {
            matchesPeriod = matchesPeriod && targetDate <= new Date(`${customEndDate}T23:59:59`);
          }
        }

        return matchesSearch && matchesCategory && matchesLevel && matchesPeriod;
      })
      .sort((a, b) => {
        if (sortBy === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (sortBy === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (sortBy === "points_high") return Number(b.reward_points) - Number(a.reward_points);
        if (sortBy === "points_low") return Number(a.reward_points) - Number(b.reward_points);
        if (sortBy === "name_asc") return a.student_name.localeCompare(b.student_name);
        return 0;
      });
  }, [achievements, searchQuery, filterCategory, filterLevel, filterPeriod, customStartDate, customEndDate, sortBy]);

  const stats = useMemo(() => {
    const totalAchievements = achievements.length;
    const totalPointsAwarded = achievements.reduce((acc, curr) => acc + (Number(curr.reward_points) || 0), 0);
    const nationalGlobalCount = achievements.filter((a) => a.level === "Nasional" || a.level === "Internasional").length;
    const tahfidzCount = achievements.filter((a) => a.category?.includes("Tahfidz") || a.category?.includes("Qur")).length;
    return { totalAchievements, totalPointsAwarded, nationalGlobalCount, tahfidzCount };
  }, [achievements]);

  const isAllFilteredSelected = useMemo(() => {
    if (filteredAchievements.length === 0) return false;
    return filteredAchievements.every((a) => selectedIds.includes(a.id));
  }, [filteredAchievements, selectedIds]);

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      const filteredIdSet = new Set(filteredAchievements.map((a) => a.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
    } else {
      const newIds = new Set([...selectedIds, ...filteredAchievements.map((v) => v.id)]);
      setSelectedIds(Array.from(newIds));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // ===========================================================================
  // 6. ACTION: CREATE ACHIEVEMENT
  // ===========================================================================
  const handleSaveCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForCreate) {
      setCreateError("Silakan cari dan pilih santri yang bersangkutan.");
      return;
    }
    if (!createTitle.trim()) {
      setCreateError("Nama kejuaraan / capaian prestasi wajib diisi.");
      return;
    }

    setIsCreating(true);
    setCreateError("");
    try {
      const studentFullName = selectedStudentForCreate.full_name || selectedStudentForCreate.name || selectedStudentForCreate.nama || "Santri";
      const payload = {
        student_id: selectedStudentForCreate.id,
        student_name: studentFullName,
        nis: selectedStudentForCreate.nis,
        title: createTitle.trim(),
        category: createCategory,
        level: createLevel,
        event_date: createEventDate,
        reward_points: Number(createRewardPoints),
        appreciation: createAppreciation.trim() || "Piagam Penghargaan",
        description: createDescription.trim() || null,
        certificate_url: createCertificateUrl.trim() || null,
      };

      const { error } = await supabase.from("achievements").insert([payload]);
      if (error) throw error;

      setShowCreateModal(false);
      setSelectedStudentForCreate(null);
      setCreateTitle("");
      setCreateDescription("");
      setCreateCertificateUrl("");
      await fetchData();
    } catch (err: any) {
      setCreateError(err.message || "Gagal mencatat prestasi.");
    } finally {
      setIsCreating(false);
    }
  };

  // ===========================================================================
  // 7. EXPORT CSV & PRINT REPORT
  // ===========================================================================
  const handleExportCSV = () => {
    if (filteredAchievements.length === 0) {
      alert("Tidak ada data prestasi untuk diekspor.");
      return;
    }

    const headers = [
      "No",
      "Tanggal Perolehan",
      "NIS",
      "Nama Santri",
      "Kelas",
      "Kamar Asrama",
      "Konsulat Asal",
      "Nama Kejuaraan / Prestasi",
      "Kategori Bidang",
      "Tingkat Wilayah",
      "Reward Poin",
      "Bentuk Apresiasi / Hadiah",
      "Keterangan Tambahan",
    ];

    const rows = filteredAchievements.map((a, idx) => {
      const meta = studentsMap[a.nis] || {};
      const dateFormatted = new Date(a.event_date || a.created_at).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      return [
        idx + 1,
        dateFormatted,
        `'${a.nis}`,
        `"${a.student_name.replace(/"/g, '""')}"`,
        `"${meta.class || "-"}"`,
        `"${meta.dorm || "-"}"`,
        `"${meta.consulate || "-"}"`,
        `"${a.title.replace(/"/g, '""')}"`,
        a.category,
        a.level,
        a.reward_points,
        `"${(a.appreciation || "-").replace(/"/g, '""')}"`,
        `"${(a.description || "-").replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().split("T")[0];

    link.setAttribute("href", url);
    link.setAttribute("download", `Rekap_Prestasi_Santri_${dateStr}_(${filteredAchievements.length}_Data).csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintGlobalReport = () => {
    window.print();
  };

  // ===========================================================================
  // 8. INDIVIDUAL TRACKING & CETAK RAPOR PRESTASI
  // ===========================================================================
  const handleOpenStudentDossier = (a: AchievementRecord) => {
    const meta = studentsMap[a.nis] || {};
    const allStudentAchievements = achievements.filter((item) => item.nis === a.nis);
    const totalPts = allStudentAchievements.reduce((acc, curr) => acc + (Number(curr.reward_points) || 0), 0);

    setSelectedStudentForDossier({
      id: a.student_id || "",
      nis: a.nis,
      name: a.student_name,
      class: meta.class || "-",
      dorm: meta.dorm || "-",
      consulate: meta.consulate || "-",
      guardian_name: meta.guardian_name || "-",
      guardian_phone: meta.phone || "-",
      photo_url: meta.photo_url || null,
      totalRewardPoints: totalPts,
      achievementsCount: allStudentAchievements.length,
    });
    setDossierPeriodFilter("all");
  };

  const studentDossierAchievements = useMemo(() => {
    if (!selectedStudentForDossier) return [];
    const now = new Date();

    return achievements.filter((a) => {
      if (a.nis !== selectedStudentForDossier.nis) return false;
      const targetDate = new Date(a.event_date || a.created_at);

      if (dossierPeriodFilter === "7days") {
        const d = new Date();
        d.setDate(now.getDate() - 7);
        return targetDate >= d;
      }
      if (dossierPeriodFilter === "30days") {
        const d = new Date();
        d.setDate(now.getDate() - 30);
        return targetDate >= d;
      }
      if (dossierPeriodFilter === "semester") {
        const d = new Date();
        d.setMonth(now.getMonth() - 6);
        return targetDate >= d;
      }
      return true;
    });
  }, [achievements, selectedStudentForDossier, dossierPeriodFilter]);

  const dossierFilteredPoints = useMemo(() => {
    return studentDossierAchievements.reduce((acc, curr) => acc + (Number(curr.reward_points) || 0), 0);
  }, [studentDossierAchievements]);

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

    document.title = `Rapor_Prestasi_${selectedStudentForDossier.name.replace(/\s+/g, "_")}_(${periodLabel})`;
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
      const { error } = await supabase.from("achievements").delete().eq("id", itemToDelete.id);
      if (error) throw error;
      setAchievements((prev) => prev.filter((a) => a.id !== itemToDelete.id));
      setSelectedIds((prev) => prev.filter((id) => id !== itemToDelete.id));
      setItemToDelete(null);
    } catch (err: any) {
      alert("Gagal menghapus: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenEditModal = (a: AchievementRecord) => {
    setEditingItem(a);
    setEditError("");
    setEditTitle(a.title || "");
    setEditCategory(a.category || "Tahfidz / Al-Qur'an");
    setEditLevel(a.level || "Kabupaten / Kota");

    const rawDate = a.event_date ? a.event_date.slice(0, 10) : a.created_at ? a.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10);
    setEditEventDate(rawDate);

    setEditRewardPoints(Number(a.reward_points) || 20);
    setEditAppreciation(a.appreciation || "");
    setEditDescription(a.description || "");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    if (!editTitle.trim()) {
      setEditError("Nama kejuaraan / capaian prestasi wajib diisi.");
      return;
    }
    if (!editEventDate) {
      setEditError("Tanggal perolehan prestasi wajib ditentukan.");
      return;
    }

    setIsUpdating(true);
    setEditError("");
    try {
      const { error } = await supabase
        .from("achievements")
        .update({
          title: editTitle.trim(),
          category: editCategory,
          level: editLevel,
          event_date: editEventDate,
          reward_points: Number(editRewardPoints),
          appreciation: editAppreciation.trim(),
          description: editDescription.trim(),
        })
        .eq("id", editingItem.id);

      if (error) throw error;
      await fetchData();
      setEditingItem(null);
    } catch (err: any) {
      setEditError(err.message || "Gagal memperbarui catatan prestasi.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConfirmBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsBatchDeleting(true);
    try {
      const { error } = await supabase.from("achievements").delete().in("id", selectedIds);
      if (error) throw error;
      setAchievements((prev) => prev.filter((a) => !selectedIds.includes(a.id)));
      setSelectedIds([]);
      setShowBatchDeleteModal(false);
    } catch (err: any) {
      alert("Gagal hapus massal: " + err.message);
    } finally {
      setIsBatchDeleting(false);
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto font-sans relative pb-24">
      {/* STRICT CSS PRINT ENGINE */}
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
          #printable-individual-achievement,
          #printable-report-area {
            display: block !important;
          }
        }
      `}</style>

      {/* ================= HEADER HERO BANNER ================= */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 p-5 sm:p-6 shadow-sm backdrop-blur-xl print:hidden">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="flex items-start sm:items-center space-x-3.5 min-w-0">
            <Link
              href="/dashboard"
              className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:text-emerald-500 hover:border-emerald-500/40 transition active:scale-95 shadow-xs"
              title="Kembali ke Dashboard Utama"
            >
              <ArrowLeft className="h-5 w-5 stroke-[2.4]" />
            </Link>

            <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-emerald-600 text-white shadow-md shadow-emerald-500/20">
              <Trophy className="h-6 w-6 stroke-[2.3]" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg lg:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Pusat Apresiasi &amp; Prestasi Santri
                </h1>
                <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 border border-amber-500/20 whitespace-nowrap">
                  Hall of Fame
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                Dokumentasi capaian kejuaraan, sertifikasi tahfidz, dan tracking rekam jejak santri teladan
              </p>
            </div>
          </div>

          {/* Sisi Kanan: Klaster Tombol Aksi */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap self-end xl:self-center shrink-0">
            <button
              type="button"
              onClick={fetchData}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 shadow-xs transition hover:border-emerald-500/50 hover:text-emerald-500 active:scale-95 cursor-pointer"
              title="Segarkan Data"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-emerald-500" : ""}`} />
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center space-x-1.5 rounded-xl border border-emerald-600/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-3.5 py-2 text-xs font-bold transition active:scale-95 shadow-xs whitespace-nowrap cursor-pointer"
              title="Unduh format CSV/Excel"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Ekspor Excel</span>
            </button>

            <button
              type="button"
              onClick={handlePrintGlobalReport}
              className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 transition active:scale-95 shadow-xs whitespace-nowrap cursor-pointer"
              title="Cetak format Laporan"
            >
              <Printer className="h-4 w-4" />
              <span>Cetak Laporan</span>
            </button>

            {/* TOMBOL BUKA MODAL INPUT PRESTASI LANGSUNG */}
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(true);
                setCreateError("");
                setSelectedStudentForCreate(null);
                setCreateSearchStudent("");
                setCreateTitle("");
                setCreateDescription("");
              }}
              className="inline-flex items-center space-x-1.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-500 to-amber-500 hover:from-emerald-500 hover:to-amber-400 px-4 py-2 text-xs font-black text-white shadow-md shadow-emerald-500/20 transition active:scale-95 whitespace-nowrap cursor-pointer"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>Catat Prestasi Baru</span>
            </button>
          </div>
        </div>
      </div>

      {/* ================= KARTU METRIK STATISTIK ================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 print:hidden">
        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 p-4 sm:p-5 shadow-xs backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Prestasi</span>
            <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Medal className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-2 font-mono">{stats.totalAchievements}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Rekapitulasi Capaian</p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 p-4 sm:p-5 shadow-xs backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Poin Apresiasi</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Award className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-500 mt-2 font-mono">+{stats.totalPointsAwarded}</p>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
            <Star className="h-3 w-3 fill-emerald-500" /> Reward Kebaikan
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 p-4 sm:p-5 shadow-xs backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Nasional / Global</span>
            <div className="h-8 w-8 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
              <Globe2 className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-sky-500 mt-2 font-mono">{stats.nationalGlobalCount}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Ajang Bergengsi Luar</p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 p-4 sm:p-5 shadow-xs backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Tahfidz &amp; Quran</span>
            <div className="h-8 w-8 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-teal-500 mt-2 font-mono">{stats.tahfidzCount}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Hifdzil Quran</p>
        </div>
      </div>

      {/* ================= TOOLBAR FILTER & SEARCH ================= */}
      <div className="space-y-2.5 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          <div className="relative sm:col-span-12 lg:col-span-4 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 transition-colors group-focus-within:text-emerald-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari santri, NIS, atau nama kejuaraan..."
              className="h-10 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 pl-10 pr-4 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-xs"
            />
          </div>

          <div className="sm:col-span-4 lg:col-span-3">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="h-10 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-emerald-500 cursor-pointer shadow-xs"
            >
              <option value="all">Semua Kategori</option>
              <option value="Tahfidz / Al-Qur'an">Tahfidz / Al-Qur&apos;an</option>
              <option value="Bahasa / Pidato">Bahasa / Pidato</option>
              <option value="Akademik & Sains">Akademik &amp; Sains</option>
              <option value="Keorganisasian & Kepemimpinan">Keorganisasian</option>
              <option value="Olahraga & Seni">Olahraga &amp; Seni</option>
            </select>
          </div>

          <div className="sm:col-span-4 lg:col-span-2">
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="h-10 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-emerald-500 cursor-pointer shadow-xs"
            >
              <option value="all">Semua Tingkat</option>
              <option value="Internal Pondok">Internal Pondok</option>
              <option value="Kabupaten / Kota">Kabupaten / Kota</option>
              <option value="Provinsi">Provinsi</option>
              <option value="Nasional">Nasional</option>
              <option value="Internasional">Internasional</option>
            </select>
          </div>

          <div className="sm:col-span-4 lg:col-span-3">
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value as any)}
              className="h-10 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-emerald-500 cursor-pointer shadow-xs"
            >
              <option value="all">Periode: Semua Waktu</option>
              <option value="7days">1 Minggu Terakhir (7 Hari)</option>
              <option value="30days">1 Bulan Terakhir (30 Hari)</option>
              <option value="semester">1 Semester Terakhir (6 Bulan)</option>
              <option value="custom">Rentang Tanggal Khusus...</option>
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

      {/* ================= TABEL DATA PRESTASI ================= */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 shadow-xl shadow-slate-200/30 dark:shadow-black/40 backdrop-blur-xl print:hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/90 dark:bg-slate-950/60 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none">
                <th className="py-4 px-3 w-10 text-center">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="p-1 rounded-md text-slate-400 hover:text-emerald-500 transition cursor-pointer"
                  >
                    {isAllFilteredSelected ? (
                      <CheckSquare className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="py-4 px-4 font-bold">Santri Berprestasi</th>
                <th className="py-4 px-4 font-bold">Nama Kejuaraan / Prestasi</th>
                <th className="py-4 px-4 text-center font-bold">Tingkat</th>
                <th className="py-4 px-4 text-center font-bold">Reward Poin</th>
                <th className="py-4 px-4 font-bold">Bentuk Apresiasi</th>
                <th className="py-4 px-4 text-right font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <RefreshCw className="h-7 w-7 animate-spin mx-auto mb-2 text-emerald-500" />
                    <span className="text-xs font-semibold">Memuat rekam prestasi santri...</span>
                  </td>
                </tr>
              ) : filteredAchievements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400 space-y-3">
                    <Trophy className="h-10 w-10 mx-auto text-slate-400 opacity-40" />
                    <div>
                      <p className="font-bold text-sm text-slate-700 dark:text-slate-300">Belum ada catatan prestasi</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Tidak ditemukan data prestasi yang sesuai filter.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAchievements.map((a) => {
                  const isSelected = selectedIds.includes(a.id);
                  const meta = studentsMap[a.nis] || {};

                  return (
                    <tr
                      key={a.id}
                      className={`group transition-all duration-200 ${
                        isSelected
                          ? "bg-emerald-500/[0.08] dark:bg-emerald-950/30"
                          : "hover:bg-emerald-500/[0.03] dark:hover:bg-emerald-500/[0.02]"
                      }`}
                    >
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(a.id)}
                          className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer h-4 w-4"
                        />
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="relative h-9 w-9 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-black text-xs group-hover:scale-105 transition-transform overflow-hidden flex items-center justify-center">
                            {meta.photo_url ? (
                              <img src={meta.photo_url} alt={a.student_name} className="h-full w-full object-cover" />
                            ) : (
                              a.student_name.charAt(0)
                            )}
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => handleOpenStudentDossier(a)}
                              className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors hover:underline text-left cursor-pointer"
                              title="Klik untuk melihat seluruh riwayat prestasi santri ini"
                            >
                              {a.student_name}
                            </button>
                            <p className="font-mono text-[11px] text-slate-500">
                              NIS: <span className="font-bold">{a.nis}</span> • {meta.class || "-"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="font-extrabold text-slate-900 dark:text-white leading-tight">
                          {a.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            {a.category}
                          </span>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                            <Calendar className="h-3 w-3" />
                            {new Date(a.event_date || a.created_at).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                          {a.certificate_url && (
                            <a
                              href={a.certificate_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span>Piagam</span>
                            </a>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {a.level}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-black font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          +{a.reward_points}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-800 dark:text-slate-200">
                          {a.appreciation || "Piagam Penghargaan"}
                        </p>
                        {a.description && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                            {a.description}
                          </p>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            type="button"
                            onClick={() => handleOpenStudentDossier(a)}
                            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-cyan-500 hover:border-cyan-500/40 hover:bg-cyan-500/10 transition active:scale-90 cursor-pointer"
                            title="Lihat Rapor Prestasi Santri"
                          >
                            <History className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(a)}
                            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-amber-500 hover:border-amber-500/40 hover:bg-amber-500/10 transition active:scale-90 cursor-pointer"
                            title="Edit Data Prestasi Lengkap"
                          >
                            <Edit className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setItemToDelete(a)}
                            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-rose-500 hover:border-rose-500/40 hover:bg-rose-500/10 transition active:scale-90 cursor-pointer"
                            title="Hapus Catatan Prestasi"
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
            <span className="h-7 w-7 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-xs">
              {selectedIds.length}
            </span>
            <span className="text-xs font-bold text-slate-200">Prestasi Terpilih</span>
          </div>

          <div className="flex items-center gap-2">
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

      {/* ================= MODAL CATAT PRESTASI BARU ================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-2xl my-auto overflow-hidden rounded-[28px] border border-slate-800 bg-slate-900/95 p-6 sm:p-7 text-white space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Plus className="h-5 w-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">Catat Prestasi Baru Santri</h3>
                  <p className="text-[11px] text-slate-400">Input rekognisi kejuaraan &amp; penambahan poin reward</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCreate} className="space-y-4 text-xs font-sans">
              {/* Cari Santri */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-300">Pilih Santri Penerima *</label>
                {!selectedStudentForCreate ? (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={createSearchStudent}
                        onChange={(e) => setCreateSearchStudent(e.target.value)}
                        placeholder="Ketik Nama Lengkap atau NIS Santri..."
                        className="w-full h-9.5 pl-9 pr-3 rounded-xl border border-slate-800 bg-slate-950 font-semibold text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                    {createSearchStudent.trim() && (
                      <div className="max-h-36 overflow-y-auto space-y-1 border border-slate-800 rounded-xl p-1.5 bg-slate-950/80">
                        {rawStudents
                          .filter((s) => {
                            const q = createSearchStudent.toLowerCase();
                            const nm = (s.full_name || s.name || s.nama || "").toLowerCase();
                            return nm.includes(q) || String(s.nis || "").includes(q);
                          })
                          .slice(0, 5)
                          .map((st) => (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => {
                                setSelectedStudentForCreate(st);
                                setCreateSearchStudent("");
                              }}
                              className="w-full text-left p-2 rounded-lg hover:bg-slate-800 flex items-center justify-between transition cursor-pointer"
                            >
                              <span className="font-bold text-white text-xs">{st.full_name || st.name || st.nama}</span>
                              <span className="text-[10px] text-slate-400 font-mono">NIS: {st.nis}</span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <div>
                      <p className="font-bold text-white text-xs">
                        {selectedStudentForCreate.full_name || selectedStudentForCreate.name || selectedStudentForCreate.nama}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        NIS: {selectedStudentForCreate.nis} • Kelas: {selectedStudentForCreate.kelas || selectedStudentForCreate.class_name || "-"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedStudentForCreate(null)}
                      className="text-xs text-rose-400 hover:underline font-bold cursor-pointer"
                    >
                      Ganti
                    </button>
                  </div>
                )}
              </div>

              {/* Nama Kejuaraan */}
              <div className="space-y-1">
                <label className="font-bold text-slate-300">Nama Kejuaraan / Prestasi *</label>
                <input
                  type="text"
                  required
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="Contoh: Juara 1 Pidato Bahasa Arab Tingkat Jawa Barat"
                  className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 font-semibold text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-300">Kategori Bidang</label>
                  <select
                    value={createCategory}
                    onChange={(e) => setCreateCategory(e.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 font-bold text-slate-200 outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="Tahfidz / Al-Qur'an">Tahfidz / Al-Qur&apos;an</option>
                    <option value="Bahasa / Pidato">Bahasa / Pidato</option>
                    <option value="Akademik & Sains">Akademik &amp; Sains</option>
                    <option value="Keorganisasian & Kepemimpinan">Keorganisasian</option>
                    <option value="Olahraga & Seni">Olahraga &amp; Seni</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-300">Tingkat Wilayah</label>
                  <select
                    value={createLevel}
                    onChange={(e) => handleLevelPointCalculation(e.target.value, false)}
                    className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 font-bold text-slate-200 outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="Internal Pondok">Internal Pondok (+10 Poin)</option>
                    <option value="Kabupaten / Kota">Kabupaten / Kota (+20 Poin)</option>
                    <option value="Provinsi">Provinsi (+35 Poin)</option>
                    <option value="Nasional">Nasional (+50 Poin)</option>
                    <option value="Internasional">Internasional (+100 Poin)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-300">Tanggal Perolehan *</label>
                  <input
                    type="date"
                    required
                    value={createEventDate}
                    onChange={(e) => setCreateEventDate(e.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 font-bold text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4 space-y-1">
                  <label className="font-bold text-slate-300">Reward Poin (+)</label>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={createRewardPoints}
                    onChange={(e) => setCreateRewardPoints(Number(e.target.value))}
                    className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 font-bold text-emerald-400 outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="sm:col-span-8 space-y-1">
                  <label className="font-bold text-slate-300">Bentuk Apresiasi / Hadiah</label>
                  <input
                    type="text"
                    value={createAppreciation}
                    onChange={(e) => setCreateAppreciation(e.target.value)}
                    placeholder="Contoh: Piagam Emas, Uang Pembinaan"
                    className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 text-xs text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">Keterangan Tambahan / Penyelenggara</label>
                <textarea
                  rows={2}
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="Keterangan instansi penyelenggara atau catatan khusus..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black shadow-md transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isCreating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  <span>Simpan Catatan Prestasi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL DOSSIER RAPOR PRESTASI SANTRI ================= */}
      {selectedStudentForDossier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 sm:p-6 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200 print:hidden">
          <div className="w-full max-w-3xl my-auto overflow-hidden rounded-[32px] border border-slate-800 bg-slate-900 text-white space-y-5 p-6 sm:p-8 shadow-2xl animate-in zoom-in-95">
            <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between border-b border-slate-800 pb-5 gap-5">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
                <div className="relative h-[115px] w-[90px] shrink-0 rounded-2xl overflow-hidden border-2 border-amber-500/50 bg-slate-800 shadow-xl flex items-center justify-center">
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
                    <span className="rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 font-mono text-xs font-bold">
                      NIS: {selectedStudentForDossier.nis}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-300 pt-1">
                    <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                      <GraduationCap className="h-3.5 w-3.5 text-amber-400" />
                      <span>Kelas: <strong>{selectedStudentForDossier.class}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                      <Home className="h-3.5 w-3.5 text-amber-400" />
                      <span>Asrama: <strong>{selectedStudentForDossier.dorm}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                      <MapPin className="h-3.5 w-3.5 text-amber-400" />
                      <span>Konsulat: <strong>{selectedStudentForDossier.consulate}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                      <Phone className="h-3.5 w-3.5 text-amber-400" />
                      <span>Wali: <strong>{selectedStudentForDossier.guardian_phone || "-"}</strong></span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedStudentForDossier(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
                <p className="text-slate-400 text-[10px] uppercase font-bold">Total Prestasi</p>
                <p className="text-lg font-black text-white font-mono mt-0.5">{studentDossierAchievements.length} Capaian</p>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
                <p className="text-slate-400 text-[10px] uppercase font-bold">Reward Poin</p>
                <p className="text-lg font-black text-emerald-400 font-mono mt-0.5">+{dossierFilteredPoints} Poin</p>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
                <p className="text-slate-400 text-[10px] uppercase font-bold">Tingkat Luar</p>
                <p className="text-lg font-black text-sky-400 font-mono mt-0.5">
                  {studentDossierAchievements.filter((a) => a.level === "Nasional" || a.level === "Provinsi" || a.level === "Internasional").length} Ajang
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
                <p className="text-slate-400 text-[10px] uppercase font-bold">Kategori Teladan</p>
                <p className="text-xs font-bold text-amber-300 mt-1">Santri Berprestasi</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-800">
              <div className="flex items-center space-x-1 text-xs font-bold text-slate-400">
                <History className="h-4 w-4 text-amber-400" />
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
                        ? "bg-amber-500 text-slate-950 font-black shadow-xs"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto custom-scrollbar space-y-2.5 pr-1">
              {studentDossierAchievements.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs font-medium">
                  Tidak ada catatan prestasi pada periode ini.
                </div>
              ) : (
                studentDossierAchievements.map((a, i) => (
                  <div
                    key={a.id}
                    className="p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-1.5 text-xs hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-[10px] text-slate-400">#{i + 1}</span>
                        <span className="font-bold text-white text-sm">{a.title}</span>
                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {a.level}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-emerald-400">+{a.reward_points} Poin</span>
                    </div>

                    <p className="text-slate-300 text-xs">
                      <span className="text-slate-500 font-semibold">Apresiasi:</span> {a.appreciation || "Piagam Penghargaan"}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-900">
                      <span>Tanggal: {new Date(a.event_date || a.created_at).toLocaleDateString("id-ID", { dateStyle: "long" })}</span>
                      <span className="font-bold text-amber-300">Bidang: {a.category}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800 gap-2">
              <button
                type="button"
                onClick={handlePrintStudentDossier}
                disabled={studentDossierAchievements.length === 0}
                className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition active:scale-95 disabled:opacity-40 cursor-pointer"
              >
                <Printer className="h-4 w-4 stroke-[2.5]" />
                <span>Cetak / PDF Rapor Prestasi</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedStudentForDossier(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Tutup Rapor Prestasi
              </button>
            </div>
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
                <h3 className="font-bold text-base text-white">Hapus {selectedIds.length} Prestasi?</h3>
                <p className="text-xs text-slate-400">Data penghargaan yang dipilih akan dihapus permanen</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
              Apakah Anda yakin ingin menghapus <strong>{selectedIds.length} catatan prestasi</strong> sekaligus?
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
                  <h3 className="text-base font-black text-white leading-tight">Hapus Catatan Prestasi?</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Data penghargaan santri akan dihapus permanen</p>
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
                <span className="text-slate-400">Capaian:</span>
                <span className="font-semibold text-emerald-300 text-right max-w-[220px] truncate">
                  {itemToDelete.title}
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

      {/* ================= MODAL EDIT LENGKAP ================= */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-xl my-auto overflow-hidden rounded-[28px] border border-slate-800 bg-slate-900/95 p-6 sm:p-7 text-white space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <Edit className="h-5 w-5 text-amber-400" />
                <div>
                  <h3 className="font-black text-sm text-white">Edit Data Prestasi Santri</h3>
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

            {editError && (
              <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs font-sans">
              <div className="space-y-1">
                <label className="font-bold text-slate-300">Nama Kejuaraan / Capaian Prestasi *</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 font-semibold text-white outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-300">Kategori Bidang</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 font-bold text-slate-200 outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="Tahfidz / Al-Qur'an">Tahfidz / Al-Qur&apos;an</option>
                    <option value="Bahasa / Pidato">Bahasa / Pidato</option>
                    <option value="Akademik & Sains">Akademik &amp; Sains</option>
                    <option value="Keorganisasian & Kepemimpinan">Keorganisasian</option>
                    <option value="Olahraga & Seni">Olahraga &amp; Seni</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-300">Tingkat Wilayah</label>
                  <select
                    value={editLevel}
                    onChange={(e) => handleLevelPointCalculation(e.target.value, true)}
                    className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 font-bold text-slate-200 outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="Internal Pondok">Internal Pondok (+10 Poin)</option>
                    <option value="Kabupaten / Kota">Kabupaten / Kota (+20 Poin)</option>
                    <option value="Provinsi">Provinsi (+35 Poin)</option>
                    <option value="Nasional">Nasional (+50 Poin)</option>
                    <option value="Internasional">Internasional (+100 Poin)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-300">Tanggal Perolehan *</label>
                  <input
                    type="date"
                    required
                    value={editEventDate}
                    onChange={(e) => setEditEventDate(e.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 font-bold text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4 space-y-1">
                  <label className="font-bold text-slate-300">Reward Poin (+)</label>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={editRewardPoints}
                    onChange={(e) => setEditRewardPoints(Number(e.target.value))}
                    className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 font-bold text-emerald-400 outline-none focus:border-amber-500"
                  />
                </div>

                <div className="sm:col-span-8 space-y-1">
                  <label className="font-bold text-slate-300">Bentuk Hadiah / Apresiasi Khusus</label>
                  <input
                    type="text"
                    value={editAppreciation}
                    onChange={(e) => setEditAppreciation(e.target.value)}
                    placeholder="Contoh: Piagam Emas, Uang Pembinaan"
                    className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 text-xs text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">Keterangan Tambahan / Penyelenggara</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Keterangan instansi penyelenggara atau catatan khusus..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex gap-2.5 pt-2 border-t border-slate-800">
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
                  <span>Simpan Perubahan Lengkap</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= AREA CETAK 1: RAPOR PRESTASI PER-INDIVIDU ================= */}
      {selectedStudentForDossier && (
        <div id="printable-individual-achievement" style={{ display: "none" }}>
          <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: "10px", marginBottom: "15px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: "900", textTransform: "uppercase" }}>
              PONDOK PESANTREN RIYADLUL &apos;ULUM WADDA&apos;WAH CONDONG
            </h2>
            <h3 style={{ fontSize: "13px", fontWeight: "800", marginTop: "2px" }}>
              SURAT REKAPITULASI PENGHARGAAN &amp; PRESTASI SANTRI
            </h3>
            <p style={{ fontSize: "9.5px", color: "#475569", marginTop: "2px" }}>
              Biro Pengasuhan &amp; Prestasi Santri • Cibeureum - Setianegara - Kota Tasikmalaya
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
                <th style={{ border: "1px solid #000", padding: "5px", textAlign: "left" }}>Nama Kejuaraan / Prestasi</th>
                <th style={{ border: "1px solid #000", padding: "5px", textAlign: "center", width: "70px" }}>Tingkat</th>
                <th style={{ border: "1px solid #000", padding: "5px", textAlign: "center", width: "45px" }}>Poin (+)</th>
                <th style={{ border: "1px solid #000", padding: "5px", textAlign: "left" }}>Bentuk Apresiasi / Hadiah</th>
              </tr>
            </thead>
            <tbody>
              {studentDossierAchievements.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ border: "1px solid #000", padding: "12px", textAlign: "center", fontStyle: "italic" }}>
                    Tidak ada catatan prestasi pada periode ini.
                  </td>
                </tr>
              ) : (
                studentDossierAchievements.map((a, i) => (
                  <tr key={a.id}>
                    <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>{i + 1}</td>
                    <td style={{ border: "1px solid #000", padding: "4px" }}>
                      {new Date(a.event_date || a.created_at).toLocaleDateString("id-ID")}
                    </td>
                    <td style={{ border: "1px solid #000", padding: "4px" }}>
                      <strong>{a.title}</strong>
                      <div style={{ fontSize: "8.5px", color: "#64748b" }}>Bidang: {a.category}</div>
                    </td>
                    <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>{a.level}</td>
                    <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center", fontWeight: "bold", color: "#047857" }}>+{a.reward_points}</td>
                    <td style={{ border: "1px solid #000", padding: "4px" }}>{a.appreciation || "Piagam Penghargaan"}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: "#f8fafc", fontWeight: "bold" }}>
                <td colSpan={4} style={{ border: "1px solid #000", padding: "5px", textAlign: "right" }}>
                  TOTAL AKUMULASI REWARD POIN PERIODE INI:
                </td>
                <td style={{ border: "1px solid #000", padding: "5px", textAlign: "center", color: "#047857" }}>
                  +{dossierFilteredPoints}
                </td>
                <td style={{ border: "1px solid #000", padding: "5px" }}>
                  Total: {studentDossierAchievements.length} Prestasi
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
              <p style={{ fontWeight: "bold" }}>Biro Pengasuhan &amp; Prestasi</p>
              <div style={{ height: "45px" }} />
              <p style={{ fontWeight: "bold", textDecoration: "underline" }}>( Ust. Pembina Prestasi )</p>
            </div>
          </div>
        </div>
      )}

      {/* ================= AREA CETAK 2: LAPORAN GLOBAL SEMUA PRESTASI ================= */}
      {!selectedStudentForDossier && (
        <div id="printable-report-area" style={{ display: "none" }}>
          <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: "10px", marginBottom: "15px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: "900", textTransform: "uppercase" }}>
              PONDOK PESANTREN RIYADLUL &apos;ULUM WADDA&apos;WAH CONDONG
            </h2>
            <h3 style={{ fontSize: "14px", fontWeight: "800", marginTop: "2px" }}>
              LAPORAN REKAPITULASI PRESTASI &amp; KEJUARAAN SANTRI
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
                <th style={{ border: "1px solid #000", padding: "6px", textAlign: "left" }}>Nama Kejuaraan / Prestasi</th>
                <th style={{ border: "1px solid #000", padding: "6px", textAlign: "center", width: "65px" }}>Tingkat</th>
                <th style={{ border: "1px solid #000", padding: "6px", textAlign: "center", width: "45px" }}>Poin (+)</th>
                <th style={{ border: "1px solid #000", padding: "6px", textAlign: "left" }}>Bentuk Apresiasi</th>
              </tr>
            </thead>
            <tbody>
              {filteredAchievements.map((a, i) => {
                const meta = studentsMap[a.nis] || {};
                return (
                  <tr key={a.id} style={{ border: "1px solid #000" }}>
                    <td style={{ border: "1px solid #000", padding: "5px", textAlign: "center" }}>{i + 1}</td>
                    <td style={{ border: "1px solid #000", padding: "5px" }}>
                      <strong>{a.student_name}</strong>
                      <div style={{ fontSize: "8.5px", color: "#475569" }}>NIS: {a.nis}</div>
                    </td>
                    <td style={{ border: "1px solid #000", padding: "5px" }}>
                      {meta.class || "-"} / {meta.dorm || "-"}
                    </td>
                    <td style={{ border: "1px solid #000", padding: "5px" }}>
                      <strong>{a.title}</strong>
                      <div style={{ fontSize: "8.5px", color: "#64748b" }}>
                        Kategori: {a.category} • {new Date(a.event_date || a.created_at).toLocaleDateString("id-ID")}
                      </div>
                    </td>
                    <td style={{ border: "1px solid #000", padding: "5px", textAlign: "center" }}>
                      {a.level}
                    </td>
                    <td style={{ border: "1px solid #000", padding: "5px", textAlign: "center", fontWeight: "bold", color: "#047857" }}>
                      +{a.reward_points}
                    </td>
                    <td style={{ border: "1px solid #000", padding: "5px" }}>
                      {a.appreciation || "Piagam Penghargaan"}
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
              <p style={{ fontWeight: "bold" }}>Biro Pembina Prestasi Santri</p>
              <div style={{ height: "50px" }} />
              <p style={{ fontWeight: "bold", textDecoration: "underline" }}>( Ust. Pembina Prestasi )</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}