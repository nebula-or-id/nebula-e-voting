import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "pdf-lib";
import crypto from "crypto";

const ELECTION_NAME =
  "Pemilihan Ketua KIR Nebula Periode 2026/2027";

const CARDS_PER_PAGE = 8;
const COLUMNS = 2;
const ROWS_PER_PAGE = 4;

async function getAdminUser() {
  const cookieStore = await cookies();

  const supabaseAuth =
    createServerClient(
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
                ({
                  name,
                  value,
                  options,
                }) => {
                  cookieStore.set(
                    name,
                    value,
                    options
                  );
                }
              );
            } catch {
              // Tidak selalu dapat menulis cookie.
            }
          },
        },
      }
    );

  const {
    data: { user },
    error,
  } =
    await supabaseAuth.auth.getUser();

  if (error || !user) {
    return null;
  }

  if (
    user.email !==
    "admin@nebula.or.id"
  ) {
    return null;
  }

  return user;
}

function createAdminClient() {
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

function getEncryptionKey() {
  const keyHex =
    process.env.TOKEN_ENCRYPTION_KEY;

  if (!keyHex) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY belum tersedia di server."
    );
  }

  if (
    !/^[0-9a-fA-F]{64}$/.test(
      keyHex
    )
  ) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY harus berupa 64 karakter hexadecimal."
    );
  }

  return Buffer.from(
    keyHex,
    "hex"
  );
}

function decryptToken(
  encryptedValue
) {
  const key =
    getEncryptionKey();

  const parts =
    String(
      encryptedValue
    ).split(":");

  if (parts.length !== 3) {
    throw new Error(
      "Format token terenkripsi tidak valid."
    );
  }

  const [
    ivHex,
    authTagHex,
    ciphertextHex,
  ] = parts;

  const iv =
    Buffer.from(
      ivHex,
      "hex"
    );

  const authTag =
    Buffer.from(
      authTagHex,
      "hex"
    );

  const ciphertext =
    Buffer.from(
      ciphertextHex,
      "hex"
    );

  const decipher =
    crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      iv
    );

  decipher.setAuthTag(
    authTag
  );

  const decrypted =
    Buffer.concat([
      decipher.update(
        ciphertext
      ),
      decipher.final(),
    ]);

  return decrypted.toString(
    "utf8"
  );
}

