import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "Konfigurasi Supabase server belum lengkap."
    );
  }

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function getCurrentUser() {
  const cookieStore = await cookies();

  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Tidak perlu menulis cookie untuk route ini.
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  return user;
}

export async function DELETE() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Anda belum login.",
        },
        { status: 401 }
      );
    }

    if (user.email !== "admin@nebula.or.id") {
      return NextResponse.json(
        {
          success: false,
          message: "Akses ditolak.",
        },
        { status: 403 }
      );
    }

    const supabaseAdmin = getAdminClient();

    // Cari pemilihan aktif
    const { data: election, error: electionError } =
      await supabaseAdmin
        .from("elections")
        .select("id,name,status")
        .eq(
          "name",
          "Pemilihan Ketua KIR Nebula Periode 2026/2027"
        )
        .maybeSingle();

    if (electionError) {
      throw new Error(
        `Gagal mengambil data pemilihan: ${electionError.message}`
      );
    }

    if (!election) {
      return NextResponse.json(
        {
          success: false,
          message: "Data pemilihan tidak ditemukan.",
        },
        { status: 404 }
      );
    }

    // Data test hanya boleh dihapus saat DRAFT
    if (election.status !== "draft") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Data test hanya boleh dihapus saat status pemilihan DRAFT.",
        },
        { status: 400 }
      );
    }

    // Ambil seluruh voter test
    const { data: testVoters, error: voterError } =
      await supabaseAdmin
        .from("voters")
        .select("id,voter_code,full_name")
        .eq("election_id", election.id)
        .ilike("voter_code", "TEST%");

    if (voterError) {
      throw new Error(
        `Gagal mengambil data voter test: ${voterError.message}`
      );
    }

    const voters = testVoters || [];

    if (voters.length === 0) {
      return NextResponse.json({
        success: true,
        deleted: 0,
        deletedVoters: [],
        message: "Tidak ada data test yang ditemukan.",
      });
    }

    const voterIds = voters.map((voter) => voter.id);

    // Hapus session voting milik voter test
    const { error: sessionError } =
      await supabaseAdmin
        .from("voting_sessions")
        .delete()
        .in("voter_id", voterIds);

    if (sessionError) {
      throw new Error(
        `Gagal menghapus session test: ${sessionError.message}`
      );
    }

    // Hapus voter test
    const { error: deleteError } =
      await supabaseAdmin
        .from("voters")
        .delete()
        .in("id", voterIds);

    if (deleteError) {
      throw new Error(
        `Gagal menghapus data voter test: ${deleteError.message}`
      );
    }

    // Catat audit
    const { error: auditError } =
      await supabaseAdmin
        .from("audit_logs")
        .insert({
          election_id: election.id,
          event_type: "test_voters_deleted",
          metadata: {
            count: voters.length,
            voter_codes: voters.map(
              (voter) => voter.voter_code
            ),
          },
        });

    if (auditError) {
      console.error(
        "Audit log warning:",
        auditError
      );
    }

    return NextResponse.json({
      success: true,
      deleted: voters.length,
      deletedVoters: voters.map(
        (voter) => ({
          nisn: voter.voter_code,
          nama: voter.full_name,
        })
      ),
      message: `${voters.length} data test berhasil dihapus.`,
    });
  } catch (error) {
    console.error(
      "Delete test voters error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error.message ||
          "Terjadi kesalahan saat menghapus data test.",
      },
      { status: 500 }
    );
  }
}
