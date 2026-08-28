"use client";

// =============================================================================
// 1. IMPORT DEPENDENCIES & ICONS
// =============================================================================
import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import {
  FileCheck2,
  QrCode,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Building2,
  X,
  Sparkles,
  ChevronRight,
  UserCheck,
  Plus,
  Printer,
  ArrowLeft,
  Calendar,
  Users2,
  Check,
  Edit,
  Trash2,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase";
import QRScannerModal from "@/components/QRScannerModal";
import { parseQRCodeText, generateStandardQRPayload } from "@/lib/qrParser";
import { playScanSound } from "@/lib/feedback";

// =============================================================================
// 2. INTERFACE DATA TYPES
// =============================================================================
interface Student {
  id: string;
  nis: string;
  name?: string;
  nama_lengkap?: string;
  nama?: string;
  full_name?: string;
  nama_santri?: string;
  class?: string;
  kelas?: string;
  rombel?: string;
  dorm?: string;
  kamar_asrama?: string;
  asrama?: string;
  kobong?: string;
  photo_url?: string;
}

interface SelectedStudentInfo {
  student_id: string;
  nis: string;
  student_name: string;
  class_name: string;
  dorm: string;
}

interface Permission {
  id: string;
  student_id: string;
  nis: string;
  student_name: string;
  reason: string;
  category: string;
  companion_info?: string;
  departure_target: string;
  return_target: string;
  status: "approved" | "out_pondok" | "back_pondok" | "completed";
  actual_out_at?: string;
  actual_in_at?: string;
  created_at: string;
}

export default function PermissionsPage() {
  // ===========================================================================
  // 3. STATE MANAGEMENT
  // ===========================================================================
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "approved" | "out_pondok" | "overdue" | "back_pondok">("all");

  // Modal & Scanner States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [selectedPermitForPrint, setSelectedPermitForPrint] = useState<Permission | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [lastBatchCount, setLastBatchCount] = useState(0);

  // State Edit Modal
  const [editingPermit, setEditingPermit] = useState<Permission | null>(null);
  const [editFormData, setEditFormData] = useState({
    category: "",
    companion_type: "Sendiri (Mandiri)",
    companion_detail: "",
    reason: "",
    departure_date: "",
    departure_time: "",
    return_date: "",
    return_time: "",
    status: "approved" as Permission["status"],
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [editFormError, setEditFormError] = useState("");

  // State Hapus Modal
  const [permitToDelete, setPermitToDelete] = useState<Permission | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Quick-Search Toolbar
  const [quickStudentResults, setQuickStudentResults] = useState<Student[]>([]);
  const [isQuickSearching, setIsQuickSearching] = useState(false);
  const [showQuickDropdown, setShowQuickDropdown] = useState(false);
  const quickSearchRef = useRef<HTMLDivElement>(null);

  // Modal Autocomplete Search
  const [studentSearchInput, setStudentSearchInput] = useState("");
  const [studentSearchResults, setStudentSearchResults] = useState<Student[]>([]);
  const [isSearchingStudent, setIsSearchingStudent] = useState(false);
  const [showDropdownResults, setShowDropdownResults] = useState(false);
  const modalDropdownRef = useRef<HTMLDivElement>(null);

  // Daftar Multi-Santri
  const [selectedStudentsList, setSelectedStudentsList] = useState<SelectedStudentInfo[]>([]);

  // Default Jadwal Hari Ini
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentTimeStr = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(".", ":");

  const [formData, setFormData] = useState({
    category: "Izin Keluar Komplek (Beberapa Jam)",
    companion_type: "Sendiri (Mandiri)",
    companion_detail: "",
    reason: "",
    departure_date: todayStr,
    departure_time: currentTimeStr,
    return_date: todayStr,
    return_time: "17:30",
  });

  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ===========================================================================
  // 4. FETCH DATA & EVENT LISTENERS
  // ===========================================================================
  useEffect(() => {
    fetchPermissions();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (quickSearchRef.current && !quickSearchRef.current.contains(event.target as Node)) {
        setShowQuickDropdown(false);
      }
      if (modalDropdownRef.current && !modalDropdownRef.current.contains(event.target as Node)) {
        setShowDropdownResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function fetchPermissions() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("permissions")
        .select("*")
        .order("created_at", { ascending: false })
        .range(0, 999);

      if (error) throw error;
      setPermissions(data || []);
    } catch (err: any) {
      console.warn("Sinkronisasi tabel perizinan:", err.message);
    } finally {
      setLoading(false);
    }
  }

  // ===========================================================================
  // 5. HELPER SANITASI DATA
  // ===========================================================================
  const getStudentName = (st: any) => {
    return st?.nama_lengkap || st?.name || st?.nama || st?.full_name || st?.nama_santri || "Nama Santri";
  };

  const getStudentClass = (st: any) => {
    return st?.class || st?.kelas || st?.rombel || "-";
  };

  const getStudentDorm = (st: any) => {
    return st?.dorm || st?.kamar_asrama || st?.asrama || st?.kobong || "-";
  };

  const isOverdue = (item: Permission) => {
    if (item.status === "out_pondok") {
      return new Date() > new Date(item.return_target);
    }
    return false;
  };

  // ===========================================================================
  // 6. MULTI-SANTRI SELECTION HANDLERS
  // ===========================================================================
  const addStudentToSelection = (student: Student) => {
    const finalName = getStudentName(student);
    const finalClass = getStudentClass(student);
    const finalDorm = getStudentDorm(student);
    const stId = String(student.id);

    if (selectedStudentsList.some((s) => s.nis === student.nis || s.student_id === stId)) {
      playScanSound("warning");
      setFormError(`Santri ${finalName} (NIS: ${student.nis}) sudah ada dalam daftar.`);
      return;
    }

    playScanSound("success");
    setSelectedStudentsList((prev) => [
      ...prev,
      {
        student_id: stId,
        nis: student.nis,
        student_name: finalName,
        class_name: finalClass,
        dorm: finalDorm,
      },
    ]);

    setStudentSearchInput("");
    setStudentSearchResults([]);
    setShowDropdownResults(false);
    setShowQuickDropdown(false);
    setSearchQuery("");
    setFormError("");
  };

  const removeStudentFromSelection = (nis: string) => {
    setSelectedStudentsList((prev) => prev.filter((s) => s.nis !== nis));
  };

  const clearAllSelectedStudents = () => {
    setSelectedStudentsList([]);
  };

  const handleQuickSearchChange = async (val: string) => {
    setSearchQuery(val);
    const cleaned = val.trim().toLowerCase();

    if (!cleaned) {
      setQuickStudentResults([]);
      setShowQuickDropdown(false);
      return;
    }

    setIsQuickSearching(true);
    setShowQuickDropdown(true);

    try {
      const { data, error } = await supabase.from("students").select("*").limit(50);
      if (!error && data) {
        const matches = data.filter((st: any) => {
          const name = getStudentName(st).toLowerCase();
          const nis = String(st?.nis || "").toLowerCase();
          return name.includes(cleaned) || nis.includes(cleaned);
        });
        setQuickStudentResults(matches.slice(0, 5));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsQuickSearching(false);
    }
  };

  const handleSearchStudent = async (queryText: string) => {
    setStudentSearchInput(queryText);
    const cleaned = queryText.trim().toLowerCase();

    if (!cleaned) {
      setStudentSearchResults([]);
      setShowDropdownResults(false);
      return;
    }

    setIsSearchingStudent(true);
    setShowDropdownResults(true);

    try {
      const { data, error } = await supabase.from("students").select("*").limit(50);
      if (error) throw error;

      const filtered = (data || []).filter((st: any) => {
        const name = getStudentName(st).toLowerCase();
        const nis = String(st?.nis || "").toLowerCase();
        return name.includes(cleaned) || nis.includes(cleaned);
      });

      setStudentSearchResults(filtered.slice(0, 8));
    } catch (err) {
      console.error("Gagal mencari santri:", err);
    } finally {
      setIsSearchingStudent(false);
    }
  };

  // ===========================================================================
  // 7. SCAN KTS BERULANG
  // ===========================================================================
  const handleScanSuccess = async (decodedText: string) => {
    setFormError("");
    try {
      const { searchKey, nis, id } = parseQRCodeText(decodedText);
      const targetNis = (nis || searchKey).trim();

      let query = supabase.from("students").select("*");
      if (id) {
        query = query.eq("id", id);
      } else if (targetNis) {
        query = query.eq("nis", targetNis);
      }

      const { data: student, error } = await query.maybeSingle();
      if (error || !student) {
        playScanSound("error");
        throw new Error("Data santri tidak terdaftar di sistem.");
      }

      addStudentToSelection(student);
      setShowScanner(false);
      setShowCreateModal(true);
    } catch (err: any) {
      playScanSound("error");
      setFormError("Gagal membaca barcode KTS: " + err.message);
    }
  };

  // ===========================================================================
  // 8. SUBMIT PENERBITAN MASSAL
  // ===========================================================================
  const handleConfirmPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudentsList.length === 0) {
      setFormError("Silakan pilih minimal 1 santri untuk diterbitkan izinnya.");
      return;
    }
    if (!formData.reason.trim()) {
      setFormError("Harap isi alasan dan keperluan perizinan santri.");
      return;
    }

    setIsSubmitting(true);
    try {
      const departureIso = new Date(`${formData.departure_date}T${formData.departure_time}:00`).toISOString();
      const returnIso = new Date(`${formData.return_date}T${formData.return_time}:00`).toISOString();

      const companionText =
        formData.companion_type === "Sendiri (Mandiri)"
          ? "Sendiri (Mandiri)"
          : `${formData.companion_type}${formData.companion_detail ? ` - ${formData.companion_detail}` : ""}`;

      const payloads = selectedStudentsList.map((st) => ({
        student_id: st.student_id,
        nis: st.nis,
        student_name: st.student_name,
        category: formData.category,
        reason: formData.reason,
        companion_info: companionText,
        departure_target: departureIso,
        return_target: returnIso,
        status: "approved",
      }));

      const { error } = await supabase.from("permissions").insert(payloads);
      if (error) throw error;

      playScanSound("success");
      setLastBatchCount(payloads.length);
      await fetchPermissions();
      setShowCreateModal(false);

      setSelectedStudentsList([]);
      setFormData({
        category: "Izin Keluar Komplek (Beberapa Jam)",
        companion_type: "Sendiri (Mandiri)",
        companion_detail: "",
        reason: "",
        departure_date: todayStr,
        departure_time: currentTimeStr,
        return_date: todayStr,
        return_time: "17:30",
      });

      setShowSuccessDialog(true);
    } catch (err: any) {
      playScanSound("error");
      setFormError(err.message || "Gagal menerbitkan surat izin santri.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ===========================================================================
  // 9. EDIT & DELETE HANDLERS
  // ===========================================================================
  const handleOpenEditModal = (p: Permission) => {
    setEditingPermit(p);
    setEditFormError("");

    const depDate = new Date(p.departure_target);
    const retDate = new Date(p.return_target);

    const depDateStr = depDate.toISOString().slice(0, 10);
    const depTimeStr = depDate.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(".", ":");
    const retDateStr = retDate.toISOString().slice(0, 10);
    const retTimeStr = retDate.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(".", ":");

    let companionType = "Sendiri (Mandiri)";
    let companionDetail = "";

    if (p.companion_info) {
      if (p.companion_info.includes(" - ")) {
        const parts = p.companion_info.split(" - ");
        companionType = parts[0];
        companionDetail = parts.slice(1).join(" - ");
      } else {
        companionType = p.companion_info;
      }
    }

    setEditFormData({
      category: p.category || "Izin Keluar Komplek (Beberapa Jam)",
      companion_type: companionType,
      companion_detail: companionDetail,
      reason: p.reason || "",
      departure_date: depDateStr,
      departure_time: depTimeStr,
      return_date: retDateStr,
      return_time: retTimeStr,
      status: p.status || "approved",
    });
  };

  const handleConfirmEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPermit) return;

    if (!editFormData.reason.trim()) {
      setEditFormError("Alasan izin tidak boleh kosong.");
      return;
    }

    setIsUpdating(true);
    setEditFormError("");

    try {
      const departureIso = new Date(`${editFormData.departure_date}T${editFormData.departure_time}:00`).toISOString();
      const returnIso = new Date(`${editFormData.return_date}T${editFormData.return_time}:00`).toISOString();

      const companionText =
        editFormData.companion_type === "Sendiri (Mandiri)"
          ? "Sendiri (Mandiri)"
          : `${editFormData.companion_type}${editFormData.companion_detail ? ` - ${editFormData.companion_detail}` : ""}`;

      const { error } = await supabase
        .from("permissions")
        .update({
          category: editFormData.category,
          companion_info: companionText,
          reason: editFormData.reason,
          departure_target: departureIso,
          return_target: returnIso,
          status: editFormData.status,
        })
        .eq("id", editingPermit.id);

      if (error) throw error;

      playScanSound("success");
      await fetchPermissions();
      setEditingPermit(null);
    } catch (err: any) {
      playScanSound("error");
      setEditFormError(err.message || "Gagal memperbarui data izin.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!permitToDelete) return;
    setIsDeleting(true);

    try {
      const { error } = await supabase.from("permissions").delete().eq("id", permitToDelete.id);
      if (error) throw error;

      playScanSound("success");
      setPermissions((prev) => prev.filter((p) => p.id !== permitToDelete.id));
      setPermitToDelete(null);
    } catch (err: any) {
      playScanSound("error");
      alert("Gagal menghapus izin: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // ===========================================================================
  // 10. COMPUTED METRICS & FILTERED DATA
  // ===========================================================================
  const stats = useMemo(() => {
    const totalActive = permissions.filter((p) => p.status === "approved" || p.status === "out_pondok").length;
    const currentlyOut = permissions.filter((p) => p.status === "out_pondok").length;
    const overdueCount = permissions.filter(isOverdue).length;
    const completedCount = permissions.filter((p) => p.status === "back_pondok" || p.status === "completed").length;

    return { totalActive, currentlyOut, overdueCount, completedCount };
  }, [permissions]);

  const filteredPermissions = useMemo(() => {
    return permissions.filter((item) => {
      const matchesSearch =
        item.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.nis.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (activeTab === "approved") return item.status === "approved";
      if (activeTab === "out_pondok") return item.status === "out_pondok" && !isOverdue(item);
      if (activeTab === "overdue") return isOverdue(item);
      if (activeTab === "back_pondok") return item.status === "back_pondok" || item.status === "completed";

      return true;
    });
  }, [permissions, searchQuery, activeTab]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans relative pb-16 transition-all duration-300">
      {/* Background Subtle Glows */}
      <div className="pointer-events-none absolute -top-10 -right-10 h-72 w-72 rounded-full bg-emerald-500/10 blur-[100px]" />
      <div className="pointer-events-none absolute top-48 -left-10 h-72 w-72 rounded-full bg-teal-500/10 blur-[100px]" />

      {/* ================= HEADER UTAMA EMERALD ================= */}
      <div className="relative overflow-hidden rounded-[32px] border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 p-5 sm:p-6 shadow-xl backdrop-blur-xl">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <Link
              href="/dashboard"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:text-emerald-600 hover:border-emerald-500/40 transition active:scale-95 shadow-xs"
              title="Kembali ke Dashboard Utama"
            >
              <ArrowLeft className="h-5 w-5 stroke-[2.4]" />
            </Link>

            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-700 via-teal-600 to-amber-500 text-white shadow-md shadow-emerald-700/20 font-black">
              <FileCheck2 className="h-6 w-6 stroke-[2.3]" />
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Biro Perizinan Santri
                </h1>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  Gate Control
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Monitoring perizinan keluar/pulang santri dan verifikasi barcode gerbang terpadu
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={fetchPermissions}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 shadow-xs transition hover:border-emerald-500/50 hover:text-emerald-600 active:scale-95 cursor-pointer"
              title="Segarkan Data"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-emerald-600" : ""}`} />
            </button>

            <button
              type="button"
              onClick={() => {
                clearAllSelectedStudents();
                setFormError("");
                setShowCreateModal(true);
              }}
              className="inline-flex items-center space-x-1.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 transition active:scale-95 cursor-pointer"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span className="whitespace-nowrap">Input Manual</span>
            </button>

            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="group/scan relative inline-flex items-center space-x-1.5 rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 px-4 py-2.5 text-xs font-black text-white shadow-md shadow-emerald-700/25 transition active:scale-95 cursor-pointer"
            >
              <QrCode className="h-4 w-4 transition-transform duration-300 group-hover/scan:rotate-12 stroke-[2.5]" />
              <span className="whitespace-nowrap">Scan KTS</span>
              <Sparkles className="h-3.5 w-3.5 opacity-70 animate-pulse" />
            </button>
          </div>
        </div>
      </div>

      {/* ================= KARTU STATISTIK METRIK ================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {[
          {
            tab: "approved",
            title: "Izin Aktif",
            val: stats.totalActive,
            sub: "Santri dalam siklus izin",
            icon: Clock,
            accentBg: "from-emerald-500/10 to-transparent",
            borderColor: "border-emerald-500/40",
            iconColor: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60",
          },
          {
            tab: "out_pondok",
            title: "Di Luar Pondok",
            val: stats.currentlyOut,
            sub: "Sudah keluar gerbang",
            icon: Building2,
            accentBg: "from-amber-500/10 to-transparent",
            borderColor: "border-amber-500/40",
            iconColor: "text-amber-600 bg-amber-50 dark:bg-amber-950/60",
          },
          {
            tab: "overdue",
            title: "Terlambat",
            val: stats.overdueCount,
            sub: "Melewati batas jam kembali",
            icon: AlertTriangle,
            accentBg: stats.overdueCount > 0 ? "from-rose-500/20 to-rose-950/30" : "from-rose-500/10 to-transparent",
            borderColor: "border-rose-500/40",
            iconColor: "text-rose-600 bg-rose-50 dark:bg-rose-950/60",
          },
          {
            tab: "back_pondok",
            title: "Selesai Kembali",
            val: stats.completedCount,
            sub: "Sudah tiba di pondok",
            icon: CheckCircle2,
            accentBg: "from-teal-500/10 to-transparent",
            borderColor: "border-teal-500/40",
            iconColor: "text-teal-600 bg-teal-50 dark:bg-teal-950/60",
          },
        ].map((c) => {
          const Icon = c.icon;
          const isSelected = activeTab === c.tab;
          return (
            <div
              key={c.tab}
              onClick={() => setActiveTab(c.tab as any)}
              className={`group relative cursor-pointer overflow-hidden rounded-3xl border bg-white/90 dark:bg-slate-900/90 p-4 sm:p-5 shadow-xs transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${
                isSelected
                  ? `${c.borderColor} ring-2 ring-emerald-500/30 shadow-emerald-500/10`
                  : "border-slate-200/80 dark:border-slate-800/80 hover:border-emerald-500/40"
              }`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${c.accentBg} opacity-60 pointer-events-none`} />

              <div className="relative flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {c.title}
                </span>
                <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${c.iconColor} transition-transform group-hover:scale-110 shadow-xs`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>

              <div className="relative mt-2">
                <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight font-mono">
                  {c.val}
                </p>
                <p className="text-[11px] font-medium text-slate-400 mt-0.5 truncate">{c.sub}</p>
              </div>

              <div className="relative mt-3 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                <span>Klik untuk menyaring</span>
                <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          );
        })}
      </div>

      {/* ================= TOOLBAR PENCARIAN & STATUS TABS ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="relative flex-1 max-w-md" ref={quickSearchRef}>
          <div className="relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 transition-colors group-focus-within:text-emerald-600 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleQuickSearchChange(e.target.value)}
              placeholder="Cari santri / terbitkan izin instan..."
              className="h-10 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 pl-10 pr-4 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-xs"
            />
            {isQuickSearching && (
              <RefreshCw className="absolute right-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-emerald-600" />
            )}
          </div>

          {showQuickDropdown && quickStudentResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-2xl z-40 space-y-1 animate-in fade-in zoom-in-95">
              <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
                <span>Database Santri Terdeteksi</span>
                <span>Klik untuk Tambah ke Izin</span>
              </div>
              {quickStudentResults.map((st) => (
                <div
                  key={st.id}
                  onClick={() => {
                    addStudentToSelection(st);
                    setShowCreateModal(true);
                  }}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-emerald-500/10 cursor-pointer transition border border-transparent hover:border-emerald-500/20 group"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-black text-xs">
                      {getStudentName(st).charAt(0)}
                    </div>
                    <div>
                      <p className="font-extrabold text-xs text-slate-900 dark:text-white leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                        {getStudentName(st)}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        NIS: {st.nis} • {getStudentClass(st)} • {getStudentDorm(st)}
                      </p>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                    <Plus className="h-3 w-3" />
                    <span>Pilih</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center overflow-x-auto gap-1 rounded-2xl bg-slate-100/90 dark:bg-slate-950/70 p-1 border border-slate-200 dark:border-slate-800 text-xs font-bold">
          {[
            { id: "all", label: "Semua Izin" },
            { id: "approved", label: "Belum Keluar" },
            { id: "out_pondok", label: "Di Luar" },
            { id: "overdue", label: `Terlambat (${stats.overdueCount})`, alert: stats.overdueCount > 0 },
            { id: "back_pondok", label: "Selesai" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all duration-200 text-xs font-bold cursor-pointer ${
                activeTab === tab.id
                  ? "bg-emerald-700 text-white shadow-sm"
                  : tab.alert
                  ? "text-rose-500 hover:bg-rose-500/10 animate-pulse font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ================= TABEL DATA PERIZINAN ================= */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 shadow-xl shadow-slate-200/30 dark:shadow-black/40 backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/90 dark:bg-slate-950/60 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none">
                <th className="py-4 px-4 font-bold">Santri &amp; NIS</th>
                <th className="py-4 px-4 font-bold">Kategori &amp; Keterangan</th>
                <th className="py-4 px-4 font-bold">Jadwal Waktu Izin</th>
                <th className="py-4 px-4 text-center font-bold">Status Gerbang</th>
                <th className="py-4 px-4 text-center font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-400">
                    <RefreshCw className="h-7 w-7 animate-spin mx-auto mb-2 text-emerald-600" />
                    <span className="text-xs font-semibold">Menghubungkan ke basis data perizinan...</span>
                  </td>
                </tr>
              ) : filteredPermissions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-400 space-y-3">
                    <FileCheck2 className="h-10 w-10 mx-auto text-slate-400 opacity-40" />
                    <div>
                      <p className="font-bold text-sm text-slate-700 dark:text-slate-300">Belum ada data perizinan</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Silakan terbitkan izin baru melalui tombol di bawah.</p>
                    </div>
                    <div className="pt-2 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          clearAllSelectedStudents();
                          setShowCreateModal(true);
                        }}
                        className="inline-flex items-center space-x-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-xs font-bold shadow-md shadow-emerald-700/20 transition active:scale-95 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                        <span>Terbitkan Izin Baru</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPermissions.map((p) => {
                  const late = isOverdue(p);
                  return (
                    <tr
                      key={p.id}
                      className={`group transition-all duration-200 hover:bg-emerald-500/[0.03] dark:hover:bg-emerald-500/[0.02] ${
                        late ? "bg-rose-500/[0.06] dark:bg-rose-950/20" : ""
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-black text-xs group-hover:scale-105 transition-transform">
                            {p.student_name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                              {p.student_name}
                            </p>
                            <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">
                              NIS: {p.nis}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="rounded-lg bg-emerald-500/10 px-2.5 py-0.5 font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-500/20 text-[10px]">
                            {p.category}
                          </span>
                          {p.companion_info && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-semibold">
                              <Users2 className="h-3 w-3 text-emerald-600" />
                              <span>{p.companion_info}</span>
                            </span>
                          )}
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 mt-1 max-w-sm leading-relaxed text-xs">
                          {p.reason}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 space-y-1 text-[11px]">
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-semibold">
                          <span className="text-xs">🛫</span>
                          <span>{new Date(p.departure_target).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</span>
                        </div>
                        <div
                          className={`flex items-center gap-1.5 font-semibold ${
                            late ? "text-rose-500 font-black" : "text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          <span className="text-xs">🛬</span>
                          <span>{new Date(p.return_target).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {late ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-[10px] font-black uppercase tracking-wider animate-bounce shadow-md shadow-rose-500/10">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span>Terlambat</span>
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                              p.status === "approved"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                : p.status === "out_pondok"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            }`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            <span>
                              {p.status === "approved"
                                ? "Disetujui"
                                : p.status === "out_pondok"
                                ? "Di Luar"
                                : "Selesai"}
                            </span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            type="button"
                            onClick={() => setSelectedPermitForPrint(p)}
                            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-emerald-600 hover:border-emerald-500/40 hover:bg-emerald-500/10 transition active:scale-90 cursor-pointer"
                            title="Cetak Slip Izin"
                          >
                            <Printer className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(p)}
                            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-amber-500 hover:border-amber-500/40 hover:bg-amber-500/10 transition active:scale-90 cursor-pointer"
                            title="Edit Data Izin"
                          >
                            <Edit className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setPermitToDelete(p)}
                            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-rose-500 hover:border-rose-500/40 hover:bg-rose-500/10 transition active:scale-90 cursor-pointer"
                            title="Hapus Data Izin"
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

      {/* ================= MODAL EDIT IZIN ================= */}
      {editingPermit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 sm:p-6 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-xl my-auto overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/95 p-6 sm:p-7 text-white space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  <Edit className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">Edit Data Izin Santri</h3>
                  <p className="text-xs text-slate-400">{editingPermit.student_name} (NIS: {editingPermit.nis})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingPermit(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editFormError && (
              <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                ⚠️ {editFormError}
              </div>
            )}

            <form onSubmit={handleConfirmEdit} className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-300">Kategori Izin</label>
                  <select
                    value={editFormData.category}
                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                    className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 text-xs font-bold text-slate-200 outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="Izin Keluar Komplek (Beberapa Jam)">Izin Keluar Komplek (Beberapa Jam)</option>
                    <option value="Izin Pulang ke Rumah (Bermalam)">Izin Pulang ke Rumah (Bermalam)</option>
                    <option value="Izin Berobat / Medis (Klinik/RS)">Izin Berobat / Medis (Klinik/RS)</option>
                    <option value="Izin Tugas Pondok / Lomba">Izin Tugas Pondok / Lomba / Ekstra</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-300">Status Gerbang</label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as any })}
                    className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 text-xs font-bold text-amber-400 outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="approved">Disetujui (Belum Keluar)</option>
                    <option value="out_pondok">Di Luar Pondok</option>
                    <option value="back_pondok">Selesai (Kembali ke Pondok)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-300">Status Pendamping</label>
                  <select
                    value={editFormData.companion_type}
                    onChange={(e) => setEditFormData({ ...editFormData, companion_type: e.target.value })}
                    className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 text-xs font-semibold text-slate-200 outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="Sendiri (Mandiri)">Sendiri (Mandiri)</option>
                    <option value="Orang Tua / Wali">Dijemput Orang Tua / Wali</option>
                    <option value="Ustadz / Pembimbing">Didampingi Ustadz / Pembimbing</option>
                    <option value="Rombongan Santri">Rombongan Santri</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-300">Keterangan Penjemput</label>
                  <input
                    type="text"
                    value={editFormData.companion_detail}
                    onChange={(e) => setEditFormData({ ...editFormData, companion_detail: e.target.value })}
                    placeholder="Contoh: Bpk. Ahmad"
                    className="h-10 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 text-xs text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Tgl Berangkat</label>
                    <input
                      type="date"
                      value={editFormData.departure_date}
                      onChange={(e) => setEditFormData({ ...editFormData, departure_date: e.target.value })}
                      className="w-full h-9 rounded-xl border border-slate-800 bg-slate-900 px-2 text-xs font-bold text-white outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Jam Berangkat</label>
                    <input
                      type="time"
                      value={editFormData.departure_time}
                      onChange={(e) => setEditFormData({ ...editFormData, departure_time: e.target.value })}
                      className="w-full h-9 rounded-xl border border-slate-800 bg-slate-900 px-2 text-xs font-bold text-white outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Tgl Batas Kembali</label>
                    <input
                      type="date"
                      value={editFormData.return_date}
                      onChange={(e) => setEditFormData({ ...editFormData, return_date: e.target.value })}
                      className="w-full h-9 rounded-xl border border-slate-800 bg-slate-900 px-2 text-xs font-bold text-white outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Jam Maksimal Tiba</label>
                    <input
                      type="time"
                      value={editFormData.return_time}
                      onChange={(e) => setEditFormData({ ...editFormData, return_time: e.target.value })}
                      className="w-full h-9 rounded-xl border border-slate-800 bg-slate-900 px-2 text-xs font-bold text-white outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">Alasan / Keperluan Izin</label>
                <textarea
                  rows={2}
                  value={editFormData.reason}
                  onChange={(e) => setEditFormData({ ...editFormData, reason: e.target.value })}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingPermit(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  {isUpdating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 stroke-[3]" />}
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL KONFIRMASI HAPUS ================= */}
      {permitToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-6 text-white space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center space-x-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/30">
                <Trash2 className="h-6 w-6 stroke-[2.3]" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Hapus Surat Izin?</h3>
                <p className="text-xs text-slate-400">Tindakan ini permanen</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs space-y-1">
              <p className="font-bold text-white">{permitToDelete.student_name}</p>
              <p className="text-slate-400">NIS: {permitToDelete.nis} • {permitToDelete.category}</p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPermitToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                {isDeleting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                <span>Ya, Hapus</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL FORM BUAT IZIN BARU ================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 sm:p-6 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-2xl my-auto overflow-hidden rounded-[32px] border border-slate-800 bg-slate-900/95 p-6 sm:p-8 text-white space-y-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/10 font-black">
                  <FileCheck2 className="h-6 w-6 stroke-[2.3]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-white leading-tight">
                    Formulir Penerbitan Izin Santri
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Mendukung izin perorangan maupun rombongan sekaligus
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2.5">
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmPermission} className="space-y-4 text-xs font-sans">
              <div className="space-y-2 relative" ref={modalDropdownRef}>
                <div className="flex items-center justify-between">
                  <label className="font-bold text-xs sm:text-sm text-slate-200">
                    Santri yang Diizinkan ({selectedStudentsList.length}) <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setShowScanner(true);
                    }}
                    className="text-emerald-400 font-bold hover:underline flex items-center gap-1.5 text-xs bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 cursor-pointer"
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    <span>+ Pindai KTS Santri</span>
                  </button>
                </div>

                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={studentSearchInput}
                    onChange={(e) => handleSearchStudent(e.target.value)}
                    onFocus={() => {
                      if (studentSearchInput.trim().length > 0) {
                        setShowDropdownResults(true);
                      }
                    }}
                    placeholder="Ketik nama / NIS untuk menambahkan santri ke rombongan..."
                    className="h-10 w-full rounded-2xl border border-slate-800 bg-slate-950/80 pl-10 pr-10 text-xs font-semibold text-white placeholder-slate-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                  />
                  {isSearchingStudent && (
                    <RefreshCw className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-emerald-400" />
                  )}
                </div>

                {showDropdownResults && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 rounded-2xl border border-slate-800 bg-slate-950 p-2 shadow-2xl z-50 space-y-1 max-h-52 overflow-y-auto custom-scrollbar">
                    {studentSearchResults.length === 0 ? (
                      <p className="text-center py-3 text-xs font-medium text-slate-400">
                        Tidak ada santri yang cocok dengan "{studentSearchInput}".
                      </p>
                    ) : (
                      studentSearchResults.map((st) => {
                        const stName = getStudentName(st);
                        const stClass = getStudentClass(st);
                        return (
                          <div
                            key={st.id}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              addStudentToSelection(st);
                            }}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-900 cursor-pointer transition border border-transparent hover:border-slate-800"
                          >
                            <div className="flex items-center space-x-2.5">
                              <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-black text-xs shrink-0">
                                {stName.charAt(0)}
                              </div>
                              <div>
                                <p className="font-extrabold text-xs text-white leading-tight">
                                  {stName}
                                </p>
                                <p className="text-[10px] text-slate-400 font-mono">
                                  NIS: <span className="text-emerald-400 font-bold">{st.nis}</span> • {stClass}
                                </p>
                              </div>
                            </div>
                            <Plus className="h-4 w-4 text-emerald-400" />
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {selectedStudentsList.length > 0 && (
                  <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                      <span>Santri Terpilih ({selectedStudentsList.length}):</span>
                      <button
                        type="button"
                        onClick={clearAllSelectedStudents}
                        className="text-rose-400 hover:underline text-[10px] cursor-pointer"
                      >
                        Hapus Semua
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto custom-scrollbar p-1">
                      {selectedStudentsList.map((st) => (
                        <div
                          key={st.nis}
                          className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-bold animate-in zoom-in-95"
                        >
                          <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                          <span>
                            {st.student_name} ({st.nis} • {st.class_name})
                          </span>
                          <button
                            type="button"
                            onClick={() => removeStudentFromSelection(st.nis)}
                            className="text-slate-400 hover:text-rose-400 ml-0.5 transition cursor-pointer"
                            title="Hapus santri dari daftar"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-xs text-slate-300">
                  Kategori Perizinan <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full h-10 rounded-2xl border border-slate-800 bg-slate-950 px-3.5 text-xs font-bold text-slate-200 outline-none focus:border-emerald-500 transition cursor-pointer"
                >
                  <option value="Izin Keluar Komplek (Beberapa Jam)">Izin Keluar Komplek (Beberapa Jam)</option>
                  <option value="Izin Pulang ke Rumah (Bermalam)">Izin Pulang ke Rumah (Bermalam)</option>
                  <option value="Izin Berobat / Medis (Klinik/RS)">Izin Berobat / Medis (Klinik/RS)</option>
                  <option value="Izin Tugas Pondok / Lomba">Izin Tugas Pondok / Lomba / Ekstra</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-xs text-slate-300">Status Pendamping</label>
                  <select
                    value={formData.companion_type}
                    onChange={(e) => setFormData({ ...formData, companion_type: e.target.value })}
                    className="w-full h-10 rounded-2xl border border-slate-800 bg-slate-950 px-3.5 text-xs font-semibold text-slate-200 outline-none focus:border-emerald-500 transition cursor-pointer"
                  >
                    <option value="Sendiri (Mandiri)">Sendiri (Mandiri)</option>
                    <option value="Orang Tua / Wali">Dijemput Orang Tua / Wali</option>
                    <option value="Ustadz / Pembimbing">Didampingi Ustadz / Pembimbing</option>
                    <option value="Rombongan Santri">Rombongan Santri</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-xs text-slate-300">Keterangan Penjemput</label>
                  <input
                    type="text"
                    value={formData.companion_detail}
                    onChange={(e) => setFormData({ ...formData, companion_detail: e.target.value })}
                    placeholder="Contoh: Bpk. Ahmad"
                    className="h-10 w-full rounded-2xl border border-slate-800 bg-slate-950 px-3.5 text-xs font-medium text-white placeholder-slate-500 outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-1.5 text-emerald-400 font-bold text-[11px] uppercase tracking-wider">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Waktu Mulai Berangkat</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <input
                        type="date"
                        value={formData.departure_date}
                        onChange={(e) => setFormData({ ...formData, departure_date: e.target.value })}
                        className="w-full h-9 rounded-xl border border-slate-800 bg-slate-900 px-3 text-xs font-bold text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <input
                        type="time"
                        value={formData.departure_time}
                        onChange={(e) => setFormData({ ...formData, departure_time: e.target.value })}
                        className="w-full h-9 rounded-xl border border-slate-800 bg-slate-900 px-3 text-xs font-bold text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center space-x-1.5 text-rose-400 font-bold text-[11px] uppercase tracking-wider">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Batas Waktu Tiba di Pondok</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <input
                        type="date"
                        value={formData.return_date}
                        onChange={(e) => setFormData({ ...formData, return_date: e.target.value })}
                        className="w-full h-9 rounded-xl border border-slate-800 bg-slate-900 px-3 text-xs font-bold text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <input
                        type="time"
                        value={formData.return_time}
                        onChange={(e) => setFormData({ ...formData, return_time: e.target.value })}
                        className="w-full h-9 rounded-xl border border-slate-800 bg-slate-900 px-3 text-xs font-bold text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-xs text-slate-300">
                  Alasan / Keperluan Izin <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Tuliskan detail keperluan izin santri..."
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-3 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 rounded-2xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-300 font-bold text-xs transition active:scale-95 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || selectedStudentsList.length === 0}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white font-black text-xs shadow-md shadow-emerald-700/20 transition active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Menerbitkan Izin...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 stroke-[3]" />
                      <span>Terbitkan ({selectedStudentsList.length}) Izin</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL SCANNER QR ================= */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <QrCode className="h-5 w-5 text-emerald-400" />
                <h3 className="font-bold text-sm">Pindai Barcode KTS Santri</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowScanner(false);
                  setShowCreateModal(true);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <QRScannerModal
              isOpen={showScanner}
              onClose={() => {
                setShowScanner(false);
                setShowCreateModal(true);
              }}
              onScanSuccess={handleScanSuccess}
              title="Arahkan Kamera ke Barcode KTS"
              description="Arahkan ke KTS santri untuk menambahkan ke rombongan izin"
            />

            <button
              type="button"
              onClick={() => {
                setShowScanner(false);
                setShowCreateModal(true);
              }}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center space-x-1.5 transition active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Selesai Memindai &amp; Kembali ke Formulir</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= DIALOG SUKSES ================= */}
      {showSuccessDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-[32px] border border-slate-800 bg-slate-900 p-6 text-center text-white space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-7 w-7 stroke-[2.5]" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black text-white">
                Berhasil Menerbitkan {lastBatchCount} Surat Izin!
              </h3>
              <p className="text-xs text-slate-400">
                Surat perizinan telah aktif di gerbang dan siap diverifikasi oleh petugas pos satpam.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowSuccessDialog(false)}
              className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs transition cursor-pointer"
            >
              Selesai
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL CETAK SLIP ================= */}
      {selectedPermitForPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-[32px] border border-slate-800 bg-slate-900 p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Printer className="h-4 w-4 text-emerald-400" />
                <h3 className="font-bold text-sm">Slip Izin Resmi Santri</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPermitForPrint(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              id="printable-slip-area"
              className="rounded-2xl border border-slate-300 bg-white p-5 text-slate-950 shadow-inner font-mono text-[11px] space-y-3"
            >
              <div className="text-center border-b-2 border-dashed border-slate-300 pb-3 space-y-1">
                <h4 className="font-black text-sm uppercase tracking-wider text-slate-900">
                  SURAT IZIN RESMI SANTRI
                </h4>
                <p className="text-[10px] font-bold text-[#064e3b]">PONDOK PESANTREN CONDONG</p>
                <p className="text-[9px] text-slate-500 font-sans">
                  No. Tiket: #{selectedPermitForPrint.id.slice(0, 8).toUpperCase()}
                </p>
              </div>

              <div className="space-y-1.5 py-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">Nama Santri:</span>
                  <span className="font-bold text-slate-900 text-right">{selectedPermitForPrint.student_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Nomor Induk (NIS):</span>
                  <span className="font-bold text-slate-900">{selectedPermitForPrint.nis}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Kategori:</span>
                  <span className="font-bold text-slate-900">{selectedPermitForPrint.category}</span>
                </div>
                {selectedPermitForPrint.companion_info && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Pendamping:</span>
                    <span className="font-bold text-slate-900 text-right max-w-[170px] truncate">
                      {selectedPermitForPrint.companion_info}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-600">Keperluan:</span>
                  <span className="font-bold text-slate-900 text-right max-w-[170px] truncate">
                    {selectedPermitForPrint.reason}
                  </span>
                </div>
              </div>

              <div className="border-t border-b border-dashed border-slate-300 py-2 space-y-1 bg-slate-50/80 p-2 rounded-lg">
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-600">Berangkat:</span>
                  <span className="font-bold">
                    {new Date(selectedPermitForPrint.departure_target).toLocaleString("id-ID", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-rose-600 font-bold">Batas Tiba:</span>
                  <span className="font-black text-rose-600">
                    {new Date(selectedPermitForPrint.return_target).toLocaleString("id-ID", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center py-2 space-y-1">
                <div className="p-2 border border-slate-200 rounded-xl bg-white shadow-xs">
                  <QRCodeSVG
                    value={generateStandardQRPayload({
                      nis: selectedPermitForPrint.nis,
                      id: selectedPermitForPrint.student_id,
                    })}
                    size={88}
                    level="M"
                  />
                </div>
                <span className="text-[9px] text-slate-500 text-center font-sans">
                  Tunjukkan QR ini ke Petugas Gerbang Pos Satpam
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSelectedPermitForPrint(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 transition cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-emerald-700 text-white font-black text-xs hover:bg-emerald-800 transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-700/20 cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                <span>Cetak Surat</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Media Styling */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-slip-area,
          #printable-slip-area * {
            visibility: visible;
          }
          #printable-slip-area {
            position: fixed;
            left: 0;
            top: 0;
            width: 80mm;
            padding: 10px;
            margin: 0;
            border: none;
            box-shadow: none;
            background: white !important;
            color: black !important;
          }
        }
      `}</style>
    </div>
  );
}