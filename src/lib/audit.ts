import { supabase } from "@/lib/supabase";

interface LogPayload {
  action: string;
  target_type: string;
  target_id?: string;
  details?: Record<string, any>;
}

export async function recordAuditLog({
  action,
  target_type,
  target_id,
  details = {},
}: LogPayload) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    let userName = "Petugas Sistem";
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, name")
        .eq("id", user.id)
        .maybeSingle();
      
      userName = profile?.full_name || profile?.name || user.email || "Petugas";
    }

    await supabase.from("audit_logs").insert({
      user_id: user?.id || null,
      user_name: userName,
      action,
      target_type,
      target_id: target_id ? String(target_id) : null,
      details,
    });
  } catch (err) {
    console.warn("Gagal merekam audit log:", err);
  }
}