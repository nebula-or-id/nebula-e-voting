import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import crypto from "crypto";

const ELECTION_NAME =
  "Pemilihan Ketua KIR Nebula Periode 2026/2027";

async function getAdminUser() {
  const cookieStore = await cookies();

  const supabaseAuth = createServerClient(
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
            // Tidak selalu dapat menulis cookie
            // dari Server Component / Route Handler.
          }
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabaseAuth.auth.getUser();

  if (error || !user) {
    return null;
  }

  if (user.email !== "admin@nebula.or.id") {
    return null;
  }

  return user;
}

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

async function getElection(supabase) {
  const { data, error } = await supabase
    .from("elections")
    .select("id, name, status")
    .eq("name", ELECTION_NAME)
    .single();

  if (error || !data) {
    throw new Error(
      "Data pemilihan tidak ditemukan."
    );
  }

  return data;
}

function getExtension(fileName) {
  const parts = fileName.split(".");
  return parts.length > 1
    ? parts.pop().toLowerCase()
    : "";
}

function makePhotoPath(originalName) {
  const extension =
    getExtension(originalName) || "jpg";

  const uniquePart =
    crypto.randomBytes(12).toString("hex");

  return `candidate-${uniquePart}.${extension}`;
}

// ======================================================
// GET
// Ambil daftar kandidat
// ======================================================

export async function GET() {
  try {
    const admin = await getAdminUser();

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

    const supabase = createServerSupabase();

    const election = await getElection(
      supabase
    );

    const {
      data: candidates,
      error,
    } = await supabase
      .from("candidates")
      .select(
        "id, candidate_number, name, class_name, vision, photo_url"
      )
      .eq("election_id", election.id)
      .order("candidate_number", {
        ascending: true,
      });

    if (error) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Gagal mengambil data kandidat.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      election: {
        id: election.id,
        name: election.name,
        status: election.status,
      },
      candidates: candidates || [],
    });
  } catch (error) {
    console.error(
      "GET candidates error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error.message ||
          "Terjadi kesalahan saat mengambil kandidat.",
      },
      { status: 500 }
    );
  }
}

// ======================================================
// POST
// Tambah kandidat
// ======================================================

export async function POST(request) {
  try {
    const admin = await getAdminUser();

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

    const supabase = createServerSupabase();

    const election = await getElection(
      supabase
    );

    // Hanya boleh saat DRAFT
    if (election.status !== "draft") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Kandidat hanya dapat dikelola saat status pemilihan DRAFT.",
        },
        { status: 400 }
      );
    }

    const formData =
      await request.formData();

    const candidateNumberRaw =
      formData.get("candidateNumber");

    const nameRaw =
      formData.get("name");

    const classNameRaw =
      formData.get("className");

    const programRaw =
      formData.get("program");

    const photo =
      formData.get("photo");

    const candidateNumber = Number(
      candidateNumberRaw
    );

    const name = String(
      nameRaw || ""
    ).trim();

    const className = String(
      classNameRaw || ""
    ).trim();

    const program = String(
      programRaw || ""
    ).trim();

    // -----------------------------------------------
    // Validasi
    // -----------------------------------------------

    if (
      !Number.isInteger(
        candidateNumber
      ) ||
      candidateNumber < 1
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Nomor kandidat tidak valid.",
        },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Nama kandidat wajib diisi.",
        },
        { status: 400 }
      );
    }

    if (!className) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Kelas kandidat wajib diisi.",
        },
        { status: 400 }
      );
    }

    if (!program) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Program unggulan wajib diisi.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------------
    // Cek nomor kandidat sudah dipakai
    // -----------------------------------------------

    const {
      data: existingNumber,
    } = await supabase
      .from("candidates")
      .select("id")
      .eq(
        "election_id",
        election.id
      )
      .eq(
        "candidate_number",
        candidateNumber
      )
      .maybeSingle();

    if (existingNumber) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Nomor kandidat ${candidateNumber} sudah digunakan.`,
        },
        { status: 409 }
      );
    }

    // -----------------------------------------------
    // Upload foto jika ada
    // -----------------------------------------------

    let photoUrl = null;
    let uploadedPhotoPath = null;

    if (
      photo &&
      typeof photo === "object" &&
      typeof photo.arrayBuffer ===
        "function"
    ) {
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
      ];

      if (
        !allowedTypes.includes(
          photo.type
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Foto harus berupa JPG, PNG, atau WEBP.",
          },
          { status: 400 }
        );
      }

      // Maksimum 5 MB
      if (photo.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Ukuran foto maksimal 5 MB.",
          },
          { status: 400 }
        );
      }

      uploadedPhotoPath =
        makePhotoPath(
          photo.name || "photo.jpg"
        );

      const arrayBuffer =
        await photo.arrayBuffer();

      const photoBuffer =
        Buffer.from(arrayBuffer);

      const {
        error: uploadError,
      } = await supabase.storage
        .from("candidate-photos")
        .upload(
          uploadedPhotoPath,
          photoBuffer,
          {
            contentType:
              photo.type,
            upsert: false,
          }
        );

      if (uploadError) {
        console.error(
          "Candidate photo upload error:",
          uploadError
        );

        return NextResponse.json(
          {
            success: false,
            message:
              "Gagal mengunggah foto kandidat.",
          },
          { status: 500 }
        );
      }

      const {
        data: publicUrlData,
      } = supabase.storage
        .from("candidate-photos")
        .getPublicUrl(
          uploadedPhotoPath
        );

      photoUrl =
        publicUrlData?.publicUrl ||
        null;
    }

    // -----------------------------------------------
    // Simpan kandidat
    //
    // vision dipakai sebagai tempat menyimpan
    // Program Unggulan sementara agar kita tidak
    // mengubah struktur database yang sudah stabil.
    // -----------------------------------------------

    const {
      data: candidate,
      error: insertError,
    } = await supabase
      .from("candidates")
      .insert({
        election_id: election.id,
        candidate_number:
          candidateNumber,
        name,
        class_name: className,
        vision: program,
        photo_url: photoUrl,
      })
      .select(
        "id, candidate_number, name, class_name, vision, photo_url"
      )
      .single();

    if (insertError) {
      // Jika insert gagal setelah upload,
      // bersihkan foto yang sudah terlanjur diupload.
      if (uploadedPhotoPath) {
        await supabase.storage
          .from("candidate-photos")
          .remove([
            uploadedPhotoPath,
          ]);
      }

      console.error(
        "Insert candidate error:",
        insertError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Gagal menyimpan kandidat: " +
            insertError.message,
        },
        { status: 500 }
      );
    }

    // -----------------------------------------------
    // Audit log
    // -----------------------------------------------

    await supabase
      .from("audit_logs")
      .insert({
        election_id: election.id,
        event_type:
          "candidate_created",
        metadata: {
          candidate_id:
            candidate.id,
          candidate_number:
            candidate.candidate_number,
        },
      });

    return NextResponse.json(
      {
        success: true,
        message:
          "Kandidat berhasil ditambahkan.",
        candidate,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "POST candidate error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error.message ||
          "Terjadi kesalahan saat menambahkan kandidat.",
      },
      { status: 500 }
    );
  }
}
