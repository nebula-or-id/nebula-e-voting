import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import * as XLSX from "xlsx";

const ELECTION_NAME =
  "Pemilihan Ketua KIR Nebula Periode 2026/2027";

async function getAdminUser() {
  const cookieStore = await cookies();

  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },

        setAll(cookiesToSet) {
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
          } catch {}
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabaseAuth.auth.getUser();

  if (error || !user) {
    return null;
  }

  if (user.email !== "admin@nebula.or.id") {
    return null;
  }

  return user;
}

function createServerSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export async function POST(request) {
  try {
    // ==========================================
    // 1. CEK ADMIN
    // ==========================================

    const admin = await getAdminUser();

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda harus login sebagai admin.",
        },
        { status: 401 }
      );
    }

    const supabase =
      createServerSupabase();

    // ==========================================
    // 2. AMBIL ELECTION
    // ==========================================

    const {
      data: election,
      error: electionError,
    } = await supabase
      .from("elections")
      .select("id, name, status")
      .eq("name", ELECTION_NAME)
      .single();

    if (
      electionError ||
      !election
    ) {
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
    // 3. HARUS DRAFT
    // ==========================================

    if (election.status !== "draft") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Import data pemilih hanya dapat dilakukan saat status DRAFT.",
        },
        { status: 400 }
      );
    }

    // ==========================================
    // 4. AMBIL FILE
    // ==========================================

    const formData =
      await request.formData();

    const file =
      formData.get("file");

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          message:
            "File Excel belum dipilih.",
        },
        { status: 400 }
      );
    }

    const fileName =
      String(
        file.name || ""
      ).toLowerCase();

    const allowedExtensions = [
      ".xlsx",
      ".xls",
      ".csv",
    ];

    const validExtension =
      allowedExtensions.some(
        (extension) =>
          fileName.endsWith(
            extension
          )
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
    // 5. BACA EXCEL
    // ==========================================

    const arrayBuffer =
      await file.arrayBuffer();

    const buffer =
      Buffer.from(arrayBuffer);

    const workbook =
      XLSX.read(buffer, {
        type: "buffer",
        raw: false,
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
      workbook.Sheets[
        firstSheetName
      ];

    const rows =
      XLSX.utils.sheet_to_json(
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
    // 6. AMBIL KATEGORI
    // ==========================================

    const {
      data: categories,
      error: categoryError,
    } = await supabase
      .from("voter_categories")
      .select(
        "id, name, weight"
      );

    if (categoryError) {
      console.error(
        "Category error:",
        categoryError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Gagal membaca kategori pemilih.",
        },
        { status: 500 }
      );
    }

    const categoryMap =
      new Map();

    for (
      const category of
        categories || []
    ) {
      categoryMap.set(
        category.name
          .trim()
          .toLowerCase(),
        {
          id: category.id,
          name: category.name,
          weight: category.weight,
        }
      );
    }

    // ==========================================
    // 7. VALIDASI PREVIEW
    // ==========================================

    const preview = [];
    const errors = [];
    const usedCodes =
      new Set();

    for (
      let i = 0;
      i < rows.length;
      i++
    ) {
      const row = rows[i];

      const excelRow =
        i + 2;

      const nisn =
        String(
          row.NISN ?? ""
        ).trim();

      const nama =
        String(
          row.Nama ?? ""
        ).trim();

      const kategori =
        String(
          row.Kategori ?? ""
        ).trim();

      if (!nisn) {
        errors.push(
          `Baris ${excelRow}: NISN kosong.`
        );
        continue;
      }

      if (!nama) {
        errors.push(
          `Baris ${excelRow}: Nama kosong.`
        );
        continue;
      }

      if (!kategori) {
        errors.push(
          `Baris ${excelRow}: Kategori kosong.`
        );
        continue;
      }

      const category =
        categoryMap.get(
          kategori.toLowerCase()
        );

      if (!category) {
        errors.push(
          `Baris ${excelRow}: Kategori "${kategori}" tidak dikenali.`
        );
        continue;
      }

      const normalizedNisn =
        nisn.toLowerCase();

      if (
        usedCodes.has(
          normalizedNisn
        )
      ) {
        errors.push(
          `Baris ${excelRow}: NISN "${nisn}" muncul lebih dari satu kali.`
        );
        continue;
      }

      usedCodes.add(
        normalizedNisn
      );

      preview.push({
        nisn,
        nama,
        kategori:
          category.name,
        category_id:
          category.id,
      });
    }

    // ==========================================
    // 8. JANGAN SIMPAN APA PUN
    // ==========================================

    if (errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Preview gagal karena ada data yang perlu diperbaiki.",
          errors,
        },
        { status: 400 }
      );
    }

    if (!preview.length) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak ada data pemilih yang valid.",
        },
        { status: 400 }
      );
    }

    // ==========================================
    // 9. CEK NISN YANG SUDAH ADA
    // ==========================================

    const nisnList =
      preview.map(
        (voter) =>
          voter.nisn
      );

    const {
      data: existingVoters,
      error: existingError,
    } = await supabase
      .from("voters")
      .select("voter_code")
      .eq(
        "election_id",
        election.id
      )
      .in(
        "voter_code",
        nisnList
      );

    if (existingError) {
      console.error(
        "Existing voter check error:",
        existingError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Gagal memeriksa NISN yang sudah terdaftar.",
        },
        { status: 500 }
      );
    }

    const existingSet =
      new Set(
        (existingVoters || []).map(
          (voter) =>
            voter.voter_code
              .toLowerCase()
        )
      );

    const existing =
      preview
        .filter((voter) =>
          existingSet.has(
            voter.nisn
              .toLowerCase()
          )
        )
        .map(
          (voter) =>
            voter.nisn
        );

    // ==========================================
    // 10. HASIL PREVIEW
    // ==========================================

    return NextResponse.json({
      success: true,
      preview,
      existing,
      total:
        preview.length,
      message:
        "Data berhasil dibaca. Belum ada data yang disimpan dan belum ada token yang dibuat.",
    });
  } catch (error) {
    console.error(
      "Import preview error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Terjadi kesalahan saat membaca file Excel.",
      },
      { status: 500 }
    );
  }
}
