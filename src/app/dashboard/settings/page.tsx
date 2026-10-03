"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Settings,
  ArrowLeft,
  MessageSquare,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Calendar,
  Plus,
  ArrowRightLeft,
  X,
  Sparkles,
  UserCheck,
  Search,
  Trash2,
  AlertTriangle,
  History,
  Download,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { playScanSound } from "@/lib/feedback";

interface AcademicYear {
  id: string;
  year_name: string;
  is_active: boolean;
}

interface SeniorStudent {
  id: string;
  name: string;
  nis: string;
  class: string;
}

interface TransitionLog {
  id: string;
  target_year: string;
  executed_by: string;
  total_processed: number;
  total_graduated: number;
  total_continuing: number;
  created_at: string;
}

export default function SettingsPage() {
  const [waEnabled, setWaEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);

  // Academic Years States
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [newYearName, setNewYearName] = useState("");
  const [isAddingYear, setIsAddingYear] = useState(false);

  // Transition Logs States
  const [transitionLogs, setTransitionLogs] = useState<TransitionLog[]>([]);

  // Delete Confirmation Modal State
  const [yearToDelete, setYearToDelete] = useState<{ id: string; year_name: string } | null>(null);
  const [isDeletingYear, setIsDeletingYear] = useState(false);

  // Wizard Modal States
  const [showWizardModal, setShowWizardModal] = useState(false);
  const [targetAcademicYear, setTargetAcademicYear] = useState("");
  const [resetPoints, setResetPoints] = useState(true);
  const [seniorStudents, setSeniorStudents] = useState<SeniorStudent[]>([]);
  const [continuingIds, setContinuingIds] = useState<string[]>([]);
  const [wizardSearchQuery, setWizardSearchQuery] = useState("");
  const [isProcessingWizard, setIsProcessingWizard] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;

        if (user) {
          setUserEmail(user.email || "Admin");
          const { data: profiles, error: profError } = await supabase
            .from("profiles")
            .select("role, status")
            .eq("id", user.id)
            .limit(1);

          if (profError) {
            console.error("Supabase Profile Error:", profError.message);
          } else if (profiles && profiles.length > 0) {
            setUserRole(profiles[0].role || "");
          } else if (user.email === "wezefaiq75@gmail.com") {
            setUserRole("super_admin");
          }
        }

        const { data: settingsData } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "wa_notifications_enabled")
          .limit(1);

        if (settingsData && settingsData.length > 0) {
          setWaEnabled(settingsData[0].value === true);
        }

        await fetchAcademicYearsList();
        await fetchSeniorStudents();
        await fetchTransitionLogs();
      } catch (err) {
        console.warn("Gagal memuat setting:", err);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  async function fetchAcademicYearsList() {
    const { data: yearsData } = await supabase
      .from("academic_years")
      .select("*")
      .order("year_name", { ascending: false });

    if (yearsData) {
      setAcademicYears(yearsData);
    }
  }

  async function fetchSeniorStudents() {
    const { data: seniors } = await supabase
      .from("students")
      .select("id, full_name, nama_lengkap, name, nis, class")
      .eq("status", "active");

    if (seniors) {
      const filteredSeniors = seniors
        .map((s: any) => ({
          id: s.id,
          name: s.full_name || s.nama_lengkap || s.name || "Tanpa Nama",
          nis: s.nis || "-",
          class: (s.class || "").trim(),
        }))
        .filter(
          (s) =>
            s.class.toLowerCase().includes("3 kmi") ||
            s.class.toLowerCase().includes("ix") ||
            s.class.toLowerCase().includes("12") ||
            s.class.toLowerCase().includes("6 kmi")
        );

      setSeniorStudents(filteredSeniors);
    }
  }

  async function fetchTransitionLogs() {
    const { data: logs } = await supabase
      .from("academic_transition_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    if (logs) {
      setTransitionLogs(logs);
    }
  }

  const handleToggleWhatsApp = async () => {
    if (userRole !== "super_admin") {
      setMessage("Hanya Super Admin yang berhak mengubah konfigurasi ini.");
      return;
    }

    setSaving(true);
    setMessage(null);
    const nextState = !waEnabled;

    try {
      const { error } = await supabase
        .from("system_settings")
        .upsert({
          key: "wa_notifications_enabled",
          value: nextState,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      setWaEnabled(nextState);
      playScanSound("success");
      setMessage(
        `Notifikasi WhatsApp berhasil ${nextState ? "DIAKTIFKAN" : "DINONAKTIFKAN"}.`
      );
    } catch (err: any) {
      playScanSound("error");
      setMessage("Gagal memperbarui pengaturan: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddAndOpenWizard = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanYear = newYearName.trim();
    if (!cleanYear) return;

    if (userRole !== "super_admin") {
      setMessage("Hanya Super Admin yang berhak membuat tahun ajaran baru.");
      return;
    }

    setIsAddingYear(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from("academic_years")
        .insert([{ year_name: cleanYear, is_active: false }]);

      if (error) throw error;

      playScanSound("success");
      setNewYearName("");
      await fetchAcademicYearsList();

      setTargetAcademicYear(cleanYear);
      setShowWizardModal(true);
    } catch (err: any) {
      playScanSound("error");
      setMessage("Gagal menambah tahun ajaran: " + err.message);
    } finally {
      setIsAddingYear(false);
    }
  };

  const handleSetActiveYear = async (id: string, yearName: string) => {
    if (userRole !== "super_admin") {
      setMessage("Hanya Super Admin yang berhak mengubah tahun ajaran aktif.");
      return;
    }

    setMessage(null);
    try {
      await supabase.from("academic_years").update({ is_active: false }).neq("id", "0");

      const { error } = await supabase
        .from("academic_years")
        .update({ is_active: true })
        .eq("id", id);

      if (error) throw error;

      playScanSound("success");
      setMessage(`Tahun ajaran aktif berhasil diubah ke ${yearName}.`);
      await fetchAcademicYearsList();
    } catch (err: any) {
      playScanSound("error");
      setMessage("Gagal mengubah tahun aktif: " + err.message);
    }
  };

  const handleConfirmDeleteYear = async () => {
    if (!yearToDelete) return;

    if (userRole !== "super_admin") {
      setMessage("Hanya Super Admin yang berhak menghapus tahun ajaran.");
      return;
    }

    setIsDeletingYear(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from("academic_years")
        .delete()
        .eq("id", yearToDelete.id);

      if (error) throw error;

      playScanSound("success");
      setMessage(`Tahun ajaran ${yearToDelete.year_name} berhasil dihapus.`);
      setYearToDelete(null);
      await fetchAcademicYearsList();
    } catch (err: any) {
      playScanSound("error");
      setMessage("Gagal menghapus tahun ajaran: " + err.message);
    } finally {
      setIsDeletingYear(false);
    }
  };

  const toggleContinueStudent = (id: string) => {
    setContinuingIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllSeniors = () => {
    setContinuingIds(seniorStudents.map((s) => s.id));
  };

  const handleDeselectAllSeniors = () => {
    setContinuingIds([]);
  };

  const filteredSeniorStudents = useMemo(() => {
    const q = wizardSearchQuery.toLowerCase().trim();
    if (!q) return seniorStudents;
    return seniorStudents.filter(
      (s) => s.name.toLowerCase().includes(q) || s.nis.toLowerCase().includes(q)
    );
  }, [seniorStudents, wizardSearchQuery]);

  // Fitur Otomatis Unduh CSV Snapshot sebelum Transisi
  const downloadBackupSnapshot = async () => {
    const { data: allStudents } = await supabase.from("students").select("*");
    if (!allStudents || allStudents.length === 0) return;

    const headers = ["NIS", "Nama", "Kelas", "Kamar", "Status", "Poin"];
    const rows = allStudents.map((s: any) => [
      s.nis,
      `"${s.full_name || s.nama_lengkap || s.name || ""}"`,
      s.class,
      s.dorm,
      s.status,
      s.points,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e: any) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Snapshot_Santri_Sebelum_Transisi_${targetAcademicYear.replace("/", "-")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExecuteTransitionWizard = async () => {
    if (userRole !== "super_admin") {
      setMessage("Akses ditolak. Hanya Super Admin yang dapat menjalankan wizard transisi.");
      return;
    }

    setIsProcessingWizard(true);
    setMessage(null);

    try {
      // 1. Unduh file backup snapshot otomatis
      await downloadBackupSnapshot();

      // 2. Set tahun ajaran target menjadi aktif secara eksklusif
      await supabase.from("academic_years").update({ is_active: false }).neq("id", "0");
      const { error: activeErr } = await supabase
        .from("academic_years")
        .update({ is_active: true })
        .eq("year_name", targetAcademicYear);

      if (activeErr) throw activeErr;

      const { data: students, error: fetchErr } = await supabase
        .from("students")
        .select("id, nis, class, dorm, status, points")
        .eq("status", "active");

      if (fetchErr) throw fetchErr;

      let totalGraduated = 0;
      let totalContinuing = 0;
      let totalProcessed = students ? students.length : 0;

      if (students && students.length > 0) {
        for (const s of students) {
          await supabase.from("student_histories").upsert(
            [
              {
                student_id: s.id,
                nis: s.nis,
                academic_year: targetAcademicYear,
                class: s.class,
                dorm: s.dorm,
                status: s.status,
              },
            ],
            { onConflict: "student_id,academic_year" }
          );

          const currentClass = s.class.trim();
          let nextClass = currentClass;
          let newStatus = "active";

          const isSenior =
            currentClass.toLowerCase().includes("3 kmi") ||
            currentClass.toLowerCase().includes("ix");

          if (isSenior) {
            if (continuingIds.includes(s.id)) {
              nextClass = "4 KMI";
              newStatus = "active";
              totalContinuing++;
            } else {
              newStatus = "graduated";
              totalGraduated++;
            }
          } else {
            if (currentClass.startsWith("1")) nextClass = "2 KMI";
            else if (currentClass.startsWith("2")) nextClass = "3 KMI";
          }

          const updatePayload: any = { class: nextClass, status: newStatus };
          if (resetPoints) updatePayload.points = 100;

          await supabase.from("students").update(updatePayload).eq("id", s.id);
        }
      }

      // 3. Catat log riwayat transisi
      await supabase.from("academic_transition_logs").insert([
        {
          target_year: targetAcademicYear,
          executed_by: userEmail,
          total_processed: totalProcessed,
          total_graduated: totalGraduated,
          total_continuing: totalContinuing,
          reset_points_applied: resetPoints,
        },
      ]);

      playScanSound("success");
      setMessage(`Transisi ke Tahun Ajaran ${targetAcademicYear} berhasil dijalankan & file backup diunduh!`);
      setShowWizardModal(false);
      await fetchAcademicYearsList();
      await fetchSeniorStudents();
      await fetchTransitionLogs();
    } catch (err: any) {
      playScanSound("error");
      setMessage("Gagal menjalankan transisi: " + err.message);
    } finally {
      setIsProcessingWizard(false);
    }
  };

  const activeYearName = useMemo(() => {
    return academicYears.find((y) => y.is_active)?.year_name || "2026/2027";
  }, [academicYears]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto tracking-normal pb-16 relative">
      <div className="pointer-events-none absolute -top-10 -right-10 h-72 w-72 rounded-full bg-emerald-500/10 blur-[100px]" />
      <div className="pointer-events-none absolute top-48 -left-10 h-72 w-72 rounded-full bg-teal-500/10 blur-[100px]" />

      <div className="relative overflow-hidden rounded-[36px] bg-gradient-to-r from-emerald-950 via-[#064e3b] to-teal-950 p-6 sm:p-8 text-white shadow-2xl border border-emerald-500/40">
        <div className="relative z-10 flex items-center space-x-4">
          <Link
            href="/dashboard"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-all active:scale-90 shadow-sm backdrop-blur-md"
            title="Kembali ke Dashboard Utama"
          >
            <ArrowLeft className="h-5 w-5 stroke-[2.4]" />
          </Link>

          <div className="relative flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 via-emerald-500 to-teal-400 text-slate-950 shadow-lg font-black">
            <Settings className="h-6 w-6 stroke-[2.3]" />
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-emerald-200 text-[10px] font-black uppercase tracking-wider backdrop-blur-xl">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                SYSTEM &amp; INTEGRATION
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-emerald-100 to-amber-300 bg-clip-text text-transparent truncate">
              Pengaturan &amp; Integrasi Sistem
            </h1>
            <p className="text-xs text-emerald-100/90 font-medium truncate">
              Kelola modul otomatisasi, tahun ajaran, dan transisi akademik secara terpadu
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div className="p-4 rounded-3xl border border-emerald-500/30 bg-emerald-950/40 text-xs font-bold text-emerald-300 flex items-center gap-2.5 animate-in fade-in backdrop-blur-md">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{message}</span>
        </div>
      )}

      {/* PANEL UTAMA */}
      <div className="rounded-[32px] border border-slate-200/80 dark:border-emerald-900/40 bg-white/90 dark:bg-[#0c1815] p-6 sm:p-7 shadow-xl backdrop-blur-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-emerald-900/30 pb-4">
          <div className="flex items-center space-x-3.5">
            <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20 shadow-inner">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">
                Manajemen Tahun Ajaran &amp; Transisi Akademik
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ketik tahun ajaran baru untuk langsung memulai proses transisi dan kenaikan kelas
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold">
            <ShieldAlert className="h-3.5 w-3.5" />
            Admin Only
          </span>
        </div>

        <form onSubmit={handleAddAndOpenWizard} className="flex flex-col sm:flex-row items-center gap-3">
          <input
            type="text"
            value={newYearName}
            onChange={(e) => setNewYearName(e.target.value)}
            disabled={userRole !== "super_admin"}
            placeholder="Contoh: 2027/2028"
            className="h-11 flex-1 rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 px-4 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isAddingYear || userRole !== "super_admin" || !newYearName.trim()}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-5 py-3 text-xs font-black text-white shadow-lg shadow-emerald-600/20 transition active:scale-95 cursor-pointer disabled:opacity-40"
          >
            {isAddingYear ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 stroke-[2.5]" />}
            <span>Tambah Tahun &amp; Buka Wizard</span>
          </button>
        </form>

        <div className="space-y-3">
          <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
            Periode Akademik Terdaftar
          </label>

          {loading ? (
            <div className="py-6 text-center text-slate-400 text-xs">Memuat data tahun ajaran...</div>
          ) : academicYears.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-xs">Belum ada tahun ajaran terdaftar.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {academicYears.map((y) => {
                const isFuture = y.year_name > activeYearName;
                return (
                  <div
                    key={y.id}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition ${
                      y.is_active
                        ? "border-emerald-500 bg-emerald-500/10 shadow-sm"
                        : "border-slate-200 dark:border-emerald-900/40 bg-slate-50/50 dark:bg-emerald-950/20"
                    }`}
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                          {y.year_name}
                        </span>
                        {y.is_active && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 text-slate-950 px-2 py-0.5 text-[10px] font-black uppercase">
                            <CheckCircle2 className="h-3 w-3" />
                            Aktif
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                        {y.is_active
                          ? "Sistem operasional utama"
                          : isFuture
                          ? "Periode mendatang / Belum dimulai"
                          : "Arsip historis"}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {!y.is_active && (
                        <button
                          type="button"
                          disabled={userRole !== "super_admin"}
                          onClick={() => handleSetActiveYear(y.id, y.year_name)}
                          className="rounded-xl border border-slate-300 dark:border-emerald-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-700 transition cursor-pointer active:scale-95 disabled:opacity-40"
                        >
                          Aktifkan
                        </button>
                      )}

                      {!y.is_active && (
                        <button
                          type="button"
                          disabled={userRole !== "super_admin"}
                          onClick={() => setYearToDelete({ id: y.id, year_name: y.year_name })}
                          className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-xl transition cursor-pointer active:scale-95"
                          title="Hapus Tahun Ajaran"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* LOG RIWAYAT TRANSISI AKADEMIK */}
        <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-emerald-900/30">
          <div className="flex items-center space-x-2">
            <History className="h-4 w-4 text-emerald-500" />
            <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
              Log Riwayat Transisi Akademik
            </label>
          </div>

          {transitionLogs.length === 0 ? (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/40 text-center text-slate-400 text-xs">
              Belum ada riwayat transisi tahun ajaran yang tercatat.
            </div>
          ) : (
            <div className="space-y-2">
              {transitionLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl border border-slate-200 dark:border-emerald-900/40 bg-slate-50/50 dark:bg-emerald-950/10 text-xs gap-2"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900 dark:text-white">
                        Transisi ke {log.target_year}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                        {log.total_processed} Santri Diproses
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Oleh: <span className="font-mono">{log.executed_by}</span> • Lulus: {log.total_graduated} • Lanjut: {log.total_continuing}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(log.created_at).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* PANEL 2: SAKELAR WHATSAPP */}
      <div className="rounded-[32px] border border-slate-200/80 dark:border-emerald-900/40 bg-white/90 dark:bg-[#0c1815] p-6 sm:p-7 shadow-xl backdrop-blur-xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20 shadow-inner">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-black text-slate-900 dark:text-white">
                Otomatisasi Notifikasi WhatsApp Wali Santri
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg leading-relaxed">
                Jika diaktifkan, sistem akan otomatis mengirimkan pesan WhatsApp ke nomor orang tua/wali setiap kali santri diverifikasi di pos gerbang (keluar atau kembali).
              </p>
            </div>
          </div>

          {loading ? (
            <RefreshCw className="h-5 w-5 animate-spin text-emerald-600" />
          ) : (
            <button
              type="button"
              disabled={saving || userRole !== "super_admin"}
              onClick={handleToggleWhatsApp}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-40 ${
                waEnabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  waEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          )}
        </div>

        {userRole !== "super_admin" && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2.5 text-xs text-amber-700 dark:text-amber-300 font-semibold">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
            <span>Hanya akun dengan role Super Admin yang diizinkan mengubah konfigurasi sistem ini.</span>
          </div>
        )}
      </div>

      {/* MODAL KONFIRMASI HAPUS TAHUN AJARAN */}
      {yearToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md overflow-hidden rounded-[32px] border border-slate-800 bg-slate-900/95 p-6 sm:p-7 shadow-2xl text-white space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 shadow-lg shadow-rose-500/10">
                  <AlertTriangle className="h-6 w-6 stroke-[2.3]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">
                    Hapus Tahun Ajaran?
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Periode <strong className="text-emerald-400">{yearToDelete.year_name}</strong> akan dihapus permanen
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setYearToDelete(null)}
                className="text-slate-400 hover:text-white rounded-xl p-1 hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-2xl border border-rose-500/20 bg-rose-950/20 p-4 text-xs text-rose-300 leading-relaxed">
              ⚠️ Perhatian: Menghapus tahun ajaran ini akan membersihkan entri terkait dari database sistem SIPS. Tindakan ini tidak dapat dibatalkan.
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setYearToDelete(null)}
                disabled={isDeletingYear}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 py-3 text-xs font-bold text-slate-300 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleConfirmDeleteYear}
                disabled={isDeletingYear}
                className="flex-1 inline-flex items-center justify-center space-x-2 rounded-xl bg-rose-600 hover:bg-rose-500 py-3 text-xs font-bold text-white shadow-lg shadow-rose-600/30 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isDeletingYear ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>Ya, Hapus Tahun Ajaran</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL WIZARD TRANSISI */}
      {showWizardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-2xl overflow-hidden rounded-[32px] border border-slate-800 bg-slate-900/95 p-6 sm:p-8 shadow-2xl text-white space-y-5 animate-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4 shrink-0">
              <div className="flex items-center space-x-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-lg shadow-amber-500/10">
                  <Sparkles className="h-6 w-6 stroke-[2.3]" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                    Konfigurasi Transisi Tahun Ajaran Baru ({targetAcademicYear})
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Sistem akan otomatis mengunduh file backup (*.csv) sebelum proses migrasi dijalankan.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowWizardModal(false)}
                className="text-slate-400 hover:text-white rounded-xl p-1.5 hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1 text-xs flex-1">
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 flex items-center gap-3 text-emerald-300">
                <Download className="h-5 w-5 shrink-0 text-emerald-400" />
                <span>Fitur Keamanan Aktif: File backup data santri (*.csv) akan otomatis tersimpan ke komputer Anda sesaat sebelum transisi dieksekusi.</span>
              </div>

              <div className="space-y-2.5 pt-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <UserCheck className="h-4 w-4 text-emerald-400" />
                    Pengecualian: Santri Kelas 3 KMI yang Lanjut ke Kelas 4
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllSeniors}
                      className="text-[10px] font-bold text-emerald-400 hover:underline bg-emerald-950/50 px-2 py-1 rounded border border-emerald-500/20"
                    >
                      Pilih Semua
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllSeniors}
                      className="text-[10px] font-bold text-slate-400 hover:underline bg-slate-800 px-2 py-1 rounded border border-slate-700"
                    >
                      Batalkan Semua
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Secara default santri tingkat akhir akan diluluskan. Centang nama santri di bawah ini jika mereka <strong>lanjut ke Kelas 4 KMI</strong>:
                </p>

                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={wizardSearchQuery}
                    onChange={(e) => setWizardSearchQuery(e.target.value)}
                    placeholder="Cari nama atau NIS santri tingkat akhir..."
                    className="h-10 w-full rounded-xl border border-slate-800 bg-slate-950 pl-9 pr-3 text-xs font-semibold text-white placeholder-slate-500 outline-none focus:border-emerald-500"
                  />
                </div>

                {seniorStudents.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-center text-slate-500 text-xs">
                    Tidak ada santri berstatus Kelas 3 KMI / IX aktif saat ini.
                  </div>
                ) : filteredSeniorStudents.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-center text-slate-500 text-xs">
                    Tidak ditemukan santri yang cocok dengan kata kunci pencarian.
                  </div>
                ) : (
                  <div className="max-h-52 overflow-y-auto space-y-1.5 rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
                    {filteredSeniorStudents.map((sr) => {
                      const isChecked = continuingIds.includes(sr.id);
                      return (
                        <div
                          key={sr.id}
                          onClick={() => toggleContinueStudent(sr.id)}
                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                            isChecked
                              ? "border-emerald-500/50 bg-emerald-500/10 text-white shadow-sm"
                              : "border-slate-800/80 bg-slate-900/60 text-slate-300 hover:border-slate-700"
                          }`}
                        >
                          <div>
                            <p className="font-bold text-xs">{sr.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">NIS: {sr.nis} • {sr.class}</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer h-4 w-4"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2.5 pt-2 border-t border-slate-800">
                <input
                  type="checkbox"
                  id="resetPointsCheck"
                  checked={resetPoints}
                  onChange={(e) => setResetPoints(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer h-4 w-4"
                />
                <label htmlFor="resetPointsCheck" className="text-slate-300 font-semibold cursor-pointer">
                  Reset poin disiplin seluruh santri kembali maksimal (100 Poin)
                </label>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setShowWizardModal(false)}
                disabled={isProcessingWizard}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 py-3 text-xs font-bold text-slate-300 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleExecuteTransitionWizard}
                disabled={isProcessingWizard}
                className="flex-1 inline-flex items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 py-3 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isProcessingWizard ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Memproses Transisi...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Backup &amp; Jalankan Transisi</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}