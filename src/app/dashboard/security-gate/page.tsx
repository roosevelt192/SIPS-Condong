"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { recordAuditLog } from "@/lib/audit";
import { sendParentGateNotification } from "@/lib/whatsapp";
import {
  saveOfflineScan,
  syncOfflineQueueToSupabase,
  getUnsyncedScans,
} from "@/lib/offlineQueue";
import { parseQRCodeText } from "@/lib/qrParser";
import { playScanSound } from "@/lib/feedback";
import {
  ShieldCheck,
  QrCode,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  LogIn,
  Clock,
  RefreshCw,
  Building2,
  Calendar,
  FileText,
  Sparkles,
  Search,
  Users,
  KeyRound,
  Wifi,
  WifiOff,
  CloudUpload,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import QRScannerModal from "@/components/QRScannerModal";

interface StudentInfo {
  id: string;
  nis: string;
  name: string;
  class_name: string;
  dorm: string;
  photo_url?: string;
  parent_phone?: string;
}

interface ActivePermit {
  id: string;
  student_id: string;
  category: string;
  reason: string;
  departure_target: string;
  return_target: string;
  status: "approved" | "out_pondok" | "back_pondok" | "completed";
  created_at: string;
  students?: any;
}

export default function SecurityGatePage() {
  const [showScanner, setShowScanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [manualQuery, setManualQuery] = useState("");

  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [activePermit, setActivePermit] = useState<ActivePermit | null>(null);
  const [scanMessage, setScanMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // State Daftar Antrean Realtime
  const [liveQueue, setLiveQueue] = useState<any[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueFilter, setQueueFilter] = useState<"all" | "approved" | "out_pondok">("all");

  // State PWA Offline Mode & Sync
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const getStudentName = (st: any) => {
    return st?.name || st?.nama_lengkap || st?.nama || st?.full_name || st?.nama_santri || "Santri";
  };

  const getStudentClass = (st: any) => {
    return st?.class || st?.kelas || st?.rombel || "-";
  };

  const getStudentDorm = (st: any) => {
    return st?.dorm || st?.kamar_asrama || st?.asrama || st?.kobong || "-";
  };

  // 1. Monitor Status Online/Offline & Auto-Sync Antrean
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const refreshPendingCount = async () => {
      try {
        const pending = await getUnsyncedScans();
        setPendingSyncCount(pending.length);
      } catch {
        // silent fallback
      }
    };

    const handleOnline = async () => {
      setIsOnline(true);
      setIsSyncing(true);
      try {
        const { syncedCount } = await syncOfflineQueueToSupabase();
        if (syncedCount > 0) {
          playScanSound("success");
          setScanMessage({
            text: `[SINKRONISASI OTOMATIS] ${syncedCount} data tap gerbang offline berhasil disinkronkan ke server.`,
            type: "success",
          });
          fetchLiveQueue();
        }
      } catch (err: any) {
        console.warn("Gagal auto-sync:", err);
      } finally {
        await refreshPendingCount();
        setIsSyncing(false);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    refreshPendingCount();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // 2. Trigger Manual Sinkronisasi Offline
  const handleManualSync = async () => {
    if (!navigator.onLine) {
      alert("Perangkat masih dalam keadaan offline.");
      return;
    }
    setIsSyncing(true);
    try {
      const { syncedCount, failedCount } = await syncOfflineQueueToSupabase();
      const pending = await getUnsyncedScans();
      setPendingSyncCount(pending.length);

      if (failedCount > 0) {
        playScanSound("error");
      } else {
        playScanSound("success");
      }

      setScanMessage({
        text: `Sinkronisasi selesai: ${syncedCount} data berhasil diunggah, ${failedCount} gagal.`,
        type: failedCount > 0 ? "error" : "success",
      });
      fetchLiveQueue();
    } catch (err: any) {
      playScanSound("error");
      setScanMessage({
        text: "Gagal sinkronisasi data: " + err.message,
        type: "error",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // 3. Muat Daftar Antrean Santri Berizin Realtime
  const fetchLiveQueue = async () => {
    if (!navigator.onLine) {
      setQueueLoading(false);
      return;
    }
    setQueueLoading(true);
    try {
      const { data, error } = await supabase
        .from("permissions")
        .select(`
          id,
          student_id,
          category,
          reason,
          departure_target,
          return_target,
          status,
          created_at,
          students (
            id,
            nis,
            name,
            class,
            dorm,
            photo_url
          )
        `)
        .in("status", ["approved", "out_pondok"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLiveQueue(data || []);
    } catch {
      // silent fallback
    } finally {
      setQueueLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveQueue();

    // Supabase Realtime Subscription
    const channel = supabase
      .channel("gate-permissions-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "permissions" },
        () => {
          fetchLiveQueue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const processStudentVerification = async (scannedText: string) => {
    if (!scannedText.trim()) return;
    setLoading(true);
    setScanMessage(null);
    setStudentInfo(null);
    setActivePermit(null);

    try {
      // Ekstrak data via parser universal
      const { searchKey, nis, id } = parseQRCodeText(scannedText);

      let student = null;

      // 1. Cari via ID UUID
      if (id) {
        const { data } = await supabase
          .from("students")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        student = data;
      }

      // 2. Cari via NIS
      if (!student && (nis || searchKey)) {
        const { data: byNis } = await supabase
          .from("students")
          .select("*")
          .eq("nis", nis || searchKey)
          .maybeSingle();
        if (byNis) student = byNis;
      }

      // 3. Fallback: Cari via Nama
      if (!student) {
        const { data: byName } = await supabase
          .from("students")
          .select("*")
          .ilike("name", `%${searchKey}%`)
          .limit(1)
          .maybeSingle();
        if (byName) student = byName;
      }

      // 4. Fallback: Kolom alternatif nama
      if (!student) {
        const { data: byAltName } = await supabase
          .from("students")
          .select("*")
          .or(`nama.ilike.%${searchKey}%,nama_lengkap.ilike.%${searchKey}%`)
          .limit(1)
          .maybeSingle();
        if (byAltName) student = byAltName;
      }

      if (!student) {
        playScanSound("error");
        throw new Error(`Santri dengan kata kunci ("${searchKey}") tidak terdaftar di sistem.`);
      }

      const resolvedStudent: StudentInfo = {
        id: student.id,
        nis: student.nis,
        name: getStudentName(student),
        class_name: getStudentClass(student),
        dorm: getStudentDorm(student),
        photo_url: student.photo_url,
        parent_phone: student.parent_phone || student.no_hp_wali || student.phone_parent || "",
      };
      setStudentInfo(resolvedStudent);

      const { data: permits, error: pErr } = await supabase
        .from("permissions")
        .select("*")
        .eq("student_id", student.id)
        .in("status", ["approved", "out_pondok"])
        .order("created_at", { ascending: false })
        .limit(1);

      if (pErr) throw pErr;

      if (!permits || permits.length === 0) {
        playScanSound("warning");
        setScanMessage({
          text: `Santri ${resolvedStudent.name} (NIS: ${resolvedStudent.nis}) tidak memiliki surat izin aktif yang disetujui Pengasuhan.`,
          type: "error",
        });
      } else {
        playScanSound("success");
        setActivePermit(permits[0]);
      }
    } catch (err: any) {
      playScanSound("error");
      setScanMessage({ text: err.message || "Gagal memproses verifikasi.", type: "error" });
    } finally {
      setLoading(false);
      setManualQuery("");
    }
  };

  const handleScanSuccess = async (decodedText: string) => {
    setShowScanner(false);
    await processStudentVerification(decodedText);
  };

  const handleGateAction = async (actionType: "out" | "in") => {
    if (!activePermit || !studentInfo) return;
    setActionLoading(true);

    const now = new Date();
    const nowIso = now.toISOString();
    const returnTargetDate = new Date(activePermit.return_target);
    const isLate = actionType === "in" ? now > returnTargetDate : false;

    // A. KONDISI OFFLINE: Simpan ke IndexedDB
    if (!navigator.onLine) {
      try {
        await saveOfflineScan({
          id: `${Date.now()}_${activePermit.id}`,
          permit_id: activePermit.id,
          student_nis: studentInfo.nis,
          student_name: studentInfo.name,
          action_type: actionType,
          scan_time: nowIso,
          is_late: isLate,
        });

        const pending = await getUnsyncedScans();
        setPendingSyncCount(pending.length);

        if (isLate) {
          playScanSound("warning");
        } else {
          playScanSound("success");
        }

        setScanMessage({
          text: `[MODE OFFLINE TERSIMPAN] Tap ${studentInfo.name} disimpan di penyimpanan lokal HP dan akan disinkronkan otomatis saat terhubung ke internet.`,
          type: "info",
        });

        setActivePermit((prev) =>
          prev
            ? {
                ...prev,
                status: actionType === "out" ? "out_pondok" : "back_pondok",
              }
            : null
        );
      } catch (e: any) {
        playScanSound("error");
        setScanMessage({
          text: "Gagal menyimpan scan offline: " + e.message,
          type: "error",
        });
      } finally {
        setActionLoading(false);
      }
      return;
    }

    // B. KONDISI ONLINE: Eksekusi Normal Supabase
    try {
      const updatePayload =
        actionType === "out"
          ? { status: "out_pondok", actual_out_at: nowIso }
          : { status: "back_pondok", actual_in_at: nowIso };

      const { error } = await supabase
        .from("permissions")
        .update(updatePayload)
        .eq("id", activePermit.id);

      if (error) throw error;

      // 1. Rekam Audit Log
      await recordAuditLog({
        action: actionType === "out" ? "GATE_SCAN_OUT" : "GATE_SCAN_IN",
        target_type: "permissions",
        target_id: activePermit.id,
        details: {
          santri_name: studentInfo.name,
          santri_nis: studentInfo.nis,
          status_izin: actionType === "out" ? "out_pondok" : "back_pondok",
          kategori: activePermit.category,
          waktu_aktual: nowIso,
          terlambat: isLate,
        },
      });

      // 2. Kirim Notifikasi WhatsApp Otomatis ke Wali Santri
      if (studentInfo.parent_phone) {
        sendParentGateNotification({
          phone: studentInfo.parent_phone,
          studentName: studentInfo.name,
          nis: studentInfo.nis,
          actionType: actionType,
          reason: activePermit.reason,
          targetTime:
            actionType === "out"
              ? activePermit.return_target
              : activePermit.departure_target,
          isLate: isLate,
        }).catch((e) => console.warn("Background WA error:", e));
      }

      // 3. Audio & Haptic Feedback
      if (isLate) {
        playScanSound("warning");
      } else {
        playScanSound("success");
      }

      // 4. Update Feedback UI
      if (actionType === "out") {
        setScanMessage({
          text: `[KELUAR GERBANG] ${studentInfo.name} resmi tercatat meninggalkan komplek pesantren.`,
          type: "info",
        });
      } else {
        const diffMinutes = Math.round(
          (now.getTime() - returnTargetDate.getTime()) / (1000 * 60)
        );

        setScanMessage({
          text: isLate
            ? `[KEMBALI KE PONDOK - TERLAMBAT] ${studentInfo.name} tiba melewati batas waktu (${diffMinutes} menit terlambat).`
            : `[KEMBALI KE PONDOK - TEPAT WAKTU] ${studentInfo.name} telah kembali sesuai jadwal.`,
          type: isLate ? "error" : "success",
        });
      }

      setActivePermit((prev) =>
        prev
          ? {
              ...prev,
              status: actionType === "out" ? "out_pondok" : "back_pondok",
            }
          : null
      );
      fetchLiveQueue();
    } catch (err: any) {
      playScanSound("error");
      setScanMessage({
        text: "Gagal memproses gerbang: " + err.message,
        type: "error",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const isOverdue = (permit: ActivePermit) => {
    if (permit.status === "out_pondok") {
      return new Date() > new Date(permit.return_target);
    }
    return false;
  };

  const filteredQueue = liveQueue.filter((item) => {
    if (queueFilter === "approved") return item.status === "approved";
    if (queueFilter === "out_pondok") return item.status === "out_pondok";
    return true;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans relative pb-12 transition-all">
      {/* HEADER POS GERBANG */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-5 sm:p-6 shadow-xl backdrop-blur-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <Link
            href="/dashboard"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition active:scale-95 shadow-sm"
            title="Kembali ke Dashboard"
          >
            <ArrowLeft className="h-5 w-5 stroke-[2.3]" />
          </Link>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-inner">
            <ShieldCheck className="h-6 w-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Pos Gerbang &amp; Verifikasi Keluar/Masuk
              </h1>

              {/* Status Sinyal Jaringan Badge */}
              <div
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-black border ${
                  isOnline
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 animate-pulse"
                }`}
              >
                {isOnline ? (
                  <>
                    <Wifi className="h-3 w-3 stroke-[2.5]" />
                    <span>Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3 stroke-[2.5]" />
                    <span>Offline</span>
                  </>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Portal satpam untuk validasi surat izin santri dan pemindaian barcode KTS
            </p>
          </div>
        </div>

        {/* Action Group: Antrean Offline Sync, Scan Kamera & Refresh */}
        <div className="flex items-center flex-wrap gap-2.5">
          {pendingSyncCount > 0 && (
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing || !isOnline}
              className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition active:scale-95 text-xs font-bold cursor-pointer disabled:opacity-50"
              title="Sinkronkan data scan offline ke server"
            >
              <CloudUpload className={`h-4 w-4 ${isSyncing ? "animate-bounce" : ""}`} />
              <span>{isSyncing ? "Syncing..." : `${pendingSyncCount} Antrean Sync`}</span>
            </button>
          )}

          <button
            type="button"
            onClick={fetchLiveQueue}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition active:scale-95 shadow-xs cursor-pointer"
            title="Muat Ulang Antrean"
          >
            <RefreshCw className={`h-4.5 w-4.5 ${queueLoading ? "animate-spin text-indigo-500" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => setShowScanner(true)}
            className="group relative inline-flex items-center justify-center space-x-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-5 py-3 text-xs font-black text-white shadow-lg shadow-indigo-600/25 transition-all duration-300 hover:shadow-indigo-600/40 hover:scale-[1.02] active:scale-95 cursor-pointer"
          >
            <QrCode className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12" />
            <span>Buka Scanner Kamera</span>
            <Sparkles className="h-3.5 w-3.5 opacity-60 animate-pulse" />
          </button>
        </div>
      </div>

      {/* FALLBACK INPUT CEPAT SATPAM (TANPA KAMERA) */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            processStudentVerification(manualQuery);
          }}
          className="flex flex-col sm:flex-row gap-2.5"
        >
          <div className="relative flex-1 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none" />
            <input
              type="text"
              value={manualQuery}
              onChange={(e) => setManualQuery(e.target.value)}
              placeholder="Input Manual: Ketik NIS atau Nama Santri (misal: 'abdul' atau '20260001')..."
              className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 pl-10 pr-3.5 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !manualQuery.trim()}
            className="h-11 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-black transition active:scale-95 disabled:opacity-40 flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>Verifikasi Manual</span>
          </button>
        </form>
      </div>

      {/* NOTIFIKASI HASIL SCAN */}
      {scanMessage && (
        <div
          className={`p-4 rounded-3xl border flex items-center gap-3 text-xs font-bold shadow-md animate-in fade-in duration-300 ${
            scanMessage.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
              : scanMessage.type === "error"
              ? "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
              : "bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-300"
          }`}
        >
          {scanMessage.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
          ) : (
            <AlertTriangle className="h-5 w-5 shrink-0 text-rose-500" />
          )}
          <span>{scanMessage.text}</span>
        </div>
      )}

      {/* HASIL PEMINDAIAN SANTRI AKTIF */}
      {loading ? (
        <div className="py-14 text-center text-slate-400 space-y-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-500" />
          <p className="text-xs font-bold tracking-wide uppercase">Memvalidasi Status Izin Santri...</p>
        </div>
      ) : studentInfo ? (
        <div className="group relative overflow-hidden rounded-3xl border border-indigo-500/30 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-2xl space-y-5 transition-all animate-in zoom-in-95">
          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-4">
              <div className="h-16 w-16 sm:h-18 sm:w-18 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-cyan-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-2xl shrink-0 overflow-hidden shadow-sm">
                {studentInfo.photo_url ? (
                  <img src={studentInfo.photo_url} alt="" className="h-full w-full object-cover object-top" />
                ) : (
                  studentInfo.name.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Identitas Santri Terpilih:</span>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-tight">
                  {studentInfo.name}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                  NIS: <span className="text-indigo-600 dark:text-indigo-400 font-bold">{studentInfo.nis}</span> &bull; Kelas: {studentInfo.class_name} &bull; Asrama: {studentInfo.dorm}
                </p>
              </div>
            </div>

            <div>
              {activePermit ? (
                activePermit.status === "approved" ? (
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 text-xs font-black uppercase tracking-wider">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Izin Disetujui ({activePermit.category})</span>
                  </span>
                ) : activePermit.status === "out_pondok" ? (
                  isOverdue(activePermit) ? (
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/40 text-xs font-black uppercase tracking-wider animate-bounce">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>Sedang Di Luar (Terlambat)</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-black uppercase tracking-wider">
                      <Building2 className="h-3.5 w-3.5" />
                      <span>Sedang Di Luar Pondok</span>
                    </span>
                  )
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-black uppercase tracking-wider">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Sudah Kembali</span>
                  </span>
                )
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-black uppercase tracking-wider">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Tidak Ada Izin Aktif</span>
                </span>
              )}
            </div>
          </div>

          {/* Rincian Izin */}
          {activePermit && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center space-x-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 block">Waktu Berangkat:</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {new Date(activePermit.departure_target).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </div>
                </div>

                <div
                  className={`flex items-center space-x-3 p-3 rounded-2xl border ${
                    isOverdue(activePermit)
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-600"
                      : "bg-slate-50 dark:bg-slate-950/60 border-slate-200/80 dark:border-slate-800"
                  }`}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 block">Batas Kembali:</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {new Date(activePermit.return_target).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 p-3.5 space-y-1">
                <div className="flex items-center space-x-1.5 text-slate-400 text-xs font-bold">
                  <FileText className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Keperluan / Alasan Izin:</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-medium leading-relaxed">
                  {activePermit.reason}
                </p>
              </div>
            </div>
          )}

          {/* Tombol Aksi Verifikasi */}
          {activePermit && (
            <div className="pt-1">
              {activePermit.status === "approved" ? (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleGateAction("out")}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-xs shadow-lg shadow-orange-500/25 transition hover:shadow-orange-500/40 active:scale-95 flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {actionLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <LogOut className="h-4 w-4 stroke-[2.5]" />
                      <span>Verifikasi KELUAR PONDOK</span>
                    </>
                  )}
                </button>
              ) : activePermit.status === "out_pondok" ? (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleGateAction("in")}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-xs shadow-lg shadow-emerald-600/25 transition hover:shadow-emerald-600/40 active:scale-95 flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {actionLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <LogIn className="h-4 w-4 stroke-[2.5]" />
                      <span>Verifikasi KEMBALI KE PONDOK</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="p-3 text-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 font-bold text-xs flex items-center justify-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Surat izin telah selesai divalidasi.</span>
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}

      {/* ================= DAFTAR ANTREAN REALTIME SANTRI BERIZIN ================= */}
      <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="h-8 w-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
                Live Feed: Santri Berizin dari Pengasuhan
              </h2>
              <p className="text-[11px] text-slate-400">
                Santri yang telah disetujui izinnya &amp; siap diverifikasi di pos gerbang
              </p>
            </div>
          </div>

          {/* Filter Tab */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setQueueFilter("all")}
              className={`px-3 py-1 rounded-lg transition ${
                queueFilter === "all" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-black" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Semua ({liveQueue.length})
            </button>
            <button
              type="button"
              onClick={() => setQueueFilter("approved")}
              className={`px-3 py-1 rounded-lg transition ${
                queueFilter === "approved" ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs font-black" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Siap Keluar ({liveQueue.filter((q) => q.status === "approved").length})
            </button>
            <button
              type="button"
              onClick={() => setQueueFilter("out_pondok")}
              className={`px-3 py-1 rounded-lg transition ${
                queueFilter === "out_pondok" ? "bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs font-black" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Di Luar ({liveQueue.filter((q) => q.status === "out_pondok").length})
            </button>
          </div>
        </div>

        {/* Tabel / Grid Kartu Antrean */}
        {queueLoading ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-500" />
            <p className="text-xs font-semibold">Memuat data realtime...</p>
          </div>
        ) : filteredQueue.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs">
            <p className="font-semibold">Tidak ada santri dalam antrean perizinan saat ini.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredQueue.map((item) => {
              const student = item.students;
              const isLate = item.status === "out_pondok" && new Date() > new Date(item.return_target);

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-4 space-y-3 hover:border-indigo-500/40 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-cyan-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-sm shrink-0 overflow-hidden">
                        {student?.photo_url ? (
                          <img src={student.photo_url} alt="" className="h-full w-full object-cover object-top" />
                        ) : (
                          student?.name?.charAt(0).toUpperCase() || "S"
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {student?.name || "Santri"}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono truncate">
                          NIS: {student?.nis} &bull; {student?.class}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[9.5px] px-2 py-0.5 rounded-lg border font-bold ${
                        item.status === "approved"
                          ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20"
                          : isLate
                          ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 animate-pulse"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                      }`}
                    >
                      {item.status === "approved" ? "Siap Keluar" : isLate ? "Terlambat" : "Di Luar"}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-1">
                    <p className="font-semibold truncate">
                      <span className="text-slate-400">Keperluan:</span> {item.reason}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Batas Kembali: {new Date(item.return_target).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => processStudentVerification(student?.nis || item.student_id)}
                    className="w-full py-2 rounded-xl bg-slate-900 hover:bg-indigo-600 dark:bg-slate-800 dark:hover:bg-indigo-600 text-white text-[11px] font-bold transition active:scale-95 flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Pilih &amp; Verifikasi Gerbang</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL SCANNER GERBANG */}
      <QRScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScanSuccess={handleScanSuccess}
        title="Pemindai Pos Gerbang Keamanan"
        description="Arahkan kamera ke barcode KTS santri atau slip izin fisik"
      />
    </div>
  );
}