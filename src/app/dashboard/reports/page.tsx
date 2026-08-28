"use client";

// =============================================================================
// 1. IMPORT DEPENDENCIES & ICONS
// =============================================================================
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  Printer,
  ArrowLeft,
  Users,
  ShieldAlert,
  Trophy,
  LogOut,
  Download,
  Sparkles,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  RotateCcw,
  Settings2,
  FileDown,
  Loader2,
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

  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10)
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

  const [loading, setLoading] = useState(false);
  const [rawReportData, setRawReportData] = useState<any[]>([]);

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

  // Custom Visibilitas Kolom
  const [colSettings, setColSettings] = useState({
    classDorm: true,
    violationCategory: true,
    violationSanction: true,
    achievementLevel: true,
    achievementAppreciation: true,
    guardianName: true,
    guardianPhone: true,
    studentStatus: true,
    permissionDeadline: true,
  });

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
    setPdfOrientation("landscape");
  }, [reportType]);

  async function fetchReportData() {
    setLoading(true);
    try {
      const { data: studentsRaw } = await supabase.from("students").select("*");

      const studentsMapByNis: Record<string, any> = {};
      const studentsMapById: Record<string, any> = {};

      (studentsRaw || []).forEach((st: any) => {
        if (st.nis) studentsMapByNis[String(st.nis).trim()] = st;
        if (st.id) studentsMapById[String(st.id).trim()] = st;
      });

      const resolveStudentInfo = (item: any) => {
        const nisKey = item.nis ? String(item.nis).trim() : "";
        const idKey = item.student_id ? String(item.student_id).trim() : "";
        const st = studentsMapByNis[nisKey] || studentsMapById[idKey] || {};

        return {
          kelas: st.kelas || st.class_name || st.class || "-",
          kamar: st.kamar_asrama || st.dorm || st.room || st.asrama || "-",
          konsulat: st.asal_konsulat || st.consulate || st.origin_region || "-",
          namaWali: st.nama_lengkap_wali || st.guardian_name || "-",
          noWali: st.no_whatsapp || st.guardian_phone || st.parent_phone || "-",
          statusSantri: st.status_santri || st.status || "Aktif Mukim",
        };
      };

      if (reportType === "students") {
        const formatted = (studentsRaw || []).map((st: any) => ({
          ...st,
          nis: st.nis || "-",
          full_name: st.full_name || st.name || st.nama || "-",
          kelas: st.kelas || st.class_name || st.class || "-",
          kamar: st.kamar_asrama || st.dorm || st.room || st.asrama || "-",
          konsulat: st.asal_konsulat || st.consulate || st.origin_region || "-",
          nama_lengkap_wali: st.nama_lengkap_wali || st.guardian_name || "-",
          no_whatsapp: st.no_whatsapp || st.guardian_phone || st.parent_phone || "-",
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
          ...resolveStudentInfo(v),
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
          ...resolveStudentInfo(a),
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
          ...resolveStudentInfo(p),
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
    rawReportData.forEach((d) => {
      const val = d.kelas;
      if (val && val !== "-") set.add(val);
    });
    return Array.from(set).sort();
  }, [rawReportData]);

  const availableDorms = useMemo(() => {
    const set = new Set<string>();
    rawReportData.forEach((d) => {
      const val = d.kamar;
      if (val && val !== "-") set.add(val);
    });
    return Array.from(set).sort();
  }, [rawReportData]);

  const availableConsulates = useMemo(() => {
    const set = new Set<string>();
    rawReportData.forEach((d) => {
      const val = d.konsulat;
      if (val && val !== "-") set.add(val);
    });
    return Array.from(set).sort();
  }, [rawReportData]);

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
          item.reason?.toLowerCase().includes(q) ||
          item.nama_lengkap_wali?.toLowerCase().includes(q)
      );
    }

    if (filterClass !== "all") result = result.filter((d) => d.kelas === filterClass);
    if (filterDorm !== "all") result = result.filter((d) => d.kamar === filterDorm);
    if (filterConsulate !== "all") result = result.filter((d) => d.konsulat === filterConsulate);

    if (reportType === "violations") {
      if (filterViolationCategory !== "all") {
        result = result.filter((d) => d.category === filterViolationCategory);
      }
      if (filterViolationStatus !== "all") {
        result = result.filter((d) => d.status === filterViolationStatus);
      }
    }

    if (reportType === "achievements") {
      if (filterAchievementCategory !== "all") {
        result = result.filter((d) => d.category === filterAchievementCategory);
      }
      if (filterAchievementLevel !== "all") {
        result = result.filter((d) => d.level === filterAchievementLevel);
      }
    }

    if (reportType === "students") {
      if (filterStudentStatus !== "all") {
        result = result.filter((d) => d.status_santri === filterStudentStatus);
      }
    }

    if (reportType === "permissions") {
      if (filterPermissionCategory !== "all") {
        result = result.filter((d) => d.category?.includes(filterPermissionCategory));
      }
      if (filterPermissionStatus !== "all") {
        result = result.filter((d) => d.status === filterPermissionStatus);
      }
    }

    result.sort((a, b) => {
      const nameA = a.student_name || a.full_name || "";
      const nameB = b.student_name || b.full_name || "";

      if (sortBy === "name_asc") return nameA.localeCompare(nameB);
      if (sortBy === "name_desc") return nameB.localeCompare(nameA);
      if (sortBy === "nis_asc") return String(a.nis).localeCompare(String(b.nis), undefined, { numeric: true });
      if (sortBy === "nis_desc") return String(b.nis).localeCompare(String(a.nis), undefined, { numeric: true });
      if (sortBy === "points_desc") return (Number(b.points) || Number(b.reward_points) || 0) - (Number(a.points) || Number(a.reward_points) || 0);
      if (sortBy === "points_asc") return (Number(a.points) || Number(a.reward_points) || 0) - (Number(b.points) || Number(b.reward_points) || 0);
      if (sortBy === "date_asc") return new Date(a.created_at || a.event_date).getTime() - new Date(b.created_at || b.event_date).getTime();
      if (sortBy === "date_desc") return new Date(b.created_at || b.event_date).getTime() - new Date(a.created_at || a.event_date).getTime();
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
  // 4. EXPORT EXCEL (.XLSX)
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

      const headerColor =
        reportType === "violations"
          ? "991B1B"
          : reportType === "achievements"
          ? "065F46"
          : reportType === "students"
          ? "064E3B"
          : "047857";

      let headers: string[] = [];
      if (reportType === "violations") {
        headers = ["NO", "NIS", "NAMA SANTRI", "KELAS", "ASRAMA", "KONSULAT", "BENTUK PELANGGARAN", "TINGKAT", "POIN", "SANKSI / TAKZIR", "STATUS"];
      } else if (reportType === "achievements") {
        headers = ["NO", "NIS", "NAMA SANTRI", "KELAS", "ASRAMA", "KONSULAT", "NAMA PRESTASI / CAPAIAN", "TINGKAT", "REWARD POIN", "BENTUK APRESIASI"];
      } else if (reportType === "students") {
        headers = ["NO", "NIS", "NAMA LENGKAP SANTRI", "KELAS", "ASRAMA", "ASAL KONSULAT", "NAMA LENGKAP WALI", "KONTAK WHATSAPP WALI", "STATUS SANTRI"];
      } else if (reportType === "permissions") {
        headers = ["NO", "NIS", "NAMA SANTRI", "KELAS", "ASRAMA", "KONSULAT", "KATEGORI IZIN", "ALASAN / TUJUAN", "TENGGAT KEMBALI", "STATUS PERIZINAN"];
      }

      const totalCols = headers.length;
      const getColumnLetter = (colIndex: number) => {
        let temp = "";
        let num = colIndex;
        while (num > 0) {
          const rem = (num - 1) % 26;
          temp = String.fromCharCode(65 + rem) + temp;
          num = Math.floor((num - 1) / 26);
        }
        return temp;
      };
      const lastColLetter = getColumnLetter(totalCols);

      worksheet.mergeCells(`A1:${lastColLetter}1`);
      worksheet.getCell("A1").value = "PONDOK PESANTREN RIYADLUL 'ULUM WADDA'WAH CONDONG";
      worksheet.getCell("A1").font = { name: "Arial", size: 13, bold: true, color: { argb: "FF064E3B" } };
      worksheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };

      worksheet.mergeCells(`A2:${lastColLetter}2`);
      worksheet.getCell("A2").value = "BAGIAN PENGASUHAN SANTRI - BIRO TARBIYAH & KEDISIPLINAN";
      worksheet.getCell("A2").font = { name: "Arial", size: 10, bold: true, color: { argb: "FF475569" } };
      worksheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };

      worksheet.mergeCells(`A3:${lastColLetter}3`);
      worksheet.getCell("A3").value = `Laporan: ${sheetName.toUpperCase()} • Dicetak: ${new Date().toLocaleDateString("id-ID", { dateStyle: "long" })}`;
      worksheet.getCell("A3").font = { name: "Arial", size: 9, italic: true, color: { argb: "FF64748B" } };
      worksheet.getCell("A3").alignment = { horizontal: "center", vertical: "middle" };

      worksheet.addRow([]);

      const headerRow = worksheet.addRow(headers);
      headerRow.height = 26;

      headerRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF" + headerColor },
        };
        cell.font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FFFFFFFF" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin", color: { argb: "FF000000" } },
          left: { style: "thin", color: { argb: "FF000000" } },
          bottom: { style: "medium", color: { argb: "FF000000" } },
          right: { style: "thin", color: { argb: "FF000000" } },
        };
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
            item.return_target ? new Date(item.return_target).toLocaleString("id-ID") : "-",
            item.status || "-",
          ];
        }

        const row = worksheet.addRow(rowData);
        row.height = 22;

        const isEven = index % 2 === 0;
        row.eachCell((cell, colNumber) => {
          cell.font = { name: "Arial", size: 9 };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };

          if (isEven) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF0FDF4" },
            };
          }

          if (colNumber === 1 || colNumber === 2 || colNumber === 4 || colNumber === 8 || colNumber === 9 || colNumber === totalCols) {
            cell.alignment = { horizontal: "center", vertical: "middle" };
          } else {
            cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
          }
        });
      });

      headers.forEach((headerText, colIndex) => {
        let maxLen = headerText.length;
        for (let r = 5; r <= worksheet.rowCount; r++) {
          const cell = worksheet.getRow(r).getCell(colIndex + 1);
          const valStr = cell.value ? cell.value.toString() : "";
          if (valStr.length > maxLen) {
            maxLen = valStr.length;
          }
        }
        const computedWidth = Math.min(Math.max(maxLen + 3, 10), 32);
        worksheet.getColumn(colIndex + 1).width = computedWidth;
      });

      worksheet.getColumn(1).width = 5;
      worksheet.getColumn(2).width = 12;

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
  // 5. GENERATOR PDF HELPER
  // ===========================================================================
  const createPdfInstance = () => {
    const dataset = filteredData;
    const doc = new jsPDF({
      orientation: pdfOrientation,
      unit: "mm",
      format: pdfPageSize,
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("PONDOK PESANTREN RIYADLUL 'ULUM WADDA'WAH CONDONG", pageWidth / 2, 16, { align: "center" });

    doc.setFontSize(10);
    doc.text("BAGIAN PENGASUHAN SANTRI (BIRO TARBIYAH & KEDISIPLINAN)", pageWidth / 2, 22, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80);
    doc.text(
      "Jl. Condong No. 01, Setianegara, Cibeureum, Kota Tasikmalaya, Jawa Barat 46196 • Website: pesantrencondong.net",
      pageWidth / 2,
      27,
      { align: "center" }
    );

    doc.setDrawColor(0);
    doc.setLineWidth(0.8);
    doc.line(margin, 30, pageWidth - margin, 30);
    doc.setLineWidth(0.2);
    doc.line(margin, 31, pageWidth - margin, 31);

    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);

    const docTitle =
      reportType === "violations"
        ? "REKAPITULASI PELANGGARAN & POIN KEDISIPLINAN SANTRI"
        : reportType === "achievements"
        ? "REKAPITULASI CATATAN PRESTASI & PENGHARGAAN SANTRI"
        : reportType === "students"
        ? "BUKU INDUK DAN MASTER DATA SANTRI AKTIF"
        : "REKAPITULASI PERIZINAN SANTRI";

    doc.text(docTitle, margin, 38);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(70);

    const subtitle =
      reportType !== "students"
        ? `Periode: ${new Date(startDate).toLocaleDateString("id-ID", { dateStyle: "medium" })} s/d ${new Date(endDate).toLocaleDateString("id-ID", { dateStyle: "medium" })}`
        : `Rekap Data Santri Mukim Aktif (${dataset.length} Santri)`;

    doc.text(subtitle, margin, 43);

    doc.text(`No. Dok: BA/SIPS/${new Date().getFullYear()}/0994`, pageWidth - margin, 38, { align: "right" });
    doc.text(`Dicetak: ${new Date().toLocaleDateString("id-ID", { dateStyle: "medium" })}`, pageWidth - margin, 43, {
      align: "right",
    });

    const tableHeaders: string[] = ["NO", "NIS", "NAMA SANTRI"];
    if (colSettings.classDorm) tableHeaders.push("KELAS / ASRAMA / ASAL");

    if (reportType === "violations") {
      tableHeaders.push("BENTUK PELANGGARAN");
      if (colSettings.violationCategory) tableHeaders.push("TINGKAT");
      tableHeaders.push("POIN");
      if (colSettings.violationSanction) tableHeaders.push("SANKSI / TAKZIR");
      tableHeaders.push("STATUS");
    } else if (reportType === "achievements") {
      tableHeaders.push("NAMA PRESTASI / CAPAIAN");
      if (colSettings.achievementLevel) tableHeaders.push("TINGKAT");
      tableHeaders.push("REWARD");
      if (colSettings.achievementAppreciation) tableHeaders.push("BENTUK APRESIASI");
    } else if (reportType === "students") {
      if (colSettings.guardianName) tableHeaders.push("NAMA LENGKAP WALI");
      if (colSettings.guardianPhone) tableHeaders.push("KONTAK WHATSAPP");
      tableHeaders.push("STATUS");
    } else if (reportType === "permissions") {
      tableHeaders.push("KATEGORI & ALASAN");
      if (colSettings.permissionDeadline) tableHeaders.push("TENGGAT KEMBALI");
      tableHeaders.push("STATUS");
    }

    const tableBody = dataset.map((item, index) => {
      const row: string[] = [
        String(index + 1),
        item.nis || "-",
        (item.student_name || item.full_name || item.name || item.nama || "-").toUpperCase(),
      ];

      if (colSettings.classDorm) {
        row.push(`${item.kelas || "-"}\n${item.kamar || "-"} • ${item.konsulat || "-"}`);
      }

      if (reportType === "violations") {
        row.push(item.violation_name || "-");
        if (colSettings.violationCategory) row.push(item.category || "-");
        row.push(`+${item.points || 0}`);
        if (colSettings.violationSanction) row.push(item.sanction || "-");
        row.push(item.status || "-");
      } else if (reportType === "achievements") {
        row.push(item.title || "-");
        if (colSettings.achievementLevel) row.push(item.level || "-");
        row.push(`+${item.reward_points || 0} Poin`);
        if (colSettings.achievementAppreciation) row.push(item.appreciation || "-");
      } else if (reportType === "students") {
        if (colSettings.guardianName) row.push(item.nama_lengkap_wali || "-");
        if (colSettings.guardianPhone) row.push(item.no_whatsapp || "-");
        row.push(item.status_santri || "Aktif");
      } else if (reportType === "permissions") {
        row.push(`${item.category || "-"}\n${item.reason || "-"}`);
        if (colSettings.permissionDeadline) {
          row.push(item.return_target ? new Date(item.return_target).toLocaleString("id-ID") : "-");
        }
        row.push(item.status || "-");
      }

      return row;
    });

    autoTable(doc, {
      startY: 47,
      head: [tableHeaders],
      body: tableBody,
      theme: "grid",
      styles: {
        fontSize: 8,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        cellPadding: 2,
        valign: "middle",
      },
      headStyles: {
        fillColor: [209, 250, 229],
        textColor: [6, 78, 59],
        fontStyle: "bold",
        halign: "center",
        lineWidth: 0.3,
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },
        1: { halign: "center", cellWidth: 24 },
        2: { fontStyle: "bold" },
      },
      margin: { left: margin, right: margin },
      didDrawPage: (data) => {
        const pageCount = (doc as any).internal.getNumberOfPages();
        doc.setFontSize(7.5);
        doc.setTextColor(120);
        doc.text(
          `Halaman ${data.pageNumber} dari ${pageCount} • Sistem Informasi Pengasuhan Santri (SIPS)`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 8,
          { align: "center" }
        );
      },
    });

    return { doc, docTitle };
  };

  const downloadPDF = () => {
    if (filteredData.length === 0) {
      alert("Tidak ada data untuk diekspor ke PDF.");
      return;
    }
    setIsGeneratingPDF(true);
    setTimeout(() => {
      try {
        const { doc, docTitle } = createPdfInstance();
        const fileName = `SIPS_${docTitle.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;
        doc.save(fileName);
        playScanSound("success");
      } finally {
        setIsGeneratingPDF(false);
      }
    }, 150);
  };

  const printDirectly = () => {
    if (filteredData.length === 0) {
      alert("Tidak ada data untuk dicetak.");
      return;
    }
    const { doc } = createPdfInstance();
    doc.autoPrint();
    const pdfBlobUrl = doc.output("bloburl");
    window.open(pdfBlobUrl, "_blank");
  };

  return (
    <div className="w-full space-y-6 font-sans relative pb-20 transition-all duration-300">
      {/* Background Ambience Glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden print:hidden">
        <div className="absolute top-10 right-20 h-96 w-96 rounded-full bg-emerald-500/10 blur-[140px]" />
        <div className="absolute bottom-10 left-20 h-96 w-96 rounded-full bg-teal-500/10 blur-[140px]" />
      </div>

      {/* ================= HEADER HERO BANNER ================= */}
      <div className="relative overflow-hidden rounded-[32px] border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 p-5 sm:p-6 shadow-xl backdrop-blur-2xl print:hidden">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
          <div className="flex items-start sm:items-center space-x-3.5 min-w-0">
            <Link
              href="/dashboard"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-600 hover:border-emerald-500/40 transition active:scale-95 shadow-xs"
              title="Kembali ke Dashboard Utama"
            >
              <ArrowLeft className="h-5 w-5 stroke-[2.4]" />
            </Link>

            <div className="relative flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-700 via-teal-600 to-amber-500 text-white shadow-md shadow-emerald-700/20 font-black">
              <FileSpreadsheet className="h-6 w-6 stroke-[2.3]" />
              <div className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-amber-400 border-2 border-white dark:border-slate-900 animate-ping" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg lg:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Pusat Rekapitulasi &amp; Ekspor Laporan
                </h1>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                  Berita Acara
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed truncate">
                Ekspor Buku Induk, Rekap Pelanggaran, Prestasi, dan Perizinan Santri
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 shrink-0 self-start xl:self-center">
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <button
                type="button"
                onClick={exportToExcel}
                disabled={isExportingExcel}
                className="inline-flex items-center space-x-1.5 rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 px-4 py-2.5 text-xs font-black text-white shadow-md shadow-emerald-700/25 hover:scale-[1.02] active:scale-95 transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
                title="Unduh Spreadsheet Excel Asli"
              >
                {isExportingExcel ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 stroke-[2.5]" />
                )}
                <span>{isExportingExcel ? "Menyiapkan..." : "Excel (.XLSX)"}</span>
              </button>

              <button
                type="button"
                onClick={downloadPDF}
                disabled={isGeneratingPDF}
                className="inline-flex items-center space-x-1.5 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 px-4 py-2.5 text-xs font-black text-white shadow-md shadow-cyan-600/25 hover:scale-[1.02] active:scale-95 transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
                title="Unduh File Dokumen PDF Vektor"
              >
                {isGeneratingPDF ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileDown className="h-3.5 w-3.5 stroke-[2.5]" />
                )}
                <span>{isGeneratingPDF ? "Membuat..." : "Unduh PDF"}</span>
              </button>

              <button
                type="button"
                onClick={printDirectly}
                className="inline-flex items-center space-x-1.5 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 px-4 py-2.5 text-xs font-black text-white shadow-md hover:scale-[1.02] active:scale-95 transition cursor-pointer whitespace-nowrap"
                title="Cetak Langsung ke Printer Kertas"
              >
                <Printer className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>Cetak Dokumen</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/80 px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs shadow-xs">
              <Settings2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <select
                value={pdfOrientation}
                onChange={(e) => setPdfOrientation(e.target.value as PageOrientation)}
                className="bg-transparent font-bold text-[11px] outline-none cursor-pointer text-slate-800 dark:text-white"
                title="Pilih Orientasi Kertas PDF"
              >
                <option value="landscape">Landscape</option>
                <option value="portrait">Portrait</option>
              </select>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <select
                value={pdfPageSize}
                onChange={(e) => setPdfPageSize(e.target.value as PageSize)}
                className="bg-transparent font-bold text-[11px] outline-none cursor-pointer text-slate-800 dark:text-white"
                title="Pilih Ukuran Kertas PDF"
              >
                <option value="a4">A4</option>
                <option value="legal">F4 / Legal</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* TABS UTAMA 4 MODUL */}
      <div className="rounded-[32px] border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 p-3 shadow-lg backdrop-blur-xl print:hidden">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {[
            { key: "violations", label: "Rekap Kedisiplinan", icon: ShieldAlert, color: "text-rose-500" },
            { key: "achievements", label: "Buku Prestasi", icon: Trophy, color: "text-amber-500" },
            { key: "students", label: "Buku Induk Santri", icon: Users, color: "text-emerald-500" },
            { key: "permissions", label: "Rekap Perizinan Santri", icon: LogOut, color: "text-teal-500" },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = reportType === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setReportType(tab.key as ReportType)}
                className={`group flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-black transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-[#064e3b] text-white shadow-xl shadow-emerald-950/20 scale-[1.02]"
                    : "bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/50 hover:bg-slate-100 dark:hover:bg-slate-900"
                }`}
              >
                <div className="flex items-center space-x-2.5 truncate">
                  <Icon className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-110 ${isActive ? "text-emerald-300" : tab.color}`} />
                  <span className="truncate">{tab.label}</span>
                </div>
                {isActive && (
                  <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-bold shrink-0">
                    Aktif
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ================= PANEL FILTER & KUSTOMISASI MODUL ================= */}
      <div className="rounded-[32px] border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 p-5 sm:p-6 shadow-xl backdrop-blur-xl space-y-4 print:hidden animate-in fade-in duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3.5">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-black text-xs uppercase tracking-wider">
            <SlidersHorizontal className="h-4 w-4 text-emerald-600" />
            <span>
              Kustomisasi Filter Laporan:{" "}
              {reportType === "violations" && "Kedisiplinan & Pelanggaran"}
              {reportType === "achievements" && "Prestasi & Apresiasi"}
              {reportType === "students" && "Buku Induk Master Santri"}
              {reportType === "permissions" && "Perizinan Santri"}
            </span>
          </div>

          <button
            type="button"
            onClick={resetAllFilters}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-rose-500 transition cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Filter</span>
          </button>
        </div>

        {/* BARIS 1: PANCARIAN & DROPDOWN FILTER KHUSUS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 text-xs">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kata kunci data..."
              className="h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 pl-10 pr-3 text-xs font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>

          <div>
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer hover:border-slate-400 transition"
            >
              <option value="all">Semua Kelas</option>
              {availableClasses.map((cls) => (
                <option key={cls} value={cls}>
                  Kelas: {cls}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filterDorm}
              onChange={(e) => setFilterDorm(e.target.value)}
              className="h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer hover:border-slate-400 transition"
            >
              <option value="all">Semua Asrama</option>
              {availableDorms.map((dorm) => (
                <option key={dorm} value={dorm}>
                  {dorm}
                </option>
              ))}
            </select>
          </div>

          {reportType === "violations" && (
            <>
              <div>
                <select
                  value={filterViolationCategory}
                  onChange={(e) => setFilterViolationCategory(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer hover:border-slate-400 transition"
                >
                  <option value="all">Semua Kategori</option>
                  <option value="Ringan">Ringan (5-15)</option>
                  <option value="Sedang">Sedang (20-40)</option>
                  <option value="Berat">Berat (≥50 Poin)</option>
                </select>
              </div>
              <div>
                <select
                  value={filterViolationStatus}
                  onChange={(e) => setFilterViolationStatus(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer hover:border-slate-400 transition"
                >
                  <option value="all">Semua Status</option>
                  <option value="Proses">Dalam Proses</option>
                  <option value="Ditindak">Sudah Ditindak</option>
                  <option value="Selesai">Selesai Dibina</option>
                </select>
              </div>
            </>
          )}

          {reportType === "achievements" && (
            <>
              <div>
                <select
                  value={filterAchievementCategory}
                  onChange={(e) => setFilterAchievementCategory(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer hover:border-slate-400 transition"
                >
                  <option value="all">Semua Bidang</option>
                  <option value="Tahfidz / Al-Quran">Tahfidz / Al-Qur&apos;an</option>
                  <option value="Bahasa / Pidato">Bahasa / Pidato</option>
                  <option value="Akademik & Sains">Akademik &amp; Sains</option>
                  <option value="Keorganisasian & Kepemimpinan">Keorganisasian</option>
                  <option value="Olahraga & Seni">Olahraga &amp; Seni</option>
                </select>
              </div>
              <div>
                <select
                  value={filterAchievementLevel}
                  onChange={(e) => setFilterAchievementLevel(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer hover:border-slate-400 transition"
                >
                  <option value="all">Semua Tingkat</option>
                  <option value="Internal Pondok">Internal Pondok</option>
                  <option value="Kabupaten / Kota">Kabupaten / Kota</option>
                  <option value="Provinsi">Provinsi</option>
                  <option value="Nasional">Nasional</option>
                  <option value="Internasional">Internasional</option>
                </select>
              </div>
            </>
          )}

          {reportType === "students" && (
            <>
              <div>
                <select
                  value={filterConsulate}
                  onChange={(e) => setFilterConsulate(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer hover:border-slate-400 transition"
                >
                  <option value="all">Semua Konsulat</option>
                  {availableConsulates.map((con) => (
                    <option key={con} value={con}>
                      {con}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  value={filterStudentStatus}
                  onChange={(e) => setFilterStudentStatus(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer hover:border-slate-400 transition"
                >
                  <option value="all">Semua Status</option>
                  <option value="Aktif Mukim">Aktif Mukim</option>
                  <option value="Skorsing">Skorsing</option>
                  <option value="Alumni / Lulus">Alumni / Lulus</option>
                </select>
              </div>
            </>
          )}

          {reportType === "permissions" && (
            <>
              <div>
                <select
                  value={filterPermissionCategory}
                  onChange={(e) => setFilterPermissionCategory(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer hover:border-slate-400 transition"
                >
                  <option value="all">Semua Jenis Izin</option>
                  <option value="Dekat">Izin Dekat / Komplek</option>
                  <option value="Pulang">Izin Pulang / Jauh</option>
                  <option value="Berobat">Izin Berobat / Medis</option>
                  <option value="Tugas">Izin Tugas Pondok</option>
                </select>
              </div>
              <div>
                <select
                  value={filterPermissionStatus}
                  onChange={(e) => setFilterPermissionStatus(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer hover:border-slate-400 transition"
                >
                  <option value="all">Semua Status</option>
                  <option value="approved">Approved (Disetujui)</option>
                  <option value="out_pondok">Out Pondok (Di Luar)</option>
                  <option value="back_pondok">Back Pondok (Kembali)</option>
                  <option value="completed">Completed (Selesai)</option>
                </select>
              </div>
            </>
          )}
        </div>

        {/* BARIS 2: SORTING & CUSTOM CHECKBOX KOLOM */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-slate-500 font-bold">
              <ArrowUpDown className="h-4 w-4" />
              <span>Urutan:</span>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="default">Terbaru (Default)</option>
              <option value="name_asc">Nama Santri (A - Z)</option>
              <option value="name_desc">Nama Santri (Z - A)</option>
              <option value="nis_asc">NIS (Terkecil - Terbesar)</option>
              {reportType === "violations" && (
                <>
                  <option value="points_desc">Poin Terbanyak</option>
                  <option value="points_asc">Poin Paling Sedikit</option>
                </>
              )}
              {reportType === "achievements" && (
                <>
                  <option value="points_desc">Reward Tertinggi</option>
                  <option value="points_asc">Reward Terendah</option>
                </>
              )}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold text-slate-600 dark:text-slate-400">
            <span>Pilihan Kolom:</span>
            <label className="inline-flex items-center gap-1.5 cursor-pointer hover:text-emerald-600 transition">
              <input
                type="checkbox"
                checked={colSettings.classDorm}
                onChange={(e) => setColSettings({ ...colSettings, classDorm: e.target.checked })}
                className="rounded text-emerald-600"
              />
              <span>Kelas &amp; Asrama</span>
            </label>

            {reportType === "violations" && (
              <>
                <label className="inline-flex items-center gap-1.5 cursor-pointer hover:text-emerald-600 transition">
                  <input
                    type="checkbox"
                    checked={colSettings.violationCategory}
                    onChange={(e) => setColSettings({ ...colSettings, violationCategory: e.target.checked })}
                    className="rounded text-emerald-600"
                  />
                  <span>Tingkat</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer hover:text-emerald-600 transition">
                  <input
                    type="checkbox"
                    checked={colSettings.violationSanction}
                    onChange={(e) => setColSettings({ ...colSettings, violationSanction: e.target.checked })}
                    className="rounded text-emerald-600"
                  />
                  <span>Sanksi</span>
                </label>
              </>
            )}

            {reportType === "achievements" && (
              <>
                <label className="inline-flex items-center gap-1.5 cursor-pointer hover:text-emerald-600 transition">
                  <input
                    type="checkbox"
                    checked={colSettings.achievementLevel}
                    onChange={(e) => setColSettings({ ...colSettings, achievementLevel: e.target.checked })}
                    className="rounded text-emerald-600"
                  />
                  <span>Tingkat</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer hover:text-emerald-600 transition">
                  <input
                    type="checkbox"
                    checked={colSettings.achievementAppreciation}
                    onChange={(e) => setColSettings({ ...colSettings, achievementAppreciation: e.target.checked })}
                    className="rounded text-emerald-600"
                  />
                  <span>Apresiasi</span>
                </label>
              </>
            )}

            {reportType === "students" && (
              <>
                <label className="inline-flex items-center gap-1.5 cursor-pointer hover:text-emerald-600 transition">
                  <input
                    type="checkbox"
                    checked={colSettings.guardianName}
                    onChange={(e) => setColSettings({ ...colSettings, guardianName: e.target.checked })}
                    className="rounded text-emerald-600"
                  />
                  <span>Wali</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer hover:text-emerald-600 transition">
                  <input
                    type="checkbox"
                    checked={colSettings.guardianPhone}
                    onChange={(e) => setColSettings({ ...colSettings, guardianPhone: e.target.checked })}
                    className="rounded text-emerald-600"
                  />
                  <span>Kontak</span>
                </label>
              </>
            )}

            {reportType === "permissions" && (
              <>
                <label className="inline-flex items-center gap-1.5 cursor-pointer hover:text-emerald-600 transition">
                  <input
                    type="checkbox"
                    checked={colSettings.permissionDeadline}
                    onChange={(e) => setColSettings({ ...colSettings, permissionDeadline: e.target.checked })}
                    className="rounded text-emerald-600"
                  />
                  <span>Tenggat</span>
                </label>
              </>
            )}
          </div>

          {reportType !== "students" ? (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 text-[11px] font-bold text-slate-800 dark:text-slate-200 outline-none"
              />
              <span className="text-slate-400 font-bold">s/d</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 text-[11px] font-bold text-slate-800 dark:text-slate-200 outline-none"
              />
            </div>
          ) : null}

          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/20 px-3.5 py-1.5 rounded-full shadow-sm">
            {filteredData.length} Data Terpilih
          </span>
        </div>
      </div>

      {/* ================= PRATINJAU DOKUMEN LAPORAN DI LAYAR ================= */}
      <div className="rounded-[32px] border border-slate-200/90 dark:border-slate-800/90 bg-white shadow-2xl p-8 sm:p-12 text-black overflow-hidden relative">
        {/* KOP SURAT RESMI PESANTREN */}
        <div className="border-b-4 border-double border-black pb-3 mb-5 text-center space-y-1">
          <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-black">
            PONDOK PESANTREN RIYADLUL &apos;ULUM WADDA&apos;WAH CONDONG
          </h2>
          <h3 className="text-xs font-bold tracking-wide uppercase text-black">
            BAGIAN PENGASUHAN SANTRI
          </h3>
          <p className="text-[10px] text-black">
            Jl. Condong No. 01, Setianegara, Cibeureum, Kota Tasikmalaya, Jawa Barat 46196 • Website: pesantrencondong.net
          </p>
        </div>

        {/* JUDUL LAPORAN & NOMOR DOKUMEN */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div>
            <h4 className="text-xs sm:text-sm font-black uppercase text-black">
              {reportType === "violations" && "REKAPITULASI PELANGGARAN & POIN KEDISIPLINAN SANTRI"}
              {reportType === "achievements" && "REKAPITULASI CATATAN PRESTASI & PENGHARGAAN SANTRI"}
              {reportType === "students" && "BUKU INDUK DAN MASTER DATA SANTRI AKTIF"}
              {reportType === "permissions" && "REKAPITULASI PERIZINAN SANTRI"}
            </h4>
            {reportType !== "students" ? (
              <p className="text-[11px] text-black font-medium mt-0.5">
                Periode: {new Date(startDate).toLocaleDateString("id-ID", { dateStyle: "medium" })} s/d{" "}
                {new Date(endDate).toLocaleDateString("id-ID", { dateStyle: "medium" })}
              </p>
            ) : (
              <p className="text-[11px] text-black font-medium mt-0.5">
                Rekap Data Santri Mukim Aktif ({filteredData.length} Santri)
              </p>
            )}
          </div>
          <div className="text-right text-[10px] font-mono text-black">
            <p>No. Dok: BA/SIPS/{new Date().getFullYear()}/0994</p>
            <p>Dicetak: {new Date().toLocaleDateString("id-ID", { dateStyle: "medium" })}</p>
          </div>
        </div>

        {/* TABEL DOKUMEN FORMAL */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs border border-black table-fixed">
            <thead>
              <tr className="bg-emerald-50 text-[10px] uppercase font-black tracking-wider text-[#064e3b] border-b border-black">
                <th className="py-2.5 px-2 text-center border-r border-black w-[5%] font-black">NO</th>
                <th className="py-2.5 px-2 text-center border-r border-black w-[11%] font-black">NIS</th>
                <th className="py-2.5 px-3 text-center border-r border-black w-[21%] font-black">NAMA SANTRI</th>

                {colSettings.classDorm && (
                  <th className="py-2.5 px-2.5 text-center border-r border-black w-[20%] font-black">
                    KELAS / ASRAMA / ASAL
                  </th>
                )}

                {/* Kolom Khusus Pelanggaran */}
                {reportType === "violations" && (
                  <>
                    <th className="py-2.5 px-3 text-center border-r border-black w-[20%] font-black">
                      BENTUK PELANGGARAN
                    </th>
                    {colSettings.violationCategory && (
                      <th className="py-2.5 px-2 text-center border-r border-black w-[8%] font-black">TINGKAT</th>
                    )}
                    <th className="py-2.5 px-2 text-center border-r border-black w-[6%] font-black">POIN</th>
                    {colSettings.violationSanction && (
                      <th className="py-2.5 px-3 text-center border-r border-black w-[19%] font-black">
                        SANKSI / TAKZIR
                      </th>
                    )}
                    <th className="py-2.5 px-2 text-center w-[8%] font-black">STATUS</th>
                  </>
                )}

                {/* Kolom Khusus Prestasi */}
                {reportType === "achievements" && (
                  <>
                    <th className="py-2.5 px-3 text-center border-r border-black w-[22%] font-black">
                      NAMA KEJUARAAN / CAPAIAN
                    </th>
                    {colSettings.achievementLevel && (
                      <th className="py-2.5 px-2 text-center border-r border-black w-[9%] font-black">TINGKAT</th>
                    )}
                    <th className="py-2.5 px-2 text-center border-r border-black w-[9%] font-black">REWARD</th>
                    {colSettings.achievementAppreciation && (
                      <th className="py-2.5 px-3 text-center w-[23%] font-black">BENTUK APRESIASI</th>
                    )}
                  </>
                )}

                {/* Kolom Khusus Buku Induk Santri */}
                {reportType === "students" && (
                  <>
                    {colSettings.guardianName && (
                      <th className="py-2.5 px-3 text-center border-r border-black w-[18%] font-black">
                        NAMA LENGKAP WALI
                      </th>
                    )}
                    {colSettings.guardianPhone && (
                      <th className="py-2.5 px-3 text-center border-r border-black w-[14%] font-black">
                        KONTAK WHATSAPP
                      </th>
                    )}
                    <th className="py-2.5 px-2 text-center w-[10%] font-black">STATUS</th>
                  </>
                )}

                {/* Kolom Khusus Perizinan */}
                {reportType === "permissions" && (
                  <>
                    <th className="py-2.5 px-3 text-center border-r border-black w-[22%] font-black">
                      KATEGORI &amp; ALASAN
                    </th>
                    {colSettings.permissionDeadline && (
                      <th className="py-2.5 px-3 text-center border-r border-black w-[19%] font-black">
                        TENGGAT KEMBALI
                      </th>
                    )}
                    <th className="py-2.5 px-2 text-center w-[20%] font-black">STATUS</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="text-[10px] text-black">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                      <p className="font-bold text-xs">Menyiapkan pratinjau lembar data laporan...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-400">
                    <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-40 text-emerald-600" />
                    <p className="font-bold">Tidak ada catatan data yang sesuai filter.</p>
                  </td>
                </tr>
              ) : (
                filteredData.map((item, index) => (
                  <tr key={item.id || index} className="border-b border-black hover:bg-emerald-50/30 transition-colors">
                    <td className="py-2 px-2 text-center font-mono border-r border-black">{index + 1}</td>
                    <td className="py-2 px-2 text-center font-mono border-r border-black">{item.nis || "-"}</td>
                    <td className="py-2 px-3 font-bold uppercase border-r border-black break-words">
                      {item.student_name || item.full_name || item.name || item.nama || "-"}
                    </td>

                    {colSettings.classDorm && (
                      <td className="py-2 px-2.5 border-r border-black break-words">
                        <p className="font-bold">{item.kelas || "-"}</p>
                        <p className="text-[9px] text-slate-700 font-medium">
                          {item.kamar || "-"} • {item.konsulat || "-"}
                        </p>
                      </td>
                    )}

                    {/* Pelanggaran */}
                    {reportType === "violations" && (
                      <>
                        <td className="py-2 px-3 border-r border-black break-words">
                          {item.violation_name || "-"}
                        </td>
                        {colSettings.violationCategory && (
                          <td className="py-2 px-2 text-center border-r border-black">{item.category || "-"}</td>
                        )}
                        <td className="py-2 px-2 text-center font-bold font-mono border-r border-black">
                          +{item.points || 0}
                        </td>
                        {colSettings.violationSanction && (
                          <td className="py-2 px-3 border-r border-black leading-snug break-words">
                            {item.sanction || "-"}
                          </td>
                        )}
                        <td className="py-2 px-2 text-center font-bold">{item.status || "-"}</td>
                      </>
                    )}

                    {/* Prestasi */}
                    {reportType === "achievements" && (
                      <>
                        <td className="py-2 px-3 font-bold border-r border-black break-words">{item.title || "-"}</td>
                        {colSettings.achievementLevel && (
                          <td className="py-2 px-2 text-center border-r border-black">{item.level || "-"}</td>
                        )}
                        <td className="py-2 px-2 text-center font-bold font-mono border-r border-black whitespace-nowrap">
                          +{item.reward_points || 0} Poin
                        </td>
                        {colSettings.achievementAppreciation && (
                          <td className="py-2 px-3 leading-snug break-words">{item.appreciation || "-"}</td>
                        )}
                      </>
                    )}

                    {/* Santri */}
                    {reportType === "students" && (
                      <>
                        {colSettings.guardianName && (
                          <td className="py-2 px-3 border-r border-black break-words">
                            {item.nama_lengkap_wali || "-"}
                          </td>
                        )}
                        {colSettings.guardianPhone && (
                          <td className="py-2 px-3 font-mono text-center border-r border-black">
                            {item.no_whatsapp || "-"}
                          </td>
                        )}
                        <td className="py-2 px-2 text-center font-bold">{item.status_santri || "Aktif"}</td>
                      </>
                    )}

                    {/* Perizinan */}
                    {reportType === "permissions" && (
                      <>
                        <td className="py-2 px-3 border-r border-black break-words">
                          <p className="font-bold">{item.category || "-"}</p>
                          <p className="text-[9px] text-slate-700">{item.reason || "-"}</p>
                        </td>
                        {colSettings.permissionDeadline && (
                          <td className="py-2 px-3 font-mono text-center border-r border-black">
                            {item.return_target ? new Date(item.return_target).toLocaleString("id-ID") : "-"}
                          </td>
                        )}
                        <td className="py-2 px-2 text-center font-bold">{item.status || "-"}</td>
                      </>
                    )}
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