import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST() {
  try {
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

    // Pastikan admin login terlebih dahulu
    const electionName =
      "Pemilihan Ketua KIR Nebula Periode 2026/2027";

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
          message: error.message || "Gagal menyiapkan pemilihan.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Pemilihan berhasil disiapkan kembali.",
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
