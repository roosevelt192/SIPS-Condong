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
  PanelLeftClose,
  Moon,
  Sun,
  User,
  Settings,
  LogOut,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  Building2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface SpekterSidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export default function SpekterSidebar({
  isCollapsed,
  setIsCollapsed,
}: SpekterSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [searchFilter, setSearchFilter] = useState("");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [activeGateCount, setActiveGateCount] = useState(0);

  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setIsDarkMode(isDark);
  }, []);

  const toggleTheme = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setIsDarkMode(true);
    }
  };

  useEffect(() => {
    async function fetchBadge() {
      try {
        const { count } = await supabase
          .from("permissions")
          .select("*", { count: "exact", head: true })
          .eq("status", "out_pondok");
        setActiveGateCount(count || 0);
      } catch {
        // fallback silent
      }
    }
    fetchBadge();
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const menuSections = [
    {
      title: "Overview",
      items: [
        {
          name: "Dashboard Live",
          href: "/dashboard",
          icon: LayoutDashboard,
          badge: "Live",
          badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        },
      ],
    },
    {
      title: "Kesiswaan & Identitas",
      items: [
        {
          name: "Master Santri",
          href: "/dashboard/students",
          icon: Users,
        },
        {
          name: "Cetak KTS Santri",
          href: "/dashboard/id-cards",
          icon: IdCard,
          badge: "KTS",
          badgeColor: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
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
          badgeColor: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-bold",
        },
        {
          name: "Pelanggaran & Poin",
          href: "/dashboard/violations",
          icon: ShieldAlert,
        },
        {
          name: "Prestasi Santri",
          href: "/dashboard/achievements",
          icon: Trophy,
        },
      ],
    },
    {
      title: "Laporan & Dokumen",
      items: [
        {
          name: "Pusat Laporan",
          href: "/dashboard/reports",
          icon: FileSpreadsheet,
        },
      ],
    },
  ];

  return (
    <aside
      className={`fixed top-0 left-0 z-40 h-screen bg-white/95 dark:bg-slate-900/95 border-r border-slate-200/80 dark:border-slate-800/80 backdrop-blur-xl transition-all duration-300 flex flex-col justify-between ${
        isCollapsed ? "w-[72px]" : "w-[260px]"
      }`}
    >
      {/* HEADER LOGO & TOGGLE BUTTON */}
      <div className="relative p-4 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
        <Link
          href="/dashboard"
          className={`flex items-center space-x-3 overflow-hidden ${
            isCollapsed ? "justify-center w-full" : ""
          }`}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 text-white shadow-md shadow-indigo-500/25">
            <ShieldCheck className="h-5 w-5" />
          </div>

          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-1.5">
                <span className="font-black text-sm tracking-tight text-slate-900 dark:text-white">
                  SIPS
                </span>
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.2 rounded border border-indigo-500/20">
                  v2.6
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium truncate">
                Pesantren Condong
              </p>
            </div>
          )}
        </Link>

        {/* Floating Toggle Button */}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`absolute -right-3.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-500/50 shadow-md flex items-center justify-center transition-transform active:scale-90 z-50 cursor-pointer ${
            isCollapsed ? "rotate-180" : ""
          }`}
          title={isCollapsed ? "Buka Sidebar" : "Ciutkan Sidebar"}
        >
          <PanelLeftClose className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* MENU NAVIGATION */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 custom-scrollbar">
        {!isCollapsed ? (
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Quick search..."
              className="h-9 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 pl-8 pr-3 text-xs font-semibold text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
            />
          </div>
        ) : (
          <div className="flex justify-center pb-1">
            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Cari Cepat"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
        )}

        {menuSections.map((section, secIdx) => {
          const filteredItems = section.items.filter((item) =>
            item.name.toLowerCase().includes(searchFilter.toLowerCase())
          );

          if (filteredItems.length === 0) return null;

          return (
            <div key={secIdx} className="space-y-1">
              {!isCollapsed && (
                <p className="px-2.5 text-[10px] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">
                  {section.title}
                </p>
              )}

              <div className="space-y-0.5">
                {filteredItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`group relative flex items-center rounded-xl px-2.5 py-2 text-xs font-semibold transition-all duration-200 ${
                        isCollapsed ? "justify-center" : "justify-between"
                      } ${
                        isActive
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-bold shadow-sm shadow-slate-900/10"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white"
                      }`}
                      title={isCollapsed ? item.name : undefined}
                    >
                      <div className="flex items-center space-x-2.5 truncate">
                        <Icon
                          className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-110 ${
                            isActive
                              ? "text-indigo-400 dark:text-indigo-600 stroke-[2.4]"
                              : "text-slate-500 dark:text-slate-400 stroke-[1.8]"
                          }`}
                        />
                        {!isCollapsed && (
                          <span className="truncate">{item.name}</span>
                        )}
                      </div>

                      {!isCollapsed && item.badge && (
                        <span
                          className={`text-[9.5px] px-1.5 py-0.2 rounded-md border font-bold ${
                            isActive
                              ? "bg-white/20 dark:bg-slate-950/20 text-white dark:text-slate-950 border-transparent"
                              : item.badgeColor ||
                                "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Feature / Scanner Card */}
        {!isCollapsed ? (
          <div className="mt-4 rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-50/80 via-indigo-50/40 to-cyan-50/50 dark:from-indigo-950/40 dark:via-slate-900 dark:to-slate-900 p-3.5 text-xs space-y-2.5 shadow-xs">
            <div className="flex items-center space-x-2 text-indigo-700 dark:text-indigo-300 font-bold">
              <div className="h-6 w-6 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <span className="text-[11px]">Gate Scanner Terpadu</span>
            </div>
            <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Verifikasi keluar masuk santri realtime via barcode KTS.
            </p>
            <Link
              href="/dashboard/security-gate"
              className="flex items-center justify-center space-x-1.5 w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] shadow-sm shadow-indigo-600/20 transition active:scale-95"
            >
              <QrCode className="h-3.5 w-3.5" />
              <span>Buka Gate Control</span>
            </Link>
          </div>
        ) : (
          <div className="flex justify-center pt-2">
            <Link
              href="/dashboard/security-gate"
              className="h-10 w-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30 hover:scale-105 transition active:scale-90"
              title="Gate Scanner"
            >
              <QrCode className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>

      {/* FOOTER & PROFILE POPUP */}
      <div
        className="relative p-3 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/40"
        ref={profileMenuRef}
      >
        <div
          onClick={() => setShowProfileMenu(!showProfileMenu)}
          className={`flex items-center rounded-2xl p-2 transition cursor-pointer hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 select-none ${
            isCollapsed ? "justify-center" : "justify-between"
          }`}
        >
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="relative h-9 w-9 shrink-0 rounded-xl overflow-hidden bg-gradient-to-tr from-indigo-600 to-cyan-500 border border-white dark:border-slate-700 flex items-center justify-center text-white font-black text-xs shadow-xs">
              <User className="h-5 w-5" />
              <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
            </div>

            {!isCollapsed && (
              <div className="min-w-0 flex-1 text-left">
                <p className="font-bold text-xs text-slate-900 dark:text-white truncate">
                  Admin Pengasuhan
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  admin@condong.id
                </p>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <ChevronRight
              className={`h-4 w-4 text-slate-400 transition-transform ${
                showProfileMenu ? "-rotate-90 text-indigo-500" : ""
              }`}
            />
          )}
        </div>

        {showProfileMenu && (
          <div
            className={`absolute bottom-full mb-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-3 shadow-2xl z-50 text-xs space-y-2 animate-in fade-in zoom-in-95 duration-150 ${
              isCollapsed ? "left-3 w-64" : "left-3 right-3"
            }`}
          >
            <div className="flex items-center space-x-3 p-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900 dark:text-white text-xs truncate">
                  Biro Pengasuhan Santri
                </p>
                <p className="text-[10px] text-slate-400 font-mono truncate">
                  Role: Super Admin
                </p>
              </div>
            </div>

            <div className="space-y-0.5 font-semibold text-slate-700 dark:text-slate-300">
              <button
                type="button"
                onClick={toggleTheme}
                className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <div className="flex items-center space-x-2">
                  {isDarkMode ? (
                    <Sun className="h-4 w-4 text-amber-500" />
                  ) : (
                    <Moon className="h-4 w-4 text-indigo-500" />
                  )}
                  <span>Mode Gelap / Terang</span>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                  {isDarkMode ? "Dark" : "Light"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(false);
                  router.push("/dashboard/reports");
                }}
                className="w-full flex items-center space-x-2 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <Settings className="h-4 w-4 text-slate-400" />
                <span>Pengaturan Sistem</span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center space-x-2 p-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition pt-2 border-t border-slate-100 dark:border-slate-800"
              >
                <LogOut className="h-4 w-4" />
                <span>Keluar Akun (Sign Out)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}