function drawVoterCard(
  page,
  fonts,
  voter,
  index
) {
  const {
    fontRegular,
    fontBold,
  } = fonts;

  // A4 portrait dalam point
  const pageWidth =
    595.28;

  const pageHeight =
    841.89;

  const margin = 24;
  const gap = 12;

  const cardWidth =
    (pageWidth -
      margin * 2 -
      gap) /
    COLUMNS;

  const cardHeight =
    (pageHeight -
      margin * 2 -
      gap *
        (ROWS_PER_PAGE - 1)) /
    ROWS_PER_PAGE;

  const indexInPage =
    index %
    CARDS_PER_PAGE;

  const column =
    indexInPage %
    COLUMNS;

  const row =
    Math.floor(
      indexInPage /
        COLUMNS
    );

  const x =
    margin +
    column *
      (cardWidth + gap);

  const y =
    pageHeight -
    margin -
    (row + 1) *
      cardHeight -
    row * gap;

  const dark =
    rgb(
      0.09,
      0.13,
      0.20
    );

  const gray =
    rgb(
      0.35,
      0.39,
      0.45
    );

  const border =
    rgb(
      0.72,
      0.76,
      0.82
    );

  const light =
    rgb(
      0.96,
      0.97,
      0.98
    );

  const accent =
    rgb(
      0.93,
      0.95,
      1
    );

  // ==================================================
  // KARTU
  // ==================================================

  page.drawRectangle({
    x,
    y,
    width:
      cardWidth,
    height:
      cardHeight,
    borderColor:
      border,
    borderWidth: 1,
  });

  // ==================================================
  // HEADER
  // ==================================================

  page.drawRectangle({
    x:
      x + 8,
    y:
      y +
      cardHeight -
      43,
    width:
      cardWidth -
      16,
    height: 31,
    color:
      accent,
  });

  page.drawText(
    "NEBULA E-VOTING",
    {
      x:
        x + 16,
      y:
        y +
        cardHeight -
        29,
      size: 11,
      font:
        fontBold,
      color:
        dark,
    }
  );

  page.drawText(
    "PEMILIHAN KETUA KIR NEBULA",
    {
      x:
        x + 16,
      y:
        y +
        cardHeight -
        40,
      size: 6.5,
      font:
        fontRegular,
      color:
        gray,
    }
  );

  // ==================================================
  // NAMA
  // ==================================================

  const left =
    x + 16;

  let identityY =
    y +
    cardHeight -
    58;

  page.drawText(
    "NAMA",
    {
      x: left,
      y: identityY,
      size: 6.5,
      font:
        fontBold,
      color:
        gray,
    }
  );

  identityY -= 12;

  page.drawText(
    String(
      voter.full_name ||
        "-"
    ),
    {
      x: left,
      y: identityY,
      size: 8.8,
      font:
        fontBold,
      color:
        dark,
    }
  );

  // ==================================================
  // NISN
  // ==================================================

  identityY -= 19;

  page.drawText(
    "NISN",
    {
      x: left,
      y: identityY,
      size: 6.5,
      font:
        fontBold,
      color:
        gray,
    }
  );

  identityY -= 12;

  page.drawText(
    String(
      voter.voter_code ||
        "-"
    ),
    {
      x: left,
      y: identityY,
      size: 8.5,
      font:
        fontRegular,
      color:
        dark,
    }
  );

  // ==================================================
  // TOKEN
  // ==================================================

  const tokenBoxHeight =
    48;

  const tokenBoxY =
    y + 29;

  page.drawRectangle({
    x:
      x + 12,
    y:
      tokenBoxY,
    width:
      cardWidth -
      24,
    height:
      tokenBoxHeight,
    color:
      light,
    borderColor:
      border,
    borderWidth: 0.8,
  });

  page.drawText(
    "TOKEN",
    {
      x:
        x + 20,
      y:
        tokenBoxY +
        tokenBoxHeight -
        15,
      size: 7,
      font:
        fontBold,
      color:
        gray,
    }
  );

  const token =
    String(
      voter.token || "-"
    ).trim();

  const tokenSize =
    token.length > 10
      ? 14
      : 16;

  const tokenWidth =
    fontBold.widthOfTextAtSize(
      token,
      tokenSize
    );

  page.drawText(
    token,
    {
      x:
        x +
        (cardWidth -
          tokenWidth) /
          2,
      y:
        tokenBoxY +
        13,
      size:
        tokenSize,
      font:
        fontBold,
      color:
        dark,
      characterSpacing:
        1.5,
    }
  );

  // ==================================================
  // FOOTER
  // ==================================================

  page.drawText(
    "Gunakan token ini satu kali untuk memberikan suara.",
    {
      x: left,
      y: y + 13,
      size: 5.5,
      font:
        fontRegular,
      color:
        gray,
    }
  );

  page.drawText(
    `Kartu ${index + 1}`,
    {
      x:
        x +
        cardWidth -
        44,
      y:
        y + 13,
      size: 5.5,
      font:
        fontRegular,
      color:
        gray,
    }
  );
}

