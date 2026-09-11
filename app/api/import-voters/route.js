import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import crypto from "crypto";
import * as XLSX from "xlsx";

function generateToken() {
  return crypto
    .randomBytes(5)
    .toString("hex")
    .toUpperCase();
}

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(token.trim())
    .digest("hex");
}

export async function POST(request) {
  try {
    const cookieStore = await cookies();

    // ==========================================
    // 1. CEK LOGIN ADMIN
    // ==========================================

    const authSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
        cookies: {
          async getAll() {
            return cookieStore.getAll();
          },

          async setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(
                ({ name, value, options }) => {
                  cookieStore.set(
                    name,
                    value,
                    options
                  );
                }
              );
            } catch {
              // Tidak masalah jika cookie tidak dapat diubah
            }
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await authSupabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          message: "Anda harus login sebagai admin.",
        },
        { status: 401 }
      );
    }

    // Untuk sementara hanya akun admin ini
    if (user.email !== "admin@nebula.or.id") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki izin sebagai admin.",
        },
        { status: 403 }
      );
    }

    // ==========================================
    // 2. CEK KONFIGURASI
    // ==========================================

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseSecretKey =
      process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseSecretKey) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Konfigurasi Supabase belum tersedia.",
        },
        { status: 500 }
      );
    }

    // Server-only Supabase client
    const supabase = createClient(
      supabaseUrl,
      supabaseSecretKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // ==========================================
    // 3. CARI ELECTION
    // ==========================================

    const electionName =
      "Pemilihan Ketua KIR Nebula Periode 2026/2027";

    const {
      data: election,
      error: electionError,
    } = await supabase
      .from("elections")
      .select("id, name, status")
      .eq("name", electionName)
      .single();

    if (electionError || !election) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Data pemilihan tidak ditemukan.",
        },
        { status: 404 }
      );
    }

    // ==========================================
    // 4. PEMILIHAN HARUS DALAM STATUS DRAFT
    // ==========================================

    if (election.status !== "draft") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Import pemilih hanya dapat dilakukan saat status pemilihan DRAFT.",
        },
        { status: 400 }
      );
    }

    // ==========================================
    // 5. AMBIL FILE EXCEL
    // ==========================================

    const formData = await request.formData();

    const file = formData.get("file");

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          message: "File Excel belum dipilih.",
        },
        { status: 400 }
      );
    }

    // Batasi tipe file
    const fileName = file.name?.toLowerCase() || "";

    const allowedExtensions = [
      ".xlsx",
      ".xls",
      ".csv",
    ];

    const validExtension =
      allowedExtensions.some((ext) =>
        fileName.endsWith(ext)
      );

    if (!validExtension) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Format file harus .xlsx, .xls, atau .csv.",
        },
        { status: 400 }
      );
    }

    // ==========================================
    // 6. BACA FILE EXCEL
    // ==========================================

    const arrayBuffer = await file.arrayBuffer();

    const buffer = Buffer.from(arrayBuffer);

    const workbook = XLSX.read(buffer, {
      type: "buffer",
    });

    const firstSheetName =
      workbook.SheetNames[0];

    if (!firstSheetName) {
      return NextResponse.json(
        {
          success: false,
          message:
            "File Excel tidak memiliki sheet.",
        },
        { status: 400 }
      );
    }

    const worksheet =
      workbook.Sheets[firstSheetName];

    const rows = XLSX.utils.sheet_to_json(
      worksheet,
      {
        defval: "",
        raw: false,
      }
    );

    if (!rows.length) {
      return NextResponse.json(
        {
          success: false,
          message:
            "File Excel tidak memiliki data.",
        },
        { status: 400 }
      );
    }

    // ==========================================
    // 7. CARI KATEGORI PEMILIH
    // ==========================================

    const {
      data: categories,
      error: categoryError,
    } = await supabase
      .from("voter_categories")
      .select("id, name, weight");

    if (categoryError) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Gagal membaca kategori pemilih.",
        },
        { status: 500 }
      );
    }

    const categoryMap = new Map();

    for (const category of categories || []) {
      categoryMap.set(
        category.name.trim().toLowerCase(),
        category.id
      );
    }

    // ==========================================
    // 8. VALIDASI DAN SIAPKAN DATA
    // ==========================================

    const preparedVoters = [];
    const errors = [];
    const usedCodes = new Set();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      const excelRowNumber = i + 2;

      const voterCode = String(
        row.NISN ?? ""
      ).trim();

      const fullName = String(
        row.Nama ?? ""
      ).trim();

      const categoryName = String(
        row.Kategori ?? ""
      ).trim();

      // Cek data wajib
      if (!voterCode) {
        errors.push(
          `Baris ${excelRowNumber}: NISN kosong.`
        );
        continue;
      }

      if (!fullName) {
        errors.push(
          `Baris ${excelRowNumber}: Nama kosong.`
        );
        continue;
      }

      if (!categoryName) {
        errors.push(
          `Baris ${excelRowNumber}: Kategori kosong.`
        );
        continue;
      }

      // Cek kategori
      const categoryId =
        categoryMap.get(
          categoryName.toLowerCase()
        );

      if (!categoryId) {
        errors.push(
          `Baris ${excelRowNumber}: Kategori "${categoryName}" tidak dikenali.`
        );
        continue;
      }

      // Cek duplikasi di file Excel
      const normalizedCode =
        voterCode.toLowerCase();

      if (usedCodes.has(normalizedCode)) {
        errors.push(
          `Baris ${excelRowNumber}: NISN "${voterCode}" muncul lebih dari satu kali.`
        );
        continue;
      }

      usedCodes.add(normalizedCode);

      // Buat token
      const token = generateToken();

      preparedVoters.push({
        election_id: election.id,
        voter_code: voterCode,
        full_name: fullName,
        category_id: categoryId,
        token_hash: hashToken(token),
        has_voted: false,
        token,
      });
    }

    // ==========================================
    // 9. HENTIKAN JIKA ADA ERROR VALIDASI
    // ==========================================

    if (errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Import dibatalkan karena terdapat kesalahan pada file.",
          errors,
        },
        { status: 400 }
      );
    }

    if (preparedVoters.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak ada data pemilih yang dapat diimport.",
        },
        { status: 400 }
      );
    }

    // ==========================================
    // 10. CEK NISN YANG SUDAH ADA
    // ==========================================

    const codes = preparedVoters.map(
      (voter) => voter.voter_code
    );

    const {
      data: existingVoters,
      error: existingError,
    } = await supabase
      .from("voters")
      .select("voter_code")
      .eq("election_id", election.id)
      .in("voter_code", codes);

    if (existingError) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Gagal memeriksa data pemilih yang sudah ada.",
        },
        { status: 500 }
      );
    }

    if (
      existingVoters &&
      existingVoters.length > 0
    ) {
      const existingCodes =
        existingVoters.map(
          (voter) => voter.voter_code
        );

      return NextResponse.json(
        {
          success: false,
          message:
            "Import dibatalkan karena ada NISN yang sudah terdaftar.",
          existing: existingCodes,
        },
        { status: 409 }
      );
    }

    // ==========================================
    // 11. INSERT DATA PEMILIH
    // ==========================================

    const insertData =
      preparedVoters.map((voter) => ({
        election_id: voter.election_id,
        voter_code: voter.voter_code,
        full_name: voter.full_name,
        category_id: voter.category_id,
        token_hash: voter.token_hash,
        has_voted: false,
      }));

    const {
      data: insertedVoters,
      error: insertError,
    } = await supabase
      .from("voters")
      .insert(insertData)
      .select(
        "id, voter_code, full_name, category_id"
      );

    if (insertError) {
      console.error(
        "Insert voters error:",
        insertError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Gagal menyimpan data pemilih: " +
            insertError.message,
        },
        { status: 500 }
      );
    }

    // ==========================================
    // 12. SIAPKAN TOKEN UNTUK ADMIN
    // ==========================================

    const tokenResults =
      preparedVoters.map((voter) => ({
        nisn: voter.voter_code,
        nama: voter.full_name,
        token: voter.token,
      }));

    // ==========================================
    // 13. SIMPAN AUDIT LOG
    // ==========================================

    await supabase
      .from("audit_logs")
      .insert({
        election_id: election.id,
        event_type: "voters_imported",
        metadata: {
          total_imported:
            insertedVoters?.length || 0,
        },
      });

    // ==========================================
    // 14. RESPONSE
    // ==========================================

    return NextResponse.json({
      success: true,
      message:
        "Data pemilih berhasil diimport.",
      imported:
        insertedVoters?.length || 0,
      voters: tokenResults,
    });
  } catch (error) {
    console.error(
      "Import voters unexpected error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Terjadi kesalahan pada server saat import.",
      },
      { status: 500 }
    );
  }
}
