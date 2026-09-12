import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import crypto from "crypto";

const ELECTION_NAME =
  "Pemilihan Ketua KIR Nebula Periode 2026/2027";

// ======================================================
// CEK ADMIN LOGIN
// ======================================================

async function getAdminUser() {
  const cookieStore = await cookies();

  const supabaseAuth =
    createServerClient(
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
                ({
                  name,
                  value,
                  options,
                }) => {
                  cookieStore.set(
                    name,
                    value,
                    options
                  );
                }
              );
            } catch {
              // Tidak masalah jika cookie tidak dapat ditulis.
            }
          },
        },
      }
    );

  const {
    data: { user },
    error,
  } =
    await supabaseAuth.auth.getUser();

  if (error || !user) {
    return null;
  }

  if (
    user.email !==
    "admin@nebula.or.id"
  ) {
    return null;
  }

  return user;
}

// ======================================================
// SUPABASE SERVER
// ======================================================

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

// ======================================================
// GENERATE TOKEN
// ======================================================

function generateToken() {
  return crypto
    .randomBytes(5)
    .toString("hex")
    .toUpperCase();
}

// ======================================================
// HASH TOKEN
// ======================================================

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(token.trim())
    .digest("hex");
}

// ======================================================
// POST
// FINALISASI PEMILIH
// ======================================================

