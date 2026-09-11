import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import crypto from "crypto";

const ELECTION_NAME =
  "Pemilihan Ketua KIR Nebula Periode 2026/2027";

const BUCKET_NAME =
  "candidate-photos";

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
            // Tidak masalah jika cookie tidak dapat ditulis.
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
  const parts =
    String(fileName || "").split(".");

  if (parts.length < 2) {
    return "jpg";
  }

  return parts
    .pop()
    .toLowerCase();
}

function makePhotoPath(originalName) {
  const extension =
    getExtension(originalName);

  const uniquePart =
    crypto
      .randomBytes(12)
      .toString("hex");

  return `candidate-${uniquePart}.${extension}`;
}

function getStoragePathFromUrl(url) {
  if (!url) {
    return null;
  }

  const marker =
    `/storage/v1/object/public/${BUCKET_NAME}/`;

  const index =
    url.indexOf(marker);

  if (index === -1) {
    return null;
  }

  return decodeURIComponent(
    url.substring(
      index + marker.length
    )
  );
}

async function uploadPhoto(
  supabase,
  photo
) {
  if (
    !photo ||
    typeof photo !== "object" ||
    typeof photo.arrayBuffer !==
      "function"
  ) {
    return {
      photoUrl: null,
      photoPath: null,
    };
  }

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
    throw new Error(
      "Foto harus berupa JPG, PNG, atau WEBP."
    );
  }

  if (
    photo.size >
    5 * 1024 * 1024
  ) {
    throw new Error(
      "Ukuran foto maksimal 5 MB."
    );
  }

  const photoPath =
    makePhotoPath(
      photo.name || "photo.jpg"
    );

  const arrayBuffer =
    await photo.arrayBuffer();

  const buffer =
    Buffer.from(arrayBuffer);

  const { error } =
    await supabase.storage
      .from(BUCKET_NAME)
      .upload(
        photoPath,
        buffer,
        {
          contentType:
            photo.type,
          upsert: false,
        }
      );

  if (error) {
    console.error(
      "Photo upload error:",
      error
    );

    throw new Error(
      "Gagal mengunggah foto kandidat."
    );
  }

  const {
    data: publicUrlData,
  } =
    supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(
        photoPath
      );

  return {
    photoUrl:
      publicUrlData?.publicUrl ||
      null,
    photoPath,
  };
}

async function deletePhoto(
  supabase,
  photoUrl
) {
  const photoPath =
    getStoragePathFromUrl(
      photoUrl
    );

  if (!photoPath) {
    return;
  }

  const { error } =
    await supabase.storage
      .from(BUCKET_NAME)
      .remove([
        photoPath,
      ]);

  if (error) {
    console.error(
      "Photo delete warning:",
      error
    );
  }
}

// ======================================================
// GET
// ======================================================

