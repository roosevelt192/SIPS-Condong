"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  IdCard,
  FileCheck2,
  ShieldAlert,
  Trophy,
  FileSpreadsheet,
  QrCode,
  Search,
  ChevronLeft,
  Moon,
  Sun,
  Settings,
  LogOut,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  Building2,
  Bell,
  CheckCircle2,
  Clock,
  RefreshCw,
  UserCheck,
  History,
  Menu,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: "super_admin" | "pengasuhan" | "security";
  status: "pending" | "approved" | "rejected";
}

interface MenuItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // ================= 1. AUTH & USER STATE =================
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // ================= 2. UI & THEME STATES =================
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeGateCount, setActiveGateCount] = useState(0);

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: "Santri Terlambat Kembali",
      desc: "Perlu konfirmasi tap masuk di pos gerbang",
      time: "10 mnt lalu",
      type: "alert",
      unread: true,
    },
    {
      id: 2,
      title: "Permohonan Izin Baru",
      desc: "Surat perizinan santri baru diterbitkan",
      time: "25 mnt lalu",
      type: "info",
      unread: true,
    },
  ]);

  const [currentTime, setCurrentTime] = useState("");
  const [masehiDate, setMasehiDate] = useState("");
  const [hijriDate, setHijriDate] = useState("");

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // ================= 3. THEME TOGGLE & PERSISTENCE =================
  useEffect(() => {
    const savedTheme = localStorage.getItem("sips_theme");
    if (savedTheme === "dark") {
      setIsDarkMode(true);
      document.documentElement.classList.add("dark");
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove("dark");
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

  // ================= 4. AUTH VERIFICATION =================
  useEffect(() => {
    async function verifyUserSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session || !session.user) {
          setIsAuthenticated(false);
          router.replace("/login");
          return;
        }

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("id, full_name, email, role, status")
          .eq("id", session.user.id)
          .maybeSingle();

        if (error || !profile) {
          setUserProfile({
            id: session.user.id,
            full_name: session.user.email?.split("@")[0] || "Petugas SIPS",
            email: session.user.email || "",
            role: session.user.email === "wezefaiq75@gmail.com" ? "super_admin" : "pengasuhan",
            status: "approved",
          });
        } else {
          if (profile.status !== "approved") {
            await supabase.auth.signOut();
            router.replace("/login");
            return;
          }
          setUserProfile(profile);
        }

        setIsAuthenticated(true);
      } catch {
        setIsAuthenticated(false);
        router.replace("/login");
      } finally {
        setCheckingAuth(false);
      }
    }

    verifyUserSession();

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

  // ================= 5. REALTIME BADGE & CLOCK =================
  useEffect(() => {
    async function fetchBadge() {
      try {
        const { count } = await supabase
          .from("permissions")
          .select("*", { count: "exact", head: true })
          .eq("status", "out_pondok");
        setActiveGateCount(count || 0);
      } catch {
        // silent
      }
    }
    fetchBadge();
  }, [pathname]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }) + " WIB"
      );
      setMasehiDate(
        now.toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      );
      try {
        const hijri = new Intl.DateTimeFormat("id-ID-u-ca-islamic-umalqura", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(now);
        setHijriDate(`${hijri} H`);
      } catch {
        setHijriDate("Safar 1448 H");
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setShowProfileMenu(false);
      }
      if (
        notifRef.current &&
        !notifRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleConfirmLogout = async () => {
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "/login";
    } catch {
      window.location.href = "/login";
    }
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const unreadCount = notifications.filter((n) => n.unread).length;
  const currentRole = userProfile?.role || "pengasuhan";

  const getMenuSections = (): MenuSection[] => {
    if (currentRole === "security") {
      return [
        {
          title: "Akses Gerbang",
          items: [
            { name: "Pos Gerbang & Scanner", href: "/dashboard/security-gate", icon: QrCode, badge: "Gate" },
            { name: "Dashboard Utama", href: "/dashboard", icon: LayoutDashboard },
            { name: "Perizinan Santri", href: "/dashboard/permissions", icon: FileCheck2 },
          ],
        },
      ];
    }

    const sections: MenuSection[] = [
      {
        title: "Utama",
        items: [
          {
            name: "Dashboard",
            href: "/dashboard",
            icon: LayoutDashboard,
            badge: "Live",
            badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
          },
        ],
      },
      {
        title: "Kesiswaan & Identitas",
        items: [
          { name: "Master Santri", href: "/dashboard/students", icon: Users },
          {
            name: "Cetak KTS Santri",
            href: "/dashboard/id-cards",
            icon: IdCard,
            badge: "KTS",
            badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
          },
        ],
      },
      {
        title: "Disiplin & Tarbiyah",
        items: [
          {
            name: "Biro Perizinan",
            href: "/dashboard/permissions",
            icon: FileCheck2,
            badge: activeGateCount > 0 ? `${activeGateCount} Luar` : undefined,
            badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/30 font-bold",
          },
          { name: "Pelanggaran & Poin", href: "/dashboard/violations", icon: ShieldAlert },
          { name: "Prestasi Santri", href: "/dashboard/achievements", icon: Trophy },
        ],
      },
      {
        title: "Laporan & Layanan",
        items: [
          { name: "Pusat Laporan", href: "/dashboard/reports", icon: FileSpreadsheet },
          {
            name: "Audit Logs",
            href: "/dashboard/audit-logs",
            icon: History,
            badge: "Audit",
            badgeColor: "bg-teal-500/20 text-teal-300 border-teal-500/30 font-bold",
          },
          {
            name: "Pengaturan Sistem",
            href: "/dashboard/settings",
            icon: Settings,
          },
        ],
      },
    ];

    if (currentRole === "super_admin") {
      sections[3].items.push({
        name: "Kelola Akun Petugas",
        href: "/dashboard/users-management",
        icon: UserCheck,
      });
    }

    return sections;
  };

  const menuSections = getMenuSections();

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b1311] flex flex-col items-center justify-center text-slate-800 dark:text-white space-y-3 font-sans">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-600" />
        <p className="text-xs text-slate-500 font-bold tracking-wider uppercase">
          Memverifikasi Sesi Akses SIPS...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-[#f1f5f9] dark:bg-[#0b1311] text-slate-900 dark:text-slate-100 flex transition-colors duration-300 font-sans relative">
      {/* Backdrop Mobile */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-xs md:hidden animate-in fade-in duration-200"
        />
      )}

      {/* ================= SIDEBAR ================= */}
      <aside
        className={`fixed top-0 left-0 z-50 h-screen bg-[#064e3b] dark:bg-[#072d24] text-white border-r border-emerald-800/40 dark:border-emerald-900/40 backdrop-blur-2xl transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] flex flex-col justify-between shadow-2xl select-none ${
          mobileMenuOpen ? "translate-x-0 w-72" : "-translate-x-full md:translate-x-0"
        }`}
        style={{
          width: typeof window !== "undefined" && window.innerWidth >= 768 ? (isCollapsed ? "74px" : "260px") : undefined,
        }}
      >
        {/* Toggle Button */}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`hidden md:flex absolute -right-3.5 top-6 h-7 w-7 rounded-full bg-[#064e3b] dark:bg-[#072d24] border-2 border-emerald-400/50 text-white hover:bg-emerald-700 shadow-lg items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-90 z-50 cursor-pointer ${
            isCollapsed ? "rotate-180" : "rotate-0"
          }`}
          title={isCollapsed ? "Buka Sidebar" : "Ciutkan Sidebar"}
        >
          <ChevronLeft className="h-4 w-4 stroke-[2.5]" />
        </button>

        {/* Brand */}
        <div className="h-18 shrink-0 px-4 border-b border-emerald-800/40 dark:border-emerald-900/40 flex items-center justify-between overflow-hidden">
          <Link
            href="/dashboard"
            className="flex items-center space-x-3 overflow-hidden w-full"
          >
            <div className="h-10 w-10 min-w-[40px] min-h-[40px] shrink-0 rounded-2xl bg-emerald-400 text-[#064e3b] flex items-center justify-center shadow-lg font-black">
              <ShieldCheck className="h-5 w-5 stroke-[2.5]" />
            </div>

            <div
              className={`transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden whitespace-nowrap ${
                isCollapsed
                  ? "md:max-w-0 md:opacity-0 md:-translate-x-3 md:pointer-events-none"
                  : "max-w-[170px] opacity-100 translate-x-0"
              }`}
            >
              <div className="flex items-center space-x-1.5">
                <span className="font-black text-sm tracking-tight text-white truncate">
                  SIPS PANEL
                </span>
                <span className="text-[9.5px] font-black text-emerald-950 bg-emerald-300 px-1.5 py-0.2 rounded-full shadow-xs">
                  v2.6
                </span>
              </div>
              <p className="text-[10px] text-emerald-200/70 font-medium truncate">
                Pesantren Condong
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-1.5 rounded-xl text-emerald-200 hover:bg-emerald-800/60"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Menu Items */}
        <div className="flex-1 overflow-y-auto px-3 py-3.5 space-y-4 custom-scrollbar overflow-x-hidden">
          {/* Quick Search */}
          <div className="relative group flex justify-center">
            {isCollapsed ? (
              <button
                type="button"
                onClick={() => setIsCollapsed(false)}
                className="hidden md:flex h-10 w-10 rounded-2xl border border-emerald-700/50 dark:border-emerald-800/50 bg-emerald-900/40 items-center justify-center text-emerald-300 hover:bg-emerald-800/60 hover:text-white transition cursor-pointer"
                title="Cari Menu"
              >
                <Search className="h-4 w-4" />
              </button>
            ) : null}

            <div className={`relative w-full ${isCollapsed ? "md:hidden" : "block"}`}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-300/70 group-focus-within:text-white transition-colors pointer-events-none" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Pencarian menu..."
                className="h-9 w-full rounded-2xl border border-emerald-700/50 dark:border-emerald-800/50 bg-emerald-950/40 pl-8.5 pr-3 text-xs font-semibold text-white placeholder-emerald-300/50 outline-none focus:border-emerald-400 focus:bg-emerald-950/70 transition-all"
              />
            </div>
          </div>

          {menuSections.map((section, secIdx) => {
            const filteredItems = section.items.filter((item) =>
              item.name.toLowerCase().includes(searchFilter.toLowerCase())
            );

            if (filteredItems.length === 0) return null;

            return (
              <div key={secIdx} className="space-y-1">
                <p
                  className={`text-[9.5px] font-black tracking-wider uppercase text-emerald-300/60 overflow-hidden whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                    isCollapsed
                      ? "md:max-h-0 md:opacity-0 md:-translate-x-2 md:py-0 md:px-0"
                      : "max-h-5 opacity-100 translate-x-0 px-2.5 pt-1"
                  }`}
                >
                  {section.title}
                </p>

                <div className="space-y-1">
                  {filteredItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`group relative flex items-center rounded-2xl transition-all duration-200 overflow-hidden ${
                          isCollapsed
                            ? "md:h-11 md:w-11 md:mx-auto md:justify-center md:p-0 h-10 w-full px-3 justify-between"
                            : "h-10.5 w-full px-3 justify-between"
                        } ${
                          isActive
                            ? "bg-white text-[#064e3b] font-black shadow-md"
                            : "text-emerald-100 hover:bg-emerald-800/40 dark:hover:bg-emerald-800/30 hover:text-white"
                        }`}
                        title={isCollapsed ? item.name : undefined}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <div className="h-6 w-6 shrink-0 flex items-center justify-center">
                            <Icon
                              className={`h-4.5 w-4.5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                                isActive
                                  ? "text-[#064e3b] stroke-[2.6]"
                                  : "text-emerald-200 stroke-[2]"
                              }`}
                            />
                          </div>

                          <span
                            className={`transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] whitespace-nowrap overflow-hidden text-left text-xs ${
                              isCollapsed
                                ? "md:max-w-0 md:opacity-0 md:-translate-x-2 md:pointer-events-none"
                                : "max-w-[140px] opacity-100 translate-x-0"
                            }`}
                          >
                            {item.name}
                          </span>
                        </div>

                        {(!isCollapsed || mobileMenuOpen) && item.badge && (
                          <span
                            className={`whitespace-nowrap text-[9px] px-1.5 py-0.3 rounded-full border font-bold ${
                              isActive
                                ? "bg-[#064e3b]/15 text-[#064e3b] border-[#064e3b]/30"
                                : item.badgeColor || "bg-emerald-900/60 text-emerald-200 border-emerald-700/50"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}

                        {isCollapsed && (
                          <div className="fixed left-[82px] hidden md:group-hover:block rounded-xl bg-slate-950 text-white px-3 py-1.5 text-xs font-bold whitespace-nowrap shadow-2xl z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150 border border-emerald-800">
                            {item.name}
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Scanner Card */}
          <div
            className={`rounded-2xl border border-emerald-700/40 dark:border-emerald-800/40 bg-emerald-950/40 dark:bg-emerald-950/60 shadow-inner transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden ${
              isCollapsed
                ? "md:h-11 md:w-11 md:mx-auto md:flex md:items-center md:justify-center md:p-0 md:border-transparent md:bg-transparent md:dark:bg-transparent md:shadow-none p-3 text-xs space-y-2 mt-4"
                : "p-3 text-xs space-y-2 mt-4"
            }`}
          >
            {!isCollapsed || mobileMenuOpen ? (
              <div className="space-y-2 animate-in fade-in duration-300">
                <div className="flex items-center space-x-2 text-emerald-200 font-bold">
                  <div className="h-5 w-5 rounded-lg bg-emerald-400/20 flex items-center justify-center">
                    <Sparkles className="h-3 w-3 text-emerald-300" />
                  </div>
                  <span className="text-[11px]">Gate Scanner KTS</span>
                </div>
                <p className="text-[10px] text-emerald-200/70 leading-relaxed">
                  Verifikasi keluar masuk santri realtime via barcode KTS.
                </p>
                <Link
                  href="/dashboard/security-gate"
                  className="flex items-center justify-center space-x-1.5 w-full py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[10.5px] shadow-md transition active:scale-95"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  <span>Buka Scanner Pos</span>
                </Link>
              </div>
            ) : (
              <Link
                href="/dashboard/security-gate"
                className="hidden md:flex h-11 w-11 rounded-2xl bg-emerald-500 text-slate-950 items-center justify-center shadow-lg hover:scale-105 transition active:scale-90"
                title="Buka Gate Scanner"
              >
                <QrCode className="h-5 w-5" />
              </Link>
            )}
          </div>
        </div>

        {/* Profile Footer */}
        <div
          className="relative p-2.5 border-t border-emerald-800/40 dark:border-emerald-900/40 bg-emerald-950/60 dark:bg-[#05211a]"
          ref={profileMenuRef}
        >
          <div
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className={`flex items-center rounded-2xl p-1.5 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] cursor-pointer hover:bg-emerald-800/40 border border-transparent hover:border-emerald-700/50 select-none overflow-hidden ${
              isCollapsed ? "md:justify-center justify-between" : "justify-between"
            }`}
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="relative h-9 w-9 min-w-[36px] min-h-[36px] shrink-0 rounded-xl overflow-hidden bg-emerald-300 text-[#064e3b] font-black text-xs flex items-center justify-center shadow-xs">
                {userProfile?.full_name?.charAt(0).toUpperCase() || "A"}
                <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-[#064e3b]" />
              </div>

              <div
                className={`transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden whitespace-nowrap text-left ${
                  isCollapsed
                    ? "md:max-w-0 md:opacity-0 md:-translate-x-3 md:pointer-events-none"
                    : "max-w-[130px] opacity-100 translate-x-0"
                }`}
              >
                <p className="font-bold text-xs text-white truncate leading-tight">
                  {userProfile?.full_name || "Admin SIPS"}
                </p>
                <p className="text-[10px] text-emerald-300/70 truncate">
                  {userProfile?.email || "admin@condong.id"}
                </p>
              </div>
            </div>

            <div
              className={`transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden ${
                isCollapsed
                  ? "md:max-w-0 md:opacity-0 md:pointer-events-none"
                  : "max-w-[20px] opacity-100"
              }`}
            >
              <ChevronRight
                className={`h-3.5 w-3.5 text-emerald-300 transition-transform ${
                  showProfileMenu ? "-rotate-90 text-white" : ""
                }`}
              />
            </div>
          </div>

          {showProfileMenu && (
            <div
              className={`absolute bottom-full mb-2 bg-white dark:bg-[#111f1b] border border-slate-200 dark:border-emerald-900/60 rounded-3xl p-3 shadow-2xl z-50 text-xs space-y-2 animate-in fade-in zoom-in-95 duration-150 ${
                isCollapsed ? "md:left-3 md:w-64 left-2 right-2" : "left-2 right-2"
              }`}
            >
              <div className="flex items-center space-x-2.5 p-2 border-b border-slate-100 dark:border-emerald-900/40 pb-2">
                <div className="h-8 w-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs">
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900 dark:text-white text-xs truncate">
                    {userProfile?.full_name || "Petugas SIPS"}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-emerald-400 font-mono truncate capitalize">
                    {currentRole.replace("_", " ")}
                  </p>
                </div>
              </div>

              <div className="space-y-0.5 font-semibold text-slate-700 dark:text-slate-200">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-emerald-900/30 transition text-left cursor-pointer"
                >
                  <div className="flex items-center space-x-2">
                    {isDarkMode ? (
                      <Sun className="h-4 w-4 text-amber-500" />
                    ) : (
                      <Moon className="h-4 w-4 text-emerald-600" />
                    )}
                    <span>Tema Tampilan</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    {isDarkMode ? "Dark" : "Light"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    router.push("/dashboard/settings");
                  }}
                  className="w-full flex items-center space-x-2 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-emerald-900/30 transition text-left cursor-pointer"
                >
                  <Settings className="h-4 w-4 text-slate-400" />
                  <span>Pengaturan Sistem</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    setShowLogoutModal(true);
                  }}
                  className="w-full flex items-center space-x-2 p-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition pt-2 border-t border-slate-100 dark:border-emerald-900/40 text-left cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Keluar Akun</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ================= CONTAINER UTAMA & TOPBAR (GLASSMORPHISM) ================= */}
      <div
        className={`flex flex-1 flex-col min-w-0 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          isCollapsed ? "md:ml-[74px]" : "md:ml-[260px]"
        } ml-0`}
      >
        {/* TOPBAR DENGAN EFEK FROSTED GLASS TRANSPARAN */}
        <header className="sticky top-0 z-30 flex h-18 shrink-0 items-center justify-between border-b border-slate-200/70 dark:border-emerald-900/30 bg-white/70 dark:bg-[#0c1815]/70 px-4 sm:px-6 backdrop-blur-xl shadow-xs transition-all">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200/80 dark:border-emerald-900/40 bg-white/80 dark:bg-[#111f1b]/80 text-slate-600 dark:text-slate-300 hover:text-emerald-600 transition active:scale-95 cursor-pointer backdrop-blur-md"
              title="Buka Menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-none">
                {currentRole === "security"
                  ? "Portal Pos Keamanan Gerbang"
                  : "Dashboard SIPS Executive"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 hidden sm:block">
                {currentRole === "security"
                  ? "Validasi KTS & Verifikasi Lalu Lintas Santri"
                  : "Pusat Kendali Terpadu Perizinan & Kedisiplinan Santri"}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Theme Switcher Glass */}
            <button
              type="button"
              onClick={toggleTheme}
              className="relative flex items-center h-8 sm:h-9 w-16 sm:w-18 rounded-full bg-slate-200/60 dark:bg-[#111f1b]/80 p-1 transition-all duration-300 hover:scale-105 active:scale-95 border border-slate-300/80 dark:border-emerald-900/40 shadow-inner backdrop-blur-md cursor-pointer"
              title={isDarkMode ? "Beralih ke Mode Cerah" : "Beralih ke Mode Gelap"}
            >
              <div
                className={`flex h-6 sm:h-7 w-6 sm:w-7 items-center justify-center rounded-full shadow-md transition-all duration-300 transform ${
                  isDarkMode
                    ? "translate-x-8 sm:translate-x-9 bg-emerald-600 text-white shadow-emerald-500/20 rotate-0"
                    : "translate-x-0 bg-white text-amber-500 shadow-amber-500/20 rotate-360"
                }`}
              >
                {isDarkMode ? (
                  <Moon className="h-3.5 sm:h-4 w-3.5 sm:w-4 animate-in zoom-in duration-200" />
                ) : (
                  <Sun className="h-3.5 sm:h-4 w-3.5 sm:w-4 animate-in zoom-in duration-200" />
                )}
              </div>
              <div className="absolute inset-0 flex items-center justify-between px-2 sm:px-2.5 pointer-events-none text-slate-400 text-[10px]">
                <Sun className={`h-3 sm:h-3.5 w-3 sm:w-3.5 transition-opacity ${!isDarkMode ? "opacity-0" : "opacity-40"}`} />
                <Moon className={`h-3 sm:h-3.5 w-3 sm:w-3.5 transition-opacity ${isDarkMode ? "opacity-0" : "opacity-40"}`} />
              </div>
            </button>

            {/* Jam & Kalender Glass Widget */}
            <div className="hidden lg:flex flex-col items-end rounded-2xl border border-slate-200/80 dark:border-emerald-900/40 bg-white/60 dark:bg-[#111f1b]/70 px-3.5 py-1 font-mono text-xs text-slate-600 dark:text-slate-300 backdrop-blur-md shadow-xs">
              <div className="flex items-center space-x-1.5 font-black text-slate-900 dark:text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>{currentTime}</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 space-x-1">
                <span>{masehiDate}</span>
                <span>•</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{hijriDate}</span>
              </div>
            </div>

            {currentRole !== "security" && (
              <Link
                href="/dashboard/security-gate"
                className="inline-flex items-center space-x-1.5 rounded-2xl bg-[#064e3b] dark:bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-2 text-xs font-black shadow-md transition active:scale-95 whitespace-nowrap"
              >
                <QrCode className="h-4 w-4 stroke-[2.5]" />
                <span className="hidden md:inline">Simulasi Gerbang</span>
              </Link>
            )}

            {/* Notifikasi Glass */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2.5 rounded-2xl border border-slate-200/80 dark:border-emerald-900/40 bg-white/70 dark:bg-[#111f1b]/80 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-emerald-900/30 transition active:scale-95 cursor-pointer backdrop-blur-md shadow-xs"
                title="Notifikasi"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-72 sm:w-96 rounded-3xl border border-slate-200 dark:border-emerald-900/50 bg-white/95 dark:bg-[#111f1b]/95 p-4 shadow-2xl z-50 backdrop-blur-2xl animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-emerald-900/40 pb-3">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Notifikasi SIPS</h3>
                      {unreadCount > 0 && (
                        <span className="rounded-full bg-rose-100 dark:bg-rose-950/60 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-400">
                          {unreadCount} Baru
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Tandai dibaca</span>
                      </button>
                    )}
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-emerald-900/30 max-h-72 overflow-y-auto custom-scrollbar my-1">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`py-3 px-1.5 flex items-start space-x-3 transition rounded-xl ${
                          n.unread ? "bg-slate-50/80 dark:bg-emerald-950/30" : "opacity-75"
                        }`}
                      >
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                            n.type === "alert"
                              ? "bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
                              : "bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
                          }`}
                        >
                          {n.type === "alert" ? <Clock className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight truncate">
                            {n.title}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                            {n.desc}
                          </p>
                          <span className="text-[10px] font-mono text-slate-400 mt-1 block">
                            {n.time}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-emerald-900/40 text-center">
                    <Link
                      href="/dashboard/permissions"
                      onClick={() => setShowNotifications(false)}
                      className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      Buka Semua Aktivitas →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Konten Halaman */}
        <main className="flex-1 overflow-y-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-6 custom-scrollbar">
          <div className="max-w-[1440px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>

      {/* Modal Logout */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-[32px] border border-slate-800 bg-slate-900/95 p-6 text-center space-y-5 animate-in zoom-in-95 duration-200 shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-inner">
              <LogOut className="h-6 w-6 stroke-[2.2]" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-black text-white tracking-tight">
                Keluar dari Sistem?
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Sesi autentikasi Anda akan diakhiri. Pastikan seluruh data dan scan gerbang telah tersimpan.
              </p>
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                disabled={loggingOut}
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-2.5 rounded-2xl border border-slate-700 bg-slate-800 text-slate-200 text-xs font-bold hover:bg-slate-700 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={loggingOut}
                onClick={handleConfirmLogout}
                className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-500 text-white text-xs font-black shadow-lg shadow-rose-600/25 hover:from-rose-500 hover:to-rose-400 transition active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                {loggingOut ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Keluar...</span>
                  </>
                ) : (
                  <>
                    <LogOut className="h-3.5 w-3.5 stroke-[2.5]" />
                    <span>Ya, Keluar</span>
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