import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const cookieStore = await cookies();

    // Client untuk memeriksa login admin
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
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // Tidak masalah jika cookie tidak dapat diubah
            }
          },
        },
      }
    );

    // Periksa user yang sedang login
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

    // Untuk sementara admin yang diizinkan hanya akun ini
    if (user.email !== "admin@nebula.or.id") {
      return NextResponse.json(
        {
          success: false,
          message: "Anda tidak memiliki izin sebagai admin.",
        },
        { status: 403 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseSecretKey) {
      return NextResponse.json(
        {
          success: false,
          message: "Konfigurasi Supabase belum tersedia.",
        },
        { status: 500 }
      );
    }

    // Client khusus server menggunakan secret key
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

    const electionName =
      "Pemilihan Ketua KIR Nebula Periode 2026/2027";

    // Ambil data election
    const { data: election, error: electionError } =
      await supabase
        .from("elections")
        .select("id, name, status")
        .eq("name", electionName)
        .single();

    if (electionError || !election) {
      return NextResponse.json(
        {
          success: false,
          message: "Data pemilihan tidak ditemukan.",
        },
        { status: 404 }
      );
    }

    // Jalankan fungsi prepare_election
    const { data, error } = await supabase.rpc(
      "prepare_election",
      {
        p_election_id: election.id,
      }
    );

    if (error) {
      console.error("Prepare election error:", error);

      return NextResponse.json(
        {
          success: false,
          message:
            error.message ||
            "Gagal menyiapkan pemilihan.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Pemilihan berhasil disiapkan kembali.",
      result: data,
    });
  } catch (error) {
    console.error("Unexpected error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Terjadi kesalahan pada server.",
      },
      { status: 500 }
    );
  }
}
