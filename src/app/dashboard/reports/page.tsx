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
  Calendar,
  ArrowUpDown,
  Clock,
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
type SortOption = "date_desc" | "date_asc" | "name_asc" | "name_desc" | "nis_asc";

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>("permissions");

  // Rentang Waktu Fleksibel
  const [dateRangePreset, setDateRangePreset] = useState<"all" | "today" | "7d" | "month" | "year" | "custom">("all");
  const [startDate, setStartDate] = useState("2026-01-01");
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

  // Pengurutan (Sorting)
  const [sortBy, setSortBy] = useState<SortOption>("date_desc");

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

  // Filter Spesifik Perizinan
  const [filterPermissionCategory, setFilterPermissionCategory] = useState("all");
  const [filterPermissionStatus, setFilterPermissionStatus] = useState("all");

  // Pengaturan Cetak / PDF
  const [pdfOrientation, setPdfOrientation] = useState<PageOrientation>("landscape");
  const [pdfPageSize, setPdfPageSize] = useState<PageSize>("a4");
  const [showPrintSettings, setShowPrintSettings] = useState(false);

  // Dossier States
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
  }, [reportType, startDate, endDate, dateRangePreset]);

  useEffect(() => {
    setSearchQuery("");
    setFilterClass("all");
    setFilterDorm("all");
    setFilterGeneration("all");
    setFilterPermissionCategory("all");
    setFilterPermissionStatus("all");
    setDossierPage(1);
  }, [reportType]);

  const handleDatePresetChange = (preset: "all" | "today" | "7d" | "month" | "year" | "custom") => {
    setDateRangePreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (preset === "all") {
      setStartDate("2020-01-01");
      setEndDate(todayStr);
    } else if (preset === "today") {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "7d") {
      const past7 = new Date();
      past7.setDate(now.getDate() - 7);
      setStartDate(past7.toISOString().slice(0, 10));
      setEndDate(todayStr);
    } else if (preset === "month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      setStartDate(firstDay);
      setEndDate(todayStr);
    } else if (preset === "year") {
      const firstDayYear = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
      setStartDate(firstDayYear);
      setEndDate(todayStr);
    }
  };

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
        nama_lengkap_wali: st.nama_lengkap_wali || st.guardian_name || st.nama_wali || "-",
        no_whatsapp: st.no_whatsapp || st.guardian_phone || st.phone || "-",
        status_santri: st.status_santri || st.status || "Aktif",
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
          namaWali: st.nama_lengkap_wali || st.guardian_name || st.nama_wali || "-",
          noWali: st.no_whatsapp || st.guardian_phone || st.phone || "-",
          statusSantri: st.status_santri || st.status || "Aktif",
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
          namaWali: item.nama_lengkap_wali || "-",
          noWali: item.no_whatsapp || "-",
          statusSantri: "Aktif",
          full_name: item.student_name || item.full_name || item.name || "Santri",
        };

        return {
          kelas: matched.kelas,
          kamar: matched.kamar,
          angkatan: matched.angkatan,
          nama_lengkap_wali: matched.namaWali,
          no_whatsapp: matched.noWali,
          status_santri: matched.statusSantri,
          student_name: item.student_name || item.full_name || item.name || matched.full_name || "Santri",
        };
      };

      if (reportType === "students") {
        setRawReportData(allStudents);
      } else {
        const tableName = reportType === "violations" ? "violations" : reportType === "achievements" ? "achievements" : "permissions";
        let query = supabase.from(tableName).select("*");

        if (dateRangePreset !== "all") {
          query = query.gte("created_at", `${startDate}T00:00:00Z`).lte("created_at", `${endDate}T23:59:59Z`);
        }

        const { data, error } = await query.order("created_at", { ascending: false });
        if (error) throw error;
        setRawReportData((data || []).map((item: any) => ({ ...item, ...resolveInfo(item) })));
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

  const formatShortDateTime = (isoDate?: string) => {
    if (!isoDate) return "-";
    const d = new Date(isoDate);
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).replace(".", ":");
  };

  // Hanya menampilkan selisih durasi jika terlambat; jika normal, biarkan kosong tanpa menduplikasi jam batas kembali
  const getOverdueNote = (item: any) => {
    const now = new Date();
    const returnTarget = new Date(item.return_target);

    if (isOverdueOutside(item)) {
      const diffMs = now.getTime() - returnTarget.getTime();
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHrs / 24);
      const remHrs = diffHrs % 24;
      const timeStr = diffDays > 0 ? `${diffDays} hari ${remHrs} jam` : `${diffHrs} jam`;
      return `Lewat ${timeStr}`;
    }

    if (isCompletedLate(item)) {
      const actualIn = new Date(item.actual_in_at);
      const diffMs = actualIn.getTime() - returnTarget.getTime();
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHrs / 24);
      const remHrs = diffHrs % 24;
      const timeStr = diffDays > 0 ? `${diffDays} hari ${remHrs} jam` : `${diffHrs} jam`;
      return `Terlambat ${timeStr}`;
    }

    if (item.status === "back_pondok" || item.status === "completed") {
      return `Tiba: ${formatShortDateTime(item.actual_in_at)}`;
    }

    return "";
  };

  const filteredData = useMemo(() => {
    let dataset = reportType === "dossier" ? [...allMasterStudents] : [...rawReportData];

    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      dataset = dataset.filter(
        (item) =>
          item.student_name?.toLowerCase().includes(q) ||
          item.full_name?.toLowerCase().includes(q) ||
          item.nis?.toLowerCase().includes(q) ||
          item.violation_name?.toLowerCase().includes(q) ||
          item.title?.toLowerCase().includes(q) ||
          item.reason?.toLowerCase().includes(q)
      );
    }

    if (filterClass !== "all") dataset = dataset.filter((d) => d.kelas === filterClass);
    if (filterDorm !== "all") dataset = dataset.filter((d) => d.kamar === filterDorm);
    if (filterGeneration !== "all") dataset = dataset.filter((d) => d.angkatan === filterGeneration);

    if (reportType === "permissions") {
      if (filterPermissionStatus !== "all") {
        if (filterPermissionStatus === "active_izin") {
          dataset = dataset.filter((p) => p.status === "approved" || (p.status === "out_pondok" && !isOverdueOutside(p)));
        } else if (filterPermissionStatus === "completed") {
          dataset = dataset.filter((p) => (p.status === "back_pondok" || p.status === "completed") && !isCompletedLate(p));
        } else if (filterPermissionStatus === "overdue_outside") {
          dataset = dataset.filter((p) => isOverdueOutside(p));
        } else if (filterPermissionStatus === "completed_late") {
          dataset = dataset.filter((p) => isCompletedLate(p));
        }
      }
      if (filterPermissionCategory !== "all") {
        dataset = dataset.filter((p) => p.category?.toLowerCase().includes(filterPermissionCategory.toLowerCase()));
      }
    }

    dataset.sort((a, b) => {
      const nameA = (a.student_name || a.full_name || "").toLowerCase();
      const nameB = (b.student_name || b.full_name || "").toLowerCase();
      const dateA = new Date(a.departure_target || a.created_at || 0).getTime();
      const dateB = new Date(b.departure_target || b.created_at || 0).getTime();
      const nisA = a.nis || "";
      const nisB = b.nis || "";

      if (sortBy === "date_desc") return dateB - dateA;
      if (sortBy === "date_asc") return dateA - dateB;
      if (sortBy === "name_asc") return nameA.localeCompare(nameB, "id");
      if (sortBy === "name_desc") return nameB.localeCompare(nameA, "id");
      if (sortBy === "nis_asc") return nisA.localeCompare(nisB);
      return 0;
    });

    return dataset;
  }, [rawReportData, allMasterStudents, searchQuery, filterClass, filterDorm, filterGeneration, reportType, filterPermissionStatus, filterPermissionCategory, sortBy]);

  const paginatedDossierStudents = useMemo(() => {
    const start = (dossierPage - 1) * dossierPerPage;
    return filteredData.slice(start, start + dossierPerPage);
  }, [filteredData, dossierPage]);

  const totalDossierPages = Math.ceil(filteredData.length / dossierPerPage);

  const getStudentStatusLabel = (status?: string) => {
    const normalized = status?.trim().toLowerCase();
    const translated: Record<string, string> = {
      active: "Aktif",
      approved: "Disetujui",
      pending: "Menunggu Persetujuan",
      rejected: "Ditolak",
      inactive: "Nonaktif",
    };
    return (normalized && translated[normalized]) || status || "Aktif";
  };

  const handleToggleSelectStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    setSelectedStudentIds(filteredData.map((s) => s.id));
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

  const resetAllFilters = () => {
    setSearchQuery("");
    setDateRangePreset("all");
    setStartDate("2020-01-01");
    setEndDate(new Date().toISOString().slice(0, 10));
    setSortBy("date_desc");
    setFilterClass("all");
    setFilterDorm("all");
    setFilterGeneration("all");
    setFilterPermissionCategory("all");
    setFilterPermissionStatus("all");
    setDossierPage(1);
  };

  // EXPORT EXCEL PROFESIONAL BERSIH (TANPA DUPLIKASI WAKTU)
  const exportToExcel = async () => {
    const dataset = filteredData;
    if (dataset.length === 0) {
      alert("Tidak ada data untuk diekspor.");
      return;
    }

    setIsExportingExcel(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const sheetName = reportType === "violations" ? "Rekap Kedisiplinan" : reportType === "achievements" ? "Buku Prestasi" : reportType === "students" ? "Buku Induk Santri" : "Rekap Perizinan";
      const worksheet = workbook.addWorksheet(sheetName, { views: [{ showGridLines: true }] });

      let headers: string[] = [];
      if (reportType === "permissions") {
        headers = ["NO", "NIS", "NAMA SANTRI", "KELAS", "ANGKATAN", "ASRAMA", "KATEGORI & ALASAN", "WAKTU BERANGKAT", "BATAS KEMBALI", "STATUS GERBANG", "CATATAN"];
      } else if (reportType === "violations") {
        headers = ["NO", "NIS", "NAMA SANTRI", "KELAS", "ANGKATAN", "ASRAMA", "BENTUK PELANGGARAN", "KATEGORI", "POIN", "SANKSI", "STATUS"];
      } else if (reportType === "achievements") {
        headers = ["NO", "NIS", "NAMA SANTRI", "KELAS", "ANGKATAN", "ASRAMA", "NAMA PRESTASI", "TINGKAT", "REWARD POIN", "APRESIASI"];
      } else {
        headers = ["NO", "NIS", "NAMA LENGKAP", "KELAS", "ANGKATAN", "ASRAMA", "NAMA WALI", "WHATSAPP", "STATUS"];
      }

      worksheet.getRow(1).values = headers;
      worksheet.getRow(1).eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF064E3B" } };
        cell.font = { size: 9, bold: true, color: { argb: "FFFFFFFF" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });

      dataset.forEach((item, index) => {
        let rowData: any[] = [];
        if (reportType === "permissions") {
          const isLate = isOverdueOutside(item);
          const wasLate = isCompletedLate(item);
          const stLabel = isLate ? "TERLAMBAT (DI LUAR)" : wasLate ? "SELESAI (TERLAMBAT)" : item.status === "back_pondok" ? "SELESAI" : "IZIN AKTIF";
          rowData = [
            index + 1,
            item.nis || "-",
            (item.student_name || item.full_name || "-").toUpperCase(),
            item.kelas || "-",
            item.angkatan || "-",
            item.kamar || "-",
            `${item.category} (${item.reason})`,
            formatShortDateTime(item.departure_target || item.created_at),
            formatShortDateTime(item.return_target),
            stLabel,
            getOverdueNote(item),
          ];
        } else if (reportType === "violations") {
          rowData = [index + 1, item.nis || "-", (item.student_name || item.full_name || "-").toUpperCase(), item.kelas || "-", item.angkatan || "-", item.kamar || "-", item.violation_name || "-", item.category || "-", Number(item.points) || 0, item.sanction || "-", item.status || "-"];
        } else if (reportType === "achievements") {
          rowData = [index + 1, item.nis || "-", (item.student_name || item.full_name || "-").toUpperCase(), item.kelas || "-", item.angkatan || "-", item.kamar || "-", item.title || "-", item.level || "-", Number(item.reward_points) || 0, item.appreciation || "-"];
        } else {
          rowData = [index + 1, item.nis || "-", (item.full_name || item.name || "-").toUpperCase(), item.kelas || "-", item.angkatan || "-", item.kamar || "-", item.nama_lengkap_wali || "-", item.no_whatsapp ? `'${item.no_whatsapp}` : "-", item.status_santri || "Aktif"];
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

  // EXPORT PDF PROFESIONAL BERSIH (TANPA DUPLIKASI WAKTU)
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
          tableHeaders = ["NO", "NIS", "NAMA LENGKAP", "KELAS", "KEPERLUAN & ALASAN", "WAKTU BERANGKAT", "BATAS KEMBALI", "STATUS GERBANG"];
          tableBody = dataset.map((item, index) => {
            const isLate = isOverdueOutside(item);
            const wasLate = isCompletedLate(item);
            const overdueNote = getOverdueNote(item);
            const stLabel = isLate 
              ? `TERLAMBAT\n(${overdueNote})` 
              : wasLate 
              ? `SELESAI (TELAT)\n(${overdueNote})` 
              : item.status === "back_pondok" 
              ? "SELESAI" 
              : "IZIN AKTIF";

            return [
              String(index + 1),
              item.nis || "-",
              (item.student_name || item.full_name || "-").toUpperCase(),
              item.kelas || "-",
              `${item.category}\nAlasan: ${item.reason}`,
              formatShortDateTime(item.departure_target || item.created_at),
              formatShortDateTime(item.return_target),
              stLabel,
            ];
          });
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
            textColor: [30, 41, 59]
          },
          headStyles: { 
            fillColor: [6, 78, 59], 
            textColor: [255, 255, 255], 
            fontStyle: "bold", 
            halign: "center" 
          },
          columnStyles: { 0: { halign: "center", cellWidth: 8 } },
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

        const pdfBlobUrl = doc.output("bloburl");
        window.open(pdfBlobUrl, "_blank");
        playScanSound("success");
      } finally {
        setIsGeneratingPDF(false);
      }
    }, 100);
  };

  const handleGenerateDossierPDF = async () => {
    if (selectedStudentIds.length === 0) {
      alert("Silakan pilih minimal satu santri.");
      return;
    }
    setIsPreparingPDF(true);
    playScanSound("success");
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;

      for (let i = 0; i < selectedStudentIds.length; i++) {
        const id = selectedStudentIds[i];
        const s = allMasterStudents.find((st) => st.id === id);
        if (!s) continue;
        if (i > 0) doc.addPage();

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(4, 120, 87);
        doc.text("PONDOK PESANTREN CONDONG TASIKMALAYA", pageWidth / 2, 14, { align: "center" });
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text("DOSSIER PERKEMBANGAN SANTRI", pageWidth / 2, 19, { align: "center" });

        doc.setDrawColor(15, 23, 42);
        doc.setLineWidth(0.5);
        doc.line(margin, 23, pageWidth - margin, 23);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(`Nama: ${s.full_name} | NIS: ${s.nis} | Kelas: ${s.kelas} | Kamar: ${s.kamar}`, margin, 30);
      }

      const pdfBlobUrl = doc.output("bloburl");
      window.open(pdfBlobUrl, "_blank");
    } finally {
      setIsPreparingPDF(false);
    }
  };

  return (
    <div className="w-full space-y-4 font-sans relative pb-20">
      {/* ================= HEADER HERO BANNER ================= */}
      <div className="print:hidden relative overflow-hidden rounded-[28px] bg-gradient-to-r from-emerald-950 via-[#064e3b] to-teal-950 p-5 sm:p-6 text-white shadow-lg border border-emerald-500/30">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5 min-w-0">
            <Link
              href="/dashboard"
              aria-label="Kembali ke dasbor"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/20 transition active:scale-90 shadow-sm backdrop-blur-md"
            >
              <ArrowLeft className="h-5 w-5 stroke-[2.4]" />
            </Link>

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-400 via-emerald-500 to-teal-400 text-slate-950 shadow-md font-black">
              <FileSpreadsheet className="h-5 w-5 stroke-[2.3]" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-emerald-200 text-[9px] font-black uppercase tracking-wider backdrop-blur-xl">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  REKAPITULASI TERPADU
                </span>
                <span className="text-[10px] text-emerald-300 font-mono font-bold">
                  {filteredData.length} Data Ditampilkan
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-white mt-0.5 truncate">
                Pusat Laporan &amp; Rekapitulasi
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* ================= TABS 5 MODUL ================= */}
      <div className="print:hidden rounded-2xl border border-slate-200/80 dark:border-emerald-900/40 bg-white dark:bg-[#0c1815] p-1.5 shadow-xs backdrop-blur-xl">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-1.5">
          {[
            { key: "permissions", label: "Rekap Perizinan", icon: LogOut, color: "text-teal-500" },
            { key: "violations", label: "Rekap Kedisiplinan", icon: ShieldAlert, color: "text-rose-500" },
            { key: "achievements", label: "Buku Prestasi", icon: Trophy, color: "text-amber-500" },
            { key: "students", label: "Buku Induk Santri", icon: Users, color: "text-emerald-500" },
            { key: "dossier", label: "Rapor Santri", icon: FileText, color: "text-teal-500" },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = reportType === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setReportType(tab.key as ReportType)}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  isActive
                    ? "bg-emerald-600 text-white shadow-xs font-black"
                    : "bg-slate-50 dark:bg-emerald-950/40 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-emerald-900/30 hover:border-emerald-500/50"
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : tab.color}`} />
                  <span className="truncate">{tab.label}</span>
                </div>
                {isActive && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0 ml-1" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ================= PANEL FILTER & CONTROL (DESAIN SIMPLE & RAPI) ================= */}
      <div className="print:hidden rounded-2xl border border-slate-200/80 dark:border-emerald-900/40 bg-white dark:bg-[#0c1815] p-3.5 sm:p-4 shadow-xs backdrop-blur-xl space-y-3">
        
        {/* BARIS UTAMA: PRESET WAKTU & TOMBOL EKSPOR RINGKAS */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 border-b border-slate-100 dark:border-emerald-900/30 pb-3">
          
          {/* Preset Waktu Minimalis */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5 text-xs">
            <span className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 flex items-center gap-1 mr-1 shrink-0">
              <Calendar className="h-3.5 w-3.5 text-emerald-600" />
              Waktu:
            </span>
            {[
              { id: "all", label: "Semua" },
              { id: "today", label: "Hari Ini" },
              { id: "7d", label: "7 Hari" },
              { id: "month", label: "Bulan Ini" },
              { id: "year", label: "Tahun Ini" },
              { id: "custom", label: "Kustom" },
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleDatePresetChange(preset.id as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  dateRangePreset === preset.id
                    ? "bg-emerald-600 text-white font-bold"
                    : "bg-slate-100 dark:bg-emerald-950/40 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Tombol Aksi Ekspor Rapi */}
          <div className="flex items-center gap-1.5 shrink-0 self-end lg:self-auto">
            {reportType === "dossier" ? (
              <button
                type="button"
                onClick={handleGenerateDossierPDF}
                disabled={selectedStudentIds.length === 0 || isPreparingPDF}
                className="inline-flex items-center space-x-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-black text-white shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isPreparingPDF ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5 stroke-[2.5]" />}
                <span>Cetak Rapor ({selectedStudentIds.length})</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={exportToExcel}
                  disabled={isExportingExcel}
                  className="inline-flex items-center space-x-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-black text-white shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
                  title="Unduh Spreadsheet Excel (.xlsx)"
                >
                  {isExportingExcel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5 stroke-[2.5]" />}
                  <span>Excel</span>
                </button>

                <button
                  type="button"
                  onClick={downloadPDF}
                  disabled={isGeneratingPDF}
                  className="inline-flex items-center space-x-1 rounded-xl bg-teal-600 hover:bg-teal-500 px-3 py-1.5 text-xs font-black text-white shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
                  title="Buka Pratinjau PDF"
                >
                  {isGeneratingPDF ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5 stroke-[2.5]" />}
                  <span>PDF</span>
                </button>

                <button
                  type="button"
                  aria-label="Pengaturan cetak"
                  onClick={() => setShowPrintSettings(!showPrintSettings)}
                  className={`h-7 w-7 flex items-center justify-center rounded-lg border transition cursor-pointer ${
                    showPrintSettings 
                      ? "bg-amber-500 text-slate-950 border-amber-500" 
                      : "border-slate-200 dark:border-emerald-900/40 text-slate-500 hover:bg-slate-100"
                  }`}
                  title="Pengaturan Format PDF"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={resetAllFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:text-rose-500 transition cursor-pointer bg-slate-100 dark:bg-emerald-950/30 rounded-xl"
              title="Atur ulang filter"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* FORMAT CETAK PDF POPOVER */}
        {showPrintSettings && reportType !== "dossier" && (
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/20 flex flex-wrap items-center gap-2.5 text-xs">
            <span className="text-emerald-800 dark:text-emerald-300 font-bold">Kertas PDF:</span>
            <select
              value={pdfOrientation}
              onChange={(e) => setPdfOrientation(e.target.value as PageOrientation)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-emerald-800 rounded-lg px-2 py-0.5 text-xs font-semibold outline-none"
            >
              <option value="landscape">Mendatar (Landscape)</option>
              <option value="portrait">Tegak (Portrait)</option>
            </select>
            <select
              value={pdfPageSize}
              onChange={(e) => setPdfPageSize(e.target.value as PageSize)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-emerald-800 rounded-lg px-2 py-0.5 text-xs font-semibold outline-none"
            >
              <option value="a4">A4</option>
              <option value="legal">F4 / Legal</option>
            </select>
          </div>
        )}

        {/* INPUT TANGGAL KUSTOM JIKA DIPILIH */}
        {dateRangePreset === "custom" && (
          <div className="flex items-center gap-2 text-xs flex-wrap bg-slate-50 dark:bg-slate-900/40 p-2 rounded-xl border border-slate-100 dark:border-emerald-900/30">
            <span className="text-slate-500 font-semibold">Dari:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-200 outline-none"
            />
            <span className="text-slate-500 font-semibold">Hingga:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-200 outline-none"
            />
          </div>
        )}

        {/* DROPDOWN FILTER & SEARCH */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari santri, NIS, atau kata kunci..."
              className="h-9 w-full rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 pl-8 pr-3 text-xs font-semibold outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <select
              value={filterClass}
              onChange={(e) => {
                setFilterClass(e.target.value);
                if (reportType === "dossier") handleSelectByClass(e.target.value);
              }}
              className="h-9 w-full rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 px-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
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
              className="h-9 w-full rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 px-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
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
                className="h-9 w-full rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 px-2.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 outline-none cursor-pointer"
              >
                <option value="all">Semua Status Izin</option>
                <option value="active_izin">Izin Aktif (Di Luar)</option>
                <option value="completed">Selesai (Tepat Waktu)</option>
                <option value="overdue_outside">Terlambat (Di Luar)</option>
                <option value="completed_late">Terlambat (Kembali)</option>
              </select>
            </div>
          )}

          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="h-9 w-full rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 px-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
            >
              <option value="date_desc">Waktu Terbaru</option>
              <option value="date_asc">Waktu Terlama</option>
              <option value="name_asc">Nama (A - Z)</option>
              <option value="name_desc">Nama (Z - A)</option>
              <option value="nis_asc">Nomor NIS</option>
            </select>
          </div>
        </div>
      </div>

      {/* ================= TAMPILAN TABEL DATA BERSIH ================= */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-emerald-900/40 bg-white dark:bg-[#0c1815] shadow-xs backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-emerald-900/40 bg-slate-50/90 dark:bg-emerald-950/40 text-[11px] font-black uppercase tracking-wider text-slate-500">
                <th className="py-3 px-3 w-10 text-center">NO</th>
                <th className="py-3 px-3 w-24 text-center">NIS</th>
                <th className="py-3 px-3 font-black">NAMA LENGKAP SANTRI</th>
                <th className="py-3 px-2 text-center w-20">KELAS</th>
                <th className="py-3 px-2 text-center w-20">KAMAR</th>
                {reportType === "permissions" ? (
                  <>
                    <th className="py-3 px-3 font-black">KATEGORI &amp; ALASAN</th>
                    <th className="py-3 px-3 font-black w-36">WAKTU BERANGKAT</th>
                    <th className="py-3 px-3 font-black w-36">BATAS KEMBALI</th>
                    <th className="py-3 px-3 text-center w-36">STATUS GERBANG</th>
                  </>
                ) : (
                  <>
                    <th className="py-3 px-3 text-center w-24">ANGKATAN</th>
                    <th className="py-3 px-4 font-black">
                      {reportType === "violations" && "PELANGGARAN & SANKSI"}
                      {reportType === "achievements" && "PRESTASI & APRESIASI"}
                      {reportType === "students" && "WALI SANTRI & KONTAK"}
                    </th>
                    <th className="py-3 px-3 text-center w-32">
                      {reportType === "violations" || reportType === "achievements" ? "POIN" : "STATUS"}
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-emerald-900/30 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-emerald-600 mb-1.5" />
                    <span>Sinkronisasi data laporan...</span>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400 text-xs">
                    Tidak ada catatan data yang cocok dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                filteredData.map((item, idx) => {
                  const isLate = reportType === "permissions" ? isOverdueOutside(item) : false;
                  const wasLate = reportType === "permissions" ? isCompletedLate(item) : false;
                  const overdueNote = reportType === "permissions" ? getOverdueNote(item) : "";

                  return (
                    <tr key={item.id || idx} className="hover:bg-emerald-500/[0.02] transition">
                      <td className="py-2.5 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300">{item.nis || "-"}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white uppercase truncate max-w-[180px]">
                        {item.student_name || item.full_name || "-"}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-slate-600 dark:text-slate-300">{item.kelas || "-"}</td>
                      <td className="py-2.5 px-2 text-center text-slate-500">{item.kamar || "-"}</td>

                      {reportType === "permissions" ? (
                        <>
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-900 dark:text-white block">{item.category}</span>
                            <span className="text-[11px] text-slate-500 block truncate max-w-[200px]">Alasan: {item.reason}</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 font-semibold">
                              <Clock className="h-3 w-3 text-teal-600" />
                              {formatShortDateTime(item.departure_target || item.created_at)}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 font-semibold ${isLate ? "text-rose-600 font-bold" : "text-slate-600 dark:text-slate-300"}`}>
                              <Clock className="h-3 w-3 text-amber-500" />
                              {formatShortDateTime(item.return_target)}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              {isLate ? (
                                <>
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-600 text-[10px] font-black uppercase tracking-wider">
                                    <AlertTriangle className="h-2.5 w-2.5" />
                                    <span>Terlambat</span>
                                  </span>
                                  {overdueNote && (
                                    <span className="text-[10px] text-rose-500 font-bold">
                                      {overdueNote}
                                    </span>
                                  )}
                                </>
                              ) : wasLate ? (
                                <>
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 text-[10px] font-black uppercase tracking-wider">
                                    <span>Selesai (Telat)</span>
                                  </span>
                                  {overdueNote && (
                                    <span className="text-[10px] text-amber-600 font-bold">
                                      {overdueNote}
                                    </span>
                                  )}
                                </>
                              ) : item.status === "back_pondok" || item.status === "completed" ? (
                                <>
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-600">
                                    Selesai
                                  </span>
                                  {overdueNote && (
                                    <span className="text-[10px] text-slate-400 font-medium">
                                      {overdueNote}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-500/10 text-blue-600">
                                  Izin Aktif
                                </span>
                              )}
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-2.5 px-3 text-center text-slate-500 font-mono">{item.angkatan || "-"}</td>
                          <td className="py-2.5 px-4">
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
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {reportType === "violations" && <span className="px-2 py-0.5 rounded-full text-xs font-mono font-black bg-rose-500/10 text-rose-600">+{item.points || 0}</span>}
                            {reportType === "achievements" && <span className="px-2 py-0.5 rounded-full text-xs font-mono font-black bg-emerald-500/10 text-emerald-600">+{item.reward_points || 0}</span>}
                            {reportType === "students" && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100">{item.status_santri || "Aktif"}</span>}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}