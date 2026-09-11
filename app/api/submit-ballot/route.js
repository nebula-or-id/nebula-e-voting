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
    // -----------------------------------------------
    // 1. Ambil session cookie
    // -----------------------------------------------

    const cookieStore = await cookies();

    const sessionToken = cookieStore.get(
      "nebula_voting_session"
    )?.value;

    if (!sessionToken) {
      return Response.json(
        {
          success: false,
          message: "Sesi pemilih tidak ditemukan.",
        },
        { status: 401 }
      );
    }

    // -----------------------------------------------
    // 2. Ambil ranking dari request
    // -----------------------------------------------

    const body = await request.json();

    const ranking = body?.ranking;

    if (!Array.isArray(ranking)) {
      return Response.json(
        {
          success: false,
          message: "Format ranking tidak valid.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------------
    // 3. Pastikan ranking hanya UUID
    // -----------------------------------------------

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (
      ranking.length === 0 ||
      ranking.some(
        (candidateId) =>
          typeof candidateId !== "string" ||
          !uuidRegex.test(candidateId)
      )
    ) {
      return Response.json(
        {
          success: false,
          message: "Data kandidat tidak valid.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------------
    // 4. Panggil function database
    // -----------------------------------------------

    const { data, error } = await supabase.rpc(
      "submit_ballot",
      {
        p_session_token: sessionToken,
        p_ranked_candidate_ids: ranking,
      }
    );

    if (error) {
      console.error("Submit ballot error:", error);

      return Response.json(
        {
          success: false,
          message: "Suara belum dapat direkam.",
        },
        { status: 500 }
      );
    }

    const result = data?.[0];

    if (!result || result.success !== true) {
      return Response.json(
        {
          success: false,
          message:
            result?.message ||
            "Suara tidak dapat direkam.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------------
    // 5. Hapus session cookie setelah voting berhasil
    // -----------------------------------------------

    cookieStore.set("nebula_voting_session", "", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 0,
      path: "/",
    });

    // -----------------------------------------------
    // 6. Berhasil
    // -----------------------------------------------

    return Response.json({
      success: true,
      message: "Suara berhasil direkam.",
    });

  } catch (error) {
    console.error("Unexpected submit ballot error:", error);

    return Response.json(
      {
        success: false,
        message: "Terjadi kesalahan pada server.",
      },
      { status: 500 }
    );
  }
}
