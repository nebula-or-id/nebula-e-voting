import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

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
              // Tidak masalah jika cookie
              // tidak dapat ditulis.
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
// CLIENT SUPABASE SERVER
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
// GET DAFTAR PEMILIH
// ======================================================

export async function GET() {
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
        {
          status: 401,
        }
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
        {
          status: 404,
        }
      );
    }

    // --------------------------------------------------
    // 4. AMBIL PEMILIH
    //
    // TOKEN SENGAJA TIDAK DIAMBIL.
    // token_hash dan token_encrypted juga
    // tidak dikirim ke browser.
    // --------------------------------------------------

    const {
      data: voters,
      error: voterError,
    } =
      await supabase
        .from("voters")
        .select(
          `
          id,
          voter_code,
          full_name,
          category_id,
          has_voted,
          voted_at,
          created_at,
          voter_categories (
            id,
            name,
            weight
          )
          `
        )
        .eq(
          "election_id",
          election.id
        )
        .order(
          "created_at",
          {
            ascending: true,
          }
        );

    if (
      voterError
    ) {
      console.error(
        "Get voters error:",
        voterError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Gagal mengambil daftar pemilih.",
        },
        {
          status: 500,
        }
      );
    }

    // --------------------------------------------------
    // 5. BENTUK DATA YANG AMAN DIKIRIM KE ADMIN
    // --------------------------------------------------

    const safeVoters =
      (voters || []).map(
        (voter, index) => ({
          no: index + 1,

          id:
            voter.id,

          nisn:
            voter.voter_code,

          nama:
            voter.full_name,

          kategori:
            voter.voter_categories
              ?.name ||
            "-",

          has_voted:
            Boolean(
              voter.has_voted
            ),

          voted_at:
            voter.voted_at,

          created_at:
            voter.created_at,
        })
      );

    // --------------------------------------------------
    // 6. STATISTIK
    // --------------------------------------------------

    const total =
      safeVoters.length;

    const voted =
      safeVoters.filter(
        (voter) =>
          voter.has_voted
      ).length;

    const notVoted =
      total - voted;

    const participation =
      total > 0
        ? Number(
            (
              (voted /
                total) *
              100
            ).toFixed(2)
          )
        : 0;

    // --------------------------------------------------
    // 7. RESPONSE
    // --------------------------------------------------

    return NextResponse.json({
      success: true,

      election: {
        id:
          election.id,

        name:
          election.name,

        status:
          election.status,
      },

      statistics: {
        total,
        voted,
        notVoted,
        participation,
      },

      voters:
        safeVoters,
    });
  } catch (error) {
    console.error(
      "GET /api/voters error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Terjadi kesalahan saat mengambil daftar pemilih.",
      },
      {
        status: 500,
      }
    );
  }
}
