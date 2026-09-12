import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const ELECTION_NAME =
  "Pemilihan Ketua KIR Nebula Periode 2026/2027";

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
          // Tidak perlu mengubah cookie di route ini.
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  return user;
}

export async function GET() {
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

    const { data: election, error: electionError } =
      await supabaseAdmin
        .from("elections")
        .select("id,name,status")
        .eq("name", ELECTION_NAME)
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
          message: "Pemilihan tidak ditemukan.",
        },
        { status: 404 }
      );
    }

    const { data: candidates, error: candidateError } =
      await supabaseAdmin
        .from("candidates")
        .select(
          "id,candidate_number,name,class_name"
        )
        .eq("election_id", election.id)
        .order("candidate_number", {
          ascending: true,
        });

    if (candidateError) {
      throw new Error(
        `Gagal mengambil kandidat: ${candidateError.message}`
      );
    }

    const candidateList = candidates || [];

    const candidateCount =
      candidateList.length;

    if (candidateCount === 0) {
      return NextResponse.json({
        success: true,
        election: {
          id: election.id,
          name: election.name,
          status: election.status,
        },
        totalBallots: 0,
        totalWeightedScore: 0,
        candidates: [],
      });
    }

    const { data: ballots, error: ballotError } =
      await supabaseAdmin
        .from("ballots")
        .select(
          `
            id,
            weight_snapshot,
            submitted_at,
            ballot_rankings (
              candidate_id,
              rank
            )
          `
        )
        .eq("election_id", election.id)
        .order("submitted_at", {
          ascending: true,
        });

    if (ballotError) {
      throw new Error(
        `Gagal mengambil ballot: ${ballotError.message}`
      );
    }

    const ballotList = ballots || [];

    const resultMap = new Map();

    for (const candidate of candidateList) {
      resultMap.set(candidate.id, {
        candidateId: candidate.id,
        candidateNumber:
          candidate.candidate_number,
        name: candidate.name,
        className:
          candidate.class_name,
        rankCounts: {},
        bordaScore: 0,
        weightedBordaScore: 0,
      });
    }

    let totalWeightedScore = 0;

    for (const ballot of ballotList) {
      const weight =
        Number(ballot.weight_snapshot) || 0;

      for (const ranking of
        ballot.ballot_rankings || []) {
        const result =
          resultMap.get(
            ranking.candidate_id
          );

        if (!result) {
          continue;
        }

        const rank =
          Number(ranking.rank) || 0;

        if (rank <= 0) {
          continue;
        }

        // Weighted Borda:
        // poin = jumlah kandidat - ranking + 1
        const bordaPoints =
          candidateCount - rank + 1;

        if (bordaPoints < 0) {
          continue;
        }

        const weightedPoints =
          bordaPoints * weight;

        result.rankCounts[rank] =
          (result.rankCounts[rank] || 0) + 1;

        result.bordaScore +=
          bordaPoints;

        result.weightedBordaScore +=
          weightedPoints;

        totalWeightedScore +=
          weightedPoints;
      }
    }

    const rankedCandidates =
      Array.from(resultMap.values())
        .sort((a, b) => {
          if (
            b.weightedBordaScore !==
            a.weightedBordaScore
          ) {
            return (
              b.weightedBordaScore -
              a.weightedBordaScore
            );
          }

          if (
            b.bordaScore !==
            a.bordaScore
          ) {
            return (
              b.bordaScore -
              a.bordaScore
            );
          }

          return (
            a.candidateNumber -
            b.candidateNumber
          );
        })
        .map((candidate, index) => ({
          ...candidate,
          rank: index + 1,
          isWinner:
            index === 0 &&
            ballotList.length > 0,
        }));

    return NextResponse.json({
      success: true,
      election: {
        id: election.id,
        name: election.name,
        status: election.status,
      },
      totalBallots:
        ballotList.length,
      candidateCount,
      totalWeightedScore,
      candidates: rankedCandidates,
    });
  } catch (error) {
    console.error(
      "Election results error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error.message ||
          "Gagal mengambil hasil pemilihan.",
      },
      { status: 500 }
    );
  }
}
