"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { GraduationCap, MapPin, CheckCircle2, ShieldAlert } from "lucide-react";

function VerifySantriContent() {
  const searchParams = useSearchParams();
  const studentId = searchParams.get("id");
  const studentNis = searchParams.get("nis");

  const [student, setStudent] = useState<any>(null);
  const [activePermit, setActivePermit] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getStudentData() {
      if (!studentId && !studentNis) return;
      try {
        let query = supabase.from("students").select("*");
        if (studentId) query = query.eq("id", studentId);
        else if (studentNis) query = query.eq("nis", studentNis);

        const { data, error } = await query.single();
        if (error) throw error;
        setStudent(data);

        // Cek status izin aktif
        const { data: permitData } = await supabase
          .from("permissions")
          .select("*")
          .eq("student_id", data.id)
          .in("status", ["approved", "out_pondok"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        setActivePermit(permitData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    getStudentData();
  }, [studentId, studentNis]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white font-sans text-xs">
        Memverifikasi identitas santri...
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white font-sans p-4 text-center">
        <div className="max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-2">
          <ShieldAlert className="h-10 w-10 text-rose-500 mx-auto" />
          <h2 className="font-bold text-sm">Santri Tidak Ditemukan</h2>
          <p className="text-xs text-slate-400">Barcode tidak terdaftar dalam database resmi SIPS.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans p-4 flex items-center justify-center">
      <div className="w-full max-w-sm rounded-[28px] border border-cyan-500/30 bg-slate-900 p-6 shadow-2xl space-y-4 text-center">
        <div className="flex items-center justify-center space-x-2 border-b border-slate-800 pb-3">
          <GraduationCap className="h-5 w-5 text-cyan-400" />
          <span className="font-bold text-xs uppercase tracking-wider text-slate-200">Verifikasi Resmi Santri</span>
        </div>

        <div className="w-24 h-32 mx-auto rounded-2xl overflow-hidden border-2 border-cyan-500/40 bg-slate-950 flex items-center justify-center shadow-lg">
          {student.photo_url || student.avatar_url ? (
            <img
              src={student.photo_url || student.avatar_url}
              alt={student.name || student.nama_lengkap}
              className="h-full w-full object-cover object-top"
            />
          ) : (
            <span className="font-black text-2xl text-cyan-400">
              {(student.name || student.nama_lengkap || "S").charAt(0)}
            </span>
          )}
        </div>

        <div>
          <h3 className="font-black text-base text-white">{student.name || student.nama_lengkap}</h3>
          <p className="font-mono text-xs text-cyan-400 font-bold mt-0.5">NIS: {student.nis}</p>
          <p className="text-xs text-slate-400 mt-1">{student.class || student.kelas} • {student.dorm || student.kamar_asrama}</p>
        </div>

        {/* Status Izin Real-time */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3 text-xs space-y-1 text-left">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Status Perizinan Gerbang:</span>
          {activePermit ? (
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Memiliki Izin Aktif ({activePermit.category})</span>
            </div>
          ) : (
            <p className="font-semibold text-slate-400">Tidak ada izin keluar pondok aktif</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifySantriPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white font-sans text-xs">
          Memuat verifikasi santri...
        </div>
      }
    >
      <VerifySantriContent />
    </Suspense>
  );
}