export async function POST(
  request
) {
  try {
    // --------------------------------------------------
    // 1. CEK ADMIN
    // --------------------------------------------------

    const admin =
      await getAdminUser();

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

    // --------------------------------------------------
    // 2. SUPABASE SERVER
    // --------------------------------------------------

    const supabase =
      createServerSupabase();

    // --------------------------------------------------
    // 3. AMBIL ELECTION
    // --------------------------------------------------

    const {
      data: election,
      error: electionError,
    } =
      await supabase
        .from("elections")
        .select(
          "id, name, status"
        )
        .eq(
          "name",
          ELECTION_NAME
        )
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

    // --------------------------------------------------
    // 4. WAJIB DRAFT
    // --------------------------------------------------

    if (
      election.status !==
      "draft"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Pemilih hanya dapat disimpan saat status pemilihan DRAFT.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 5. AMBIL DATA DARI PREVIEW
    // --------------------------------------------------

    const body =
      await request.json();

    const voters =
      body?.voters;

    if (
      !Array.isArray(voters) ||
      voters.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tidak ada data pemilih untuk disimpan.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 6. BATASI JUMLAH DATA
    // --------------------------------------------------

    if (
      voters.length > 2000
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Maksimal 2.000 pemilih dalam satu proses.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 7. AMBIL KATEGORI TERBARU DARI DATABASE
    //
    // Kita tidak sepenuhnya percaya category_id
    // dari browser. Server akan memvalidasinya lagi.
    // --------------------------------------------------

    const {
      data: categories,
      error: categoryError,
    } =
      await supabase
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
        category
      );
    }

    // --------------------------------------------------
    // 8. VALIDASI DATA PREVIEW
    // --------------------------------------------------

    const normalizedVoters =
      [];

    const errors = [];

    const usedNisn =
      new Set();

    for (
      let i = 0;
      i < voters.length;
      i++
    ) {
      const voter =
        voters[i];

      const rowNumber =
        i + 1;

      const nisn =
        String(
          voter?.nisn ??
            ""
        ).trim();

      const nama =
        String(
          voter?.nama ??
            ""
        ).trim();

      const kategori =
        String(
          voter?.kategori ??
            ""
        ).trim();

      if (!nisn) {
        errors.push(
          `Baris ${rowNumber}: NISN kosong.`
        );
        continue;
      }

      if (!nama) {
        errors.push(
          `Baris ${rowNumber}: Nama kosong.`
        );
        continue;
      }

      if (!kategori) {
        errors.push(
          `Baris ${rowNumber}: Kategori kosong.`
        );
        continue;
      }

      const category =
        categoryMap.get(
          kategori.toLowerCase()
        );

      if (!category) {
        errors.push(
          `Baris ${rowNumber}: Kategori "${kategori}" tidak dikenali.`
        );
        continue;
      }

      const normalizedKey =
        nisn.toLowerCase();

      if (
        usedNisn.has(
          normalizedKey
        )
      ) {
        errors.push(
          `Baris ${rowNumber}: NISN "${nisn}" muncul lebih dari satu kali.`
        );
        continue;
      }

      usedNisn.add(
        normalizedKey
      );

      normalizedVoters.push({
        nisn,
        nama,
        kategori:
          category.name,
        category_id:
          category.id,
      });
    }

    if (
      errors.length > 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Data belum dapat disimpan karena masih ada kesalahan.",
          errors,
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 9. CEK NISN YANG SUDAH TERDAFTAR
    // --------------------------------------------------

    const nisnList =
      normalizedVoters.map(
        (voter) =>
          voter.nisn
      );

    const {
      data: existingVoters,
      error: existingError,
    } =
      await supabase
        .from("voters")
        .select(
          "voter_code"
        )
        .eq(
          "election_id",
          election.id
        )
        .in(
          "voter_code",
          nisnList
        );

    if (
      existingError
    ) {
      console.error(
        "Existing voter error:",
        existingError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Gagal memeriksa pemilih yang sudah terdaftar.",
        },
        { status: 500 }
      );
    }

    if (
      existingVoters &&
      existingVoters.length >
        0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Ada NISN yang sudah terdaftar. Periksa kembali data sebelum disimpan.",
          existing:
            existingVoters.map(
              (voter) =>
                voter.voter_code
            ),
        },
        { status: 409 }
      );
    }

    // --------------------------------------------------
    // 10. BUAT TOKEN
    // --------------------------------------------------

    const tokenResults =
      [];

    const insertData =
      [];

    const usedTokenHashes =
      new Set();

    for (
      const voter of
        normalizedVoters
    ) {
      let token = "";
      let tokenHash = "";

      // Pastikan token unik dalam batch
      // dan secara praktis tidak bertabrakan.
      do {
        token =
          generateToken();

        tokenHash =
          hashToken(
            token
          );
      } while (
        usedTokenHashes.has(
          tokenHash
        )
      );

      usedTokenHashes.add(
        tokenHash
      );

      insertData.push({
        election_id:
          election.id,

        voter_code:
          voter.nisn,

        full_name:
          voter.nama,

        category_id:
          voter.category_id,

        token_hash:
          tokenHash,

        has_voted:
          false,
      });

      tokenResults.push({
        nisn:
          voter.nisn,

        nama:
          voter.nama,

        kategori:
          voter.kategori,

        token,
      });
    }

    // --------------------------------------------------
    // 11. SIMPAN SEMUA SEKALIGUS
    //
    // Supabase melakukan satu operasi INSERT.
    // Jika gagal, data tidak dianggap berhasil.
    // --------------------------------------------------

    const {
      data: insertedVoters,
      error: insertError,
    } =
      await supabase
        .from("voters")
        .insert(
          insertData
        )
        .select(
          "id, voter_code, full_name, category_id"
        );

    if (
      insertError
    ) {
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

    // --------------------------------------------------
    // 12. AUDIT LOG
    // --------------------------------------------------

    const {
      error: auditError,
    } =
      await supabase
        .from("audit_logs")
        .insert({
          election_id:
            election.id,

          event_type:
            "voters_finalized",

          metadata: {
            total_saved:
              insertedVoters?.length ||
              0,

            admin_email:
              admin.email,
          },
        });

    if (auditError) {
      console.error(
        "Audit log warning:",
        auditError
      );
    }

    // --------------------------------------------------
    // 13. RESPONSE
    //
    // Token plaintext hanya dikembalikan sekarang.
    // Database tetap hanya menyimpan hash.
    // --------------------------------------------------

    return NextResponse.json({
      success: true,

      message:
        "Data pemilih berhasil disimpan dan token berhasil dibuat.",

      saved:
        insertedVoters?.length ||
        0,

      voters:
        tokenResults,
    });
  } catch (error) {
    console.error(
      "Save voters error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Terjadi kesalahan saat menyimpan data pemilih.",
      },
      { status: 500 }
    );
  }
}
