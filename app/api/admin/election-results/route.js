import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const ELECTION_NAME =
  "Pemilihan Ketua KIR Nebula Periode 2026/2027";

function getAdminClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const secretKey =
    process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "Konfigurasi Supabase server belum lengkap."
    );
  }

  return createClient(
    url,
    secretKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

async function getCurrentUser() {
  const cookieStore =
    await cookies();

  const supabaseAuth =
    createServerClient(
      process.env
        .NEXT_PUBLIC_SUPABASE_URL,
      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },

          setAll() {
            // Tidak perlu mengubah cookie.
          },
        },
      }
    );

  const {
    data: { user },
  } =
    await supabaseAuth.auth.getUser();

  return user;
}

export async function GET() {
  try {
    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda belum login.",
        },
        { status: 401 }
      );
    }

    if (
      user.email !==
      "admin@nebula.or.id"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Akses ditolak.",
        },
        { status: 403 }
      );
    }

    const supabaseAdmin =
      getAdminClient();

    const { data, error } =
      await supabaseAdmin.rpc(
        "get_election_results",
        {
          p_election_name:
            ELECTION_NAME,
        }
      );

    if (error) {
      throw new Error(
        `Gagal menghitung hasil pemilihan: ${error.message}`
      );
    }

    return NextResponse.json({
      success: true,
      election: {
        name: ELECTION_NAME,
      },
      totalBallots:
        Number(
          data?.totalBallots || 0
        ),
      candidateCount:
        Number(
          data?.candidateCount || 0
        ),
      totalWeightedScore:
        Number(
          data?.totalWeightedScore ||
            0
        ),
      candidates:
        Array.isArray(
          data?.candidates
        )
          ? data.candidates
          : [],
    });
  } catch (error) {
    console.error(
      "Election results error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error.message ||
          "Gagal mengambil hasil pemilihan.",
      },
      { status: 500 }
    );
  }
}
