import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import crypto from "crypto";

const ELECTION_NAME =
  "Pemilihan Ketua KIR Nebula Periode 2026/2027";

// ======================================================
// CEK ADMIN
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
              // Tidak selalu bisa menulis cookie
              // dari Route Handler.
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
// SUPABASE SERVER CLIENT
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
// TOKEN
// ======================================================

function generateToken() {
  /*
   * 10 digit HEX = 40 bit.
   * Contoh:
   * A7F92C18B4
   */
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
// ENCRYPT TOKEN
//
// TOKEN_ENCRYPTION_KEY harus berupa 64 karakter HEX
// = 32 byte = AES-256.
//
// Format penyimpanan:
// iv:authTag:ciphertext
// ======================================================

function getEncryptionKey() {
  const keyHex =
    process.env.TOKEN_ENCRYPTION_KEY;

  if (!keyHex) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY belum tersedia di server."
    );
  }

  if (
    !/^[0-9a-fA-F]{64}$/.test(
      keyHex
    )
  ) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY harus berupa 64 karakter hexadecimal."
    );
  }

  return Buffer.from(
    keyHex,
    "hex"
  );
}

function encryptToken(token) {
  const key =
    getEncryptionKey();

  /*
   * IV 12 byte adalah ukuran yang umum
   * untuk AES-GCM.
   */
  const iv =
    crypto.randomBytes(12);

  const cipher =
    crypto.createCipheriv(
      "aes-256-gcm",
      key,
      iv
    );

  const encrypted = Buffer.concat([
    cipher.update(
      token,
      "utf8"
    ),
    cipher.final(),
  ]);

  const authTag =
    cipher.getAuthTag();

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

// ======================================================
// VALIDASI KATEGORI
// ======================================================

async function getCategoryMap(
  supabase
) {
  const {
    data: categories,
    error,
  } =
    await supabase
      .from("voter_categories")
      .select(
        "id, name, weight"
      );

  if (error) {
    throw new Error(
      "Gagal membaca kategori pemilih."
    );
  }

  const map = new Map();

  for (
    const category of
      categories || []
  ) {
    map.set(
      category.name
        .trim()
        .toLowerCase(),
      category
    );
  }

  return map;
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
    // 2. VALIDASI ENV
    // --------------------------------------------------

    getEncryptionKey();

    // --------------------------------------------------
    // 3. SUPABASE SERVER
    // --------------------------------------------------

    const supabase =
      createServerSupabase();

    // --------------------------------------------------
    // 4. AMBIL ELECTION
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
    // 5. HARUS DRAFT
    // --------------------------------------------------

    if (
      election.status !==
      "draft"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Data pemilih hanya dapat difinalisasi saat status DRAFT.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 6. AMBIL BODY
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
    // 7. BATAS MAKSIMUM
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
    // 8. AMBIL KATEGORI DARI DATABASE
    // --------------------------------------------------

    const categoryMap =
      await getCategoryMap(
        supabase
      );

    // --------------------------------------------------
    // 9. VALIDASI PREVIEW
    // --------------------------------------------------

    const normalizedVoters =
      [];

    const usedNisn =
      new Set();

    const errors = [];

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

      // ------------------------------
      // NISN
      // ------------------------------

      if (!nisn) {
        errors.push(
          `Baris ${rowNumber}: NISN kosong.`
        );
        continue;
      }

      // ------------------------------
      // Nama
      // ------------------------------

      if (!nama) {
        errors.push(
          `Baris ${rowNumber}: Nama kosong.`
        );
        continue;
      }

      // ------------------------------
      // Kategori
      // ------------------------------

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
          `Baris ${rowNumber}: Kategori "${kategori}" tidak ditemukan.`
        );
        continue;
      }

      // ------------------------------
      // Duplikasi NISN dalam batch
      // ------------------------------

      const normalizedNisn =
        nisn.toLowerCase();

      if (
        usedNisn.has(
          normalizedNisn
        )
      ) {
        errors.push(
          `Baris ${rowNumber}: NISN "${nisn}" muncul lebih dari satu kali.`
        );
        continue;
      }

      usedNisn.add(
        normalizedNisn
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
    // 10. CEK NISN YANG SUDAH ADA
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
            "Ada NISN yang sudah terdaftar. Data tersebut tidak boleh disimpan ulang.",
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
    // 11. SIAPKAN TOKEN
    // --------------------------------------------------

    const tokenResults =
      [];

    const insertData =
      [];

    const generatedTokenHashes =
      new Set();

    /*
     * Kita ambil hash token yang sudah ada
     * supaya token baru tidak bertabrakan.
     *
     * Kemungkinan collision sangat kecil,
     * tetapi kita tetap menangani secara eksplisit.
     */

    const {
      data: existingTokenRows,
      error: tokenQueryError,
    } =
      await supabase
        .from("voters")
        .select(
          "token_hash"
        )
        .eq(
          "election_id",
          election.id
        );

    if (
      tokenQueryError
    ) {
      console.error(
        "Existing token query error:",
        tokenQueryError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Gagal memeriksa token yang sudah ada.",
        },
        { status: 500 }
      );
    }

    const existingTokenHashes =
      new Set(
        (existingTokenRows || [])
          .map(
            (row) =>
              row.token_hash
          )
      );

    for (
      const voter of
        normalizedVoters
    ) {
      let token;
      let tokenHash;

      do {
        token =
          generateToken();

        tokenHash =
          hashToken(
            token
          );
      } while (
        existingTokenHashes.has(
          tokenHash
        ) ||
        generatedTokenHashes.has(
          tokenHash
        )
      );

      generatedTokenHashes.add(
        tokenHash
      );

      // ----------------------------------------------
      // ENKRIPSI TOKEN
      // ----------------------------------------------

      const tokenEncrypted =
        encryptToken(
          token
        );

      // ----------------------------------------------
      // DATA DATABASE
      // ----------------------------------------------

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

        token_encrypted:
          tokenEncrypted,

        has_voted:
          false,

        voted_at:
          null,
      });

      // ----------------------------------------------
      // HASIL UNTUK ADMIN
      // Token plaintext hanya keluar sekarang.
      // ----------------------------------------------

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
    // 12. INSERT SEMUA PEMILIH
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
    // 13. AUDIT LOG
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

    if (
      auditError
    ) {
      console.error(
        "Audit log warning:",
        auditError
      );
    }

    // --------------------------------------------------
    // 14. RESPONSE
    // --------------------------------------------------

    return NextResponse.json({
      success: true,

      message:
        "Data pemilih berhasil disimpan dan token tetap berhasil dibuat.",

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
          error.message ||
          "Terjadi kesalahan saat menyimpan data pemilih.",
      },
      { status: 500 }
    );
  }
}
