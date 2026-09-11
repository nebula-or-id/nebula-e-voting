import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import crypto from "crypto";

function hashSessionToken(sessionToken) {
  return crypto
    .createHash("sha256")
    .update(sessionToken)
    .digest("hex");
}

export async function getVotingSession() {
  const cookieStore = await cookies();

  const sessionToken = cookieStore.get(
    "nebula_voting_session"
  )?.value;

  if (!sessionToken) {
    return null;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error("Konfigurasi Supabase server belum tersedia.");
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

  const sessionHash = hashSessionToken(sessionToken);

  const { data, error } = await supabase
    .from("voting_sessions")
    .select(`
      id,
      voter_id,
      expires_at,
      consumed_at,
      voters (
        id,
        election_id,
        full_name,
        has_voted,
        elections (
          id,
          name,
          status
        )
      )
    `)
    .eq("session_token_hash", sessionHash)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Voting session error:", error);
    return null;
  }

  if (!data || !data.voters) {
    return null;
  }

  const voter = Array.isArray(data.voters)
    ? data.voters[0]
    : data.voters;

  if (!voter) {
    return null;
  }

  const election = Array.isArray(voter.elections)
    ? voter.elections[0]
    : voter.elections;

  if (!election) {
    return null;
  }

  if (election.status !== "open") {
    return null;
  }

  if (voter.has_voted) {
    return null;
  }

  return {
    sessionId: data.id,
    voterId: voter.id,
    electionId: election.id,
    voterName: voter.full_name,
    electionName: election.name,
  };
}
