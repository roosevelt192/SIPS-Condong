"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  ArrowLeft,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Activity,
  ChevronLeft,
  ChevronRight,
  Database,
  SlidersHorizontal,
  Eye,
  X,
  FileCheck2,
  LogOut,
  LogIn,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface AuditLogItem {
  id: string;
  user_id: string | null;
  user_name: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [timeRange, setTimeRange] = useState<"all" | "today" | "7days">("all");
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const fetchLogsAndProfiles = async () => {
    setLoading(true);
    try {
      // 1. Ambil data profiles untuk mapping nama lengkap petugas secara akurat
      const { data: profs } = await supabase.from("profiles").select("id, full_name, email");
      const pMap: Record<string, string> = {};
      (profs || []).forEach((p: any) => {
        if (p.id) pMap[p.id] = p.full_name;
        if (p.email) pMap[p.email.toLowerCase()] = p.full_name;
      });
      setProfilesMap(pMap);

      // 2. Ambil data audit logs
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      setLogs(data || []);
    } catch (err: any) {
      console.warn("Gagal memuat audit log:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogsAndProfiles();

    // Supabase Realtime Subscription
    const channel = supabase
      .channel("realtime-audit-logs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_logs" },
        (payload) => {
          setLogs((prev) => [payload.new as AuditLogItem, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Helper menampilkan nama petugas resmi yang terdaftar
  const getStaffDisplayName = (log: AuditLogItem) => {
    if (log.user_id && profilesMap[log.user_id]) {
      return profilesMap[log.user_id];
    }
    const emailKey = (log.user_name || "").toLowerCase().trim();
    if (profilesMap[emailKey]) {
      return profilesMap[emailKey];
    }
    if (log.user_name && log.user_name.includes("@")) {
      const username = log.user_name.split("@")[0];
      return username
        .replace(/[._]/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
    }
    return log.user_name || "Petugas SIPS";
  };

  const stats = useMemo(() => {
    const outCount = logs.filter((l) => l.action === "GATE_SCAN_OUT").length;
    const inCount = logs.filter((l) => l.action === "GATE_SCAN_IN").length;
    const pointCount = logs.filter((l) => l.action === "UPDATE_POINTS").length;
    return { outCount, inCount, pointCount, total: logs.length };
  }, [logs]);

  const formatActionBadge = (action: string) => {
    switch (action) {
      case "GATE_SCAN_OUT":
        return {
          label: "Scan Gerbang: Keluar",
          icon: LogOut,
          cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25",
        };
      case "GATE_SCAN_IN":
        return {
          label: "Scan Gerbang: Kembali",
          icon: LogIn,
          cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
        };
      case "UPDATE_POINTS":
        return {
          label: "Pembaruan Poin Disiplin",
          icon: SlidersHorizontal,
          cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25",
        };
      case "DELETE_STUDENT":
        return {
          label: "Penghapusan Data Santri",
          icon: ShieldAlert,
          cls: "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30",
        };
      default:
        return {
          label: action.replace(/_/g, " "),
          icon: Activity,
          cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
        };
    }
  };

  const filteredLogs = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;

    return logs.filter((log) => {
      const q = searchQuery.toLowerCase().trim();
      const staffName = getStaffDisplayName(log).toLowerCase();
      const matchSearch =
        q === "" ||
        staffName.includes(q) ||
        log.user_name.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        JSON.stringify(log.details || {}).toLowerCase().includes(q);

      const matchAction =
        actionFilter === "all" || log.action === actionFilter;

      const logTime = new Date(log.created_at).getTime();
      let matchTime = true;
      if (timeRange === "today") matchTime = logTime >= startOfToday;
      if (timeRange === "7days") matchTime = logTime >= sevenDaysAgo;

      return matchSearch && matchAction && matchTime;
    });
  }, [logs, searchQuery, actionFilter, timeRange, profilesMap]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const paginatedLogs = useMemo(() => {
    return filteredLogs.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [filteredLogs, currentPage, itemsPerPage]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans relative pb-16">
      {/* Background Subtle Glows */}
      <div className="pointer-events-none absolute -top-10 -right-10 h-72 w-72 rounded-full bg-emerald-500/10 blur-[100px]" />
      <div className="pointer-events-none absolute top-48 -left-10 h-72 w-72 rounded-full bg-teal-500/10 blur-[100px]" />

      {/* ================= HEADER HERO BANNER ================= */}
      <div className="relative overflow-hidden rounded-[36px] bg-gradient-to-r from-emerald-950 via-[#064e3b] to-teal-950 p-6 sm:p-8 text-white shadow-2xl border border-emerald-500/40">
        <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-emerald-400/20 blur-[80px] pointer-events-none animate-pulse" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-amber-400/20 blur-[80px] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-black/30 pointer-events-none" />

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center space-x-4 min-w-0">
            <Link
              href="/dashboard"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-all active:scale-90 shadow-sm backdrop-blur-md"
              title="Kembali ke Dashboard Utama"
            >
              <ArrowLeft className="h-5 w-5 stroke-[2.4]" />
            </Link>

            <div className="relative flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 via-emerald-500 to-teal-400 text-slate-950 shadow-lg font-black">
              <ShieldAlert className="h-6 w-6 stroke-[2.3]" />
              <div className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-amber-400 border-2 border-white dark:border-slate-900 animate-ping" />
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-emerald-200 text-[10px] font-black uppercase tracking-wider backdrop-blur-xl">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  SECURITY &amp; LOGS
                </span>
                <span className="rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold px-2.5 py-0.5">
                  Real-time
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-emerald-100 to-amber-300 bg-clip-text text-transparent truncate">
                Audit Logs &amp; Keamanan Staf
              </h1>
              <p className="text-xs text-emerald-100/90 font-medium truncate">
                Rekam jejak dan kronologi verifikasi pos gerbang &amp; pengasuhan secara akurat
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start xl:self-center flex-wrap">
            {/* Quick Time Range Selector */}
            <div className="flex items-center p-1.5 rounded-2xl bg-black/40 border border-white/20 text-xs font-bold shadow-inner backdrop-blur-md">
              <button
                type="button"
                onClick={() => { setTimeRange("all"); setCurrentPage(1); }}
                className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer ${
                  timeRange === "all"
                    ? "bg-white text-slate-950 shadow-sm font-black"
                    : "text-emerald-100/70 hover:text-white hover:bg-white/10"
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => { setTimeRange("today"); setCurrentPage(1); }}
                className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer ${
                  timeRange === "today"
                    ? "bg-white text-slate-950 shadow-sm font-black"
                    : "text-emerald-100/70 hover:text-white hover:bg-white/10"
                }`}
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => { setTimeRange("7days"); setCurrentPage(1); }}
                className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer ${
                  timeRange === "7days"
                    ? "bg-white text-slate-950 shadow-sm font-black"
                    : "text-emerald-100/70 hover:text-white hover:bg-white/10"
                }`}
              >
                7 Hari
              </button>
            </div>

            <button
              type="button"
              onClick={fetchLogsAndProfiles}
              className="flex h-10.5 w-10.5 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white hover:bg-white/20 transition active:scale-95 shadow-sm cursor-pointer backdrop-blur-md"
              title="Segarkan Log Realtime"
            >
              <RefreshCw className={`h-4.5 w-4.5 ${loading ? "animate-spin text-amber-300" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Ringkasan Metrik Cepat */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="rounded-3xl border border-slate-200/80 dark:border-emerald-900/40 bg-white/90 dark:bg-[#0c1815] p-5 shadow-xs backdrop-blur-md transition hover:border-emerald-500/50 hover:shadow-lg flex items-center space-x-3.5">
          <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-inner">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Aktivitas</p>
            <p className="text-xl font-black text-slate-900 dark:text-white font-mono">{stats.total}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/80 dark:border-emerald-900/40 bg-white/90 dark:bg-[#0c1815] p-5 shadow-xs backdrop-blur-md transition hover:border-amber-500/50 hover:shadow-lg flex items-center space-x-3.5">
          <div className="h-10 w-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-inner">
            <LogOut className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Scan Keluar</p>
            <p className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">{stats.outCount}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/80 dark:border-emerald-900/40 bg-white/90 dark:bg-[#0c1815] p-5 shadow-xs backdrop-blur-md transition hover:border-emerald-500/50 hover:shadow-lg flex items-center space-x-3.5">
          <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-inner">
            <LogIn className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Scan Masuk</p>
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{stats.inCount}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/80 dark:border-emerald-900/40 bg-white/90 dark:bg-[#0c1815] p-5 shadow-xs backdrop-blur-md transition hover:border-rose-500/50 hover:shadow-lg flex items-center space-x-3.5">
          <div className="h-10 w-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 shadow-inner">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Poin &amp; Disiplin</p>
            <p className="text-xl font-black text-rose-600 dark:text-rose-400 font-mono">{stats.pointCount}</p>
          </div>
        </div>
      </div>

      {/* Toolbar Filter & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-3xl border border-slate-200/80 dark:border-emerald-900/40 bg-white/90 dark:bg-[#0c1815] p-4 shadow-sm backdrop-blur-md">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Cari nama staf, santri, atau aksi..."
            className="h-10 w-full rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50/80 dark:bg-emerald-950/30 pl-10 pr-4 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none transition focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50/80 dark:bg-emerald-950/30 px-3.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
          >
            <option value="all" className="dark:bg-slate-900">Semua Jenis Aksi</option>
            <option value="GATE_SCAN_OUT" className="dark:bg-slate-900">Scan Gerbang: Keluar</option>
            <option value="GATE_SCAN_IN" className="dark:bg-slate-900">Scan Gerbang: Kembali</option>
            <option value="UPDATE_POINTS" className="dark:bg-slate-900">Ubah Poin Disiplin</option>
            <option value="DELETE_STUDENT" className="dark:bg-slate-900">Hapus Santri</option>
          </select>
        </div>
      </div>

      {/* DATA AUDIT LOG: RESPONSIVE DUAL-VIEW */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 dark:border-emerald-900/40 bg-white/90 dark:bg-[#0c1815] shadow-xl backdrop-blur-xl">
        
        {/* TAMPILAN 1: MOBILE CARD VIEW (Layar HP < md) */}
        <div className="block md:hidden divide-y divide-slate-100 dark:divide-emerald-900/30">
          {loading ? (
            <div className="py-14 text-center text-slate-400">
              <RefreshCw className="h-7 w-7 animate-spin mx-auto text-emerald-600 mb-2" />
              <span className="text-xs font-bold">Sinkronisasi catatan aktivitas...</span>
            </div>
          ) : paginatedLogs.length === 0 ? (
            <div className="py-16 text-center text-slate-400 p-6 space-y-2">
              <Database className="h-9 w-9 mx-auto opacity-30" />
              <p className="font-bold text-xs">Belum ada riwayat audit log yang tercatat.</p>
              <p className="text-[11px] text-slate-400">Aktivitas gerbang atau pengasuhan akan muncul di sini.</p>
            </div>
          ) : (
            paginatedLogs.map((log) => {
              const badge = formatActionBadge(log.action);
              const Icon = badge.icon;
              const staffName = getStaffDisplayName(log);

              return (
                <div key={log.id} className="p-4 space-y-3 hover:bg-slate-50/50 dark:hover:bg-emerald-950/20 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2.5">
                      <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-black text-xs shrink-0 shadow-inner">
                        {staffName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">
                          {staffName}
                        </p>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(log.created_at).toLocaleString("id-ID", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </span>
                      </div>
                    </div>

                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[10px] font-bold shrink-0 ${badge.cls}`}>
                      <Icon className="h-3 w-3" />
                      <span>{badge.label}</span>
                    </span>
                  </div>

                  {log.details && (
                    <div className="bg-slate-50 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-slate-100 dark:border-emerald-900/30 text-xs space-y-1">
                      {log.details.santri_name && (
                        <p className="font-bold text-slate-900 dark:text-white">
                          Santri: {log.details.santri_name}{" "}
                          <span className="font-mono text-[10px] text-slate-400 font-normal">
                            ({log.details.santri_nis || "-"})
                          </span>
                        </p>
                      )}
                      {log.details.kategori && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Keperluan: <span className="font-medium text-slate-700 dark:text-slate-300">{log.details.kategori}</span>
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedLog(log)}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition active:scale-95 cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Lihat Rincian</span>
                    </button>
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
              <tr className="border-b border-slate-200 dark:border-emerald-900/40 bg-slate-50/90 dark:bg-emerald-950/40 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none">
                <th className="py-4 px-4 font-bold">Waktu</th>
                <th className="py-4 px-4 font-bold">Petugas</th>
                <th className="py-4 px-4 font-bold">Aksi</th>
                <th className="py-4 px-4 font-bold">Rincian Perizinan</th>
                <th className="py-4 px-4 text-right font-bold">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-emerald-900/30 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-14 text-center text-slate-400">
                    <RefreshCw className="h-7 w-7 animate-spin mx-auto text-emerald-600 mb-2" />
                    <span className="text-xs font-bold">Sinkronisasi catatan aktivitas...</span>
                  </td>
                </tr>
              ) : paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-400 space-y-2">
                    <Database className="h-9 w-9 mx-auto opacity-30 text-emerald-600" />
                    <p className="font-bold text-xs">Belum ada riwayat audit log yang tercatat.</p>
                    <p className="text-[11px] text-slate-400">Aktivitas gerbang atau pengasuhan akan muncul di sini secara realtime.</p>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  const badge = formatActionBadge(log.action);
                  const Icon = badge.icon;
                  const staffName = getStaffDisplayName(log);

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-emerald-500/[0.03] dark:hover:bg-emerald-950/20 transition duration-150 group"
                    >
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <span>
                            {new Date(log.created_at).toLocaleString("id-ID", {
                              dateStyle: "short",
                              timeStyle: "medium",
                            })}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-black text-xs shrink-0 shadow-inner">
                            {staffName.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-extrabold text-slate-900 dark:text-white">
                            {staffName}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[10.5px] font-bold ${badge.cls}`}>
                          <Icon className="h-3 w-3" />
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        {log.details ? (
                          <div className="space-y-0.5">
                            {log.details.santri_name && (
                              <p className="font-extrabold text-slate-900 dark:text-white">
                                {log.details.santri_name}{" "}
                                <span className="font-mono text-[10px] text-slate-400 font-normal">
                                  ({log.details.santri_nis || "NIS: -"})
                                </span>
                              </p>
                            )}
                            {log.details.kategori && (
                              <p className="text-[11px] text-slate-400 truncate max-w-xs">
                                Keperluan: <span className="text-slate-600 dark:text-slate-300 font-medium">{log.details.kategori}</span>
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          className="p-2 rounded-xl border border-slate-200 dark:border-emerald-900/40 bg-slate-50 dark:bg-emerald-950/40 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/40 transition active:scale-95 shadow-xs cursor-pointer"
                          title="Lihat Detail Rincian Log"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-emerald-900/40 px-5 py-3 text-xs text-slate-400 bg-slate-50/50 dark:bg-emerald-950/40">
          <span>
            Halaman <strong>{currentPage}</strong> dari <strong>{totalPages}</strong> ({filteredLogs.length} entri)
          </span>
          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 hover:bg-white dark:hover:bg-emerald-900/40 disabled:opacity-40 transition cursor-pointer text-slate-700 dark:text-slate-300"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 hover:bg-white dark:hover:bg-emerald-900/40 disabled:opacity-40 transition cursor-pointer text-slate-700 dark:text-slate-300"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Dialog Inspeksi Detail Log */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 text-white space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
                  <FileCheck2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Rincian Aktivitas Petugas</h3>
                  <p className="text-[10px] text-slate-400 font-mono">{selectedLog.id.slice(0, 16)}...</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Nama Petugas</span>
                  <span className="font-extrabold text-white text-xs mt-0.5 block truncate">
                    {getStaffDisplayName(selectedLog)}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Jenis Aktivitas</span>
                  <span className="font-extrabold text-emerald-400 text-xs mt-0.5 block truncate">
                    {formatActionBadge(selectedLog.action).label}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Detail Rincian:
                </span>

                {selectedLog.details ? (
                  <div className="space-y-1.5 text-xs">
                    {selectedLog.details.santri_name && (
                      <div className="flex justify-between border-b border-slate-800 pb-1">
                        <span className="text-slate-400">Nama Santri:</span>
                        <span className="font-bold text-white text-right">
                          {selectedLog.details.santri_name}
                        </span>
                      </div>
                    )}
                    {selectedLog.details.santri_nis && (
                      <div className="flex justify-between border-b border-slate-800 pb-1">
                        <span className="text-slate-400">Nomor Induk (NIS):</span>
                        <span className="font-mono font-bold text-emerald-400">
                          {selectedLog.details.santri_nis}
                        </span>
                      </div>
                    )}
                    {selectedLog.details.kategori && (
                      <div className="flex justify-between border-b border-slate-800 pb-1">
                        <span className="text-slate-400">Kategori Izin:</span>
                        <span className="font-semibold text-slate-200 text-right">
                          {selectedLog.details.kategori}
                        </span>
                      </div>
                    )}
                    {selectedLog.details.status_izin && (
                      <div className="flex justify-between border-b border-slate-800 pb-1">
                        <span className="text-slate-400">Status Siklus:</span>
                        <span className="font-bold text-emerald-400 capitalize">
                          {selectedLog.details.status_izin.replace("_", " ")}
                        </span>
                      </div>
                    )}
                    {selectedLog.details.waktu_aktual && (
                      <div className="flex justify-between border-b border-slate-800 pb-1">
                        <span className="text-slate-400">Waktu Verifikasi:</span>
                        <span className="font-mono text-slate-300">
                          {new Date(selectedLog.details.waktu_aktual).toLocaleString("id-ID")}
                        </span>
                      </div>
                    )}
                    {typeof selectedLog.details.terlambat === "boolean" && (
                      <div className="flex justify-between pt-0.5">
                        <span className="text-slate-400">Status Ketepatan:</span>
                        <span className={`font-bold ${selectedLog.details.terlambat ? "text-rose-400" : "text-emerald-400"}`}>
                          {selectedLog.details.terlambat ? "⚠️ Terlambat Kembali" : "✓ Tepat Waktu"}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-400 text-[11px] italic">Tidak ada catatan data tambahan.</p>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span>Waktu Log: {new Date(selectedLog.created_at).toLocaleString("id-ID")}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedLog(null)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition active:scale-95 cursor-pointer shadow-md"
            >
              Tutup Rincian
            </button>
          </div>
        </div>
      )}
    </div>
  );
}