"use client";

// =============================================================================
// 1. IMPORT DEPENDENCIES & ICONS
// =============================================================================
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  IdCard,
  Printer,
  FileDown,
  ArrowLeft,
  Search,
  CheckSquare,
  Square,
  Building2,
  ShieldCheck,
  CheckCircle2,
  Sliders,
  Settings2,
  RotateCcw,
  Tag,
  Grid,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { QRCodeSVG } from "qrcode.react";
import { generateStandardQRPayload } from "@/lib/qrParser";

// =============================================================================
// 2. INTERFACE DATA SANTRI
// =============================================================================
interface StudentItem {
  id: string;
  nis: string;
  name: string;
  class: string;
  dorm: string;
  consulate: string;
  photo_url?: string | null;
  status: string;
  entry_year: string;
}

export default function IdCardsGeneratorPage() {
  // ===========================================================================
  // 3. STATE MANAGEMENT
  // ===========================================================================
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [filterDorm, setFilterDorm] = useState("all");

  // Mode Cetak: KTS Fisik CR-80 vs Stiker Label 103 vs Stiker Grid A4
  const [printMode, setPrintMode] = useState<"card" | "label103" | "stickerA4">("card");

  // Selection & UI States
  const [selectedNisList, setSelectedNisList] = useState<string[]>([]);
  const [cardSide, setCardSide] = useState<"both" | "front" | "back">("both");
  const [showSettings, setShowSettings] = useState(false);

  // Dimensi Cetak Kustom
  const [paperSize, setPaperSize] = useState<"A4" | "F4" | "Letter" | "PVC_Single">("A4");
  const [cardPreset, setCardPreset] = useState<"CR80" | "Medium" | "Mini" | "Custom">("CR80");
  const [cardWidthMm, setCardWidthMm] = useState(85.6);
  const [cardHeightMm, setCardHeightMm] = useState(54.0);
  const [gridGapMm, setGridGapMm] = useState(4);
  const [pageMarginMm, setPageMarginMm] = useState(6);

  // ===========================================================================
  // 4. FETCH DATA DARI SUPABASE
  // ===========================================================================
  useEffect(() => {
    fetchStudents();
  }, []);

  async function fetchStudents() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .range(0, 4999);

      if (error) throw error;

      const formatted: StudentItem[] = (data || []).map((st: any) => ({
        id: st.id,
        nis: st.nis || "-",
        name: st.full_name || st.name || st.nama || "Santri",
        class: st.kelas || st.class_name || st.class || "-",
        dorm: st.kamar_asrama || st.dorm || st.room || st.asrama || st.room_name || "-",
        consulate: st.asal_konsulat || st.consulate || st.origin_region || "-",
        photo_url: st.photo_url || st.foto || null,
        status: st.status_santri || st.status || "Aktif Mukim",
        entry_year: st.tahun_masuk || st.entry_year || "2026",
      }));

      formatted.sort((a, b) => a.name.localeCompare(b.name));
      setStudents(formatted);
      setSelectedNisList([]);
    } catch (err: any) {
      console.error("Gagal memuat data santri:", err.message);
    } finally {
      setLoading(false);
    }
  }

  // ===========================================================================
  // 5. FILTERING & SELECTION LOGIC
  // ===========================================================================
  const handlePresetChange = (preset: "CR80" | "Medium" | "Mini" | "Custom") => {
    setCardPreset(preset);
    if (preset === "CR80") {
      setCardWidthMm(85.6);
      setCardHeightMm(54.0);
    } else if (preset === "Medium") {
      setCardWidthMm(90.0);
      setCardHeightMm(60.0);
    } else if (preset === "Mini") {
      setCardWidthMm(75.0);
      setCardHeightMm(48.0);
    }
  };

  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.class && s.class !== "-") set.add(s.class);
    });
    return Array.from(set).sort();
  }, [students]);

  const availableDorms = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.dorm && s.dorm !== "-") set.add(s.dorm);
    });
    return Array.from(set).sort();
  }, [students]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === "" ||
        s.name.toLowerCase().includes(q) ||
        s.nis.toLowerCase().includes(q) ||
        s.consulate.toLowerCase().includes(q) ||
        s.dorm.toLowerCase().includes(q);

      const matchesClass = filterClass === "all" || s.class === filterClass;
      const matchesDorm = filterDorm === "all" || s.dorm === filterDorm;

      return matchesSearch && matchesClass && matchesDorm;
    });
  }, [students, searchQuery, filterClass, filterDorm]);

  const isAllFilteredSelected = useMemo(() => {
    if (filteredStudents.length === 0) return false;
    return filteredStudents.every((s) => selectedNisList.includes(s.nis));
  }, [filteredStudents, selectedNisList]);

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      const filteredNisSet = new Set(filteredStudents.map((s) => s.nis));
      setSelectedNisList((prev) => prev.filter((nis) => !filteredNisSet.has(nis)));
    } else {
      const newNisSet = new Set([...selectedNisList, ...filteredStudents.map((s) => s.nis)]);
      setSelectedNisList(Array.from(newNisSet));
    }
  };

  const handleToggleStudent = (nis: string) => {
    setSelectedNisList((prev) =>
      prev.includes(nis) ? prev.filter((item) => item !== nis) : [...prev, nis]
    );
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setFilterClass("all");
    setFilterDorm("all");
  };

  const selectedStudentsToPrint = useMemo(() => {
    return students.filter((s) => selectedNisList.includes(s.nis));
  }, [students, selectedNisList]);

  const getDynamicNameFontSize = (name: string) => {
    const len = name.trim().length;
    if (len > 30) return "text-[9.5px] leading-[11px]";
    if (len > 22) return "text-[10.5px] leading-[12px]";
    return "text-[12px] leading-[13.5px]";
  };

  const getPageSizeCSS = () => {
    if (printMode === "label103") {
      return "size: 162mm 215mm portrait;";
    }
    if (paperSize === "F4") return "size: 215mm 330mm portrait;";
    if (paperSize === "Letter") return "size: letter portrait;";
    if (paperSize === "PVC_Single") return `size: ${cardWidthMm}mm ${cardHeightMm}mm portrait;`;
    return "size: A4 portrait;";
  };

  const printPages = useMemo(() => {
    if (printMode === "label103") {
      const perPage = 12;
      const pages: StudentItem[][] = [];
      for (let i = 0; i < selectedStudentsToPrint.length; i += perPage) {
        pages.push(selectedStudentsToPrint.slice(i, i + perPage));
      }
      return pages;
    }

    if (printMode === "stickerA4") {
      const perPage = 24;
      const pages: StudentItem[][] = [];
      for (let i = 0; i < selectedStudentsToPrint.length; i += perPage) {
        pages.push(selectedStudentsToPrint.slice(i, i + perPage));
      }
      return pages;
    }

    const cards: { type: "front" | "back"; student: StudentItem }[] = [];
    selectedStudentsToPrint.forEach((student) => {
      if (cardSide === "both") {
        cards.push({ type: "front", student });
        cards.push({ type: "back", student });
      } else if (cardSide === "front") {
        cards.push({ type: "front", student });
      } else if (cardSide === "back") {
        cards.push({ type: "back", student });
      }
    });

    const CARDS_PER_PAGE = paperSize === "PVC_Single" ? 1 : 8;
    const pages: any[] = [];
    for (let i = 0; i < cards.length; i += CARDS_PER_PAGE) {
      pages.push(cards.slice(i, i + CARDS_PER_PAGE));
    }
    return pages;
  }, [selectedStudentsToPrint, printMode, cardSide, paperSize]);

  // ===========================================================================
  // 6. ISOLATED MULTI-PAGE PRINT ENGINE
  // ===========================================================================
  const executeIsolatedPrint = (customTitle?: string) => {
    const printArea = document.getElementById("print-area-kts");
    if (!printArea) return;

    const existingIframe = document.getElementById("sips-isolated-iframe");
    if (existingIframe) existingIframe.remove();

    const iframe = document.createElement("iframe");
    iframe.id = "sips-isolated-iframe";
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    const prefix = printMode === "label103" ? "Stiker_Label103" : printMode === "stickerA4" ? "Stiker_GridA4" : "KTS_Condong";
    const titleText =
      customTitle ||
      `${prefix}_${new Date().toISOString().split("T")[0]}_(${selectedStudentsToPrint.length}_Santri)`;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${titleText}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800;900&display=swap" rel="stylesheet">
          <style>
            @page {
              ${getPageSizeCSS()}
              margin: ${printMode === "label103" ? "6mm 8mm" : `${pageMarginMm}mm`};
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              font-family: 'Plus Jakarta Sans', sans-serif;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              background: #ffffff;
              color: #000000;
              width: 100%;
            }

            .kts-print-page {
              display: grid !important;
              grid-template-columns: repeat(2, ${cardWidthMm}mm) !important;
              grid-auto-rows: ${cardHeightMm}mm !important;
              gap: ${gridGapMm}mm !important;
              justify-content: center !important;
              align-content: start !important;
              margin: 0 auto !important;
              padding: 0 !important;
              width: 100% !important;
              page-break-after: always !important;
              break-after: page !important;
            }
            .kts-print-page:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
            .print-card-item {
              width: ${cardWidthMm}mm !important;
              height: ${cardHeightMm}mm !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              margin: 0 !important;
              padding: 0 !important;
              display: block !important;
            }
            .kts-card {
              width: ${cardWidthMm}mm !important;
              height: ${cardHeightMm}mm !important;
              border: 1px solid #1e293b !important;
              border-radius: 3.5mm !important;
              overflow: hidden !important;
              background: #ffffff !important;
            }
            .kts-header-solid {
              background-color: #064e3b !important;
              box-shadow: inset 0 0 0 1000px #064e3b !important;
              color: #ffffff !important;
            }
            .kts-gold-solid {
              background-color: #d97706 !important;
              box-shadow: inset 0 0 0 1000px #d97706 !important;
            }
            .kts-badge-nis-solid {
              background-color: #064e3b !important;
              box-shadow: inset 0 0 0 1000px #064e3b !important;
              color: #fef08a !important;
            }

            .sticker-103-page {
              display: grid !important;
              grid-template-columns: repeat(3, 64mm) !important;
              grid-auto-rows: 32mm !important;
              column-gap: 2.5mm !important;
              row-gap: 3mm !important;
              justify-content: center !important;
              align-content: start !important;
              margin: 0 auto !important;
              page-break-after: always !important;
              break-after: page !important;
            }
            .sticker-103-page:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
            .sticker-103-item {
              width: 64mm !important;
              height: 32mm !important;
              border: 1px dashed #cbd5e1 !important;
              border-radius: 2mm !important;
              padding: 2.5mm 3.5mm !important;
              display: flex !important;
              align-items: center !important;
              gap: 3mm !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              overflow: hidden !important;
              background: #ffffff !important;
            }

            .sticker-a4-page {
              display: grid !important;
              grid-template-columns: repeat(3, 63mm) !important;
              grid-auto-rows: 33mm !important;
              gap: 2mm !important;
              justify-content: center !important;
              align-content: start !important;
              margin: 0 auto !important;
              page-break-after: always !important;
              break-after: page !important;
            }
            .sticker-a4-page:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
            .sticker-a4-item {
              width: 63mm !important;
              height: 33mm !important;
              border: 1px dashed #94a3b8 !important;
              border-radius: 2.5mm !important;
              padding: 2.5mm 3mm !important;
              display: flex !important;
              align-items: center !important;
              gap: 3mm !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              overflow: hidden !important;
              background: #ffffff !important;
            }
          </style>
        </head>
        <body>
          ${printArea.innerHTML}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 500);
  };

  return (
    <div className="w-full space-y-6 font-sans relative pb-28 transition-all">
      {/* ================= HEADER HERO BANNER (SUPER COLORFUL & INTERAKTIF) ================= */}
      <div className="relative overflow-hidden rounded-[36px] bg-gradient-to-r from-emerald-950 via-[#064e3b] to-teal-950 p-6 sm:p-8 text-white shadow-2xl border border-emerald-500/40">
        <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-emerald-400/20 blur-[80px] pointer-events-none animate-pulse" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-amber-400/20 blur-[80px] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-black/30 pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-start sm:items-center space-x-4 min-w-0">
            <Link
              href="/dashboard"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-all active:scale-90 shadow-sm backdrop-blur-md"
              title="Kembali ke Dashboard"
            >
              <ArrowLeft className="h-5 w-5 stroke-[2.4]" />
            </Link>

            <div className="relative flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 via-emerald-500 to-teal-400 text-slate-950 shadow-lg font-black">
              <IdCard className="h-6 w-6 stroke-[2.2]" />
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-emerald-200 text-[10px] font-black uppercase tracking-wider backdrop-blur-xl">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  ID CARD &amp; STICKER QR
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-emerald-100 to-amber-300 bg-clip-text text-transparent truncate">
                Generator Cetak KTS &amp; Stiker QR
              </h1>
              <p className="text-xs text-emerald-100/90 font-medium truncate">
                Cetak Kartu Tanda Santri fisik atau Stiker Label Undangan QR Code
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 shrink-0 self-stretch sm:self-end lg:self-auto min-w-[360px]">
            {/* Switcher Mode: Kartu vs Label 103 vs Stiker A4 */}
            <div className="flex items-center bg-black/40 p-1.5 rounded-2xl border border-emerald-400/30 text-xs font-bold shadow-inner justify-between gap-1 backdrop-blur-xl">
              <button
                type="button"
                onClick={() => setPrintMode("card")}
                className={`flex-1 text-center py-2 px-2.5 rounded-xl transition cursor-pointer text-xs flex items-center justify-center space-x-1.5 ${
                  printMode === "card"
                    ? "bg-gradient-to-r from-emerald-400 to-teal-300 text-slate-950 shadow-md font-black"
                    : "text-emerald-100/70 hover:text-white hover:bg-white/10"
                }`}
              >
                <IdCard className="w-3.5 h-3.5" />
                <span>Kartu KTS</span>
              </button>

              <button
                type="button"
                onClick={() => setPrintMode("label103")}
                className={`flex-1 text-center py-2 px-2.5 rounded-xl transition cursor-pointer text-xs flex items-center justify-center space-x-1.5 ${
                  printMode === "label103"
                    ? "bg-gradient-to-r from-emerald-400 to-teal-300 text-slate-950 shadow-md font-black"
                    : "text-emerald-100/70 hover:text-white hover:bg-white/10"
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Stiker Label 103</span>
              </button>

              <button
                type="button"
                onClick={() => setPrintMode("stickerA4")}
                className={`flex-1 text-center py-2 px-2.5 rounded-xl transition cursor-pointer text-xs flex items-center justify-center space-x-1.5 ${
                  printMode === "stickerA4"
                    ? "bg-gradient-to-r from-emerald-400 to-teal-300 text-slate-950 shadow-md font-black"
                    : "text-emerald-100/70 hover:text-white hover:bg-white/10"
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>Stiker Grid A4 (24)</span>
              </button>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              {/* Opsi Sisi Kartu (Khusus Mode Kartu) */}
              {printMode === "card" && (
                <div className="flex items-center bg-black/40 p-1.5 rounded-2xl border border-emerald-400/30 text-xs font-bold shadow-inner flex-1 justify-between backdrop-blur-xl">
                  <button
                    type="button"
                    onClick={() => setCardSide("both")}
                    className={`flex-1 text-center py-1.5 px-2 rounded-xl transition cursor-pointer text-[11px] ${
                      cardSide === "both"
                        ? "bg-white text-slate-950 shadow-sm font-black"
                        : "text-emerald-100/70 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    Bolak-Balik
                  </button>
                  <button
                    type="button"
                    onClick={() => setCardSide("front")}
                    className={`flex-1 text-center py-1.5 px-2 rounded-xl transition cursor-pointer text-[11px] ${
                      cardSide === "front"
                        ? "bg-white text-slate-950 shadow-sm font-black"
                        : "text-emerald-100/70 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    Depan
                  </button>
                  <button
                    type="button"
                    onClick={() => setCardSide("back")}
                    className={`flex-1 text-center py-1.5 px-2 rounded-xl transition cursor-pointer text-[11px] ${
                      cardSide === "back"
                        ? "bg-white text-slate-950 shadow-sm font-black"
                        : "text-emerald-100/70 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    Belakang
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => executeIsolatedPrint()}
                disabled={selectedStudentsToPrint.length === 0}
                className="inline-flex items-center justify-center space-x-1.5 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 px-4 py-2.5 text-xs font-black text-slate-950 shadow-lg shadow-emerald-900/30 hover:scale-[1.02] active:scale-95 transition cursor-pointer disabled:opacity-40 flex-1"
                title="Cetak Langsung ke Printer"
              >
                <Printer className="h-4 w-4 stroke-[2.5]" />
                <span className="whitespace-nowrap">Cetak ({selectedStudentsToPrint.length})</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  executeIsolatedPrint(
                    `${printMode === "label103" ? "Stiker_103" : printMode === "stickerA4" ? "Stiker_A4" : "KTS"}_${new Date().toISOString().split("T")[0]}_(${selectedStudentsToPrint.length}_Santri)`
                  )
                }
                disabled={selectedStudentsToPrint.length === 0}
                className="inline-flex items-center justify-center space-x-1.5 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-400 hover:from-cyan-300 hover:to-blue-300 px-4 py-2.5 text-xs font-black text-slate-950 shadow-lg shadow-cyan-900/30 hover:scale-[1.02] active:scale-95 transition cursor-pointer disabled:opacity-40"
                title="Simpan Lengkap ke File PDF"
              >
                <FileDown className="h-4 w-4 stroke-[2.5]" />
                <span className="whitespace-nowrap">PDF</span>
              </button>
            </div>

            {printMode === "card" && (
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                className={`w-full inline-flex items-center justify-center space-x-2 rounded-2xl py-2 px-4 text-xs font-bold border transition cursor-pointer active:scale-98 shadow-xs ${
                  showSettings
                    ? "bg-emerald-700 text-white border-emerald-700 shadow-emerald-700/20"
                    : "bg-white/10 hover:bg-white/20 text-emerald-200 border-white/20 backdrop-blur-md"
                }`}
              >
                <Settings2 className="h-3.5 w-3.5 text-amber-300" />
                <span>
                  Pengaturan Kartu ({paperSize} • {cardWidthMm}×{cardHeightMm}mm)
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ================= PANEL PENGATURAN DIMENSI KARTU ================= */}
      {showSettings && printMode === "card" && (
        <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 p-6 shadow-xl backdrop-blur-xl animate-in fade-in slide-in-from-top-3 duration-200 print:hidden space-y-4">
          <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
            <div className="flex items-center space-x-2 text-emerald-800 dark:text-emerald-300 font-black text-sm">
              <Sliders className="h-4 w-4" />
              <span>Pengaturan Dimensi Cetak KTS</span>
            </div>
            <span className="text-[11px] text-slate-500">
              Menyesuaikan tata letak cetak secara instan
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Ukuran Kertas Cetak
              </label>
              <select
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value as any)}
                className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 font-semibold text-slate-900 dark:text-white outline-none cursor-pointer focus:border-emerald-500"
              >
                <option value="A4">A4 (210 × 297 mm)</option>
                <option value="F4">F4 / Folio (215 × 330 mm)</option>
                <option value="Letter">Letter (216 × 279 mm)</option>
                <option value="PVC_Single">Printer Kartu PVC Tray Satuan</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Preset Dimensi Kartu
              </label>
              <select
                value={cardPreset}
                onChange={(e) => handlePresetChange(e.target.value as any)}
                className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 font-semibold text-slate-900 dark:text-white outline-none cursor-pointer focus:border-emerald-500"
              >
                <option value="CR80">Standar CR-80 KTP (85.6 × 54.0 mm)</option>
                <option value="Medium">Medium Badge (90.0 × 60.0 mm)</option>
                <option value="Mini">Mini Card (75.0 × 48.0 mm)</option>
                <option value="Custom">Custom Ukuran Manual</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Lebar: <strong className="text-emerald-700 dark:text-emerald-400">{cardWidthMm} mm</strong>
              </label>
              <input
                type="number"
                step="0.1"
                min="50"
                max="120"
                value={cardWidthMm}
                onChange={(e) => {
                  setCardWidthMm(parseFloat(e.target.value) || 85.6);
                  setCardPreset("Custom");
                }}
                className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Tinggi: <strong className="text-emerald-700 dark:text-emerald-400">{cardHeightMm} mm</strong>
              </label>
              <input
                type="number"
                step="0.1"
                min="30"
                max="90"
                value={cardHeightMm}
                onChange={(e) => {
                  setCardHeightMm(parseFloat(e.target.value) || 54.0);
                  setCardPreset("Custom");
                }}
                className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* ================= DAFTAR PEMILIH SANTRI & FILTER ================= */}
      <div className="rounded-3xl border border-slate-200/80 dark:border-emerald-900/40 bg-white/90 dark:bg-[#0c1815] p-5 sm:p-6 shadow-xl backdrop-blur-xl space-y-4 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 text-xs items-center">
          <div className="relative sm:col-span-2 md:col-span-5">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama santri, NIS, asrama, atau konsulat..."
              className="h-10 w-full rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 pl-10 pr-3 text-xs font-semibold outline-none focus:border-emerald-500 transition shadow-xs"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="h-10 w-full rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 px-3 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="all" className="dark:bg-slate-900">Semua Kelas ({availableClasses.length})</option>
              {availableClasses.map((cls) => (
                <option key={cls} value={cls} className="dark:bg-slate-900">
                  Kelas: {cls}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={filterDorm}
              onChange={(e) => setFilterDorm(e.target.value)}
              className="h-10 w-full rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 px-3 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="all" className="dark:bg-slate-900">Semua Asrama ({availableDorms.length})</option>
              {availableDorms.map((dorm) => (
                <option key={dorm} value={dorm} className="dark:bg-slate-900">
                  {dorm}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-1">
            <button
              type="button"
              onClick={handleResetFilters}
              className="w-full h-10 flex items-center justify-center rounded-2xl border border-slate-200 dark:border-emerald-900/60 bg-slate-100 hover:bg-slate-200 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-slate-600 dark:text-slate-300 transition cursor-pointer"
              title="Batal / Reset Filter"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Counter Info Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 text-xs">
          <div className="flex items-center space-x-2 font-bold text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>
              {selectedStudentsToPrint.length} Santri Terpilih ({printMode === "label103" ? "Format Stiker Tom & Jerry 103" : printMode === "stickerA4" ? "Format Grid Stiker A4" : "Format Kartu Fisik KTS"})
            </span>
          </div>

          <div className="flex items-center space-x-3 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="bg-white dark:bg-emerald-950/50 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-emerald-900/40 font-semibold">
              Total: <strong>{students.length} Santri</strong>
            </span>
            <span className="bg-white dark:bg-emerald-950/50 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-emerald-900/40 font-semibold">
              Halaman Dokumen: <strong>{printPages.length} Lembar ({printMode === "label103" ? "Label 103" : paperSize})</strong>
            </span>
          </div>
        </div>

        {/* Box Checklist Pemilih Santri */}
        <div className="border border-slate-200 dark:border-emerald-900/40 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between p-3 bg-slate-100 dark:bg-emerald-950/50 border-b border-slate-200 dark:border-emerald-900/40 text-xs font-bold">
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="inline-flex items-center space-x-2 text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition cursor-pointer"
            >
              {isAllFilteredSelected ? (
                <CheckSquare className="h-4 w-4 text-emerald-600" />
              ) : (
                <Square className="h-4 w-4 text-slate-400" />
              )}
              <span>{isAllFilteredSelected ? "Batalkan Pilihan Filter" : `Pilih Semua (${filteredStudents.length} Santri)`}</span>
            </button>

            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Menampilkan {filteredStudents.length} dari {students.length} Santri
            </span>
          </div>

          <div className="max-h-96 overflow-y-auto p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 custom-scrollbar">
            {loading ? (
              <div className="col-span-full py-8 text-center text-xs text-slate-400 animate-pulse">
                Memuat data santri...
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="col-span-full py-8 text-center text-xs text-slate-400">
                Tidak ada santri yang cocok dengan filter pencarian.
              </div>
            ) : (
              filteredStudents.map((st) => {
                const isSelected = selectedNisList.includes(st.nis);
                return (
                  <div
                    key={st.nis}
                    onClick={() => handleToggleStudent(st.nis)}
                    className={`flex items-center space-x-3 p-3 rounded-2xl border transition-all duration-200 cursor-pointer select-none group ${
                      isSelected
                        ? "bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-500/50 shadow-md shadow-emerald-500/5 scale-[1.01]"
                        : "bg-white dark:bg-[#071310] border-slate-200/80 dark:border-emerald-900/30 text-slate-600 dark:text-slate-400 hover:border-emerald-300 hover:shadow-sm"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="rounded text-emerald-600 pointer-events-none"
                    />

                    <div className="relative h-10 w-9 shrink-0 rounded-xl overflow-hidden bg-slate-200 dark:bg-emerald-900/40 border border-slate-300 dark:border-emerald-800 shadow-xs group-hover:scale-105 transition-transform flex items-center justify-center">
                      {st.photo_url ? (
                        <img
                          src={st.photo_url}
                          alt={st.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-black text-slate-600 dark:text-slate-300">
                          {st.name.charAt(0)}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 text-xs">
                      <p className="font-bold truncate text-slate-900 dark:text-slate-100 uppercase">
                        {st.name}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        NIS: {st.nis} • {st.class}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* =====================================================================
          PRINT TEMPLATE SOURCE (MULTI-PAGE CHUNKS SOURCE)
          ===================================================================== */}
      <div id="print-area-kts" style={{ display: "none" }}>
        {/* ================= MODE 1: KARTU FISIK KTS ================= */}
        {printMode === "card" &&
          printPages.map((pageCards: any[], pageIndex: number) => (
            <div key={`print-card-page-${pageIndex}`} className="kts-print-page">
              {pageCards.map(({ type, student }: any, cardIndex: number) => {
                if (type === "front") {
                  return (
                    <div key={`front-${student.nis}-${cardIndex}`} className="print-card-item">
                      <div
                        style={{
                          width: `${cardWidthMm}mm`,
                          height: `${cardHeightMm}mm`,
                          boxSizing: "border-box",
                          backgroundColor: "#ffffff",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                        }}
                        className="kts-card relative"
                      >
                        {/* Header Kop Depan */}
                        <div>
                          <div
                            style={{
                              backgroundColor: "#064e3b",
                              height: "38px",
                              width: "100%",
                              padding: "0 12px",
                              boxSizing: "border-box",
                              display: "flex",
                              alignItems: "center",
                              gap: "9px",
                            }}
                            className="kts-header-solid"
                          >
                            <img
                              src="/logo Condong.png"
                              alt="Logo Condong"
                              style={{
                                width: "24px",
                                height: "24px",
                                objectFit: "contain",
                                display: "block",
                                flexShrink: 0,
                              }}
                            />

                            <div style={{ textAlign: "left", lineHeight: "1.15", flex: 1, minWidth: 0 }}>
                              <span
                                style={{
                                  color: "#ffffff",
                                  fontSize: "9px",
                                  fontWeight: "900",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.8px",
                                  display: "block",
                                }}
                              >
                                KARTU TANDA SANTRI
                              </span>
                              <span
                                style={{
                                  color: "#fef08a",
                                  fontSize: "6.5px",
                                  fontWeight: "700",
                                  display: "block",
                                  marginTop: "1px",
                                }}
                              >
                                Pondok Pesantren Riyadlul &apos;Ulum Wadda&apos;wah Condong
                              </span>
                            </div>
                          </div>

                          <div
                            style={{
                              backgroundColor: "#d97706",
                              height: "2.5px",
                              width: "100%",
                            }}
                            className="kts-gold-solid"
                          />
                        </div>

                        {/* Body Depan */}
                        <div
                          style={{
                            padding: "4px 10px 2px",
                            margin: "auto 0",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "8px",
                            width: "100%",
                            boxSizing: "border-box",
                          }}
                        >
                          <div style={{ width: "66px", flexShrink: 0, textAlign: "center" }}>
                            <div
                              style={{
                                width: "64px",
                                height: "82px",
                                borderRadius: "7px",
                                border: "2px solid #d97706",
                                backgroundColor: "#f8fafc",
                                overflow: "hidden",
                                boxSizing: "border-box",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                margin: "0 auto",
                              }}
                            >
                              {student.photo_url ? (
                                <img
                                  src={student.photo_url}
                                  alt={student.name}
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    display: "block",
                                  }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontWeight: "900",
                                    fontSize: "24px",
                                    color: "#064e3b",
                                    backgroundColor: "#ecfdf5",
                                  }}
                                >
                                  {student.name.charAt(0)}
                                </div>
                              )}
                            </div>

                            <div
                              style={{
                                backgroundColor: "#064e3b",
                                color: "#fef08a",
                                fontSize: "6.5px",
                                fontWeight: "800",
                                fontFamily: "monospace",
                                padding: "1.5px 0",
                                borderRadius: "3px",
                                marginTop: "2.5px",
                                lineHeight: "1",
                              }}
                              className="kts-badge-nis-solid"
                            >
                              NIS: {student.nis}
                            </div>
                          </div>

                          <div
                            style={{
                              flex: 1,
                              minWidth: 0,
                              paddingLeft: "6px",
                              borderLeft: "2px solid #064e3b",
                            }}
                          >
                            <div
                              style={{
                                color: "#0f172a",
                                fontWeight: "900",
                                textTransform: "uppercase",
                                letterSpacing: "0.2px",
                                lineHeight: "1.15",
                                marginBottom: "2px",
                              }}
                              className={getDynamicNameFontSize(student.name)}
                            >
                              {student.name}
                            </div>

                            <div
                              style={{
                                color: "#b45309",
                                fontSize: "6.2px",
                                fontWeight: "800",
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                                marginBottom: "4px",
                              }}
                            >
                              SANTRI MUKIM AKTIF
                            </div>

                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: "3px",
                                marginBottom: "2px",
                              }}
                            >
                              <div
                                style={{
                                  border: "1px solid #cbd5e1",
                                  backgroundColor: "#f8fafc",
                                  padding: "2px 4px",
                                  borderRadius: "4px",
                                  fontSize: "6.8px",
                                }}
                              >
                                <span style={{ color: "#64748b", fontWeight: "700", fontSize: "5px", display: "block", textTransform: "uppercase" }}>
                                  KELAS
                                </span>
                                <strong style={{ color: "#0f172a", fontWeight: "800" }}>{student.class}</strong>
                              </div>

                              <div
                                style={{
                                  border: "1px solid #cbd5e1",
                                  backgroundColor: "#f8fafc",
                                  padding: "2px 4px",
                                  borderRadius: "4px",
                                  fontSize: "6.8px",
                                }}
                              >
                                <span style={{ color: "#64748b", fontWeight: "700", fontSize: "5px", display: "block", textTransform: "uppercase" }}>
                                  KAMAR ASRAMA
                                </span>
                                <strong style={{ color: "#0f172a", fontWeight: "800", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>
                                  {student.dorm}
                                </strong>
                              </div>

                              <div
                                style={{
                                  border: "1px solid #cbd5e1",
                                  backgroundColor: "#f8fafc",
                                  padding: "2px 4px",
                                  borderRadius: "4px",
                                  fontSize: "6.8px",
                                }}
                              >
                                <span style={{ color: "#64748b", fontWeight: "700", fontSize: "5px", display: "block", textTransform: "uppercase" }}>
                                  KONSULAT
                                </span>
                                <strong style={{ color: "#0f172a", fontWeight: "800", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>
                                  {student.consulate}
                                </strong>
                              </div>

                              <div
                                style={{
                                  border: "1px solid #cbd5e1",
                                  backgroundColor: "#f8fafc",
                                  padding: "2px 4px",
                                  borderRadius: "4px",
                                  fontSize: "6.8px",
                                }}
                              >
                                <span style={{ color: "#64748b", fontWeight: "700", fontSize: "5px", display: "block", textTransform: "uppercase" }}>
                                  TAHUN MASUK
                                </span>
                                <strong style={{ color: "#0f172a", fontWeight: "800" }}>
                                  Angkatan {student.entry_year}
                                </strong>
                              </div>
                            </div>
                          </div>

                          <div
                            style={{
                              textAlign: "center",
                              width: "60px",
                              flexShrink: 0,
                            }}
                          >
                            <div
                              style={{
                                padding: "2px",
                                backgroundColor: "#ffffff",
                                border: "1.5px solid #cbd5e1",
                                borderRadius: "6px",
                                display: "inline-block",
                              }}
                            >
                              <QRCodeSVG
                                value={generateStandardQRPayload({ nis: student.nis, id: student.id })}
                                size={56}
                                level="M"
                                includeMargin={false}
                              />
                            </div>
                            <div
                              style={{
                                backgroundColor: "#064e3b",
                                color: "#ffffff",
                                fontSize: "5px",
                                fontWeight: "900",
                                textTransform: "uppercase",
                                padding: "1px 2px",
                                borderRadius: "2px",
                                marginTop: "2px",
                                letterSpacing: "0.4px",
                              }}
                              className="kts-header-solid"
                            >
                              SCAN PROFIL
                            </div>
                          </div>
                        </div>

                        {/* Footer Depan */}
                        <div
                          style={{
                            backgroundColor: "#f1f5f9",
                            borderTop: "1px solid #cbd5e1",
                            padding: "3.5px 12px",
                            fontSize: "6px",
                            boxSizing: "border-box",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <div style={{ color: "#475569", fontWeight: "700", display: "flex", alignItems: "center", gap: "3px" }}>
                            <Building2 style={{ width: "9px", height: "9px", color: "#064e3b" }} />
                            <span>Tasikmalaya, Jawa Barat</span>
                          </div>
                          <span style={{ fontStyle: "italic", fontWeight: "800", color: "#064e3b" }}>
                            *Berlaku Selama Menjadi Santri
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Sisi Belakang
                return (
                  <div key={`back-${student.nis}-${cardIndex}`} className="print-card-item">
                    <div
                      style={{
                        width: `${cardWidthMm}mm`,
                        height: `${cardHeightMm}mm`,
                        boxSizing: "border-box",
                        backgroundColor: "#ffffff",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                      }}
                      className="kts-card relative"
                    >
                      <div>
                        <div
                          style={{
                            backgroundColor: "#064e3b",
                            height: "38px",
                            width: "100%",
                            padding: "0 12px",
                            boxSizing: "border-box",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                          className="kts-header-solid"
                        >
                          <span
                            style={{
                              color: "#fef08a",
                              fontSize: "8.5px",
                              fontWeight: "900",
                              textTransform: "uppercase",
                              letterSpacing: "0.8px",
                            }}
                          >
                            KETENTUAN PEMEGANG KARTU
                          </span>
                          <ShieldCheck style={{ width: "16px", height: "16px", color: "#fef08a" }} />
                        </div>
                        <div
                          style={{
                            backgroundColor: "#d97706",
                            height: "2.5px",
                            width: "100%",
                          }}
                          className="kts-gold-solid"
                        />
                      </div>

                      <div style={{ padding: "4px 12px", margin: "auto 0", fontSize: "7px", lineHeight: "11px", color: "#1e293b" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "5px", marginBottom: "3px" }}>
                          <span style={{ backgroundColor: "#064e3b", color: "#fef08a", fontWeight: "900", fontSize: "6px", borderRadius: "50%", width: "12px", height: "12px", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            1
                          </span>
                          <span style={{ fontWeight: "600" }}>Kartu ini adalah tanda pengenal resmi santri Pondok Pesantren Condong.</span>
                        </div>

                        <div style={{ display: "flex", alignItems: "flex-start", gap: "5px", marginBottom: "3px" }}>
                          <span style={{ backgroundColor: "#064e3b", color: "#fef08a", fontWeight: "900", fontSize: "6px", borderRadius: "50%", width: "12px", height: "12px", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            2
                          </span>
                          <span style={{ fontWeight: "600" }}>Wajib dibawa saat perizinan keluar gerbang, kunjungan wali, dan kegiatan resmi.</span>
                        </div>

                        <div style={{ display: "flex", alignItems: "flex-start", gap: "5px", marginBottom: "3px" }}>
                          <span style={{ backgroundColor: "#064e3b", color: "#fef08a", fontWeight: "900", fontSize: "6px", borderRadius: "50%", width: "12px", height: "12px", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            3
                          </span>
                          <span style={{ fontWeight: "600" }}>QR Code di sisi depan terhubung langsung ke server portal monitoring perizinan santri.</span>
                        </div>

                        <div style={{ display: "flex", alignItems: "flex-start", gap: "5px", marginBottom: "3px" }}>
                          <span style={{ backgroundColor: "#064e3b", color: "#fef08a", fontWeight: "900", fontSize: "6px", borderRadius: "50%", width: "12px", height: "12px", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            4
                          </span>
                          <span style={{ fontWeight: "600" }}>Dilarang keras memindahtangankan, meminjamkan, atau memalsukan kartu ini.</span>
                        </div>

                        <div style={{ display: "flex", alignItems: "flex-start", gap: "5px" }}>
                          <span style={{ backgroundColor: "#064e3b", color: "#fef08a", fontWeight: "900", fontSize: "6px", borderRadius: "50%", width: "12px", height: "12px", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            5
                          </span>
                          <span style={{ fontWeight: "600" }}>Bila menemukan kartu ini, harap segera menghubungi Bagian Pengasuhan Santri.</span>
                        </div>
                      </div>

                      <div
                        style={{
                          backgroundColor: "#f1f5f9",
                          borderTop: "1px solid #cbd5e1",
                          padding: "4px 12px",
                          fontSize: "6px",
                          boxSizing: "border-box",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          minHeight: "28px",
                        }}
                      >
                        <div style={{ lineHeight: "1.2", textAlign: "left" }}>
                          <div style={{ fontWeight: "700", fontSize: "6.5px", color: "#0f172a" }}>
                            Pondok Pesantren
                          </div>
                          <div style={{ fontWeight: "900", color: "#064e3b", fontSize: "7px" }}>
                            Riyadlul Wadda&apos;wah Condong
                          </div>
                          <div style={{ color: "#64748b", fontSize: "5px" }}>
                            Cibeureum - Setianegara - Kota Tasikmalaya
                          </div>
                        </div>

                        <div style={{ textAlign: "right", lineHeight: "1.2" }}>
                          <div style={{ fontWeight: "900", color: "#0f172a", textTransform: "uppercase", fontSize: "7px" }}>
                            Bagian Pengasuhan Santri
                          </div>
                          <div style={{ fontStyle: "italic", fontWeight: "800", color: "#047857", fontSize: "6.2px" }}>
                            Tarbiyah &amp; Disiplin
                          </div>
                          <div
                            style={{
                              fontSize: "5.5px",
                              color: "#1e293b",
                              fontFamily: "monospace",
                              fontWeight: "800",
                              backgroundColor: "#fef3c7",
                              padding: "1px 4px",
                              borderRadius: "3px",
                              border: "1px solid #fde68a",
                              display: "inline-block",
                              marginTop: "1px",
                            }}
                          >
                            Narahubung: 0812-3456-7890
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

        {/* ================= MODE 2: STIKER LABEL UNDANGAN NO. 103 (12/LEMBAR) ================= */}
        {printMode === "label103" &&
          printPages.map((pageStudents: StudentItem[], pageIndex: number) => (
            <div key={`print-label103-page-${pageIndex}`} className="sticker-103-page">
              {pageStudents.map((student) => (
                <div key={`stk103-${student.nis}`} className="sticker-103-item">
                  <div style={{ flexShrink: 0, padding: "1.5px", border: "1px solid #064e3b", borderRadius: "4px", display: "inline-block" }}>
                    <QRCodeSVG
                      value={generateStandardQRPayload({ nis: student.nis, id: student.id })}
                      size={80}
                      level="M"
                      includeMargin={false}
                    />
                  </div>

                  <div style={{ flex: 1, minWidth: 0, lineHeight: "1.25", textAlign: "left" }}>
                    <div style={{ fontSize: "6px", fontWeight: "800", color: "#064e3b", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                      PESANTREN CONDONG
                    </div>

                    <div style={{ fontSize: "8.5px", fontWeight: "900", color: "#0f172a", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: "1px 0" }}>
                      {student.name}
                    </div>

                    <div style={{ fontSize: "7px", fontFamily: "monospace", fontWeight: "800", color: "#b45309" }}>
                      NIS: {student.nis}
                    </div>

                    <div style={{ fontSize: "6.5px", color: "#334155", fontWeight: "700", marginTop: "1.5px" }}>
                      Kelas: {student.class}
                    </div>

                    <div style={{ fontSize: "6px", color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      Kamar: {student.dorm}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}

        {/* ================= MODE 3: STIKER GRID A4 KOMPAK (24/LEMBAR) ================= */}
        {printMode === "stickerA4" &&
          printPages.map((pageStudents: StudentItem[], pageIndex: number) => (
            <div key={`print-stickera4-page-${pageIndex}`} className="sticker-a4-page">
              {pageStudents.map((student) => (
                <div key={`stka4-${student.nis}`} className="sticker-a4-item">
                  <div style={{ flexShrink: 0, padding: "2px", border: "1.5px solid #047857", borderRadius: "5px", display: "inline-block" }}>
                    <QRCodeSVG
                      value={generateStandardQRPayload({ nis: student.nis, id: student.id })}
                      size={82}
                      level="M"
                      includeMargin={false}
                    />
                  </div>

                  <div style={{ flex: 1, minWidth: 0, lineHeight: "1.25", textAlign: "left" }}>
                    <div style={{ fontSize: "6px", fontWeight: "900", color: "#047857", textTransform: "uppercase", letterSpacing: "0.3px" }}>
                      SIPS CONDONG
                    </div>

                    <div style={{ fontSize: "8.5px", fontWeight: "900", color: "#0f172a", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: "1px 0" }}>
                      {student.name}
                    </div>

                    <div style={{ fontSize: "7px", fontFamily: "monospace", fontWeight: "800", color: "#b45309" }}>
                      NIS: {student.nis}
                    </div>

                    <div style={{ fontSize: "6.5px", color: "#334155", fontWeight: "700", marginTop: "1px" }}>
                      Kelas: {student.class}
                    </div>

                    <div style={{ fontSize: "6px", color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      Asrama: {student.dorm}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}