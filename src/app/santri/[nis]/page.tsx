"use client";

import { useEffect, useState, use } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  IdCard,
  ShieldCheck,
  ShieldAlert,
  Trophy,
  Phone,
  ExternalLink,
  MapPin,
  Clock,
  LogOut,
  AlertCircle,
  Home,
  CheckCircle2,
  RefreshCw,
  MessageCircle,
  Sun,
  Moon,
  Copy,
  Check,
  Award,
  Sparkles,
  Activity,
  Calendar,
  Share2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface StudentProfile {
  id: string;
  nis: string;
  nisn: string;
  name: string;
  gender: string;
  pob: string;
  dob: string;
  class: string;
  dorm: string;
  entry_year: string;
  consulate: string;
  guardian_name: string;
  guardian_phone: string;
  address: string;
  photo_url?: string | null;
  status: string;
  points: number;
}

export default function PublicSantriPortalPage({
  params,
}: {
  params: Promise<{ nis: string }>;
}) {
  const resolvedParams = use(params);
  const nisParam = decodeURIComponent(resolvedParams.nis || "").trim();

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [violations, setViolations] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);

  const [activeTab, setActiveTab] = useState<"overview" | "achievements" | "violations" | "permissions">("overview");

  useEffect(() => {
    const savedTheme = localStorage.getItem("sips_portal_theme");
    if (savedTheme === "dark") {
      setIsDarkMode(true);
    } else if (savedTheme === "light") {
      setIsDarkMode(false);
    } else {
      setIsDarkMode(false);
    }
  }, []);

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem("sips_portal_theme", next ? "dark" : "light");
      return next;
    });
  };

  useEffect(() => {
    if (nisParam) {
      fetchSantriDetails();
    }
  }, [nisParam]);

  async function fetchSantriDetails() {
    setLoading(true);
    try {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nisParam);

      let query = supabase.from("students").select("*");
      if (isUUID) {
        query = query.eq("id", nisParam);
      } else {
        query = query.eq("nis", nisParam);
      }

      const { data: stData, error: stError } = await query.maybeSingle();

      if (stError) throw stError;
      if (!stData) {
        setStudent(null);
        setLoading(false);
        return;
      }

      const profile: StudentProfile = {
        id: stData.id,
        nis: stData.nis || "-",
        nisn: stData.nisn || "-",
        name: stData.full_name || stData.name || stData.nama || "Santri",
        gender: stData.gender || "-",
        pob: stData.tempat_lahir || stData.pob || "-",
        dob: stData.tanggal_lahir || stData.dob || "-",
        class: stData.kelas || stData.class_name || stData.class || "-",
        dorm: stData.kamar_asrama || stData.dorm || stData.room || stData.asrama || "-",
        entry_year: stData.tahun_masuk || stData.entry_year || "2026",
        consulate: stData.asal_konsulat || stData.consulate || stData.origin_region || "-",
        guardian_name: stData.nama_lengkap_wali || stData.guardian_name || "-",
        guardian_phone: stData.no_whatsapp || stData.guardian_phone || stData.parent_phone || "-",
        address: stData.alamat_lengkap || stData.address || "-",
        photo_url: stData.photo_url || stData.foto || null,
        status: stData.status_santri || stData.status || "Aktif Mukim",
        points: Number(stData.poin_disiplin || stData.points) || 0,
      };

      setStudent(profile);

      // Pelanggaran
      let vQuery = supabase.from("violations").select("*");
      if (profile.nis && profile.nis !== "-") {
        vQuery = vQuery.or(`nis.eq.${profile.nis},student_id.eq.${profile.id}`);
      } else {
        vQuery = vQuery.eq("student_id", profile.id);
      }
      const { data: vData } = await vQuery.order("created_at", { ascending: false });
      setViolations(vData || []);

      // Prestasi
      let aQuery = supabase.from("achievements").select("*");
      if (profile.nis && profile.nis !== "-") {
        aQuery = aQuery.or(`nis.eq.${profile.nis},student_id.eq.${profile.id}`);
      } else {
        aQuery = aQuery.eq("student_id", profile.id);
      }
      const { data: aData } = await aQuery.order("created_at", { ascending: false });
      setAchievements(aData || []);

      // Perizinan
      let pQuery = supabase.from("permissions").select("*");
      if (profile.nis && profile.nis !== "-") {
        pQuery = pQuery.or(`nis.eq.${profile.nis},student_id.eq.${profile.id}`);
      } else {
        pQuery = pQuery.eq("student_id", profile.id);
      }
      const { data: pData } = await pQuery.order("created_at", { ascending: false });
      setPermissions(pData || []);
    } catch (err: any) {
      console.error("Gagal memuat portal santri:", err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleCopyNis = () => {
    if (!student?.nis) return;
    navigator.clipboard.writeText(student.nis);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `KTS Digital: ${student?.name}`,
        text: `Profil dan monitoring santri ${student?.name} di Pesantren Condong.`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      handleCopyNis();
    }
  };

  const totalViolationPoints = violations.reduce((acc, curr) => acc + (Number(curr.points) || 0), 0);
  const totalRewardPoints = achievements.reduce((acc, curr) => acc + (Number(curr.reward_points) || 0), 0);
  const activePermission = permissions.find((p) => p.status === "approved" || p.status === "out_pondok");

  // Skor Kedisiplinan Dinamis (100 - Poin Takzir)
  const disciplineScore = Math.max(0, 100 - totalViolationPoints);
  const getDisciplineStatus = () => {
    if (totalViolationPoints === 0) return { label: "Sangat Disiplin & Teladan", color: "emerald", percent: 100 };
    if (totalViolationPoints <= 20) return { label: "Kedisiplinan Terjaga Baik", color: "teal", percent: 85 };
    if (totalViolationPoints <= 40) return { label: "Status Waspada Pembinaan", color: "amber", percent: 60 };
    return { label: "Peringatan Khusus Pengasuhan", color: "rose", percent: 30 };
  };
  const disciplineMeta = getDisciplineStatus();

  if (loading) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 font-sans transition-colors duration-300 ${isDarkMode ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-900"}`}>
        <div className="relative flex h-20 w-20 items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 animate-ping" />
          <div className="h-12 w-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin shadow-lg" />
        </div>
        <div className="text-center mt-5 space-y-1">
          <p className="text-xs font-black tracking-widest uppercase text-emerald-500 animate-pulse">
            Memuat Portal Santri
          </p>
          <p className={`text-[11px] font-medium ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            Menghubungkan ke basis data SIPS Pesantren...
          </p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 font-sans text-center transition-colors duration-300 ${isDarkMode ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-900"}`}>
        <div className="h-20 w-20 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 mb-4 shadow-xl animate-bounce">
          <AlertCircle className="h-10 w-10 stroke-[1.8]" />
        </div>
        <h2 className="text-xl font-black tracking-tight">Data Santri Tidak Ditemukan</h2>
        <p className={`text-xs max-w-sm mt-1.5 leading-relaxed ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
          QR Code atau Nomor Induk Santri (NIS: <span className="font-mono font-bold text-rose-500">{nisParam}</span>) tidak terdaftar di sistem pusat SIPS Pesantren.
        </p>
        <Link
          href="/"
          className={`mt-6 inline-flex items-center space-x-2 rounded-2xl px-6 py-3 text-xs font-black shadow-lg transition active:scale-95 ${
            isDarkMode ? "bg-slate-800 hover:bg-slate-700 text-white shadow-slate-900/50" : "bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/20"
          }`}
        >
          <Home className="h-4 w-4" />
          <span>Kembali ke Beranda</span>
        </Link>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans pb-28 relative transition-colors duration-300 ${
      isDarkMode 
        ? "bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white" 
        : "bg-slate-100/80 text-slate-900 selection:bg-emerald-600 selection:text-white"
    }`}>
      {/* Dynamic Animated Ambience Light Glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className={`absolute -top-32 left-1/2 -translate-x-1/2 h-[450px] w-[450px] rounded-full blur-[150px] transition-all duration-700 ${
          isDarkMode ? "bg-emerald-500/20" : "bg-emerald-500/15"
        }`} />
        <div className={`absolute top-1/2 right-0 h-96 w-96 rounded-full blur-[150px] transition-all duration-700 ${
          isDarkMode ? "bg-blue-500/15" : "bg-blue-500/10"
        }`} />
      </div>

      {/* TOP BRANDING BAR */}
      <header className={`sticky top-0 z-30 border-b backdrop-blur-2xl px-4 sm:px-6 py-3.5 flex items-center justify-between transition-colors shadow-sm ${
        isDarkMode 
          ? "border-slate-800/80 bg-slate-950/80" 
          : "border-slate-200/80 bg-white/90"
      }`}>
        <div className="flex items-center space-x-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-400 text-slate-950 font-black text-base shadow-lg shadow-emerald-500/30">
            S
            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-slate-950 animate-ping" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className={`text-xs font-black tracking-wider uppercase ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                SIPS PESANTREN CONDONG
              </h1>
              <span className="inline-flex items-center text-[9px] px-2 py-0.2 rounded-full font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                Verified
              </span>
            </div>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
              <ShieldCheck className="h-3 w-3" /> Portal Monitoring Wali Santri
            </p>
          </div>
        </div>

        {/* Kontrol Kanan: Share, Theme, Refresh */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleShare}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all active:scale-90 cursor-pointer shadow-sm ${
              isDarkMode
                ? "border-slate-800 bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800"
                : "border-slate-200 bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50"
            }`}
            title="Bagikan Tautan Profil"
          >
            <Share2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all active:scale-90 cursor-pointer shadow-sm ${
              isDarkMode
                ? "border-slate-800 bg-slate-900 text-amber-400 hover:text-amber-300 hover:bg-slate-800"
                : "border-slate-200 bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50"
            }`}
            title={isDarkMode ? "Mode Terang" : "Mode Gelap"}
          >
            {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={fetchSantriDetails}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition active:scale-90 cursor-pointer shadow-sm ${
              isDarkMode
                ? "border-slate-800 bg-slate-900/80 text-slate-400 hover:text-white"
                : "border-slate-200 bg-white text-slate-600 hover:text-slate-900"
            }`}
            title="Segarkan Data"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-xl mx-auto px-4 pt-5 space-y-5 relative z-10">
        
        {/* ================= HOLOGRAPHIC HERO PROFILE CARD ================= */}
        <div className={`relative overflow-hidden rounded-[32px] border p-6 shadow-2xl backdrop-blur-2xl transition-all duration-300 group ${
          isDarkMode 
            ? "border-slate-800/90 bg-gradient-to-br from-slate-900/95 via-slate-900/70 to-slate-950/90 shadow-emerald-950/20" 
            : "border-slate-200/90 bg-gradient-to-br from-white via-white to-emerald-50/40 shadow-slate-200/70"
        }`}>
          {/* Decorative Corner Shimmer */}
          <div className="absolute -top-12 -right-12 h-32 w-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
          
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left relative z-10">
            {/* Foto Santri dengan Glowing Frame */}
            <div className={`relative h-28 w-24 shrink-0 rounded-2xl overflow-hidden border-2 shadow-xl group-hover:scale-105 transition-transform duration-300 ${
              isDarkMode 
                ? "border-emerald-500/50 bg-slate-800 shadow-emerald-950/50" 
                : "border-emerald-500/40 bg-slate-100 shadow-emerald-500/10"
            }`}>
              {student.photo_url ? (
                <Image
                  src={student.photo_url}
                  alt={student.name}
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-black text-3xl text-emerald-500">
                  {student.name.charAt(0)}
                </div>
              )}
            </div>

            {/* Identitas Santri & Tombol Salin NIS */}
            <div className="flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-wider border shadow-sm ${
                  isDarkMode 
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" 
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}>
                  <CheckCircle2 className="h-3 w-3" /> {student.status}
                </span>

                <button
                  type="button"
                  onClick={handleCopyNis}
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border transition active:scale-90 cursor-pointer ${
                    copied
                      ? "bg-emerald-500 text-white border-emerald-500"
                      : isDarkMode
                      ? "bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                  }`}
                  title="Salin NIS"
                >
                  {copied ? <Check className="h-3 w-3 text-white" /> : <Copy className="h-3 w-3" />}
                  <span>NIS: {student.nis}</span>
                </button>
              </div>

              <h2 className={`text-lg sm:text-xl font-black tracking-tight uppercase leading-snug pt-0.5 ${
                isDarkMode ? "text-white" : "text-slate-900"
              }`}>
                {student.name}
              </h2>

              <p className={`text-xs font-semibold flex items-center justify-center sm:justify-start gap-1.5 pt-0.5 ${
                isDarkMode ? "text-slate-300" : "text-slate-700"
              }`}>
                <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                <span>Kelas {student.class} • Kamar {student.dorm}</span>
              </p>
            </div>
          </div>

          {/* DYNAMIC DISCIPLINE HEALTH METER */}
          <div className={`mt-5 pt-4 border-t space-y-2 ${isDarkMode ? "border-slate-800" : "border-slate-100"}`}>
            <div className="flex items-center justify-between text-xs">
              <span className={`font-bold flex items-center gap-1.5 ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                <Activity className="h-3.5 w-3.5 text-emerald-500" />
                <span>Indeks Kepatuhan Santri:</span>
              </span>
              <span className="font-black text-emerald-600 dark:text-emerald-400">
                {disciplineMeta.label}
              </span>
            </div>
            
            {/* Progress Bar */}
            <div className={`w-full h-2 rounded-full overflow-hidden ${isDarkMode ? "bg-slate-800" : "bg-slate-200"}`}>
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full transition-all duration-1000"
                style={{ width: `${disciplineMeta.percent}%` }}
              />
            </div>
          </div>

          {/* 3 Metric Mini Counters */}
          <div className="grid grid-cols-3 gap-2.5 pt-4 mt-4 text-center">
            <div className={`rounded-2xl p-3 border transition hover:scale-105 duration-200 ${
              isDarkMode 
                ? "bg-slate-950/60 border-slate-800/80 shadow-inner" 
                : "bg-slate-50 border-slate-200/80 shadow-sm"
            }`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Poin Takzir
              </p>
              <p className={`text-base font-black mt-0.5 ${
                totalViolationPoints > 0 
                  ? "text-rose-500" 
                  : isDarkMode ? "text-slate-200" : "text-slate-800"
              }`}>
                {totalViolationPoints} Pts
              </p>
            </div>

            <div className={`rounded-2xl p-3 border transition hover:scale-105 duration-200 ${
              isDarkMode 
                ? "bg-slate-950/60 border-slate-800/80 shadow-inner" 
                : "bg-slate-50 border-slate-200/80 shadow-sm"
            }`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Poin Prestasi
              </p>
              <p className="text-base font-black mt-0.5 text-emerald-600 dark:text-emerald-400">
                +{totalRewardPoints} Pts
              </p>
            </div>

            <div className={`rounded-2xl p-3 border transition hover:scale-105 duration-200 ${
              isDarkMode 
                ? "bg-slate-950/60 border-slate-800/80 shadow-inner" 
                : "bg-slate-50 border-slate-200/80 shadow-sm"
            }`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Perizinan
              </p>
              <p className="text-base font-black mt-0.5 text-cyan-600 dark:text-cyan-400">
                {permissions.length} Kali
              </p>
            </div>
          </div>
        </div>

        {/* NOTIFIKASI STATUS PERIZINAN AKTIF */}
        {activePermission && (
          <div className={`rounded-3xl border p-4 text-xs shadow-xl animate-in slide-in-from-top duration-300 ${
            isDarkMode 
              ? "border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-slate-900 to-amber-500/5 text-slate-200" 
              : "border-amber-300 bg-gradient-to-r from-amber-50 via-white to-amber-50 text-amber-950 shadow-amber-500/5"
          }`}>
            <div className="flex items-center justify-between">
              <span className="font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Clock className="h-4 w-4 animate-spin" /> Sedang Mengantongi Izin Aktif
              </span>
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500 text-white dark:bg-amber-400 dark:text-slate-950 shadow-sm">
                {activePermission.status}
              </span>
            </div>
            <p className="font-bold mt-2">
              Kategori: {activePermission.category}
            </p>
            <p className={`text-[11px] mt-0.5 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
              Alasan: {activePermission.reason}
            </p>
            <p className="text-[11px] font-mono mt-1 font-bold text-amber-700 dark:text-amber-300">
              Batas Waktu Kembali: {activePermission.return_target ? new Date(activePermission.return_target).toLocaleString("id-ID") : "-"}
            </p>
          </div>
        )}

        {/* TAB NAVIGATION DENGAN BADGE HITUNGAN */}
        <div className={`grid grid-cols-4 gap-1.5 rounded-2xl p-1.5 border shadow-sm ${
          isDarkMode 
            ? "bg-slate-900/80 border-slate-800" 
            : "bg-white border-slate-200"
        }`}>
          {[
            { key: "overview", label: "Profil KTS", icon: IdCard, count: undefined },
            { key: "achievements", label: "Prestasi", icon: Trophy, count: achievements.length },
            { key: "violations", label: "Disiplin", icon: ShieldAlert, count: violations.length },
            { key: "permissions", label: "Perizinan", icon: LogOut, count: permissions.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex flex-col items-center justify-center py-2.5 rounded-xl text-[10px] font-black transition-all cursor-pointer relative ${
                  isActive
                    ? isDarkMode 
                      ? "bg-emerald-500 text-slate-950 shadow-md scale-[1.02]" 
                      : "bg-emerald-600 text-white shadow-md shadow-emerald-600/25 scale-[1.02]"
                    : isDarkMode 
                      ? "text-slate-400 hover:text-white" 
                      : "text-slate-600 hover:text-slate-950"
                }`}
              >
                <Icon className="h-4 w-4 mb-0.5" />
                <div className="flex items-center gap-1">
                  <span>{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={`text-[8px] px-1 py-0.2 rounded-full font-bold ${
                      isActive 
                        ? "bg-black/20 text-white" 
                        : "bg-slate-500/20 text-slate-400"
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* ================= TAB 1: OVERVIEW & DETAIL KTS ================= */}
        {activeTab === "overview" && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className={`rounded-3xl border p-5 space-y-3 text-xs shadow-md transition-all ${
              isDarkMode 
                ? "border-slate-800 bg-slate-900/60 shadow-slate-950/50" 
                : "border-slate-200/90 bg-white shadow-slate-200/40"
            }`}>
              <h3 className={`text-[11px] font-black uppercase tracking-wider border-b pb-2 flex items-center justify-between ${
                isDarkMode ? "text-slate-400 border-slate-800" : "text-slate-500 border-slate-100"
              }`}>
                <span>Rincian Data Santri &amp; Asrama</span>
                <span className="text-[10px] font-mono text-emerald-500">KTS-V3</span>
              </h3>

              <div className="grid grid-cols-12 gap-1 py-1">
                <span className={`col-span-5 font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Nama Lengkap</span>
                <span className="col-span-1 text-slate-400">:</span>
                <span className={`col-span-6 font-bold uppercase ${isDarkMode ? "text-white" : "text-slate-900"}`}>{student.name}</span>
              </div>

              <div className="grid grid-cols-12 gap-1 py-1">
                <span className={`col-span-5 font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Nomor Induk (NIS)</span>
                <span className="col-span-1 text-slate-400">:</span>
                <span className="col-span-6 font-mono font-bold text-emerald-600 dark:text-emerald-400">{student.nis}</span>
              </div>

              <div className="grid grid-cols-12 gap-1 py-1">
                <span className={`col-span-5 font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Kelas / Jenjang</span>
                <span className="col-span-1 text-slate-400">:</span>
                <span className={`col-span-6 font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>{student.class}</span>
              </div>

              <div className="grid grid-cols-12 gap-1 py-1">
                <span className={`col-span-5 font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Kamar / Asrama</span>
                <span className="col-span-1 text-slate-400">:</span>
                <span className={`col-span-6 font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>{student.dorm}</span>
              </div>

              <div className="grid grid-cols-12 gap-1 py-1">
                <span className={`col-span-5 font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Konsulat Wilayah</span>
                <span className="col-span-1 text-slate-400">:</span>
                <span className={`col-span-6 font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>{student.consulate}</span>
              </div>

              <div className="grid grid-cols-12 gap-1 py-1">
                <span className={`col-span-5 font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Nama Wali Santri</span>
                <span className="col-span-1 text-slate-400">:</span>
                <span className={`col-span-6 font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>{student.guardian_name}</span>
              </div>
            </div>

            {/* Interactive Call to Action WhatsApp */}
            <div className={`rounded-3xl border p-5 text-center space-y-3 shadow-lg transition-all ${
              isDarkMode 
                ? "border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-slate-900 to-transparent" 
                : "border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50"
            }`}>
              <div className="flex items-center justify-center space-x-2 text-emerald-600 dark:text-emerald-400 font-black text-xs uppercase tracking-wider">
                <MessageCircle className="h-4 w-4" />
                <span>Layanan Hotline Biro Pengasuhan</span>
              </div>
              <p className={`text-xs leading-relaxed ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                Butuh informasi perkembangan, perizinan darurat, atau konfirmasi ananda? Hubungi sekretariat pengasuhan via WhatsApp.
              </p>
              <a
                href={`https://wa.me/6281234567890?text=Assalamu%27alaikum%20Biro%20Pengasuhan%20Pesantren%2C%20saya%20wali%20dari%20santri%20${encodeURIComponent(student.name)}%20(NIS%3A%20${student.nis})`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center space-x-2 w-full rounded-2xl bg-emerald-600 hover:bg-emerald-500 py-3.5 text-xs font-black text-white shadow-xl shadow-emerald-600/30 transition hover:scale-[1.02] active:scale-95 cursor-pointer"
              >
                <Phone className="h-4 w-4" />
                <span>Kirim Pesan WhatsApp ke Pengasuhan</span>
              </a>
            </div>
          </div>
        )}

        {/* ================= TAB 2: PRESTASI & PENGHARGAAN ================= */}
        {activeTab === "achievements" && (
          <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
            {achievements.length === 0 ? (
              <div className={`rounded-3xl border p-12 text-center space-y-2 shadow-sm ${
                isDarkMode ? "border-slate-800 bg-slate-900/40 text-slate-500" : "border-slate-200 bg-white text-slate-400"
              }`}>
                <Trophy className="h-12 w-12 mx-auto opacity-30 text-amber-500 animate-pulse" />
                <p className={`font-bold text-xs ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>Belum Ada Catatan Prestasi</p>
                <p className="text-[11px]">Capaian kejuaraan atau tahfidz santri akan otomatis diverifikasi dan tampil di sini.</p>
              </div>
            ) : (
              achievements.map((a) => (
                <div key={a.id} className={`rounded-2xl border p-4 space-y-2 shadow-sm transition hover:scale-[1.01] ${
                  isDarkMode ? "border-slate-800 bg-slate-900/70 hover:border-slate-700" : "border-slate-200 bg-white hover:border-slate-300"
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {a.category}
                      </span>
                      <h4 className={`text-xs font-bold mt-1.5 leading-snug ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                        {a.title}
                      </h4>
                    </div>
                    <span className="text-xs font-black font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20 shrink-0 shadow-sm">
                      +{a.reward_points} Pts
                    </span>
                  </div>

                  <div className={`flex items-center justify-between text-[10px] pt-1.5 border-t ${
                    isDarkMode ? "border-slate-800 text-slate-400" : "border-slate-100 text-slate-500"
                  }`}>
                    <span>Tingkat: <strong className={isDarkMode ? "text-slate-300" : "text-slate-800"}>{a.level}</strong></span>
                    <span className="font-mono">{new Date(a.event_date || a.created_at).toLocaleDateString("id-ID", { dateStyle: "medium" })}</span>
                  </div>

                  {a.certificate_url && (
                    <a
                      href={a.certificate_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-[10px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline pt-1"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Lihat Dokumen Piagam Resmi
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ================= TAB 3: CATATAN KEDISIPLINAN ================= */}
        {activeTab === "violations" && (
          <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
            {violations.length === 0 ? (
              <div className={`rounded-3xl border p-12 text-center space-y-2 shadow-sm ${
                isDarkMode ? "border-slate-800 bg-slate-900/40 text-slate-500" : "border-slate-200 bg-white text-slate-400"
              }`}>
                <ShieldCheck className="h-12 w-12 mx-auto text-emerald-500 opacity-70 animate-pulse" />
                <p className={`font-bold text-xs ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>Nihil Pelanggaran (Disiplin Terpuji)</p>
                <p className="text-[11px]">Santri mematuhi seluruh tata tertib dan etika pondok pesantren dengan sangat baik.</p>
              </div>
            ) : (
              violations.map((v) => (
                <div key={v.id} className={`rounded-2xl border p-4 space-y-2 shadow-sm transition hover:scale-[1.01] ${
                  isDarkMode ? "border-slate-800 bg-slate-900/70 hover:border-slate-700" : "border-slate-200 bg-white hover:border-slate-300"
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                        {v.category || "Pelanggaran"}
                      </span>
                      <h4 className={`text-xs font-bold mt-1.5 leading-snug ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                        {v.violation_name}
                      </h4>
                    </div>
                    <span className="text-xs font-black font-mono text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-xl border border-rose-500/20 shrink-0 shadow-sm">
                      +{v.points} Pts
                    </span>
                  </div>

                  {v.sanction && (
                    <p className={`text-[11px] p-2.5 rounded-xl border leading-relaxed ${
                      isDarkMode ? "bg-slate-950/60 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700"
                    }`}>
                      <strong className={isDarkMode ? "text-slate-400" : "text-slate-900"}>Takzir/Sanksi:</strong> {v.sanction}
                    </p>
                  )}

                  <div className={`flex items-center justify-between text-[10px] pt-1.5 border-t ${
                    isDarkMode ? "border-slate-800 text-slate-400" : "border-slate-100 text-slate-500"
                  }`}>
                    <span>Status Pembinaan: <strong className={isDarkMode ? "text-slate-300" : "text-slate-800"}>{v.status || "Selesai"}</strong></span>
                    <span className="font-mono">{new Date(v.created_at).toLocaleDateString("id-ID", { dateStyle: "medium" })}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ================= TAB 4: RIWAYAT PERIZINAN ================= */}
        {activeTab === "permissions" && (
          <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
            {permissions.length === 0 ? (
              <div className={`rounded-3xl border p-12 text-center space-y-2 shadow-sm ${
                isDarkMode ? "border-slate-800 bg-slate-900/40 text-slate-500" : "border-slate-200 bg-white text-slate-400"
              }`}>
                <LogOut className="h-12 w-12 mx-auto opacity-30 text-cyan-500 animate-pulse" />
                <p className={`font-bold text-xs ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>Belum Ada Riwayat Izin</p>
                <p className="text-[11px]">Seluruh riwayat perizinan santri keluar/pulang resmi akan tercatat di sini.</p>
              </div>
            ) : (
              permissions.map((p) => (
                <div key={p.id} className={`rounded-2xl border p-4 space-y-2 shadow-sm transition hover:scale-[1.01] ${
                  isDarkMode ? "border-slate-800 bg-slate-900/70 hover:border-slate-700" : "border-slate-200 bg-white hover:border-slate-300"
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className={`text-xs font-bold leading-snug ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                        {p.category}
                      </h4>
                      <p className={`text-[11px] mt-0.5 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                        {p.reason}
                      </p>
                    </div>
                    <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shrink-0 shadow-sm ${
                      p.status === "completed"
                        ? isDarkMode ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-700"
                        : "bg-cyan-500 text-white"
                    }`}>
                      {p.status}
                    </span>
                  </div>

                  <div className={`flex items-center justify-between text-[10px] pt-1.5 border-t font-mono ${
                    isDarkMode ? "border-slate-800 text-slate-400" : "border-slate-100 text-slate-500"
                  }`}>
                    <span>Tenggat: {p.return_target ? new Date(p.return_target).toLocaleString("id-ID") : "-"}</span>
                    <span>{new Date(p.created_at).toLocaleDateString("id-ID")}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* FOOTER RESMI */}
      <footer className={`text-center text-[10px] py-8 border-t mt-12 transition-colors ${
        isDarkMode ? "border-slate-900 text-slate-600" : "border-slate-200 text-slate-500"
      }`}>
        <p className="font-bold">© 2026 SIPS Pesantren Riyadlul Ulum Wadda&apos;wah Condong</p>
        <p className="mt-0.5">Sistem Informasi Pengasuhan &amp; Kedisiplinan Santri Terpadu</p>
      </footer>
    </div>
  );
}