export async function GET() {
  try {
    // ==================================================
    // CEK ADMIN
    // ==================================================

    const admin =
      await getAdminUser();

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda harus login sebagai admin.",
        },
        {
          status: 401,
        }
      );
    }

    // ==================================================
    // CEK KEY
    // ==================================================

    getEncryptionKey();

    // ==================================================
    // DATABASE
    // ==================================================

    const supabase =
      createAdminClient();

    const {
      data: election,
      error: electionError,
    } =
      await supabase
        .from("elections")
        .select(
          "id, name, status"
        )
        .eq(
          "name",
          ELECTION_NAME
        )
        .single();

    if (
      electionError ||
      !election
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Data pemilihan tidak ditemukan.",
        },
        {
          status: 404,
        }
      );
    }

    // ==================================================
    // AMBIL SEMUA PEMILIH
    // ==================================================

    const {
      data: voters,
      error: voterError,
    } =
      await supabase
        .from("voters")
        .select(
          `
          id,
          voter_code,
          full_name,
          token_encrypted,
          created_at
          `
        )
        .eq(
          "election_id",
          election.id
        )
        .order(
          "created_at",
          {
            ascending: true,
          }
        );

    if (voterError) {
      console.error(
        "Get voter cards error:",
        voterError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Gagal mengambil data pemilih.",
        },
        {
          status: 500,
        }
      );
    }

    if (
      !voters ||
      voters.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Belum ada pemilih yang tersimpan.",
        },
        {
          status: 404,
        }
      );
    }

    // ==================================================
    // DECRYPT TOKEN
    // ==================================================

    const missingToken =
      [];

    const decryptedVoters =
      [];

    for (
      const voter of voters
    ) {
      if (
        !voter.token_encrypted
      ) {
        missingToken.push(
          voter.voter_code
        );
        continue;
      }

      try {
        const token =
          decryptToken(
            voter.token_encrypted
          );

        decryptedVoters.push({
          id:
            voter.id,

          voter_code:
            voter.voter_code,

          full_name:
            voter.full_name,

          token,
        });
      } catch (error) {
        console.error(
          "Decrypt voter token error:",
          voter.id,
          error
        );

        missingToken.push(
          voter.voter_code
        );
      }
    }

    // ==================================================
    // JIKA ADA TOKEN YANG TIDAK TERSEDIA
    // ==================================================

    if (
      missingToken.length > 0
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Tidak semua pemilih memiliki token terenkripsi yang dapat dicetak.",

          total:
            voters.length,

          printable:
            decryptedVoters.length,

          missing:
            missingToken,
        },
        {
          status: 409,
        }
      );
    }

    // ==================================================
    // BUAT PDF
    // ==================================================

    const pdfDoc =
      await PDFDocument.create();

    const fontRegular =
      await pdfDoc.embedFont(
        StandardFonts.Helvetica
      );

    const fontBold =
      await pdfDoc.embedFont(
        StandardFonts.HelveticaBold
      );

    const fonts = {
      fontRegular,
      fontBold,
    };

    // ==================================================
    // GENERATE HALAMAN
    // ==================================================

    decryptedVoters.forEach(
      (voter, index) => {
        const indexInPage =
          index %
          CARDS_PER_PAGE;

        if (
          indexInPage === 0
        ) {
          pdfDoc.addPage([
            595.28,
            841.89,
          ]);
        }

        const page =
          pdfDoc.getPage(
            pdfDoc.getPageCount() -
              1
          );

        drawVoterCard(
          page,
          fonts,
          voter,
          index
        );
      }
    );

    // ==================================================
    // PDF BYTES
    // ==================================================

    const pdfBytes =
      await pdfDoc.save();

    // ==================================================
    // AUDIT
    // ==================================================

    await supabase
      .from("audit_logs")
      .insert({
        election_id:
          election.id,

        event_type:
          "voter_cards_exported",

        metadata: {
          total_cards:
            decryptedVoters.length,

          admin_email:
            admin.email,
        },
      });

    // ==================================================
    // RESPONSE
    // ==================================================

    return new NextResponse(
      pdfBytes,
      {
        status: 200,

        headers: {
          "Content-Type":
            "application/pdf",

          "Content-Disposition":
            'attachment; filename="kartu-pemilih-nebula-semua-A4.pdf"',

          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Admin voter cards error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error.message ||
          "Gagal membuat kartu pemilih.",
      },
      {
        status: 500,
      }
    );
  }
}