export async function GET() {
  try {
    const admin =
      await getAdminUser();

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

    const supabase =
      createServerSupabase();

    const election =
      await getElection(
        supabase
      );

    const {
      data: candidates,
      error,
    } =
      await supabase
        .from("candidates")
        .select(
          "id, candidate_number, name, class_name, vision, photo_url"
        )
        .eq(
          "election_id",
          election.id
        )
        .order(
          "candidate_number",
          {
            ascending: true,
          }
        );

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
      candidates:
        candidates || [],
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
// ======================================================

export async function POST(
  request
) {
  try {
    const admin =
      await getAdminUser();

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

    const supabase =
      createServerSupabase();

    const election =
      await getElection(
        supabase
      );

    if (
      election.status !==
      "draft"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Kandidat hanya dapat dikelola saat status DRAFT.",
        },
        { status: 400 }
      );
    }

    const formData =
      await request.formData();

    const candidateNumber =
      Number(
        formData.get(
          "candidateNumber"
        )
      );

    const name =
      String(
        formData.get(
          "name"
        ) || ""
      ).trim();

    const className =
      String(
        formData.get(
          "className"
        ) || ""
      ).trim();

    const program =
      String(
        formData.get(
          "program"
        ) || ""
      ).trim();

    const photo =
      formData.get("photo");

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

    const {
      data: existingNumber,
    } =
      await supabase
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

    let photoUrl =
      null;

    let uploadedPhotoPath =
      null;

    if (
      photo &&
      typeof photo ===
        "object" &&
      typeof photo.arrayBuffer ===
        "function"
    ) {
      const uploaded =
        await uploadPhoto(
          supabase,
          photo
        );

      photoUrl =
        uploaded.photoUrl;

      uploadedPhotoPath =
        uploaded.photoPath;
    }

    const {
      data: candidate,
      error: insertError,
    } =
      await supabase
        .from("candidates")
        .insert({
          election_id:
            election.id,
          candidate_number:
            candidateNumber,
          name,
          class_name:
            className,
          vision:
            program,
          photo_url:
            photoUrl,
        })
        .select(
          "id, candidate_number, name, class_name, vision, photo_url"
        )
        .single();

    if (insertError) {
      if (uploadedPhotoPath) {
        await supabase.storage
          .from(BUCKET_NAME)
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

    await supabase
      .from("audit_logs")
      .insert({
        election_id:
          election.id,
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

// ======================================================
// PUT
// Edit kandidat
// ======================================================

export async function PUT(
  request
) {
  try {
    const admin =
      await getAdminUser();

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

    const supabase =
      createServerSupabase();

    const election =
      await getElection(
        supabase
      );

    if (
      election.status !==
      "draft"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Kandidat hanya dapat diedit saat status DRAFT.",
        },
        { status: 400 }
      );
    }

    const formData =
      await request.formData();

    const candidateId =
      String(
        formData.get(
          "candidateId"
        ) || ""
      ).trim();

    const candidateNumber =
      Number(
        formData.get(
          "candidateNumber"
        )
      );

    const name =
      String(
        formData.get(
          "name"
        ) || ""
      ).trim();

    const className =
      String(
        formData.get(
          "className"
        ) || ""
      ).trim();

    const program =
      String(
        formData.get(
          "program"
        ) || ""
      ).trim();

    const photo =
      formData.get("photo");

    const removePhoto =
      String(
        formData.get(
          "removePhoto"
        ) || "false"
      ) === "true";

    if (!candidateId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID kandidat tidak ditemukan.",
        },
        { status: 400 }
      );
    }

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

    // Ambil kandidat lama
    const {
      data: existingCandidate,
      error:
        existingCandidateError,
    } =
      await supabase
        .from("candidates")
        .select(
          "id, candidate_number, name, class_name, vision, photo_url"
        )
        .eq(
          "id",
          candidateId
        )
        .eq(
          "election_id",
          election.id
        )
        .single();

    if (
      existingCandidateError ||
      !existingCandidate
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Kandidat tidak ditemukan.",
        },
        { status: 404 }
      );
    }

    // Cek nomor kandidat
    const {
      data: numberConflict,
    } =
      await supabase
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
        .neq(
          "id",
          candidateId
        )
        .maybeSingle();

    if (numberConflict) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Nomor kandidat ${candidateNumber} sudah digunakan kandidat lain.`,
        },
        { status: 409 }
      );
    }

    let newPhotoUrl =
      existingCandidate.photo_url;

    let uploadedPhotoPath =
      null;

    // Kalau pilih foto baru
    if (
      photo &&
      typeof photo ===
        "object" &&
      typeof photo.arrayBuffer ===
        "function"
    ) {
      const uploaded =
        await uploadPhoto(
          supabase,
          photo
        );

      newPhotoUrl =
        uploaded.photoUrl;

      uploadedPhotoPath =
        uploaded.photoPath;

      // Hapus foto lama
      if (
        existingCandidate.photo_url
      ) {
        await deletePhoto(
          supabase,
          existingCandidate.photo_url
        );
      }
    }

    // Kalau admin memilih hapus foto
    else if (
      removePhoto &&
      existingCandidate.photo_url
    ) {
      await deletePhoto(
        supabase,
        existingCandidate.photo_url
      );

      newPhotoUrl =
        null;
    }

    const {
      data: updatedCandidate,
      error: updateError,
    } =
      await supabase
        .from("candidates")
        .update({
          candidate_number:
            candidateNumber,
          name,
          class_name:
            className,
          vision:
            program,
          photo_url:
            newPhotoUrl,
        })
        .eq(
          "id",
          candidateId
        )
        .eq(
          "election_id",
          election.id
        )
        .select(
          "id, candidate_number, name, class_name, vision, photo_url"
        )
        .single();

    if (updateError) {
      if (uploadedPhotoPath) {
        await supabase.storage
          .from(BUCKET_NAME)
          .remove([
            uploadedPhotoPath,
          ]);
      }

      console.error(
        "Update candidate error:",
        updateError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Gagal memperbarui kandidat: " +
            updateError.message,
        },
        { status: 500 }
      );
    }

    await supabase
      .from("audit_logs")
      .insert({
        election_id:
          election.id,
        event_type:
          "candidate_updated",
        metadata: {
          candidate_id:
            updatedCandidate.id,
          candidate_number:
            updatedCandidate.candidate_number,
        },
      });

    return NextResponse.json({
      success: true,
      message:
        "Kandidat berhasil diperbarui.",
      candidate:
        updatedCandidate,
    });
  } catch (error) {
    console.error(
      "PUT candidate error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error.message ||
          "Terjadi kesalahan saat memperbarui kandidat.",
      },
      { status: 500 }
    );
  }
}

// ======================================================
// DELETE
// Hapus kandidat
// ======================================================

export async function DELETE(
  request
) {
  try {
    const admin =
      await getAdminUser();

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

    const supabase =
      createServerSupabase();

    const election =
      await getElection(
        supabase
      );

    if (
      election.status !==
      "draft"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Kandidat hanya dapat dihapus saat status DRAFT.",
        },
        { status: 400 }
      );
    }

    const body =
      await request.json();

    const candidateId =
      String(
        body?.candidateId ||
          ""
      ).trim();

    if (!candidateId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID kandidat tidak ditemukan.",
        },
        { status: 400 }
      );
    }

    const {
      data: candidate,
      error:
        candidateError,
    } =
      await supabase
        .from("candidates")
        .select(
          "id, candidate_number, name, photo_url"
        )
        .eq(
          "id",
          candidateId
        )
        .eq(
          "election_id",
          election.id
        )
        .single();

    if (
      candidateError ||
      !candidate
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Kandidat tidak ditemukan.",
        },
        { status: 404 }
      );
    }

    // Hapus data kandidat
    const {
      error: deleteError,
    } =
      await supabase
        .from("candidates")
        .delete()
        .eq(
          "id",
          candidateId
        )
        .eq(
          "election_id",
          election.id
        );

    if (deleteError) {
      console.error(
        "Delete candidate error:",
        deleteError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Gagal menghapus kandidat: " +
            deleteError.message,
        },
        { status: 500 }
      );
    }

    // Hapus foto jika ada
    if (candidate.photo_url) {
      await deletePhoto(
        supabase,
        candidate.photo_url
      );
    }

    await supabase
      .from("audit_logs")
      .insert({
        election_id:
          election.id,
        event_type:
          "candidate_deleted",
        metadata: {
          candidate_id:
            candidate.id,
          candidate_number:
            candidate.candidate_number,
          candidate_name:
            candidate.name,
        },
      });

    return NextResponse.json({
      success: true,
      message:
        "Kandidat berhasil dihapus.",
    });
  } catch (error) {
    console.error(
      "DELETE candidate error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error.message ||
          "Terjadi kesalahan saat menghapus kandidat.",
      },
      { status: 500 }
    );
  }
}
