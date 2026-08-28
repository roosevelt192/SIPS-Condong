/**
 * Format payload standar QR Code yang dihasilkan oleh seluruh modul SIPS
 */
export function generateStandardQRPayload(student: { nis: string; id?: string }) {
  // Standar resmi payload QR SIPS: NIS murni
  return student.nis.trim();
}

/**
 * Parser serbaguna (Universal Extractor)
 * Mampu membaca segala jenis format QR yang pernah dicetak/dibuat di web SIPS
 */
export function parseQRCodeText(rawText: string): {
  searchKey: string;
  nis?: string;
  id?: string;
} {
  if (!rawText) return { searchKey: "" };

  const raw = rawText.trim();
  let detectedNis = "";
  let detectedId = "";

  // 1. Format URL (contoh: https://domain.com/verify?nis=12345 atau /students/UUID)
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const url = new URL(raw);
      detectedNis = url.searchParams.get("nis") || url.searchParams.get("student_nis") || "";
      detectedId = url.searchParams.get("id") || url.searchParams.get("student_id") || "";

      if (!detectedNis && !detectedId) {
        const segments = url.pathname.split("/").filter(Boolean);
        const lastSegment = segments[segments.length - 1] || "";
        if (lastSegment.length > 20 && lastSegment.includes("-")) {
          detectedId = lastSegment;
        } else {
          detectedNis = lastSegment;
        }
      }
    } catch {
      // fallback
    }
  }
  // 2. Format JSON (contoh: {"nis": "20260001"} atau {"student_id": "..."})
  else if (raw.startsWith("{") && raw.endsWith("}")) {
    try {
      const parsed = JSON.parse(raw);
      detectedNis = parsed.nis || parsed.NIS || parsed.student_nis || "";
      detectedId = parsed.id || parsed.ID || parsed.student_id || "";
    } catch {
      // fallback
    }
  }
  // 3. Format Prefix KTS (contoh: KTS-20260001, SIPS:20260001, SAN_20260001)
  else if (/^(KTS|SIPS|SAN)[-_:]/i.test(raw)) {
    detectedNis = raw.replace(/^(KTS|SIPS|SAN)[-_:]/i, "").trim();
  }
  // 4. Format UUID vs Plain NIS
  else {
    if (raw.length > 20 && raw.includes("-")) {
      detectedId = raw;
    } else {
      detectedNis = raw;
    }
  }

  const searchKey = (detectedNis || detectedId || raw).trim();
  return { searchKey, nis: detectedNis, id: detectedId };
}