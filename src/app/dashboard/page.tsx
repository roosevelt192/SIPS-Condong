"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  LogOut,
  ShieldAlert,
  LogIn,
  CheckCheck,
  RefreshCw,
  ArrowRight,
  Sparkles,
  QrCode,
  FileCheck2,
  Trophy,
  IdCard,
  FileSpreadsheet,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ChevronRight,
  Layers,
  Activity,
  ShieldCheck,
  TrendingUp,
  Compass,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface PermissionRecord {
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

interface ViolationRecord {
  id: string;
  student_name: string;
  nis: string;
  violation_name: string;
  category: string;
  points: number;
  created_at: string;
}

interface AchievementRecord {
  id: string;
  student_name: string;
  nis: string;
  title: string;
  level: string;
  reward_points: number;
  created_at: string;
}

export default function DashboardLivePage() {
  const router = useRouter();

  // ================= 1. AUTH CHECK =================
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // ================= 2. DATA STATES =================
  const [totalStudents, setTotalStudents] = useState(0);
  const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
  const [violations, setViolations] = useState<ViolationRecord[]>([]);
  const [achievements, setAchievements] = useState<AchievementRecord[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Interactive Filter Stream
  const [activityFilter, setActivityFilter] = useState<"all" | "gate" | "violations">("all");

  useEffect(() => {
    async function verifyAuth() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session || !session.user) {
          setIsAuthenticated(false);
          router.replace("/login");
          return;
        }
        setIsAuthenticated(true);
      } catch {
        setIsAuthenticated(false);
        router.replace("/login");
      } finally {
        setCheckingAuth(false);
      }
    }

    verifyAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        setIsAuthenticated(false);
        router.replace("/login");
      } else if (session) {
        setIsAuthenticated(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchRealtimeData();
    const interval = setInterval(fetchRealtimeData, 10000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  async function fetchRealtimeData() {
    try {
      const { count: studentCount } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true });
      setTotalStudents(studentCount || 0);

      const { data: pData } = await supabase
        .from("permissions")
        .select("*")
        .order("created_at", { ascending: false });
      setPermissions(pData || []);

      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { data: vData } = await supabase
        .from("violations")
        .select("*")
        .gte("created_at", firstDayOfMonth)
        .order("created_at", { ascending: false });
      setViolations(vData || []);

      const { data: aData } = await supabase
        .from("achievements")
        .select("*")
        .order("created_at", { ascending: false });
      setAchievements(aData || []);
    } catch (err: any) {
      console.warn("Sinkronisasi dashboard:", err.message);
    } finally {
      setLoadingData(false);
    }
  }

  // ================= 3. METRICS & STATUS =================
  const isOverdue = (item: PermissionRecord) => {
    if (item.status === "out_pondok") {
      return new Date() > new Date(item.return_target);
    }
    return false;
  };

  const currentlyOutList = useMemo(() => {
    return permissions.filter((p) => p.status === "out_pondok");
  }, [permissions]);

  const overdueList = useMemo(() => {
    return permissions.filter(isOverdue);
  }, [permissions]);

  const approvedWaitingOut = useMemo(() => {
    return permissions.filter((p) => p.status === "approved");
  }, [permissions]);

  const completedToday = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return permissions.filter(
      (p) =>
        (p.status === "back_pondok" || p.status === "completed") &&
        p.created_at.slice(0, 10) === todayStr
    );
  }, [permissions]);

  const totalPointsViolations = useMemo(() => {
    return violations.reduce((acc, curr) => acc + (Number(curr.points) || 0), 0);
  }, [violations]);

  const totalRewardPoints = useMemo(() => {
    return achievements.reduce((acc, curr) => acc + (Number(curr.reward_points) || 0), 0);
  }, [achievements]);

  // Persentase Santri Mukim vs Di Luar
  const insidePondokCount = Math.max(0, totalStudents - currentlyOutList.length);
  const insidePondokPercent = totalStudents > 0 ? Math.round((insidePondokCount / totalStudents) * 100) : 100;

  // ================= 4. LIVE FEED STREAM =================
  const liveFeed = useMemo(() => {
    const logs: Array<{
      id: string;
      title: string;
      subtitle: string;
      time: string;
      type: "out" | "in" | "approve" | "violation";
      categoryGroup: "gate" | "violations";
      timestamp: number;
    }> = [];

    permissions.forEach((p) => {
      if (p.actual_in_at) {
        logs.push({
          id: `in-${p.id}`,
          title: p.student_name,
          subtitle: "Presensi Masuk Gerbang (Tepat Waktu)",
          time: new Date(p.actual_in_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
          type: "in",
          categoryGroup: "gate",
          timestamp: new Date(p.actual_in_at).getTime(),
        });
      }
      if (p.actual_out_at) {
        logs.push({
          id: `out-${p.id}`,
          title: p.student_name,
          subtitle: `Presensi Keluar Gerbang (${p.category})`,
          time: new Date(p.actual_out_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
          type: "out",
          categoryGroup: "gate",
          timestamp: new Date(p.actual_out_at).getTime(),
        });
      }
      if (p.status === "approved" && !p.actual_out_at) {
        logs.push({
          id: `app-${p.id}`,
          title: p.student_name,
          subtitle: `Izin Disetujui: ${p.reason}`,
          time: new Date(p.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
          type: "approve",
          categoryGroup: "gate",
          timestamp: new Date(p.created_at).getTime(),
        });
      }
    });

    violations.slice(0, 6).forEach((v) => {
      logs.push({
        id: `v-${v.id}`,
        title: v.student_name,
        subtitle: `Catatan Disiplin: ${v.violation_name} (+${v.points} Poin)`,
        time: new Date(v.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        type: "violation",
        categoryGroup: "violations",
        timestamp: new Date(v.created_at).getTime(),
      });
    });

    const sorted = logs.sort((a, b) => b.timestamp - a.timestamp);
    if (activityFilter === "all") return sorted.slice(0, 7);
    return sorted.filter((item) => item.categoryGroup === activityFilter).slice(0, 7);
  }, [permissions, violations, activityFilter]);

  if (checkingAuth) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3 font-sans">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-600" />
        <p className="text-xs text-slate-500 font-bold tracking-wider uppercase">
          Memverifikasi Akses SIPS...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="space-y-5 max-w-[1440px] mx-auto font-sans pb-16">
      {/* ================= HEADER HERO DASHBOARD UTAMA ================= */}
      <div className="relative overflow-hidden rounded-[28px] border border-slate-200/80 dark:border-emerald-900/30 bg-white/95 dark:bg-[#111f1b] p-5 sm:p-6 shadow-sm backdrop-blur-xl transition-all">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[10.5px] font-black uppercase tracking-wider">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                PONDOK PESANTREN CONDONG
              </span>
              <span className="rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5">
                Real-time Sync
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-2">
              Dashboard Utama
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Ringkasan operasional dan kendali pengasuhan santri secara real-time
            </p>
          </div>

          {/* Mini Status Kesiapan Sistem */}
          <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-[#0c1815] border border-slate-200 dark:border-emerald-900/40 p-2 sm:px-3 sm:py-2 rounded-2xl shrink-0 self-start md:self-auto shadow-xs">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-300">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Sistem Aktif &amp; Terhubung</span>
            </div>
            <button
              type="button"
              onClick={fetchRealtimeData}
              className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-emerald-900/40 text-slate-500 dark:text-slate-400 transition cursor-pointer"
              title="Segarkan Data Realtime"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingData ? "animate-spin text-emerald-600" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ================= 4 KARTU STATISTIK METRIK ATAS ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Santri Aktif */}
        <Link
          href="/dashboard/students"
          className="group relative overflow-hidden rounded-[24px] border border-slate-200/80 dark:border-emerald-900/30 bg-white/95 dark:bg-[#111f1b] p-5 shadow-xs hover:border-emerald-500/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Santri Aktif
            </span>
            <div className="h-9 w-9 rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center transition-transform group-hover:scale-110">
              <Users className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-3">
            <h3 className="text-3xl font-black text-slate-900 dark:text-white font-mono">
              {totalStudents}
            </h3>
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20">
              Mukim
            </span>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-emerald-900/30 flex items-center justify-between text-[10.5px]">
            <span className="text-slate-400 truncate">{insidePondokPercent}% di dalam pondok</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold group-hover:underline flex items-center gap-0.5">
              Detail <ChevronRight className="h-3 w-3" />
            </span>
          </div>
        </Link>

        {/* 2. Izin di Luar */}
        <Link
          href="/dashboard/permissions"
          className="group relative overflow-hidden rounded-[24px] border border-slate-200/80 dark:border-emerald-900/30 bg-white/95 dark:bg-[#111f1b] p-5 shadow-xs hover:border-amber-500/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Izin di Luar
            </span>
            <div className="h-9 w-9 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center transition-transform group-hover:scale-110">
              <LogOut className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-3">
            <h3 className="text-3xl font-black text-amber-600 dark:text-amber-400 font-mono">
              {currentlyOutList.length}
            </h3>
            <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase border ${
              overdueList.length > 0
                ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-500/30 animate-pulse"
                : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-500/20"
            }`}>
              {overdueList.length > 0 ? `${overdueList.length} Terlambat` : "Aktif"}
            </span>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-emerald-900/30 flex items-center justify-between text-[10.5px]">
            <span className="text-slate-400 truncate">
              {currentlyOutList.length === 0 ? "Semua santri di pondok" : `${currentlyOutList.length} santri di luar`}
            </span>
            <span className="text-amber-600 dark:text-amber-400 font-bold group-hover:underline flex items-center gap-0.5">
              Buka <ChevronRight className="h-3 w-3" />
            </span>
          </div>
        </Link>

        {/* 3. Disiplin Bulan Ini */}
        <Link
          href="/dashboard/violations"
          className="group relative overflow-hidden rounded-[24px] border border-slate-200/80 dark:border-emerald-900/30 bg-white/95 dark:bg-[#111f1b] p-5 shadow-xs hover:border-rose-500/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Disiplin Bulan Ini
            </span>
            <div className="h-9 w-9 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center transition-transform group-hover:scale-110">
              <ShieldAlert className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-3">
            <h3 className="text-3xl font-black text-slate-900 dark:text-white font-mono">
              {violations.length}
            </h3>
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 font-mono border border-rose-500/20">
              +{totalPointsViolations} Poin
            </span>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-emerald-900/30 flex items-center justify-between text-[10.5px]">
            <span className="text-slate-400 truncate">
              {violations.length === 0 ? "Kedisiplinan terjaga" : "Rekapitulasi pembinaan"}
            </span>
            <span className="text-rose-600 dark:text-rose-400 font-bold group-hover:underline flex items-center gap-0.5">
              Takzir <ChevronRight className="h-3 w-3" />
            </span>
          </div>
        </Link>

        {/* 4. Prestasi Santri */}
        <Link
          href="/dashboard/achievements"
          className="group relative overflow-hidden rounded-[24px] border border-slate-200/80 dark:border-emerald-900/30 bg-white/95 dark:bg-[#111f1b] p-5 shadow-xs hover:border-teal-500/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Prestasi Santri
            </span>
            <div className="h-9 w-9 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center transition-transform group-hover:scale-110">
              <Trophy className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-3">
            <h3 className="text-3xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
              {achievements.length}
            </h3>
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 font-mono border border-teal-500/20">
              +{totalRewardPoints} Reward
            </span>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-emerald-900/30 flex items-center justify-between text-[10.5px]">
            <span className="text-slate-400 truncate">{achievements.length} capaian kejuaraan</span>
            <span className="text-teal-600 dark:text-teal-400 font-bold group-hover:underline flex items-center gap-0.5">
              Hall of Fame <ChevronRight className="h-3 w-3" />
            </span>
          </div>
        </Link>
      </div>

      {/* ================= AKSI CEPAT OPERASIONAL (1-CLICK DOCK) ================= */}
      <div className="rounded-[28px] border border-slate-200/80 dark:border-emerald-900/30 bg-white/95 dark:bg-[#111f1b] p-5 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-emerald-900/30 pb-3">
          <div className="flex items-center space-x-2">
            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Aksi Cepat Operasional
            </h3>
          </div>
          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-[#162924] px-2.5 py-1 rounded-xl">
            Pintasan 1-Klik
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            {
              label: "Pos Gerbang",
              sub: "Scan QR KTS",
              href: "/dashboard/security-gate",
              icon: QrCode,
              color: "text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30",
            },
            {
              label: "Input Izin",
              sub: "Buat Surat Izin",
              href: "/dashboard/permissions",
              icon: FileCheck2,
              color: "text-blue-800 dark:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30",
            },
            {
              label: "Pelanggaran",
              sub: "Catat Disiplin",
              href: "/dashboard/violations",
              icon: ShieldAlert,
              color: "text-rose-800 dark:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30",
            },
            {
              label: "Prestasi",
              sub: "Input Prestasi",
              href: "/dashboard/achievements",
              icon: Trophy,
              color: "text-amber-800 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30",
            },
            {
              label: "Cetak KTS",
              sub: "Kartu Digital",
              href: "/dashboard/id-cards",
              icon: IdCard,
              color: "text-indigo-800 dark:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/30",
            },
            {
              label: "Pusat Laporan",
              sub: "Ekspor Excel/PDF",
              href: "/dashboard/reports",
              icon: FileSpreadsheet,
              color: "text-teal-800 dark:text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 border-teal-500/30",
            },
          ].map((act, i) => {
            const Icon = act.icon;
            return (
              <Link
                key={i}
                href={act.href}
                className={`p-3.5 rounded-2xl border transition-all duration-200 hover:-translate-y-1 hover:shadow-md active:scale-95 flex items-center space-x-3 group cursor-pointer ${act.color}`}
              >
                <div className="h-8.5 w-8.5 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-110 transition-transform">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <p className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                    {act.label}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5 font-medium">
                    {act.sub}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ================= MONITORING PERIZINAN & LIVE STREAM AKTIVITAS ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Kolom Kiri: Status Siklus Perizinan Hari Ini */}
        <div className="lg:col-span-7 rounded-[28px] border border-slate-200/80 dark:border-emerald-900/30 bg-white/95 dark:bg-[#111f1b] p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-emerald-900/30 pb-3.5">
            <div className="flex items-center space-x-2">
              <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                <Layers className="h-4 w-4" />
              </div>
              <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Status Siklus Perizinan Hari Ini
              </h3>
            </div>
            <Link
              href="/dashboard/permissions"
              className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              <span>Detail</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* 4 Status Box Siklus */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            {/* Siap Keluar */}
            <div className="p-3 rounded-2xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 space-y-1 transition hover:scale-102">
              <p className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase">Siap Keluar</p>
              <p className="text-2xl font-black text-blue-950 dark:text-blue-200 font-mono">
                {approvedWaitingOut.length}
              </p>
              <span className="text-[9.5px] text-blue-600 dark:text-blue-400 font-medium block">
                Disetujui
              </span>
            </div>

            {/* Di Luar */}
            <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 space-y-1 transition hover:scale-102">
              <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase">Di Luar</p>
              <p className="text-2xl font-black text-amber-950 dark:text-amber-200 font-mono">
                {currentlyOutList.length}
              </p>
              <span className="text-[9.5px] text-amber-600 dark:text-amber-400 font-medium block">
                Sudah Tap Out
              </span>
            </div>

            {/* Selesai Kembali */}
            <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 space-y-1 transition hover:scale-102">
              <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">Selesai</p>
              <p className="text-2xl font-black text-emerald-950 dark:text-emerald-200 font-mono">
                {completedToday.length}
              </p>
              <span className="text-[9.5px] text-emerald-600 dark:text-emerald-400 font-medium block">
                Tiba di Pondok
              </span>
            </div>

            {/* Terlambat */}
            <div className="p-3 rounded-2xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 space-y-1 transition hover:scale-102">
              <p className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase">Terlambat</p>
              <p className="text-2xl font-black text-rose-950 dark:text-rose-200 font-mono">
                {overdueList.length}
              </p>
              <span className="text-[9.5px] text-rose-600 dark:text-rose-400 font-medium block">
                {overdueList.length > 0 ? "Perlu Tindakan" : "Tepat Waktu"}
              </span>
            </div>
          </div>

          {/* Progress Bar Santri Mukim di Pondok */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0c1815] border border-slate-200/80 dark:border-emerald-900/30 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-700 dark:text-slate-300">Presensi Santri Berada di Dalam Pondok</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-mono">{insidePondokCount} / {totalStudents} Santri ({insidePondokPercent}%)</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                style={{ width: `${insidePondokPercent}%` }}
                className="h-full bg-gradient-to-r from-emerald-600 to-teal-400 transition-all duration-500 rounded-full"
              />
            </div>
          </div>

          {/* Warning Banner Santri Terlambat */}
          {overdueList.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between gap-3 text-xs animate-in fade-in">
              <div className="flex items-center space-x-2.5 min-w-0">
                <AlertTriangle className="h-4.5 w-4.5 text-rose-600 dark:text-rose-400 shrink-0" />
                <p className="font-bold text-rose-900 dark:text-rose-200 truncate">
                  Peringatan: {overdueList.length} santri melewati tenggat batas kembali
                </p>
              </div>
              <Link
                href="/dashboard/security-gate"
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs transition shrink-0 shadow-sm"
              >
                Cek Pos Gerbang
              </Link>
            </div>
          )}
        </div>

        {/* Kolom Kanan: Aktivitas Terkini (Interactive Feed) */}
        <div className="lg:col-span-5 rounded-[28px] border border-slate-200/80 dark:border-emerald-900/30 bg-white/95 dark:bg-[#111f1b] p-5 sm:p-6 shadow-sm space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-emerald-900/30 pb-3 gap-2">
            <div className="flex items-center space-x-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Aktivitas Terkini
              </h3>
            </div>

            {/* Filter Pill Interaktif */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#0c1815] p-1 rounded-xl border border-slate-200 dark:border-emerald-900/30 text-[10.5px] font-bold">
              {[
                { id: "all", label: "Semua" },
                { id: "gate", label: "Gerbang" },
                { id: "violations", label: "Disiplin" },
              ].map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setActivityFilter(btn.id as any)}
                  className={`px-2.5 py-0.5 rounded-lg transition cursor-pointer ${
                    activityFilter === btn.id
                      ? "bg-[#064e3b] dark:bg-emerald-600 text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 max-h-[340px] overflow-y-auto custom-scrollbar pr-1">
            {liveFeed.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs font-medium">
                Belum ada aktivitas tercatat pada filter ini.
              </div>
            ) : (
              liveFeed.map((act) => (
                <div
                  key={act.id}
                  className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 dark:border-emerald-900/20 bg-slate-50/70 dark:bg-[#162924]/60 text-xs hover:border-emerald-500/40 transition hover:translate-x-1"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-bold shadow-xs ${
                        act.type === "out"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                          : act.type === "in"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                          : act.type === "violation"
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400"
                      }`}
                    >
                      {act.type === "out" && <LogOut className="h-4 w-4" />}
                      {act.type === "in" && <LogIn className="h-4 w-4" />}
                      {act.type === "approve" && <CheckCheck className="h-4 w-4" />}
                      {act.type === "violation" && <ShieldAlert className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 dark:text-slate-100 truncate text-xs">
                        {act.title}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {act.subtitle}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] font-bold text-slate-400 bg-white dark:bg-[#111f1b] px-2 py-1 rounded-lg border border-slate-200 dark:border-emerald-900/40 shrink-0 ml-2 shadow-xs">
                    {act.time}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}