import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function requireAdmin() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          success: false,
          message: "Belum login sebagai admin.",
        },
        { status: 401 }
      ),
    };
  }

  if (user.email !== "admin@nebula.or.id") {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          success: false,
          message: "Akses admin ditolak.",
        },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    user,
  };
}

export async function POST() {
  try {
    // ====================================================
    // CEK ADMIN
    // ====================================================

    const auth = await requireAdmin();

    if (!auth.authorized) {
      return auth.response;
    }

    // ====================================================
    // CARI PEMILIHAN
    // ====================================================

    const { data: election, error: electionError } =
      await supabaseAdmin
        .from("elections")
        .select(
          "id, name, status"
        )
        .eq(
          "name",
          "Pemilihan Ketua KIR Nebula Periode 2026/2027"
        )
        .single();

    if (
      electionError ||
      !election
    ) {
      console.error(
        "Delete test voters election error:",
        electionError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Data pemilihan tidak ditemukan.",
        },
        { status: 404 }
      );
    }

    // ====================================================
    // WAJIB DRAFT
    // ====================================================

    if (
      election.status !==
      "draft"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Penghapusan data test hanya dapat dilakukan saat status DRAFT.",
        },
        { status: 409 }
      );
    }

    // ====================================================
    // AMBIL VOTER TEST
    // HANYA voter_code DIAWALI TEST
    // ====================================================

    const {
      data: testVoters,
      error: voterFetchError,
    } = await supabaseAdmin
      .from("voters")
      .select(
        "id, voter_code, full_name"
      )
      .eq(
        "election_id",
        election.id
      )
      .ilike(
        "voter_code",
        "TEST%"
      );

    if (voterFetchError) {
      console.error(
        "Fetch test voters error:",
        voterFetchError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Gagal mengambil data pemilih test.",
        },
        { status: 500 }
      );
    }

    // ====================================================
    // TIDAK ADA DATA TEST
    // ====================================================

    if (
      !testVoters ||
      testVoters.length === 0
    ) {
      return NextResponse.json({
        success: true,
        deleted: 0,
        deleted_voters: [],
        message:
          "Tidak ada data pemilih test yang ditemukan.",
      });
    }

    const testVoterIds =
      testVoters.map(
        (voter) => voter.id
      );

    // ====================================================
    // HAPUS SESSION TEST
    // ====================================================

    const {
      error: sessionDeleteError,
    } = await supabaseAdmin
      .from("voting_sessions")
      .delete()
      .in(
        "voter_id",
        testVoterIds
      );

    if (sessionDeleteError) {
      console.error(
        "Delete test sessions error:",
        sessionDeleteError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Gagal menghapus session pemilih test.",
        },
        { status: 500 }
      );
    }

    // ====================================================
    // HAPUS VOTER TEST
    // ====================================================

    const {
      error: voterDeleteError,
    } = await supabaseAdmin
      .from("voters")
      .delete()
      .in(
        "id",
        testVoterIds
      );

    if (voterDeleteError) {
      console.error(
        "Delete test voters error:",
        voterDeleteError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Gagal menghapus data pemilih test.",
        },
        { status: 500 }
      );
    }

    // ====================================================
    // AUDIT LOG
    // ====================================================

    const {
      error: auditError,
    } = await supabaseAdmin
      .from("audit_logs")
      .insert({
        election_id:
          election.id,
        event_type:
          "test_voters_deleted",
        metadata: {
          deleted_count:
            testVoters.length,
          deleted_voters:
            testVoters.map(
              (voter) => ({
                nisn:
                  voter.voter_code,
                nama:
                  voter.full_name,
              })
            ),
        },
      });

    if (auditError) {
      console.error(
        "Audit log error:",
        auditError
      );
    }

    // ====================================================
    // SELESAI
    // ====================================================

    return NextResponse.json({
      success: true,
      deleted:
        testVoters.length,
      deleted_voters:
        testVoters.map(
          (voter) =>
            voter.voter_code
        ),
      message:
        `Berhasil menghapus ${testVoters.length} data pemilih test.`,
    });
  } catch (error) {
    console.error(
      "Delete test voters fatal error:",
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
