import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function getAdminUser() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
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
              ({ name, value, options }) => {
                cookieStore.set(
                  name,
                  value,
                  options
                );
              }
            );
          } catch {
            // Tidak selalu bisa menulis cookie dari Server Component.
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function POST(request) {
  try {
    // ------------------------------------------------
    // 1. Pastikan user sudah login
    // ------------------------------------------------

    const user = await getAdminUser();

    if (!user) {
      return Response.json(
        {
          success: false,
          message: "Anda harus login sebagai admin.",
        },
        { status: 401 }
      );
    }

    // ------------------------------------------------
    // 2. Untuk tahap sekarang kita batasi hanya
    //    akun admin yang kita buat.
    // ------------------------------------------------

    if (user.email !== "admin@nebula.or.id") {
      return Response.json(
        {
          success: false,
          message: "Anda tidak memiliki akses admin.",
        },
        { status: 403 }
      );
    }

    // ------------------------------------------------
    // 3. Baca action
    // ------------------------------------------------

    const body = await request.json();

    const action = body?.action;

    if (!["open", "close"].includes(action)) {
      return Response.json(
        {
          success: false,
          message: "Perintah tidak valid.",
        },
        { status: 400 }
      );
    }

    // ------------------------------------------------
    // 4. Gunakan secret key hanya di server
    // ------------------------------------------------

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // ------------------------------------------------
    // 5. Ambil election
    // ------------------------------------------------

    const { data: election, error: electionError } =
      await supabase
        .from("elections")
        .select("id, name, status")
        .eq(
          "name",
          "Pemilihan Ketua KIR Nebula Periode 2026/2027"
        )
        .limit(1)
        .single();

    if (electionError || !election) {
      return Response.json(
        {
          success: false,
          message: "Pemilihan tidak ditemukan.",
        },
        { status: 404 }
      );
    }

    // ------------------------------------------------
    // 6. Tentukan transisi status
    // ------------------------------------------------

    if (action === "open") {
      if (election.status !== "draft") {
        return Response.json(
          {
            success: false,
            message:
              "Pemilihan hanya dapat dibuka dari status draft.",
          },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("elections")
        .update({
          status: "open",
          opened_at: new Date().toISOString(),
          closed_at: null,
        })
        .eq("id", election.id);

      if (error) {
        console.error(error);

        return Response.json(
          {
            success: false,
            message: "Gagal membuka pemilihan.",
          },
          { status: 500 }
        );
      }
    }

    if (action === "close") {
      if (election.status !== "open") {
        return Response.json(
          {
            success: false,
            message:
              "Pemilihan hanya dapat ditutup dari status open.",
          },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("elections")
        .update({
          status: "closed",
          closed_at: new Date().toISOString(),
        })
        .eq("id", election.id);

      if (error) {
        console.error(error);

        return Response.json(
          {
            success: false,
            message: "Gagal menutup pemilihan.",
          },
          { status: 500 }
        );
      }
    }

    // ------------------------------------------------
    // 7. Berhasil
    // ------------------------------------------------

    return Response.json({
      success: true,
      status: action === "open" ? "open" : "closed",
    });

  } catch (error) {
    console.error("Election status error:", error);

    return Response.json(
      {
        success: false,
        message: "Terjadi kesalahan pada server.",
      },
      { status: 500 }
    );
  }
}
