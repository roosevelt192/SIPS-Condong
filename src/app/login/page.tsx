"use client";

import { useState, useEffect } from "react";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  User,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Building2,
  UserCheck,
  Sun,
  Moon,
  Sparkles,
  QrCode,
  ShieldAlert,
  ArrowLeft,
  Trophy,
  FileSpreadsheet,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { playScanSound } from "@/lib/feedback";
import SIPSLogo from "@/components/SIPSLogo";

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Form States
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"pengasuhan" | "security">("pengasuhan");
  const [showPassword, setShowPassword] = useState(false);

  // Status & Feedback States
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingNotice, setPendingNotice] = useState(false);
  const [successRegister, setSuccessRegister] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("sips_theme");
    if (savedTheme === "light") {
      setIsDarkMode(false);
      document.documentElement.classList.remove("dark");
    } else {
      setIsDarkMode(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleTheme = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("sips_theme", "light");
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("sips_theme", "dark");
      setIsDarkMode(true);
    }
  };

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");
    setPendingNotice(false);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (authError) {
        throw new Error(
          authError.message === "Invalid login credentials"
            ? "Email atau kata sandi yang Anda masukkan tidak valid."
            : authError.message
        );
      }

      if (authData?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, status")
          .eq("id", authData.user.id)
          .maybeSingle();

        if (profile) {
          if (profile.status === "pending") {
            await supabase.auth.signOut();
            setPendingNotice(true);
            playScanSound("warning");
            setLoading(false);
            return;
          }

          if (profile.status === "rejected") {
            await supabase.auth.signOut();
            throw new Error("Pendaftaran akun Anda ditolak oleh Super Admin.");
          }

          playScanSound("success");
          if (profile.role === "security") {
            window.location.href = "/dashboard/security-gate";
            return;
          }
        }

        playScanSound("success");
        window.location.href = "/dashboard";
      }
    } catch (err: any) {
      playScanSound("error");
      setErrorMessage(err.message || "Terjadi kesalahan saat masuk ke sistem.");
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || password.length < 6) {
      setErrorMessage("Harap lengkapi seluruh data. Kata sandi minimal 6 karakter.");
      playScanSound("warning");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setPendingNotice(false);

    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: role,
          },
        },
      });

      if (error) throw error;
      playScanSound("success");
      setSuccessRegister(true);
    } catch (err: any) {
      playScanSound("error");
      setErrorMessage(err.message || "Gagal mendaftarkan akun baru.");
    } finally {
      setLoading(false);
    }
  }

  const switchMode = (targetRegister: boolean) => {
    setIsRegister(targetRegister);
    setErrorMessage("");
    setPendingNotice(false);
    setSuccessRegister(false);
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#f1f5f9] dark:bg-[#07130e] p-4 sm:p-6 antialiased selection:bg-emerald-600 selection:text-white font-sans relative overflow-x-hidden transition-colors duration-500">
      {/* Background Decorative Blur Lights */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-[550px] w-[550px] rounded-full bg-emerald-600/15 dark:bg-emerald-600/20 blur-[140px]" />
        <div className="absolute -bottom-24 -right-24 h-[550px] w-[550px] rounded-full bg-teal-500/15 dark:bg-teal-500/20 blur-[140px]" />
      </div>

      {/* Main Container */}
      <div className="relative w-full max-w-[880px] rounded-[32px] sm:rounded-[36px] bg-white/95 dark:bg-slate-900/95 shadow-2xl border border-slate-200/90 dark:border-slate-800/90 p-5 sm:p-7 md:p-4 flex flex-col md:flex-row overflow-hidden z-10 transition-all duration-300 md:min-h-[560px]">
        
        {/* ================= PANEL 1: FORMULIR LOGIN ================= */}
        <div
          className={`w-full md:w-1/2 flex flex-col justify-between py-2 md:py-4 px-1 sm:px-4 md:px-7 transition-all duration-500 ${
            isRegister
              ? "hidden md:flex md:opacity-0 md:pointer-events-none md:-translate-x-10 md:scale-95"
              : "flex opacity-100 translate-x-0 scale-100"
          }`}
        >
          {/* Header Brand & Theme Switcher */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center space-x-2.5">
                <SIPSLogo className="h-10 w-10 min-w-[40px] min-h-[40px] shrink-0" />
                <div className="flex items-center space-x-1.5">
                  <span className="text-base font-black tracking-tight text-slate-900 dark:text-white uppercase">
                    SIPS
                  </span>
                  <span className="text-[9px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    v2.6
                  </span>
                </div>
              </div>

              {/* Theme Switcher */}
              <button
                type="button"
                onClick={toggleTheme}
                className="relative flex items-center h-8 w-16 rounded-full bg-slate-200/80 dark:bg-slate-950 p-1 transition-all duration-300 hover:scale-105 active:scale-95 border border-slate-300/90 dark:border-slate-800 shadow-inner cursor-pointer"
                title={isDarkMode ? "Beralih ke Mode Cerah" : "Beralih ke Mode Gelap"}
              >
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full shadow-md transition-all duration-300 transform ${
                    isDarkMode
                      ? "translate-x-8 bg-[#064e3b] text-emerald-300 rotate-0"
                      : "translate-x-0 bg-amber-500 text-white rotate-360"
                  }`}
                >
                  {isDarkMode ? (
                    <Moon className="h-3 w-3 animate-in zoom-in duration-200" />
                  ) : (
                    <Sun className="h-3 w-3 animate-in zoom-in duration-200" />
                  )}
                </div>
                <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none text-slate-400 text-xs">
                  <Sun className={`h-2.5 w-2.5 transition-opacity ${!isDarkMode ? "opacity-0" : "opacity-40"}`} />
                  <Moon className={`h-2.5 w-2.5 transition-opacity ${isDarkMode ? "opacity-0" : "opacity-40"}`} />
                </div>
              </button>
            </div>

            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Selamat Datang Kembali
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                Portal Sistem Pengasuhan Santri Pesantren Condong
              </p>
            </div>
          </div>

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="my-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-300 flex items-center gap-2 animate-in fade-in">
              <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {pendingNotice && (
            <div className="my-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-2 animate-in fade-in">
              <Clock className="h-4 w-4 text-amber-500 shrink-0" />
              <span>Menunggu persetujuan Super Admin.</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-3.5 my-4 md:my-auto">
            <div className="space-y-1">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Email Kedinasan / Petugas
              </label>
              <div className="relative flex items-center group">
                <Mail className="absolute left-3.5 h-4 w-4 text-slate-400 transition-colors group-focus-within:text-emerald-600" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="petugas@condong.id"
                  className="h-11 w-full rounded-2xl border border-slate-300 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 pl-10 pr-3.5 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Kata Sandi
              </label>
              <div className="relative flex items-center group">
                <Lock className="absolute left-3.5 h-4 w-4 text-slate-400 transition-colors group-focus-within:text-emerald-600" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 w-full rounded-2xl border border-slate-300 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 pl-10 pr-10 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-xs font-black text-white shadow-lg shadow-emerald-700/25 transition-all duration-200 hover:scale-[1.01] active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Memverifikasi Akses...</span>
                </>
              ) : (
                <>
                  <span>Masuk ke Dashboard</span>
                  <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                </>
              )}
            </button>
          </form>

          {/* Switch to Register Button on Mobile */}
          <div className="block md:hidden text-center my-3">
            <button
              type="button"
              onClick={() => switchMode(true)}
              className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
            >
              Belum punya akun? Daftar Petugas di sini
            </button>
          </div>

          {/* Footer Security Badge */}
          <div className="pt-2 text-center border-t border-slate-100 dark:border-slate-800/60 md:border-none">
            <div className="inline-flex items-center space-x-1.5 text-[10px] text-slate-400 font-bold">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>Autentikasi Terproteksi • Pondok Pesantren Condong</span>
            </div>
          </div>
        </div>

        {/* ================= PANEL 2: FORMULIR DAFTAR PETUGAS ================= */}
        <div
          className={`w-full md:w-1/2 flex flex-col justify-between py-2 md:py-4 px-1 sm:px-4 md:px-7 transition-all duration-500 ${
            !isRegister
              ? "hidden md:flex md:opacity-0 md:pointer-events-none md:translate-x-10 md:scale-95"
              : "flex opacity-100 translate-x-0 scale-100"
          }`}
        >
          {/* Header Brand & Theme Switcher */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center space-x-2.5">
                <SIPSLogo className="h-10 w-10 min-w-[40px] min-h-[40px] shrink-0" />
                <span className="text-base font-black tracking-tight text-slate-900 dark:text-white uppercase">
                  SIPS
                </span>
              </div>

              <button
                type="button"
                onClick={toggleTheme}
                className="relative flex items-center h-8 w-16 rounded-full bg-slate-200/80 dark:bg-slate-950 p-1 transition-all duration-300 hover:scale-105 active:scale-95 border border-slate-300/90 dark:border-slate-800 shadow-inner cursor-pointer"
                title={isDarkMode ? "Beralih ke Mode Cerah" : "Beralih ke Mode Gelap"}
              >
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full shadow-md transition-all duration-300 transform ${
                    isDarkMode
                      ? "translate-x-8 bg-[#064e3b] text-emerald-300 rotate-0"
                      : "translate-x-0 bg-amber-500 text-white rotate-360"
                  }`}
                >
                  {isDarkMode ? (
                    <Moon className="h-3 w-3 animate-in zoom-in duration-200" />
                  ) : (
                    <Sun className="h-3 w-3 animate-in zoom-in duration-200" />
                  )}
                </div>
                <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none text-slate-400 text-xs">
                  <Sun className={`h-2.5 w-2.5 transition-opacity ${!isDarkMode ? "opacity-0" : "opacity-40"}`} />
                  <Moon className={`h-2.5 w-2.5 transition-opacity ${isDarkMode ? "opacity-0" : "opacity-40"}`} />
                </div>
              </button>
            </div>

            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Registrasi Petugas Baru
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                Pilih bidang penugasan dan lengkapi data kedinasan
              </p>
            </div>
          </div>

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="my-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-300 flex items-center gap-2 animate-in fade-in">
              <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successRegister ? (
            <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center space-y-2.5 my-auto animate-in fade-in">
              <CheckCircle2 className="h-9 w-9 text-emerald-600 mx-auto" />
              <h3 className="font-black text-sm text-slate-900 dark:text-white">Pendaftaran Berhasil Diajukan!</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Akun petugas Anda telah dibuat dan masuk ke antrean verifikasi Super Admin.
              </p>
              <button
                type="button"
                onClick={() => switchMode(false)}
                className="mt-2 px-5 py-2.5 rounded-2xl bg-[#064e3b] text-white text-xs font-black hover:bg-emerald-800 transition active:scale-95 shadow-md cursor-pointer"
              >
                Kembali ke Halaman Masuk
              </button>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3 my-4 md:my-auto">
              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Nama Lengkap Petugas
                </label>
                <div className="relative flex items-center group">
                  <User className="absolute left-3.5 h-4 w-4 text-slate-400 transition-colors group-focus-within:text-emerald-600" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Contoh: Ust. Setiawan / Bpk. Jajang"
                    className="h-10.5 w-full rounded-2xl border border-slate-300 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 pl-10 pr-3 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Pilih Penugasan (Role)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div
                    onClick={() => setRole("pengasuhan")}
                    className={`cursor-pointer rounded-2xl border p-2.5 flex items-center space-x-2 transition-all select-none ${
                      role === "pengasuhan"
                        ? "bg-emerald-500/15 border-emerald-600 text-emerald-800 dark:text-emerald-300 font-bold ring-1 ring-emerald-500/30 shadow-xs"
                        : "border-slate-300 dark:border-slate-800 text-slate-500 hover:border-slate-400 bg-slate-50/50 dark:bg-transparent"
                    }`}
                  >
                    <UserCheck className="h-4 w-4 shrink-0" />
                    <span className="text-xs truncate font-bold">Pengasuhan</span>
                  </div>
                  <div
                    onClick={() => setRole("security")}
                    className={`cursor-pointer rounded-2xl border p-2.5 flex items-center space-x-2 transition-all select-none ${
                      role === "security"
                        ? "bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-300 font-bold ring-1 ring-amber-500/30 shadow-xs"
                        : "border-slate-300 dark:border-slate-800 text-slate-500 hover:border-slate-400 bg-slate-50/50 dark:bg-transparent"
                    }`}
                  >
                    <Building2 className="h-4 w-4 shrink-0" />
                    <span className="text-xs truncate font-bold">Pos Satpam</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Email Kedinasan
                </label>
                <div className="relative flex items-center group">
                  <Mail className="absolute left-3.5 h-4 w-4 text-slate-400 transition-colors group-focus-within:text-emerald-600" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="petugas@condong.id"
                    className="h-10.5 w-full rounded-2xl border border-slate-300 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 pl-10 pr-3 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Kata Sandi Baru
                </label>
                <div className="relative flex items-center group">
                  <Lock className="absolute left-3.5 h-4 w-4 text-slate-400 transition-colors group-focus-within:text-emerald-600" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 Karakter"
                    className="h-10.5 w-full rounded-2xl border border-slate-300 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 pl-10 pr-10 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-xs font-black text-white shadow-lg shadow-emerald-700/25 transition-all duration-200 hover:scale-[1.01] active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Mendaftarkan Akun...</span>
                  </>
                ) : (
                  <>
                    <span>Ajukan Akun Petugas</span>
                    <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Switch to Login Button on Mobile */}
          <div className="block md:hidden text-center my-3">
            <button
              type="button"
              onClick={() => switchMode(false)}
              className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
            >
              Sudah punya akun? Masuk di sini
            </button>
          </div>

          {/* Footer Security Badge */}
          <div className="pt-2 text-center border-t border-slate-100 dark:border-slate-800/60 md:border-none">
            <div className="inline-flex items-center space-x-1.5 text-[10px] text-slate-400 font-bold">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>Verifikasi Berjenjang • Bagian Pengasuhan Santri</span>
            </div>
          </div>
        </div>

        {/* ================= PANEL 3: ANIMATED SLIDING VISUAL BANNER (DESKTOP ONLY) ================= */}
        <div
          style={{
            left: isRegister ? "0.75rem" : "50%",
            width: "calc(50% - 0.75rem)",
          }}
          className="hidden md:flex absolute top-3 bottom-3 rounded-[28px] overflow-hidden p-6 sm:p-7 flex-col justify-between text-white transition-all duration-700 ease-[cubic-bezier(0.65,0,0.35,1)] z-20 shadow-2xl bg-gradient-to-b from-[#064e3b] via-[#043e30] to-[#022c22]"
        >
          {/* Abstract Glow Artwork */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
            <div className="absolute top-1/4 right-0 w-64 h-64 rounded-full bg-emerald-400/20 blur-3xl transform translate-x-12 animate-pulse" />
            <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-teal-400/20 blur-3xl transform -translate-x-10 translate-y-10" />
          </div>

          {/* Top Banner Header with Logo */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2.5">
              <SIPSLogo className="h-11 w-11" />
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[9.5px] font-bold uppercase tracking-wider">
                <Sparkles className="h-3 w-3 text-emerald-300" />
                <span>Sistem Pengasuhan Santri Terpadu</span>
              </div>
            </div>

            <h3 className="text-xl font-black tracking-tight leading-snug">
              Integritas &amp; Kedisiplinan <br />
              <span className="text-emerald-300">Pondok Pesantren Condong</span>
            </h3>
          </div>

          {/* 4 Pilar Fitur Utama SIPS */}
          <div className="grid grid-cols-2 gap-2 bg-white/10 backdrop-blur-md border border-white/15 p-2.5 rounded-2xl shadow-xl">
            <div className="flex items-center space-x-2 bg-white/5 p-2 rounded-xl border border-white/10">
              <div className="h-7 w-7 rounded-lg bg-emerald-400/20 text-emerald-300 flex items-center justify-center shrink-0">
                <QrCode className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] text-slate-300 truncate">Lalu Lintas</p>
                <p className="text-[11px] font-bold text-white truncate">Gate Scanner</p>
              </div>
            </div>

            <div className="flex items-center space-x-2 bg-white/5 p-2 rounded-xl border border-white/10">
              <div className="h-7 w-7 rounded-lg bg-rose-400/20 text-rose-300 flex items-center justify-center shrink-0">
                <ShieldAlert className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] text-slate-300 truncate">Tarbiyah</p>
                <p className="text-[11px] font-bold text-white truncate">Poin Disiplin</p>
              </div>
            </div>

            <div className="flex items-center space-x-2 bg-white/5 p-2 rounded-xl border border-white/10">
              <div className="h-7 w-7 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0">
                <Trophy className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] text-slate-300 truncate">Apresiasi</p>
                <p className="text-[11px] font-bold text-white truncate">Buku Prestasi</p>
              </div>
            </div>

            <div className="flex items-center space-x-2 bg-white/5 p-2 rounded-xl border border-white/10">
              <div className="h-7 w-7 rounded-lg bg-teal-400/20 text-teal-300 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] text-slate-300 truncate">Database</p>
                <p className="text-[11px] font-bold text-white truncate">KTS &amp; Laporan</p>
              </div>
            </div>
          </div>

          {/* Interactive Slide Action Button */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => switchMode(!isRegister)}
              className="w-full py-2.5 px-4 rounded-2xl bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 text-xs font-bold text-white flex items-center justify-center space-x-2 transition-all duration-300 hover:scale-[1.02] active:scale-95 shadow-md cursor-pointer"
            >
              {isRegister ? (
                <>
                  <ArrowLeft className="h-3.5 w-3.5 text-emerald-300" />
                  <span>Sudah Terdaftar? Beralih ke Masuk Akun</span>
                </>
              ) : (
                <>
                  <span>Belum Punya Akun? Beralih ke Daftar Petugas</span>
                  <ArrowRight className="h-3.5 w-3.5 text-emerald-300" />
                </>
              )}
            </button>

            <div className="text-[10px] text-emerald-200/80 font-medium flex items-center justify-between px-1">
              <span>© 2026 Bagian Pengasuhan Santri</span>
              <span className="text-emerald-300 font-bold">Terproteksi RLS</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}