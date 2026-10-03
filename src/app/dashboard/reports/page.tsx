"use client";

// =============================================================================
// 1. IMPORT DEPENDENCIES & ICONS
// =============================================================================
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  ArrowLeft,
  Users,
  ShieldAlert,
  Trophy,
  LogOut,
  Search,
  SlidersHorizontal,
  RotateCcw,
  Settings2,
  FileDown,
  Loader2,
  Printer,
  FileText,
  CheckSquare,
  Square,
  AlertTriangle,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { playScanSound } from "@/lib/feedback";

type ReportType = "violations" | "achievements" | "students" | "permissions" | "dossier";
type PageOrientation = "portrait" | "landscape";
type PageSize = "a4" | "legal";

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>("violations");

  const [startDate, setStartDate] = useState("2026-01-01");
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

  const [loading, setLoading] = useState(false);
  const [rawReportData, setRawReportData] = useState<any[]>([]);
  const [allMasterStudents, setAllMasterStudents] = useState<any[]>([]);

  // State Animasi Proses Ekspor
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [filterDorm, setFilterDorm] = useState("all");
  const [filterGeneration, setFilterGeneration] = useState("all");

  // Spesifik Pelanggaran
  const [filterViolationCategory, setFilterViolationCategory] = useState("all");
  const [filterViolationStatus, setFilterViolationStatus] = useState("all");

  // Spesifik Prestasi
  const [filterAchievementCategory, setFilterAchievementCategory] = useState("all");
  const [filterAchievementLevel, setFilterAchievementLevel] = useState("all");

  // Spesifik Santri
  const [filterStudentStatus, setFilterStudentStatus] = useState("all");

  // Spesifik Perizinan
  const [filterPermissionCategory, setFilterPermissionCategory] = useState("all");
  const [filterPermissionStatus, setFilterPermissionStatus] = useState("all");

  // Pengaturan Cetak / PDF
  const [pdfOrientation, setPdfOrientation] = useState<PageOrientation>("landscape");
  const [pdfPageSize, setPdfPageSize] = useState<PageSize>("a4");
  const [showPrintSettings, setShowPrintSettings] = useState(false);

  // DOSSIER SPECIFIC STATES (PILIHAN & PAGINASI)
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isPreparingPDF, setIsPreparingPDF] = useState(false);
  const [dossierPage, setDossierPage] = useState(1);
  const dossierPerPage = 15;

  useEffect(() => {
    fetchMasterStudents();
  }, []);

  useEffect(() => {
    if (reportType !== "dossier") {
      fetchReportData();
    }
  }, [reportType, startDate, endDate]);

  useEffect(() => {
    setSearchQuery("");
    setFilterClass("all");
    setFilterDorm("all");
    setFilterGeneration("all");
    setFilterViolationCategory("all");
    setFilterViolationStatus("all");
    setFilterAchievementCategory("all");
    setFilterAchievementLevel("all");
    setFilterStudentStatus("all");
    setFilterPermissionCategory("all");
    setFilterPermissionStatus("all");
    setDossierPage(1);
  }, [reportType]);

  async function fetchMasterStudents() {
    try {
      let allStudents: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await supabase.from("students").select("*").range(from, to);
        if (error) throw error;
        if (data && data.length > 0) {
          allStudents = [...allStudents, ...data];
          if (data.length < pageSize) hasMore = false;
          else page++;
        } else {
          hasMore = false;
        }
      }

      const formatted = allStudents.map((st: any) => ({
        ...st,
        nis: (st.nis || st.nomor_induk || "-").trim(),
        full_name: (st.full_name || st.name || st.nama || st.nama_lengkap || "Santri").trim(),
        kelas: (st.kelas || st.class_name || st.class || st.rombel || "-").trim(),
        kamar: (st.kamar_asrama || st.dorm || st.room || st.asrama || "-").trim(),
        angkatan: String(st.entry_year || st.tahun_masuk || st.angkatan || "2026").trim(),
        konsulat: (st.asal_konsulat || st.consulate || st.origin_region || "Pusat").trim(),
        nama_lengkap_wali: st.nama_lengkap_wali || st.guardian_name || st.nama_wali || "-",
        no_whatsapp: st.no_whatsapp || st.guardian_phone || st.phone || "-",
        status_santri: st.status_santri || st.status || "Aktif Mukim",
      }));
      setAllMasterStudents(formatted);
    } catch (e) {
      console.warn("Gagal memuat master santri:", e);
    }
  }

  async function fetchReportData() {
    setLoading(true);
    try {
      let allStudents = allMasterStudents;
      if (allStudents.length === 0) {
        const { data } = await supabase.from("students").select("*");
        allStudents = data || [];
      }

      const studentsMapByNis: Record<string, any> = {};
      const studentsMapById: Record<string, any> = {};

      allStudents.forEach((st: any) => {
        const normalizedSt = {
          id: String(st.id || ""),
          nis: String(st.nis || st.nomor_induk || "-").trim(),
          full_name: (st.full_name || st.name || st.nama || st.nama_lengkap || "Santri").trim(),
          kelas: (st.kelas || st.class_name || st.class || st.rombel || "-").trim(),
          kamar: (st.kamar_asrama || st.dorm || st.room || st.asrama || "-").trim(),
          angkatan: String(st.entry_year || st.tahun_masuk || st.angkatan || "2026").trim(),
          konsulat: (st.asal_konsulat || st.consulate || st.origin_region || "Pusat").trim(),
          namaWali: st.nama_lengkap_wali || st.guardian_name || st.nama_wali || "-",
          noWali: st.no_whatsapp || st.guardian_phone || st.phone || "-",
          statusSantri: st.status_santri || st.status || "Aktif Mukim",
        };

        if (normalizedSt.id) studentsMapById[normalizedSt.id] = normalizedSt;
        if (normalizedSt.nis && normalizedSt.nis !== "-") studentsMapByNis[normalizedSt.nis] = normalizedSt;
      });

      const resolveInfo = (item: any) => {
        const idKey = item.student_id ? String(item.student_id).trim() : "";
        const nisKey = item.nis ? String(item.nis).trim() : "";

        const matched = studentsMapById[idKey] || studentsMapByNis[nisKey] || {
          kelas: item.kelas || item.class || "-",
          kamar: item.kamar || item.dorm || "-",
          angkatan: item.angkatan || "2026",
          konsulat: item.konsulat || item.consulate || "Pusat",
          namaWali: item.nama_lengkap_wali || "-",
          noWali: item.no_whatsapp || "-",
          statusSantri: "Aktif Mukim",
          full_name: item.student_name || item.full_name || item.name || "Santri",
        };

        return {
          kelas: matched.kelas,
          kamar: matched.kamar,
          angkatan: matched.angkatan,
          konsulat: matched.konsulat,
          nama_lengkap_wali: matched.namaWali,
          no_whatsapp: matched.noWali,
          status_santri: matched.statusSantri,
          student_name: item.student_name || item.full_name || item.name || matched.full_name || "Santri",
        };
      };

      if (reportType === "students") {
        setRawReportData(allStudents);
      } else if (reportType === "violations") {
        const { data } = await supabase
          .from("violations")
          .select("*")
          .gte("created_at", `${startDate}T00:00:00Z`)
          .lte("created_at", `${endDate}T23:59:59Z`)
          .order("created_at", { ascending: false });

        setRawReportData((data || []).map((v: any) => ({ ...v, ...resolveInfo(v) })));
      } else if (reportType === "achievements") {
        const { data } = await supabase
          .from("achievements")
          .select("*")
          .gte("created_at", `${startDate}T00:00:00Z`)
          .lte("created_at", `${endDate}T23:59:59Z`)
          .order("created_at", { ascending: false });

        setRawReportData((data || []).map((a: any) => ({ ...a, ...resolveInfo(a) })));
      } else if (reportType === "permissions") {
        const { data } = await supabase
          .from("permissions")
          .select("*")
          .gte("created_at", `${startDate}T00:00:00Z`)
          .lte("created_at", `${endDate}T23:59:59Z`)
          .order("created_at", { ascending: false });

        setRawReportData((data || []).map((p: any) => ({ ...p, ...resolveInfo(p) })));
      }
    } catch (err: any) {
      console.error("Gagal memuat data laporan:", err.message);
    } finally {
      setLoading(false);
    }
  }

  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    allMasterStudents.forEach((st) => {
      if (st.kelas && st.kelas !== "-") set.add(st.kelas);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "id"));
  }, [allMasterStudents]);

  const availableDorms = useMemo(() => {
    const set = new Set<string>();
    allMasterStudents.forEach((st) => {
      if (st.kamar && st.kamar !== "-") set.add(st.kamar);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "id"));
  }, [allMasterStudents]);

  const availableGenerations = useMemo(() => {
    const set = new Set<string>();
    allMasterStudents.forEach((st) => {
      if (st.angkatan && st.angkatan !== "-") set.add(st.angkatan);
    });
    return Array.from(set).sort();
  }, [allMasterStudents]);

  // HELPER KALKULASI KETERLAMBATAN & WAKTU DETAIL
  const isOverdueOutside = (item: any) => {
    if (item.status === "out_pondok") {
      return new Date() > new Date(item.return_target);
    }
    return false;
  };

  const isCompletedLate = (item: any) => {
    if ((item.status === "back_pondok" || item.status === "completed") && item.actual_in_at) {
      return new Date(item.actual_in_at) > new Date(item.return_target);
    }
    return false;
  };

  const getDetailedTimeInfo = (item: any) => {
    const now = new Date();
    const returnTarget = new Date(item.return_target);

    if (isOverdueOutside(item)) {
      const diffMs = now.getTime() - returnTarget.getTime();
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHrs / 24);
      const remHrs = diffHrs % 24;
      const timeStr = diffDays > 0 ? `${diffDays} hari ${remHrs} jam` : `${diffHrs} jam`;
      return `Terlambat di luar pondok selama ${timeStr}`;
    }

    if (isCompletedLate(item)) {
      const actualIn = new Date(item.actual_in_at);
      const diffMs = actualIn.getTime() - returnTarget.getTime();
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHrs / 24);
      const remHrs = diffHrs % 24;
      const timeStr = diffDays > 0 ? `${diffDays} hari ${remHrs} jam` : `${diffHrs} jam`;
      return `Datang terlambat ${timeStr} dari jadwal`;
    }

    if (item.status === "approved" || item.status === "out_pondok") {
      return `Batas kembali: ${returnTarget.toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
    }

    return `Tiba tepat waktu`;
  };

  const filteredData = useMemo(() => {
    if (reportType === "dossier") {
      let result = [...allMasterStudents];
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        result = result.filter(
          (item) =>
            item.full_name?.toLowerCase().includes(q) ||
            item.nis?.toLowerCase().includes(q)
        );
      }
      if (filterClass !== "all") result = result.filter((d) => d.kelas === filterClass);
      if (filterDorm !== "all") result = result.filter((d) => d.kamar === filterDorm);
      if (filterGeneration !== "all") result = result.filter((d) => d.angkatan === filterGeneration);
      return result;
    }

    let result = [...rawReportData];
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.student_name?.toLowerCase().includes(q) ||
          item.full_name?.toLowerCase().includes(q) ||
          item.nis?.toLowerCase().includes(q) ||
          item.violation_name?.toLowerCase().includes(q) ||
          item.title?.toLowerCase().includes(q) ||
          item.reason?.toLowerCase().includes(q)
      );
    }

    if (filterClass !== "all") result = result.filter((d) => d.kelas === filterClass);
    if (filterDorm !== "all") result = result.filter((d) => d.kamar === filterDorm);
    if (filterGeneration !== "all") result = result.filter((d) => d.angkatan === filterGeneration);

    if (reportType === "permissions" && filterPermissionStatus !== "all") {
      if (filterPermissionStatus === "active_izin") {
        result = result.filter((p) => p.status === "approved" || (p.status === "out_pondok" && !isOverdueOutside(p)));
      } else if (filterPermissionStatus === "completed") {
        result = result.filter((p) => (p.status === "back_pondok" || p.status === "completed") && !isCompletedLate(p));
      } else if (filterPermissionStatus === "overdue_outside") {
        result = result.filter((p) => isOverdueOutside(p));
      } else if (filterPermissionStatus === "completed_late") {
        result = result.filter((p) => isCompletedLate(p));
      }
    }

    if (reportType === "permissions" && filterPermissionCategory !== "all") {
      result = result.filter((p) => p.category?.toLowerCase().includes(filterPermissionCategory.toLowerCase()));
    }

    return result;
  }, [rawReportData, allMasterStudents, searchQuery, filterClass, filterDorm, filterGeneration, reportType, filterPermissionStatus, filterPermissionCategory]);

  const paginatedDossierStudents = useMemo(() => {
    const start = (dossierPage - 1) * dossierPerPage;
    return filteredData.slice(start, start + dossierPerPage);
  }, [filteredData, dossierPage]);

  const totalDossierPages = Math.ceil(filteredData.length / dossierPerPage);

  const handleToggleSelectStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    const allFilteredIds = filteredData.map((s) => s.id);
    setSelectedStudentIds(allFilteredIds);
  };

  const handleDeselectAll = () => {
    setSelectedStudentIds([]);
  };

  const handleSelectByClass = (cls: string) => {
    if (cls === "all") return;
    const ids = allMasterStudents.filter((s) => s.kelas.toLowerCase() === cls.toLowerCase()).map((s) => s.id);
    setSelectedStudentIds(Array.from(new Set([...selectedStudentIds, ...ids])));
  };

  const handleSelectByDorm = (drm: string) => {
    if (drm === "all") return;
    const ids = allMasterStudents.filter((s) => s.kamar.toLowerCase() === drm.toLowerCase()).map((s) => s.id);
    setSelectedStudentIds(Array.from(new Set([...selectedStudentIds, ...ids])));
  };

  // GENERATOR PDF DOSSIER RESMI MULTI-HALAMAN
  const handleGenerateDossierPDF = async () => {
    if (selectedStudentIds.length === 0) {
      alert("Silakan centang atau pilih minimal satu santri yang ingin dicetak rapornya.");
      return;
    }

    setIsPreparingPDF(true);
    playScanSound("success");

    try {
      const { data: violations } = await supabase.from("violations").select("*");
      const { data: permits } = await supabase.from("permissions").select("*");
      const { data: achievements } = await supabase.from("achievements").select("*");

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;

      for (let i = 0; i < selectedStudentIds.length; i++) {
        const id = selectedStudentIds[i];
        const s = allMasterStudents.find((st) => st.id === id);
        if (!s) continue;

        if (i > 0) {
          doc.addPage();
        }

        const sViolations = (violations || []).filter((v: any) => String(v.student_id) === String(id) || v.nis === s.nis);
        const sPermits = (permits || []).filter((p: any) => String(p.student_id) === String(id) || p.nis === s.nis);
        const sAchievements = (achievements || []).filter((a: any) => String(a.student_id) === String(id) || a.nis === s.nis);

        // --- KOP SURAT ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(4, 120, 87);
        doc.text("PONDOK PESANTREN CONDONG TASIKMALAYA", pageWidth / 2, 14, { align: "center" });

        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text("PUSAT INFORMASI PENGASUHAN SANTRI (SIPS)", pageWidth / 2, 19, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text("Laporan Resmi Rekam Jejak & Dossier Perkembangan Santri Tahun Ajaran 2026/2027", pageWidth / 2, 24, { align: "center" });

        doc.setDrawColor(15, 23, 42);
        doc.setLineWidth(0.6);
        doc.line(margin, 27, pageWidth - margin, 27);

        // --- BIODATA KOTAK ---
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, 31, pageWidth - (margin * 2), 16, "F");
        doc.setDrawColor(226, 232, 240);
        doc.rect(margin, 31, pageWidth - (margin * 2), 16, "D");

        doc.setFontSize(7);
        doc.setTextColor(100);
        doc.text("NAMA LENGKAP", margin + 4, 35);
        doc.text("NOMOR INDUK (NIS)", margin + 65, 35);
        doc.text("KELAS / TINGKAT", margin + 110, 35);
        doc.text("ASRAMA / KAMAR", margin + 145, 35);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text(s.full_name || "-", margin + 4, 42);
        doc.text(String(s.nis || "-"), margin + 65, 42);
        doc.text(String(s.kelas || "-"), margin + 110, 42);
        doc.text(String(s.kamar || "-"), margin + 145, 42);

        // --- POIN DISIPLIN ---
        doc.setFillColor(236, 253, 245);
        doc.rect(margin, 51, pageWidth - (margin * 2), 11, "F");
        doc.setDrawColor(167, 243, 208);
        doc.rect(margin, 51, pageWidth - (margin * 2), 11, "D");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(4, 120, 87);
        doc.text(`Akumulasi Poin Disiplin Santri: ${s.points ?? 100} / 100`, margin + 4, 58);

        let currentY = 68;

        // --- TABEL 1: PELANGGARAN ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text(`1. Catatan Pelanggaran & Sanksi Disiplin (${sViolations.length} Kasus)`, margin, currentY);
        currentY += 2;

        const violationBody = sViolations.length === 0 
          ? [["1", "Tidak ada catatan pelanggaran. Santri berdisiplin baik.", "-", "-"]]
          : sViolations.map((v: any, idx: number) => [
              String(idx + 1),
              v.violation_name || v.description || "Pelanggaran Tata Tertib",
              v.sanction || "Pembinaan",
              `-${v.points_deducted || v.points || 5}`,
            ]);

        autoTable(doc, {
          startY: currentY,
          head: [["No", "Bentuk Pelanggaran", "Sanksi / Tindakan", "Poin"]],
          body: violationBody,
          theme: "grid",
          styles: { font: "helvetica", fontSize: 7.5, cellPadding: 2, valign: "middle", textColor: [30, 41, 59] },
          headStyles: { fillColor: [6, 78, 59], textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
          columnStyles: { 0: { halign: "center", cellWidth: 8 }, 3: { halign: "center", cellWidth: 15 } },
          margin: { left: margin, right: margin },
        });

        // @ts-ignore
        currentY = doc.lastAutoTable.finalY + 8;

        // --- TABEL 2: PERIZINAN ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(`2. Rekapitulasi Perizinan Keluar / Masuk (${sPermits.length} Izin Tercatat)`, margin, currentY);
        currentY += 2;

        const permitBody = sPermits.length === 0
          ? [["1", "Belum ada catatan perizinan keluar gerbang.", "-", "-"]]
          : sPermits.map((p: any, idx: number) => [
              String(idx + 1),
              p.reason || "Keperluan Keluarga",
              new Date(p.created_at || Date.now()).toLocaleDateString("id-ID"),
              p.status === "back_pondok" ? "Selesai" : p.status === "out_pondok" ? "Di Luar" : "Aktif",
            ]);

        autoTable(doc, {
          startY: currentY,
          head: [["No", "Keperluan / Keterangan", "Tanggal", "Status"]],
          body: permitBody,
          theme: "grid",
          styles: { font: "helvetica", fontSize: 7.5, cellPadding: 2, valign: "middle", textColor: [30, 41, 59] },
          headStyles: { fillColor: [6, 78, 59], textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
          columnStyles: { 0: { halign: "center", cellWidth: 8 }, 3: { halign: "center", cellWidth: 20 } },
          margin: { left: margin, right: margin },
        });

        // @ts-ignore
        currentY = doc.lastAutoTable.finalY + 8;

        // --- TABEL 3: PRESTASI ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(`3. Catatan Prestasi & Penghargaan (${sAchievements.length} Prestasi)`, margin, currentY);
        currentY += 2;

        const achievementBody = sAchievements.length === 0
          ? [["1", "Belum ada catatan prestasi formal.", "-"]]
          : sAchievements.map((a: any, idx: number) => [
              String(idx + 1),
              a.achievement_name || a.title || "Penghargaan Pesantren",
              a.level || "Internal Pondok",
            ]);

        autoTable(doc, {
          startY: currentY,
          head: [["No", "Jenis Prestasi / Perlombaan", "Tingkat"]],
          body: achievementBody,
          theme: "grid",
          styles: { font: "helvetica", fontSize: 7.5, cellPadding: 2, valign: "middle", textColor: [30, 41, 59] },
          headStyles: { fillColor: [6, 78, 59], textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
          columnStyles: { 0: { halign: "center", cellWidth: 8 } },
          margin: { left: margin, right: margin },
        });

        // --- TANDA TANGAN ---
        // @ts-ignore
        let signY = doc.lastAutoTable.finalY + 12;
        if (signY > pageHeight - 35) {
          doc.addPage();
          signY = 25;
        }

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);

        doc.text("Mengetahui,", pageWidth / 2, signY, { align: "center" });
        doc.text(`Tasikmalaya, ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`, pageWidth - margin, signY, { align: "right" });

        doc.setFont("helvetica", "bold");
        doc.text("Wali Kelas / Asrama", margin + 5, signY + 5, { align: "left" });
        doc.text("Orang Tua / Wali Santri", pageWidth / 2, signY + 5, { align: "center" });
        doc.text("Bagian Pengasuhan Santri", pageWidth - margin, signY + 5, { align: "right" });

        doc.setFont("helvetica", "normal");
        doc.text("( ........................................ )", margin + 5, signY + 23, { align: "left" });
        doc.text("( ........................................ )", pageWidth / 2, signY + 23, { align: "center" });
        doc.text("( ........................................ )", pageWidth - margin, signY + 23, { align: "right" });
      }

      const pdfBlobUrl = doc.output("bloburl");
      window.open(pdfBlobUrl, "_blank");

      playScanSound("success");
    } catch (err) {
      console.error("Gagal membuat PDF:", err);
      alert("Terjadi kesalahan saat memproses PDF.");
    } finally {
      setIsPreparingPDF(false);
    }
  };

  const resetAllFilters = () => {
    setSearchQuery("");
    setFilterClass("all");
    setFilterDorm("all");
    setFilterGeneration("all");
    setFilterViolationCategory("all");
    setFilterViolationStatus("all");
    setFilterAchievementCategory("all");
    setFilterAchievementLevel("all");
    setFilterStudentStatus("all");
    setFilterPermissionCategory("all");
    setFilterPermissionStatus("all");
    setDossierPage(1);
  };

  // GENERATOR EXCEL SINKRON DENGAN DATA DI WEB (BAHASA INDONESIA)
  const exportToExcel = async () => {
    const dataset = filteredData;
    if (dataset.length === 0) {
      alert("Tidak ada data untuk diekspor.");
      return;
    }

    setIsExportingExcel(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const sheetName = reportType === "violations" ? "Rekap Kedisiplinan" : reportType === "achievements" ? "Buku Prestasi" : reportType === "students" ? "Buku Induk Santri" : "Perizinan Santri";
      const worksheet = workbook.addWorksheet(sheetName, { views: [{ showGridLines: true }] });

      let headers: string[] = [];
      if (reportType === "violations") {
        headers = ["NO", "NIS", "NAMA SANTRI", "KELAS", "ANGKATAN", "ASRAMA", "BENTUK PELANGGARAN", "KATEGORI", "POIN", "SANKSI", "STATUS"];
      } else if (reportType === "achievements") {
        headers = ["NO", "NIS", "NAMA SANTRI", "KELAS", "ANGKATAN", "ASRAMA", "NAMA PRESTASI", "TINGKAT", "REWARD POIN", "APRESIASI"];
      } else if (reportType === "students") {
        headers = ["NO", "NIS", "NAMA LENGKAP", "KELAS", "ANGKATAN", "ASRAMA", "NAMA WALI", "WHATSAPP", "STATUS"];
      } else if (reportType === "permissions") {
        headers = ["NO", "NIS", "NAMA SANTRI", "KELAS", "ANGKATAN", "ASRAMA", "KATEGORI & ALASAN", "KETERANGAN WAKTU DETAIL", "STATUS GERBANG"];
      }

      worksheet.getRow(1).values = headers;
      worksheet.getRow(1).eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF047857" } };
        cell.font = { size: 9, bold: true, color: { argb: "FFFFFFFF" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });

      dataset.forEach((item, index) => {
        let rowData: any[] = [];
        if (reportType === "violations") {
          rowData = [index + 1, item.nis || "-", (item.student_name || item.full_name || "-").toUpperCase(), item.kelas || "-", item.angkatan || "-", item.kamar || "-", item.violation_name || "-", item.category || "-", Number(item.points) || 0, item.sanction || "-", item.status || "-"];
        } else if (reportType === "achievements") {
          rowData = [index + 1, item.nis || "-", (item.student_name || item.full_name || "-").toUpperCase(), item.kelas || "-", item.angkatan || "-", item.kamar || "-", item.title || "-", item.level || "-", Number(item.reward_points) || 0, item.appreciation || "-"];
        } else if (reportType === "students") {
          rowData = [index + 1, item.nis || "-", (item.full_name || item.name || "-").toUpperCase(), item.kelas || "-", item.angkatan || "-", item.kamar || "-", item.nama_lengkap_wali || "-", item.no_whatsapp ? `'${item.no_whatsapp}` : "-", item.status_santri || "Aktif"];
        } else if (reportType === "permissions") {
          const timeDetail = getDetailedTimeInfo(item);
          const isLate = isOverdueOutside(item);
          const wasLate = isCompletedLate(item);
          const stLabel = isLate ? "TERLAMBAT (DI LUAR)" : wasLate ? "SELESAI (TERLAMBAT)" : item.status === "back_pondok" ? "SELESAI" : "IZIN AKTIF";
          rowData = [index + 1, item.nis || "-", (item.student_name || item.full_name || "-").toUpperCase(), item.kelas || "-", item.angkatan || "-", item.kamar || "-", `${item.category} - ${item.reason}`, timeDetail, stLabel];
        }
        worksheet.addRow(rowData);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `SIPS_${sheetName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      playScanSound("success");
    } finally {
      setIsExportingExcel(false);
    }
  };

  // GENERATOR PDF LAPORAN BIASA DENGAN PREVIEW TAB BARU & FONT HITAM
  const downloadPDF = () => {
    const dataset = filteredData;
    if (dataset.length === 0) {
      alert("Tidak ada data untuk diekspor.");
      return;
    }
    setIsGeneratingPDF(true);
    setTimeout(() => {
      try {
        const doc = new jsPDF({ orientation: pdfOrientation, unit: "mm", format: pdfPageSize });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 12;

        // --- KOP SURAT PROFESIONAL ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(4, 120, 87);
        doc.text("PONDOK PESANTREN CONDONG TASIKMALAYA", pageWidth / 2, 12, { align: "center" });

        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text("PUSAT INFORMASI PENGASUHAN SANTRI (SIPS)", pageWidth / 2, 17, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(100);
        const reportTitleMap: Record<ReportType, string> = {
          violations: "LAPORAN REKAPITULASI KEDISIPLINAN SANTRI",
          achievements: "LAPORAN BUKU PRESTASI SANTRI",
          students: "LAPORAN BUKU INDUK MASTER SANTRI",
          permissions: "LAPORAN REKAPITULASI PERIZINAN & GERBANG",
          dossier: "LAPORAN DOSSIER PERKEMBANGAN SANTRI",
        };
        doc.text(reportTitleMap[reportType], pageWidth / 2, 22, { align: "center" });

        doc.setDrawColor(15, 23, 42);
        doc.setLineWidth(0.5);
        doc.line(margin, 25, pageWidth - margin, 25);

        let tableHeaders = ["NO", "NIS", "NAMA LENGKAP SANTRI", "KELAS", "ANGKATAN", "KAMAR"];
        let tableBody = dataset.map((item, index) => [
          String(index + 1),
          item.nis || "-",
          (item.student_name || item.full_name || "-").toUpperCase(),
          item.kelas || "-",
          item.angkatan || "-",
          item.kamar || "-",
        ]);

        if (reportType === "permissions") {
          tableHeaders = ["NO", "NIS", "NAMA LENGKAP SANTRI", "KELAS", "KATEGORI & ALASAN", "KETERANGAN WAKTU DETAIL", "STATUS GERBANG"];
          tableBody = dataset.map((item, index) => [
            String(index + 1),
            item.nis || "-",
            (item.student_name || item.full_name || "-").toUpperCase(),
            item.kelas || "-",
            `${item.category}\n(${item.reason})`,
            getDetailedTimeInfo(item),
            isOverdueOutside(item) ? "TERLAMBAT (DI LUAR)" : isCompletedLate(item) ? "SELESAI (TERLAMBAT)" : item.status === "back_pondok" ? "SELESAI" : "IZIN AKTIF",
          ]);
        }

        autoTable(doc, {
          startY: 28,
          head: [tableHeaders],
          body: tableBody,
          theme: "grid",
          styles: { 
            font: "helvetica", 
            fontSize: 7.5, 
            cellPadding: 2, 
            valign: "middle", 
            textColor: [30, 41, 59] // Teks hitam pekat profesional
          },
          headStyles: { 
            fillColor: [6, 78, 59], 
            textColor: [255, 255, 255], 
            fontStyle: "bold", 
            halign: "center" 
          },
          columnStyles: { 0: { halign: "center", cellWidth: 10 } },
          margin: { left: margin, right: margin },
          didDrawPage: (data) => {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(120);
            doc.text(
              `Dicetak pada: ${new Date().toLocaleDateString("id-ID", { dateStyle: "full" })} • SIPS Pesantren Condong`,
              margin,
              pageHeight - 10
            );
            doc.text(
              `Halaman ${data.pageNumber}`,
              pageWidth - margin,
              pageHeight - 10,
              { align: "right" }
            );
          },
        });

        // Buka Preview PDF di Tab Baru (Bukan Otomatis Download)
        const pdfBlobUrl = doc.output("bloburl");
        window.open(pdfBlobUrl, "_blank");

        playScanSound("success");
      } finally {
        setIsGeneratingPDF(false);
      }
    }, 100);
  };

  return (
    <div className="w-full space-y-5 font-sans relative pb-20">
      {/* ================= HEADER HERO BANNER ================= */}
      <div className="print:hidden relative overflow-hidden rounded-[32px] bg-gradient-to-r from-emerald-950 via-[#064e3b] to-teal-950 p-5 sm:p-7 text-white shadow-xl border border-emerald-500/40">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5 min-w-0">
            <Link
              href="/dashboard"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white hover:bg-white/20 transition active:scale-90 shadow-sm backdrop-blur-md"
            >
              <ArrowLeft className="h-5 w-5 stroke-[2.4]" />
            </Link>

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 via-emerald-500 to-teal-400 text-slate-950 shadow-md font-black">
              <FileSpreadsheet className="h-5 w-5 stroke-[2.3]" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-emerald-200 text-[9.5px] font-black uppercase tracking-wider backdrop-blur-xl">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  REKAPITULASI TERPADU
                </span>
                <span className="text-[10px] text-emerald-300 font-mono font-bold">
                  {filteredData.length} Data
                </span>
              </div>
              <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white mt-0.5 truncate">
                Pusat Laporan &amp; Rekapitulasi
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* ================= TABS 5 MODUL LAPORAN ================= */}
      <div className="print:hidden rounded-3xl border border-slate-200/80 dark:border-emerald-900/40 bg-white/90 dark:bg-[#0c1815] p-2.5 shadow-sm backdrop-blur-xl">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {[
            { key: "violations", label: "Rekap Kedisiplinan", icon: ShieldAlert, color: "text-rose-500" },
            { key: "achievements", label: "Buku Prestasi", icon: Trophy, color: "text-amber-500" },
            { key: "students", label: "Buku Induk Santri", icon: Users, color: "text-emerald-500" },
            { key: "permissions", label: "Rekap Perizinan", icon: LogOut, color: "text-teal-500" },
            { key: "dossier", label: "Rapor & Dossier", icon: FileText, color: "text-cyan-500" },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = reportType === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setReportType(tab.key as ReportType)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer ${
                  isActive
                    ? "bg-emerald-600 text-white shadow-sm font-black"
                    : "bg-slate-50 dark:bg-emerald-950/40 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-emerald-900/30 hover:border-emerald-500/50"
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : tab.color}`} />
                  <span className="truncate">{tab.label}</span>
                </div>
                {isActive && <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0 ml-1" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ================= PANEL FILTER & CONTROL BAR ================= */}
      <div className="print:hidden rounded-3xl border border-slate-200/80 dark:border-emerald-900/40 bg-white/90 dark:bg-[#0c1815] p-4 sm:p-5 shadow-sm backdrop-blur-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-emerald-900/30 pb-3">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-black text-xs uppercase tracking-wider">
            <SlidersHorizontal className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Kustomisasi Parameter Data &amp; Aksi</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {reportType === "dossier" ? (
              <button
                type="button"
                onClick={handleGenerateDossierPDF}
                disabled={selectedStudentIds.length === 0 || isPreparingPDF}
                className="inline-flex items-center space-x-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 px-4 py-2 text-xs font-black text-slate-950 shadow-md transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isPreparingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4 stroke-[2.5]" />}
                <span>Preview PDF Rapor Terpilih ({selectedStudentIds.length} Santri)</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={exportToExcel}
                  disabled={isExportingExcel}
                  className="inline-flex items-center space-x-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-black text-white shadow-md transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {isExportingExcel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5 stroke-[2.5]" />}
                  <span>Excel</span>
                </button>

                <button
                  type="button"
                  onClick={downloadPDF}
                  disabled={isGeneratingPDF}
                  className="inline-flex items-center space-x-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-3.5 py-2 text-xs font-black text-white shadow-md transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {isGeneratingPDF ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5 stroke-[2.5]" />}
                  <span>Preview PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPrintSettings(!showPrintSettings)}
                  className="h-9 w-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-emerald-900/40 hover:bg-slate-200 border border-slate-200 dark:border-emerald-800 text-slate-700 dark:text-slate-200 transition cursor-pointer"
                >
                  <Settings2 className="h-4 w-4 text-amber-500" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={resetAllFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-500 hover:text-rose-500 transition cursor-pointer bg-slate-50 dark:bg-emerald-950/30 rounded-xl border border-slate-200 dark:border-emerald-900/40"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {showPrintSettings && reportType !== "dossier" && (
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-emerald-950/40 border border-slate-200 dark:border-emerald-900/40 flex flex-wrap items-center gap-3 text-xs">
            <span className="text-slate-700 dark:text-slate-300 font-bold">Format PDF:</span>
            <select
              value={pdfOrientation}
              onChange={(e) => setPdfOrientation(e.target.value as PageOrientation)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-emerald-800 rounded-xl px-2.5 py-1 text-xs font-semibold outline-none cursor-pointer"
            >
              <option value="landscape">Landscape (Mendatar)</option>
              <option value="portrait">Portrait (Tegak)</option>
            </select>
            <select
              value={pdfPageSize}
              onChange={(e) => setPdfPageSize(e.target.value as PageSize)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-emerald-800 rounded-xl px-2.5 py-1 text-xs font-semibold outline-none cursor-pointer"
            >
              <option value="a4">Ukuran A4</option>
              <option value="legal">Ukuran F4 / Legal</option>
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5 text-xs">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari santri, NIS, atau kata kunci..."
              className="h-10 w-full rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 pl-9 pr-3 text-xs font-semibold outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <select
              value={filterGeneration}
              onChange={(e) => setFilterGeneration(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 px-3 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="all">Semua Angkatan</option>
              {availableGenerations.map((gen) => (
                <option key={gen} value={gen}>Angkatan {gen}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filterClass}
              onChange={(e) => {
                setFilterClass(e.target.value);
                if (reportType === "dossier") handleSelectByClass(e.target.value);
              }}
              className="h-10 w-full rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 px-3 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="all">Semua Kelas</option>
              {availableClasses.map((cls) => (
                <option key={cls} value={cls}>Kelas {cls}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filterDorm}
              onChange={(e) => {
                setFilterDorm(e.target.value);
                if (reportType === "dossier") handleSelectByDorm(e.target.value);
              }}
              className="h-10 w-full rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 px-3 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="all">Semua Asrama</option>
              {availableDorms.map((dorm) => (
                <option key={dorm} value={dorm}>{dorm}</option>
              ))}
            </select>
          </div>

          {reportType === "permissions" && (
            <div>
              <select
                value={filterPermissionStatus}
                onChange={(e) => setFilterPermissionStatus(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 px-3 text-xs font-bold text-emerald-600 dark:text-emerald-400 outline-none cursor-pointer"
              >
                <option value="all">Semua Status Izin</option>
                <option value="active_izin">Izin (Masih Aktif di Luar)</option>
                <option value="completed">Selesai (Kembali Tepat Waktu)</option>
                <option value="overdue_outside">Terlambat (Masih di Luar)</option>
                <option value="completed_late">Terlambat (Sudah Kembali)</option>
              </select>
            </div>
          )}

          {reportType === "dossier" && (
            <div className="flex items-center gap-1 sm:col-span-2">
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="flex-1 h-10 px-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] transition border border-emerald-500/20 cursor-pointer"
              >
                Pilih Semua ({filteredData.length})
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="h-10 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-[10px] transition border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                Reset
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ================= TAMPILAN KONDISIONAL ================= */}
      {reportType === "dossier" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2 text-xs font-bold text-slate-600 dark:text-slate-400">
            <span>Menampilkan halaman {dossierPage} dari {totalDossierPages || 1} • Total Terpilih: <strong className="text-emerald-500">{selectedStudentIds.length} Santri</strong></span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={dossierPage <= 1}
                onClick={() => setDossierPage((p) => Math.max(p - 1, 1))}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-emerald-900/50 bg-white dark:bg-slate-900 disabled:opacity-40 cursor-pointer"
              >
                Sebelumnya
              </button>
              <button
                type="button"
                disabled={dossierPage >= totalDossierPages}
                onClick={() => setDossierPage((p) => Math.min(p + 1, totalDossierPages))}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-emerald-900/50 bg-white dark:bg-slate-900 disabled:opacity-40 cursor-pointer"
              >
                Selanjutnya
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200/80 dark:border-emerald-900/40 bg-white/90 dark:bg-[#0c1815] shadow-xl backdrop-blur-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-emerald-900/40 bg-slate-50/90 dark:bg-emerald-950/40 text-[11px] font-black uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-3 w-12 text-center">PILIH</th>
                    <th className="py-3 px-3 w-24 text-center">NIS</th>
                    <th className="py-3 px-4 font-black">NAMA LENGKAP SANTRI</th>
                    <th className="py-3 px-3 text-center w-24">KELAS</th>
                    <th className="py-3 px-3 text-center w-28">ANGKATAN</th>
                    <th className="py-3 px-3 text-center w-28">KAMAR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-emerald-900/30">
                  {paginatedDossierStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        Tidak ada santri yang ditemukan.
                      </td>
                    </tr>
                  ) : (
                    paginatedDossierStudents.map((st) => {
                      const isChecked = selectedStudentIds.includes(st.id);
                      return (
                        <tr
                          key={st.id}
                          onClick={() => handleToggleSelectStudent(st.id)}
                          className={`cursor-pointer transition ${isChecked ? "bg-emerald-500/10" : "hover:bg-emerald-500/[0.02]"}`}
                        >
                          <td className="py-3 px-3 text-center">
                            {isChecked ? (
                              <CheckSquare className="h-4 w-4 text-emerald-600 mx-auto" />
                            ) : (
                              <Square className="h-4 w-4 text-slate-300 mx-auto" />
                            )}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300">{st.nis}</td>
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-white uppercase">{st.full_name}</td>
                          <td className="py-3 px-3 text-center font-bold text-slate-600 dark:text-slate-300">{st.kelas}</td>
                          <td className="py-3 px-3 text-center text-slate-500 font-mono">{st.angkatan}</td>
                          <td className="py-3 px-3 text-center text-slate-500">{st.kamar}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ================= TABEL LAPORAN BIASA ================= */
        <div className="overflow-hidden rounded-3xl border border-slate-200/80 dark:border-emerald-900/40 bg-white/90 dark:bg-[#0c1815] shadow-xl backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-emerald-900/40 bg-slate-50/90 dark:bg-emerald-950/40 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-3 w-12 text-center">NO</th>
                  <th className="py-3.5 px-3 w-24 text-center">NIS</th>
                  <th className="py-3.5 px-4 font-black">NAMA LENGKAP SANTRI</th>
                  <th className="py-3.5 px-3 text-center w-24">KELAS</th>
                  <th className="py-3.5 px-3 text-center w-28">ANGKATAN</th>
                  <th className="py-3.5 px-3 text-center w-28">KAMAR</th>
                  <th className="py-3.5 px-4 font-black">
                    {reportType === "violations" && "BENTUK PELANGGARAN & SANKSI"}
                    {reportType === "achievements" && "PRESTASI & APRESIASI"}
                    {reportType === "students" && "WALI SANTRI & KONTAK"}
                    {reportType === "permissions" && "KATEGORI & ALASAN IZIN"}
                  </th>
                  <th className="py-3.5 px-3 text-center w-48">
                    {reportType === "violations" || reportType === "achievements" ? "POIN" : "STATUS GERBANG & WAKTU"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-emerald-900/30 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-14 text-center text-slate-400">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-emerald-600 mb-2" />
                      <span>Sinkronisasi data laporan dari database...</span>
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                      Tidak ada catatan data yang cocok dengan kriteria filter.
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item, idx) => {
                    const isLate = reportType === "permissions" ? isOverdueOutside(item) : false;
                    const wasLate = reportType === "permissions" ? isCompletedLate(item) : false;
                    const timeDetail = reportType === "permissions" ? getDetailedTimeInfo(item) : "";

                    return (
                      <tr key={item.id || idx} className="hover:bg-emerald-500/[0.03] transition">
                        <td className="py-3 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300">{item.nis || "-"}</td>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white uppercase">{item.student_name || item.full_name || "-"}</td>
                        <td className="py-3 px-3 text-center font-bold text-slate-600 dark:text-slate-300">{item.kelas || "-"}</td>
                        <td className="py-3 px-3 text-center text-slate-500 font-mono">{item.angkatan || "-"}</td>
                        <td className="py-3 px-3 text-center text-slate-500">{item.kamar || "-"}</td>
                        <td className="py-3 px-4">
                          {reportType === "violations" && (
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white">{item.violation_name || "-"}</p>
                              <p className="text-[11px] text-slate-400">Takzir: {item.sanction || "-"}</p>
                            </div>
                          )}
                          {reportType === "achievements" && (
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white">{item.title || "-"}</p>
                              <p className="text-[11px] text-slate-400">{item.level} • {item.appreciation || "-"}</p>
                            </div>
                          )}
                          {reportType === "students" && (
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white">{item.nama_lengkap_wali || "-"}</p>
                              <p className="text-[11px] text-slate-400 font-mono">WA: {item.no_whatsapp || "-"}</p>
                            </div>
                          )}
                          {reportType === "permissions" && (
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white">{item.category || "-"}</p>
                              <p className="text-[11px] text-slate-400">{item.reason || "-"}</p>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {reportType === "violations" && <span className="px-2 py-0.5 rounded-full text-xs font-mono font-black bg-rose-500/10 text-rose-600">+{item.points || 0}</span>}
                          {reportType === "achievements" && <span className="px-2 py-0.5 rounded-full text-xs font-mono font-black bg-emerald-500/10 text-emerald-600">+{item.reward_points || 0}</span>}
                          {reportType === "students" && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100">{item.status_santri || "Aktif"}</span>}
                          {reportType === "permissions" && (
                            <div className="flex flex-col items-center gap-1">
                              {isLate ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-600 border border-rose-500/30 text-[10px] font-black uppercase tracking-wider">
                                  <AlertTriangle className="h-3 w-3" />
                                  <span>Terlambat</span>
                                </span>
                              ) : wasLate ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 border border-amber-500/30 text-[10px] font-black uppercase tracking-wider">
                                  <AlertTriangle className="h-3 w-3" />
                                  <span>Selesai (Telat)</span>
                                </span>
                              ) : item.status === "back_pondok" || item.status === "completed" ? (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                  Selesai
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-500/10 text-blue-600 border border-blue-500/20">
                                  Izin Aktif
                                </span>
                              )}
                              <span className="text-[10px] text-slate-500 font-medium leading-tight">
                                {timeDetail}
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}