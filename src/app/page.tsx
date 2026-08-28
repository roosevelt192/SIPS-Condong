"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Users,
  FileCheck2,
  AlertTriangle,
  Award,
  ArrowUpRight,
  Clock,
  Building2,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  QrCode,
  ShieldCheck,
  Calendar,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface PermissionRecord {
  id: string;
  student_id: string;
  nis: string;
  student_name: string;
  reason: string;
  category: string;
  departure_target: string;
  return_target: string;
  status: "approved" | "out_pondok" | "back_pondok" | "completed";
  actual_out_at?: string;
  actual_in_at?: string;
  security_out_officer?: string;
  security_in_officer?: string;
  created_at: string;
}

export default function DashboardLivePage() {
  const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
  const [totalStudents, setTotalStudents] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      // 1. Ambil total santri
      const { count: sCount } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true });
      setTotalStudents(sCount || 0);

      // 2. Ambil data perizinan
      const { data: pData, error: pErr } = await supabase
        .from("permissions")
        .select("*")
        .order("created_at", { ascending: false });

      if (pErr) throw pErr;
      setPermissions(pData || []);
    } catch (err: any) {
      console.warn("Dashboard sync warning:", err.message);
    } finally {
      setLoading(false);
    }
  }

  // ================= 1. SINKRONISASI STATUS & METRIK =================
  const isOverdue = (item: PermissionRecord) => {
    if (item.status === "out_pondok") {
      return new Date() > new Date(item.return_target);
    }
    return false;
  };

  const overdueList = useMemo(() => {
    return permissions.filter(isOverdue);
  }, [permissions]);

  const currentlyOutList = useMemo(() => {
    return permissions.filter((p) => p.status === "out_pondok");
  }, [permissions]);

  const activePermitsCount = useMemo(() => {
    return permissions.filter((p) => p.status === "approved" || p.status === "out_pondok").length;
  }, [permissions]);

  // ================= 2. SINKRONISASI TREN 7 HARI =================
  const weeklyTrendData = useMemo(() => {
    const days: { label: string; count: number; dateStr: string }[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayName = d.toLocaleDateString("id-ID", { weekday: "short" });

      const dayCount = permissions.filter((p) => {
        const itemDate = new Date(p.created_at).toISOString().slice(0, 10);
        return itemDate === dateStr;
      }).length;

      days.push({ label: dayName, count: dayCount, dateStr });
    }

    const maxCount = Math.max(...days.map((d) => d.count), 1);
    return { days, maxCount };
  }, [permissions]);

  // ================= 3. SINKRONISASI LOG AKTIVITAS POS GERBANG =================
  const gateActivityLogs = useMemo(() => {
    const logs: Array<{
      id: string;
      title: string;
      desc: string;
      time: string;
      type: "out" | "in" | "approved";
    }> = [];

    permissions.forEach((p) => {
      if (p.actual_in_at) {
        logs.push({
          id: `in-${p.id}`,
          title: `${p.student_name} Masuk Gerbang`,
          desc: `Telah kembali ke pesantren (${p.category})`,
          time: new Date(p.actual_in_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB",
          type: "in",
        });
      }
      if (p.actual_out_at) {
        logs.push({
          id: `out-${p.id}`,
          title: `${p.student_name} Keluar Gerbang`,
          desc: `Verifikasi pos satpam untuk ${p.category}`,
          time: new Date(p.actual_out_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB",
          type: "out",
        });
      }
      if (p.status === "approved" && !p.actual_out_at) {
        logs.push({
          id: `app-${p.id}`,
          title: `Surat Izin ${p.student_name} Diterbitkan`,
          desc: `Menunggu tap out gerbang (${p.reason})`,
          time: new Date(p.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB",
          type: "approved",
        });
      }
    });

    return logs.slice(0, 6);
  }, [permissions]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans relative pb-12 transition-all">
      {/* HEADER BANNER DASHBOARD */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 p-6 shadow-xl backdrop-blur-xl">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-500">
                Sistem Terhubung Real-Time
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
              Pusat Kendali Pengasuhan Santri
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Sinkronisasi data master santri, status perizinan gerbang, dan kedisiplinan mukim
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchDashboardData}
              className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95"
              title="Sinkronisasi Ulang Data"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-cyan-400" : ""}`} />
            </button>

            <Link
              href="/dashboard/permissions"
              className="inline-flex items-center space-x-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-3 text-xs font-black text-slate-950 shadow-lg shadow-cyan-500/25 hover:brightness-105 active:scale-95 transition"
            >
              <FileCheck2 className="h-4 w-4 stroke-[2.5]" />
              <span>Kelola Perizinan</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 4 KARTU STATISTIK UTAMA */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Santri */}
        <Link
          href="/dashboard/students"
          className="group rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 shadow-sm hover:shadow-lg hover:border-cyan-500/30 transition-all duration-300"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-black uppercase tracking-wider">Total Santri</span>
            <Users className="h-4 w-4 text-cyan-500 group-hover:scale-110 transition-transform" />
          </div>
          <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white">{totalStudents}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">Santri terdaftar aktif</span>
        </Link>

        {/* Santri Sedang Di Luar */}
        <Link
          href="/dashboard/permissions"
          className="group rounded-3xl border border-teal-500/30 bg-teal-500/5 dark:bg-slate-900/80 p-5 shadow-sm hover:shadow-lg hover:border-teal-500/60 transition-all duration-300"
        >
          <div className="flex items-center justify-between text-teal-600 dark:text-teal-400">
            <span className="text-xs font-black uppercase tracking-wider">Di Luar Pondok</span>
            <Building2 className="h-4 w-4 group-hover:scale-110 transition-transform" />
          </div>
          <p className="mt-3 text-3xl font-black text-teal-600 dark:text-teal-400">{currentlyOutList.length}</p>
          <span className="text-[11px] text-teal-600/80 dark:text-teal-400/80 mt-1 block">Telah tap out pos gerbang</span>
        </Link>

        {/* Perlu Konfirmasi Terlambat */}
        <Link
          href="/dashboard/permissions"
          className={`group rounded-3xl border p-5 shadow-sm transition-all duration-300 hover:shadow-lg ${
            overdueList.length > 0
              ? "border-rose-500/40 bg-rose-500/10 dark:bg-rose-950/20 ring-1 ring-rose-500/30"
              : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80"
          }`}
        >
          <div className="flex items-center justify-between text-rose-500">
            <span className="text-xs font-black uppercase tracking-wider">Terlambat</span>
            <AlertTriangle className={`h-4 w-4 ${overdueList.length > 0 ? "animate-bounce" : ""}`} />
          </div>
          <p className="mt-3 text-3xl font-black text-rose-600 dark:text-rose-400">{overdueList.length}</p>
          <span className="text-[11px] text-rose-500/80 mt-1 block">Melewati batas waktu</span>
        </Link>

        {/* Izin Aktif Siklus */}
        <Link
          href="/dashboard/permissions"
          className="group rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 shadow-sm hover:shadow-lg hover:border-cyan-500/30 transition-all duration-300"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-black uppercase tracking-wider">Izin Aktif</span>
            <Clock className="h-4 w-4 text-cyan-500 group-hover:scale-110 transition-transform" />
          </div>
          <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white">{activePermitsCount}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">Dalam siklus perizinan</span>
        </Link>
      </div>

      {/* GRID 2 KOLOM: TREN 7 HARI & PERLU KONFIRMASI TERLAMBAT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1. WIDGET TREN PERIZINAN 7 HARI */}
        <div className="lg:col-span-2 rounded-3xl border border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 p-6 shadow-xl backdrop-blur-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Tren Perizinan Keluar (7 Hari Terakhir)
              </h3>
              <p className="text-[11px] text-slate-400">Aktivitas penerbitan izin keluar komplek & pulang</p>
            </div>
            <span className="rounded-xl bg-cyan-500/10 px-2.5 py-1 text-[10px] font-black text-cyan-500 border border-cyan-500/20">
              Live Chart
            </span>
          </div>

          {/* Bar Chart Visualizer */}
          <div className="h-44 flex items-end justify-between gap-2 pt-6 pb-2 px-2">
            {weeklyTrendData.days.map((day) => {
              const heightPercent = Math.max((day.count / weeklyTrendData.maxCount) * 100, 8);
              return (
                <div key={day.dateStr} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                  <div className="text-[10px] font-mono font-bold text-slate-400 group-hover:text-cyan-400 transition-colors">
                    {day.count}
                  </div>
                  <div className="w-full max-w-[36px] bg-slate-100 dark:bg-slate-800/80 rounded-2xl p-1 flex items-end h-full">
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full rounded-xl bg-gradient-to-t from-cyan-600 to-teal-400 group-hover:from-cyan-500 group-hover:to-teal-300 transition-all duration-500 shadow-md shadow-cyan-500/20"
                    />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 group-hover:text-slate-200 transition-colors uppercase">
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. WIDGET PERLU KONFIRMASI TERLAMBAT */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 p-6 shadow-xl backdrop-blur-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="h-4 w-4 text-rose-500" />
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Perlu Konfirmasi Terlambat
                </h3>
              </div>
              <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-black text-rose-500">
                {overdueList.length} Santri
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/60 mt-2 max-h-56 overflow-y-auto custom-scrollbar">
              {overdueList.length === 0 ? (
                <div className="py-10 text-center text-slate-400 space-y-1">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500/40 mx-auto" />
                  <p className="text-xs font-bold text-slate-500">Disiplin Terjaga</p>
                  <p className="text-[10px] text-slate-400">Tidak ada santri yang terlambat saat ini.</p>
                </div>
              ) : (
                overdueList.map((item) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-xs text-slate-900 dark:text-white">{item.student_name}</p>
                      <p className="text-[10px] text-rose-500 font-semibold mt-0.5">
                        Batas: {new Date(item.return_target).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-400 font-extrabold text-[9px] uppercase">
                      Terlambat
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <Link
            href="/dashboard/permissions"
            className="w-full py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center space-x-1.5 transition"
          >
            <span>Buka Semua Perizinan</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* GRID 2 KOLOM: SANTRI DI LUAR PONDOK & LIVE STREAM AKTIVITAS GERBANG */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 3. WIDGET SANTRI DI LUAR PONDOK */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 p-6 shadow-xl backdrop-blur-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <Building2 className="h-4 w-4 text-cyan-500" />
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Santri di Luar Pondok
              </h3>
            </div>
            <span className="text-[11px] font-bold text-slate-400">
              {currentlyOutList.length} Santri Aktif Keluar
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/60 max-h-64 overflow-y-auto custom-scrollbar">
            {currentlyOutList.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Building2 className="h-8 w-8 text-slate-600 opacity-40 mx-auto mb-1" />
                <p className="text-xs font-bold">Semua Santri Berada di Dalam Komplek</p>
              </div>
            ) : (
              currentlyOutList.map((st) => (
                <div key={st.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold text-xs">
                      {st.student_name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-xs text-slate-900 dark:text-white">{st.student_name}</p>
                      <p className="text-[10px] text-slate-400">
                        NIS: <span className="font-mono text-cyan-500">{st.nis}</span> • {st.category}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-500 block">Target Kembali:</span>
                    <span className="text-[11px] font-mono font-bold text-slate-900 dark:text-slate-200">
                      {new Date(st.return_target).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 4. LIVE STREAM AKTIVITAS POS KEAMANAN GERBANG */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 p-6 shadow-xl backdrop-blur-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Aktivitas Pos Keamanan Gerbang
              </h3>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-400 border border-emerald-500/20">
              Live Feed
            </span>
          </div>

          <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
            {gateActivityLogs.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <p className="text-xs font-bold">Belum ada aktivitas tap pos gerbang hari ini</p>
              </div>
            ) : (
              gateActivityLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`h-8 w-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                        log.type === "in"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : log.type === "out"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                      }`}
                    >
                      {log.type === "in" ? "IN" : log.type === "out" ? "OUT" : "APP"}
                    </div>
                    <div>
                      <p className="font-bold text-xs text-slate-900 dark:text-white leading-tight">{log.title}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{log.desc}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 font-semibold">{log.time}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}