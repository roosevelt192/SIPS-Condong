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
  ArrowUpDown,
  RotateCcw,
  Settings2,
  FileDown,
  Loader2,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { playScanSound } from "@/lib/feedback";

type ReportType = "violations" | "achievements" | "students" | "permissions";
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
  const [filterConsulate, setFilterConsulate] = useState("all");

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

  // Sorting
  const [sortBy, setSortBy] = useState<string>("default");

  // Pengaturan Cetak / PDF
  const [pdfOrientation, setPdfOrientation] = useState<PageOrientation>("landscape");
  const [pdfPageSize, setPdfPageSize] = useState<PageSize>("a4");
  const [showPrintSettings, setShowPrintSettings] = useState(false);

  useEffect(() => {
    fetchMasterStudents();
  }, []);

  useEffect(() => {
    fetchReportData();
  }, [reportType, startDate, endDate]);

  useEffect(() => {
    setSearchQuery("");
    setFilterClass("all");
    setFilterDorm("all");
    setFilterConsulate("all");
    setFilterViolationCategory("all");
    setFilterViolationStatus("all");
    setFilterAchievementCategory("all");
    setFilterAchievementLevel("all");
    setFilterStudentStatus("all");
    setFilterPermissionCategory("all");
    setFilterPermissionStatus("all");
    setSortBy("default");
  }, [reportType]);

  // Pengambilan Master Santri Penuh (>1000 Data)
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

      const studentsMapByNis: Record<string, any> = {};
      const studentsMapById: Record<string, any> = {};

      allStudents.forEach((st: any) => {
        const normalizedSt = {
          id: String(st.id || ""),
          nis: String(st.nis || st.nomor_induk || "-").trim(),
          full_name: (st.full_name || st.name || st.nama || st.nama_lengkap || "Santri").trim(),
          kelas: (st.kelas || st.class_name || st.class || st.rombel || "-").trim(),
          kamar: (st.kamar_asrama || st.dorm || st.room || st.asrama || "-").trim(),
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
          konsulat: item.konsulat || item.consulate || "Pusat",
          namaWali: item.nama_lengkap_wali || "-",
          noWali: item.no_whatsapp || "-",
          statusSantri: "Aktif Mukim",
          full_name: item.student_name || item.full_name || item.name || "Santri",
        };

        return {
          kelas: matched.kelas,
          kamar: matched.kamar,
          konsulat: matched.konsulat,
          nama_lengkap_wali: matched.namaWali,
          no_whatsapp: matched.noWali,
          status_santri: matched.statusSantri,
          student_name: item.student_name || item.full_name || item.name || matched.full_name || "Santri",
        };
      };

      if (reportType === "students") {
        const formatted = allStudents.map((st: any) => ({
          ...st,
          nis: st.nis || st.nomor_induk || "-",
          full_name: st.full_name || st.name || st.nama || st.nama_lengkap || "-",
          kelas: st.kelas || st.class_name || st.class || st.rombel || "-",
          kamar: st.kamar_asrama || st.dorm || st.room || st.asrama || "-",
          konsulat: st.asal_konsulat || st.consulate || st.origin_region || "Pusat",
          nama_lengkap_wali: st.nama_lengkap_wali || st.guardian_name || "-",
          no_whatsapp: st.no_whatsapp || st.guardian_phone || "-",
          status_santri: st.status_santri || st.status || "Aktif Mukim",
        }));
        setRawReportData(formatted);
      } else if (reportType === "violations") {
        const { data, error } = await supabase
          .from("violations")
          .select("*")
          .gte("created_at", `${startDate}T00:00:00Z`)
          .lte("created_at", `${endDate}T23:59:59Z`)
          .order("created_at", { ascending: false });
        if (error) throw error;

        const enriched = (data || []).map((v: any) => ({
          ...v,
          ...resolveInfo(v),
        }));
        setRawReportData(enriched);
      } else if (reportType === "achievements") {
        const { data, error } = await supabase
          .from("achievements")
          .select("*")
          .gte("created_at", `${startDate}T00:00:00Z`)
          .lte("created_at", `${endDate}T23:59:59Z`)
          .order("created_at", { ascending: false });
        if (error) throw error;

        const enriched = (data || []).map((a: any) => ({
          ...a,
          ...resolveInfo(a),
        }));
        setRawReportData(enriched);
      } else if (reportType === "permissions") {
        const { data, error } = await supabase
          .from("permissions")
          .select("*")
          .gte("created_at", `${startDate}T00:00:00Z`)
          .lte("created_at", `${endDate}T23:59:59Z`)
          .order("created_at", { ascending: false });
        if (error) throw error;

        const enriched = (data || []).map((p: any) => ({
          ...p,
          ...resolveInfo(p),
        }));
        setRawReportData(enriched);
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

  const availableConsulates = useMemo(() => {
    const set = new Set<string>();
    allMasterStudents.forEach((st) => {
      if (st.konsulat && st.konsulat !== "-") set.add(st.konsulat);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "id"));
  }, [allMasterStudents]);

  const filteredData = useMemo(() => {
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

    if (filterClass !== "all") {
      result = result.filter((d) => d.kelas === filterClass);
    }
    if (filterDorm !== "all") {
      result = result.filter((d) => d.kamar === filterDorm);
    }
    if (filterConsulate !== "all") {
      result = result.filter((d) => d.konsulat === filterConsulate);
    }

    if (reportType === "violations") {
      if (filterViolationCategory !== "all") result = result.filter((d) => d.category === filterViolationCategory);
      if (filterViolationStatus !== "all") result = result.filter((d) => d.status === filterViolationStatus);
    }

    if (reportType === "achievements") {
      if (filterAchievementCategory !== "all") result = result.filter((d) => d.category === filterAchievementCategory);
      if (filterAchievementLevel !== "all") result = result.filter((d) => d.level === filterAchievementLevel);
    }

    if (reportType === "students") {
      if (filterStudentStatus !== "all") result = result.filter((d) => d.status_santri === filterStudentStatus);
    }

    if (reportType === "permissions") {
      if (filterPermissionCategory !== "all") result = result.filter((d) => d.category?.includes(filterPermissionCategory));
      if (filterPermissionStatus !== "all") result = result.filter((d) => d.status === filterPermissionStatus);
    }

    result.sort((a, b) => {
      const nameA = a.student_name || a.full_name || "";
      const nameB = b.student_name || b.full_name || "";

      if (sortBy === "name_asc") return nameA.localeCompare(nameB);
      if (sortBy === "name_desc") return nameB.localeCompare(nameA);
      if (sortBy === "nis_asc") return String(a.nis).localeCompare(String(b.nis), undefined, { numeric: true });
      if (sortBy === "points_desc") return (Number(b.points) || Number(b.reward_points) || 0) - (Number(a.points) || Number(a.reward_points) || 0);
      return 0;
    });

    return result;
  }, [
    rawReportData,
    searchQuery,
    filterClass,
    filterDorm,
    filterConsulate,
    filterViolationCategory,
    filterViolationStatus,
    filterAchievementCategory,
    filterAchievementLevel,
    filterStudentStatus,
    filterPermissionCategory,
    filterPermissionStatus,
    sortBy,
    reportType,
  ]);

  const resetAllFilters = () => {
    setSearchQuery("");
    setFilterClass("all");
    setFilterDorm("all");
    setFilterConsulate("all");
    setFilterViolationCategory("all");
    setFilterViolationStatus("all");
    setFilterAchievementCategory("all");
    setFilterAchievementLevel("all");
    setFilterStudentStatus("all");
    setFilterPermissionCategory("all");
    setFilterPermissionStatus("all");
    setSortBy("default");
  };

  // ===========================================================================
  // EXPORT EXCEL PROFESIONAL (.XLSX)
  // ===========================================================================
  const exportToExcel = async () => {
    const dataset = filteredData;
    if (dataset.length === 0) {
      alert("Tidak ada data untuk diekspor.");
      return;
    }

    setIsExportingExcel(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "SIPS Pesantren Condong";
      workbook.created = new Date();

      const sheetName =
        reportType === "violations"
          ? "Rekap Kedisiplinan"
          : reportType === "achievements"
          ? "Buku Prestasi"
          : reportType === "students"
          ? "Buku Induk Santri"
          : "Perizinan Santri";

      const worksheet = workbook.addWorksheet(sheetName, {
        views: [{ showGridLines: true }],
      });

      let headers: string[] = [];
      if (reportType === "violations") {
        headers = ["NO", "NIS", "NAMA SANTRI", "KELAS", "ASRAMA", "KONSULAT", "BENTUK PELANGGARAN", "KATEGORI", "POIN", "SANKSI / TAKZIR", "STATUS"];
      } else if (reportType === "achievements") {
        headers = ["NO", "NIS", "NAMA SANTRI", "KELAS", "ASRAMA", "KONSULAT", "NAMA PRESTASI / CAPAIAN", "TINGKAT", "REWARD POIN", "APRESIASI"];
      } else if (reportType === "students") {
        headers = ["NO", "NIS", "NAMA LENGKAP SANTRI", "KELAS", "ASRAMA", "KONSULAT", "NAMA WALI", "WHATSAPP WALI", "STATUS"];
      } else if (reportType === "permissions") {
        headers = ["NO", "NIS", "NAMA SANTRI", "KELAS", "ASRAMA", "KONSULAT", "KATEGORI", "ALASAN", "TENGGAT KEMBALI", "STATUS"];
      }

      const lastColIndex = headers.length;

      // Header Kop Formal
      worksheet.mergeCells(1, 1, 1, lastColIndex);
      const titleCell = worksheet.getCell(1, 1);
      titleCell.value = "PONDOK PESANTREN RIYADLUL 'ULUM WADDA'WAH CONDONG";
      titleCell.font = { name: "Segoe UI", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
      titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF064E3B" } };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };

      worksheet.mergeCells(2, 1, 2, lastColIndex);
      const subTitleCell = worksheet.getCell(2, 1);
      subTitleCell.value = `LAPORAN RESMI: ${sheetName.toUpperCase()} • Dicetak: ${new Date().toLocaleDateString("id-ID", { dateStyle: "full" })}`;
      subTitleCell.font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "FF065F46" } };
      subTitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } };
      subTitleCell.alignment = { horizontal: "center", vertical: "middle" };

      worksheet.getRow(1).height = 24;
      worksheet.getRow(2).height = 18;
      worksheet.addRow([]);

      worksheet.getRow(4).values = headers;
      const headerRow = worksheet.getRow(4);
      headerRow.height = 24;

      headerRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF047857" } };
        cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });

      dataset.forEach((item, index) => {
        let rowData: any[] = [];
        if (reportType === "violations") {
          rowData = [
            index + 1,
            item.nis || "-",
            (item.student_name || item.full_name || "-").toUpperCase(),
            item.kelas || "-",
            item.kamar || "-",
            item.konsulat || "-",
            item.violation_name || "-",
            item.category || "-",
            Number(item.points) || 0,
            item.sanction || "-",
            item.status || "-",
          ];
        } else if (reportType === "achievements") {
          rowData = [
            index + 1,
            item.nis || "-",
            (item.student_name || item.full_name || "-").toUpperCase(),
            item.kelas || "-",
            item.kamar || "-",
            item.konsulat || "-",
            item.title || "-",
            item.level || "-",
            Number(item.reward_points) || 0,
            item.appreciation || "-",
          ];
        } else if (reportType === "students") {
          rowData = [
            index + 1,
            item.nis || "-",
            (item.full_name || item.name || "-").toUpperCase(),
            item.kelas || "-",
            item.kamar || "-",
            item.konsulat || "-",
            item.nama_lengkap_wali || "-",
            item.no_whatsapp ? `'${item.no_whatsapp}` : "-",
            item.status_santri || "Aktif Mukim",
          ];
        } else if (reportType === "permissions") {
          rowData = [
            index + 1,
            item.nis || "-",
            (item.student_name || item.full_name || "-").toUpperCase(),
            item.kelas || "-",
            item.kamar || "-",
            item.konsulat || "-",
            item.category || "-",
            item.reason || "-",
            item.return_target ? new Date(item.return_target).toLocaleDateString("id-ID") : "-",
            item.status || "-",
          ];
        }

        const row = worksheet.addRow(rowData);
        row.height = 20;

        const isEven = index % 2 === 0;
        row.eachCell((cell, colNumber) => {
          cell.font = { name: "Segoe UI", size: 8.5 };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: isEven ? "FFFFFFFF" : "FFF8FAFC" },
          };
          if ([1, 2, 4, 8, 9, lastColIndex].includes(colNumber)) {
            cell.alignment = { horizontal: "center", vertical: "middle" };
          } else {
            cell.alignment = { horizontal: "left", vertical: "middle" };
          }
        });
      });

      worksheet.columns = headers.map((h) => ({ width: Math.max(h.length + 5, 12) }));
      worksheet.getColumn(1).width = 6;
      worksheet.getColumn(2).width = 14;
      worksheet.getColumn(3).width = 28;

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(blob, `SIPS_${sheetName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      playScanSound("success");
    } finally {
      setIsExportingExcel(false);
    }
  };

  // ===========================================================================
  // GENERATOR PDF RESMI
  // ===========================================================================
  const downloadPDF = () => {
    const dataset = filteredData;
    if (dataset.length === 0) {
      alert("Tidak ada data untuk diekspor ke PDF.");
      return;
    }
    setIsGeneratingPDF(true);
    setTimeout(() => {
      try {
        const doc = new jsPDF({
          orientation: pdfOrientation,
          unit: "mm",
          format: pdfPageSize,
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 12;

        // Kop Formal
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("PONDOK PESANTREN CONDONG", pageWidth / 2, 14, { align: "center" });

        doc.setFontSize(9);
        doc.text("BAGIAN PENGASUHAN SANTRI - PUSAT LAPORAN & REKAPITULASI", pageWidth / 2, 19, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100);
        doc.text("Cibeureum, Kota Tasikmalaya, Jawa Barat - Telp. (0265) 331578", pageWidth / 2, 23, { align: "center" });

        doc.setDrawColor(0);
        doc.setLineWidth(0.6);
        doc.line(margin, 25, pageWidth - margin, 25);

        doc.setTextColor(0);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);

        const docTitle =
          reportType === "violations"
            ? "LAPORAN REKAPITULASI PELANGGARAN & KEDISIPLINAN SANTRI"
            : reportType === "achievements"
            ? "LAPORAN REKAPITULASI PRESTASI & PENGHARGAAN SANTRI"
            : reportType === "students"
            ? "BUKU INDUK DAN MASTER DATA SANTRI MUKIM"
            : "LAPORAN REKAPITULASI PERIZINAN SANTRI";

        doc.text(docTitle, margin, 31);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.text(`Total: ${dataset.length} Data • Dicetak: ${new Date().toLocaleDateString("id-ID", { dateStyle: "full" })}`, margin, 35);

        let tableHeaders: string[] = ["NO", "NIS", "NAMA SANTRI", "KELAS", "KAMAR"];
        if (reportType === "violations") {
          tableHeaders = [...tableHeaders, "BENTUK PELANGGARAN", "KATEGORI", "POIN", "STATUS"];
        } else if (reportType === "achievements") {
          tableHeaders = [...tableHeaders, "NAMA KEJUARAAN / PRESTASI", "TINGKAT", "POIN", "APRESIASI"];
        } else if (reportType === "students") {
          tableHeaders = [...tableHeaders, "KONSULAT", "NAMA WALI", "WHATSAPP", "STATUS"];
        } else if (reportType === "permissions") {
          tableHeaders = [...tableHeaders, "KATEGORI", "ALASAN", "TENGGAT", "STATUS"];
        }

        const tableBody = dataset.map((item, index) => {
          const base = [
            String(index + 1),
            item.nis || "-",
            (item.student_name || item.full_name || "-").toUpperCase(),
            item.kelas || "-",
            item.kamar || "-",
          ];

          if (reportType === "violations") {
            return [...base, item.violation_name || "-", item.category || "-", `+${item.points || 0}`, item.status || "-"];
          } else if (reportType === "achievements") {
            return [...base, item.title || "-", item.level || "-", `+${item.reward_points || 0}`, item.appreciation || "-"];
          } else if (reportType === "students") {
            return [...base, item.konsulat || "-", item.nama_lengkap_wali || "-", item.no_whatsapp || "-", item.status_santri || "Aktif"];
          } else {
            return [...base, item.category || "-", item.reason || "-", item.return_target ? new Date(item.return_target).toLocaleDateString("id-ID") : "-", item.status || "-"];
          }
        });

        autoTable(doc, {
          startY: 38,
          head: [tableHeaders],
          body: tableBody,
          theme: "grid",
          styles: { fontSize: 7, cellPadding: 1.5, valign: "middle" },
          headStyles: { fillColor: [6, 78, 59], textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
          columnStyles: {
            0: { halign: "center", cellWidth: 8 },
            1: { halign: "center", cellWidth: 18 },
            2: { fontStyle: "bold" },
            3: { halign: "center" },
            4: { halign: "center" },
          },
          margin: { left: margin, right: margin },
        });

        const fileName = `SIPS_Laporan_${reportType}_${new Date().toISOString().slice(0, 10)}.pdf`;
        doc.save(fileName);
        playScanSound("success");
      } finally {
        setIsGeneratingPDF(false);
      }
    }, 100);
  };

  return (
    <div className="w-full space-y-5 font-sans relative pb-20">
      {/* ================= HEADER HERO BANNER ================= */}
      <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-r from-emerald-950 via-[#064e3b] to-teal-950 p-5 sm:p-7 text-white shadow-xl border border-emerald-500/40">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5 min-w-0">
            <Link
              href="/dashboard"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white hover:bg-white/20 transition active:scale-90 shadow-sm backdrop-blur-md"
              title="Kembali ke Dashboard Utama"
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

          {/* Action Buttons Ringkas */}
          <div className="flex items-center gap-2 self-end md:self-auto shrink-0 flex-wrap">
            <button
              type="button"
              onClick={exportToExcel}
              disabled={isExportingExcel}
              className="inline-flex items-center space-x-1.5 rounded-2xl bg-emerald-400 hover:bg-emerald-300 px-3.5 py-2 text-xs font-black text-slate-950 shadow-md transition active:scale-95 cursor-pointer disabled:opacity-50"
              title="Unduh Spreadsheet Excel Asli"
            >
              {isExportingExcel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5 stroke-[2.5]" />}
              <span>Excel</span>
            </button>

            <button
              type="button"
              onClick={downloadPDF}
              disabled={isGeneratingPDF}
              className="inline-flex items-center space-x-1.5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 px-3.5 py-2 text-xs font-black text-slate-950 shadow-md transition active:scale-95 cursor-pointer disabled:opacity-50"
              title="Unduh Dokumen PDF Resmi"
            >
              {isGeneratingPDF ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5 stroke-[2.5]" />}
              <span>PDF</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPrintSettings(!showPrintSettings)}
              className="h-9 w-9 flex items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white transition cursor-pointer"
              title="Pengaturan Format PDF"
            >
              <Settings2 className="h-4 w-4 text-amber-300" />
            </button>
          </div>
        </div>

        {/* Popover Pengaturan Kertas PDF */}
        {showPrintSettings && (
          <div className="mt-3 pt-3 border-t border-white/15 flex flex-wrap items-center gap-3 text-xs">
            <span className="text-slate-300 font-bold">Format PDF:</span>
            <select
              value={pdfOrientation}
              onChange={(e) => setPdfOrientation(e.target.value as PageOrientation)}
              className="bg-black/40 border border-white/20 rounded-xl px-2.5 py-1 text-white text-xs font-semibold outline-none cursor-pointer"
            >
              <option value="landscape" className="bg-slate-900">Landscape (Mendatar)</option>
              <option value="portrait" className="bg-slate-900">Portrait (Tegak)</option>
            </select>
            <select
              value={pdfPageSize}
              onChange={(e) => setPdfPageSize(e.target.value as PageSize)}
              className="bg-black/40 border border-white/20 rounded-xl px-2.5 py-1 text-white text-xs font-semibold outline-none cursor-pointer"
            >
              <option value="a4" className="bg-slate-900">Ukuran A4</option>
              <option value="legal" className="bg-slate-900">Ukuran F4 / Legal</option>
            </select>
          </div>
        )}
      </div>

      {/* ================= TABS 4 MODUL LAPORAN ================= */}
      <div className="rounded-3xl border border-slate-200/80 dark:border-emerald-900/40 bg-white/90 dark:bg-[#0c1815] p-2.5 shadow-sm backdrop-blur-xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { key: "violations", label: "Rekap Kedisiplinan", icon: ShieldAlert, color: "text-rose-500" },
            { key: "achievements", label: "Buku Prestasi", icon: Trophy, color: "text-amber-500" },
            { key: "students", label: "Buku Induk Santri", icon: Users, color: "text-emerald-500" },
            { key: "permissions", label: "Rekap Perizinan", icon: LogOut, color: "text-teal-500" },
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

      {/* ================= PANEL FILTER MULTIFUNGSI ================= */}
      <div className="rounded-3xl border border-slate-200/80 dark:border-emerald-900/40 bg-white/90 dark:bg-[#0c1815] p-4 sm:p-5 shadow-sm backdrop-blur-xl space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-emerald-900/30 pb-3">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-black text-xs uppercase tracking-wider">
            <SlidersHorizontal className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Kustomisasi Parameter Data</span>
          </div>

          <button
            type="button"
            onClick={resetAllFilters}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-rose-500 transition cursor-pointer self-start sm:self-auto"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Filter</span>
          </button>
        </div>

        {/* Baris Input Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2.5 text-xs">
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
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
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
              onChange={(e) => setFilterDorm(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 px-3 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="all">Semua Asrama</option>
              {availableDorms.map((dorm) => (
                <option key={dorm} value={dorm}>{dorm}</option>
              ))}
            </select>
          </div>

          {/* Filter Khusus Per Modul */}
          {reportType === "violations" && (
            <div>
              <select
                value={filterViolationCategory}
                onChange={(e) => setFilterViolationCategory(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 px-3 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value="all">Semua Kategori Pelanggaran</option>
                <option value="Ringan">Ringan (5-15)</option>
                <option value="Sedang">Sedang (20-40)</option>
                <option value="Berat">Berat (≥50)</option>
              </select>
            </div>
          )}

          {reportType === "achievements" && (
            <div>
              <select
                value={filterAchievementLevel}
                onChange={(e) => setFilterAchievementLevel(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 px-3 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value="all">Semua Tingkat Prestasi</option>
                <option value="Internal Pondok">Internal Pondok</option>
                <option value="Kabupaten / Kota">Kabupaten / Kota</option>
                <option value="Provinsi">Provinsi</option>
                <option value="Nasional">Nasional</option>
                <option value="Internasional">Internasional</option>
              </select>
            </div>
          )}

          {reportType === "students" && (
            <div>
              <select
                value={filterConsulate}
                onChange={(e) => setFilterConsulate(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 px-3 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value="all">Semua Konsulat</option>
                {availableConsulates.map((con) => (
                  <option key={con} value={con}>{con}</option>
                ))}
              </select>
            </div>
          )}

          {reportType === "permissions" && (
            <div>
              <select
                value={filterPermissionStatus}
                onChange={(e) => setFilterPermissionStatus(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 px-3 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value="all">Semua Status Izin</option>
                <option value="approved">Disetujui</option>
                <option value="out_pondok">Di Luar Pondok</option>
                <option value="back_pondok">Kembali</option>
              </select>
            </div>
          )}
        </div>

        {/* Rentang Tanggal & Urutan */}
        {reportType !== "students" && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100 dark:border-emerald-900/30 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-400">Periode:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 rounded-lg border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 px-2 text-xs font-bold"
              />
              <span className="text-slate-400">s/d</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 rounded-lg border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 px-2 text-xs font-bold"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-400">Urut:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-8 rounded-lg border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-emerald-950/30 px-2 text-xs font-bold"
              >
                <option value="default">Default</option>
                <option value="name_asc">Nama (A - Z)</option>
                <option value="name_desc">Nama (Z - A)</option>
                <option value="nis_asc">NIS (Terkecil)</option>
                <option value="points_desc">Poin Tertinggi</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ================= TABEL PRATINJAU DATA ELEGAN ================= */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 dark:border-emerald-900/40 bg-white/90 dark:bg-[#0c1815] shadow-xl backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-emerald-900/40 bg-slate-50/90 dark:bg-emerald-950/40 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3.5 px-3 w-12 text-center">NO</th>
                <th className="py-3.5 px-3 w-24 text-center">NIS</th>
                <th className="py-3.5 px-4 font-black">NAMA LENGKAP SANTRI</th>
                <th className="py-3.5 px-3 text-center w-24">KELAS</th>
                <th className="py-3.5 px-3 text-center w-28">KAMAR</th>
                <th className="py-3.5 px-4 font-black">
                  {reportType === "violations" && "BENTUK PELANGGARAN & SANKSI"}
                  {reportType === "achievements" && "PRESTASI & APRESIASI"}
                  {reportType === "students" && "WALI SANTRI & KONTAK"}
                  {reportType === "permissions" && "KATEGORI & ALASAN IZIN"}
                </th>
                <th className="py-3.5 px-3 text-center w-24">
                  {reportType === "violations" || reportType === "achievements" ? "POIN" : "STATUS"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-emerald-900/30 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-emerald-600 mb-2" />
                    <span>Sinkronisasi data laporan dari database...</span>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                    Tidak ada catatan data yang cocok dengan kriteria filter yang dipilih.
                  </td>
                </tr>
              ) : (
                filteredData.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-emerald-500/[0.03] transition">
                    <td className="py-3 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300">{item.nis || "-"}</td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white uppercase">
                      {item.student_name || item.full_name || "-"}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-600 dark:text-slate-300">{item.kelas || "-"}</td>
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
                      {reportType === "violations" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-black bg-rose-500/10 text-rose-600 border border-rose-500/20">
                          +{item.points || 0}
                        </span>
                      )}
                      {reportType === "achievements" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-black bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          +{item.reward_points || 0}
                        </span>
                      )}
                      {reportType === "students" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 dark:bg-emerald-950/40 text-slate-700 dark:text-slate-300">
                          {item.status_santri || "Aktif"}
                        </span>
                      )}
                      {reportType === "permissions" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 dark:bg-emerald-950/40 text-slate-700 dark:text-slate-300">
                          {item.status || "Proses"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}