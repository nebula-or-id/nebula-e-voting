import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

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

export async function POST(request) {
  try {
    // --------------------------------------------------
    // 1. Baca data dari request
    // --------------------------------------------------

    const body = await request.json();

    const voterCode = String(body.voterCode || "").trim();
    const token = String(body.token || "").trim();

    // --------------------------------------------------
    // 2. Validasi input dasar
    // --------------------------------------------------

    if (!voterCode || !token) {
      return Response.json(
        {
          success: false,
          message: "NISN dan token wajib diisi.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 3. Cari election yang aktif
    // --------------------------------------------------

    const { data: election, error: electionError } = await supabase
      .from("elections")
      .select("id, name, status")
      .eq(
        "name",
        "Pemilihan Ketua KIR Nebula Periode 2026/2027"
      )
      .limit(1)
      .single();

    if (electionError || !election) {
      console.error("Election error:", electionError);

      return Response.json(
        {
          success: false,
          message: "Konfigurasi pemilihan tidak ditemukan.",
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // 4. Panggil function verify_voter()
    // --------------------------------------------------

    const { data, error } = await supabase.rpc(
      "verify_voter",
      {
        p_election_id: election.id,
        p_voter_code: voterCode,
        p_token: token,
      }
    );

    if (error) {
      console.error("Verify voter error:", error);

      return Response.json(
        {
          success: false,
          message: "Terjadi kesalahan saat memverifikasi pemilih.",
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // 5. Ambil hasil verifikasi
    // --------------------------------------------------

    const result = data?.[0];

    if (!result || result.valid !== true) {
      return Response.json(
        {
          success: false,
          message: "NISN atau token tidak valid, atau hak pilih sudah digunakan.",
        },
        { status: 401 }
      );
    }

    // --------------------------------------------------
    // 6. Simpan session token ke HTTP-only cookie
    // --------------------------------------------------

    const cookieStore = await cookies();

    cookieStore.set("nebula_voting_session", result.session_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 20 * 60,
      path: "/",
    });

    // --------------------------------------------------
    // 7. Jangan kirim session token ke browser
    // --------------------------------------------------

    return Response.json({
      success: true,
      voter: {
        name: result.full_name,
        weight: result.weight,
      },
      election: {
        name: election.name,
      },
    });
  } catch (error) {
    console.error("Unexpected verify voter error:", error);

    return Response.json(
      {
        success: false,
        message: "Terjadi kesalahan pada server.",
      },
      { status: 500 }
    );
  }
}
