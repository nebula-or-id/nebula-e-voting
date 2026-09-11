import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { getVotingSession } from "../../lib/voting-auth";
import VoteBallot from "./VoteBallot";

export default async function VotePage() {
  const session = await getVotingSession();

  if (!session) {
    redirect("/");
  }

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

  const { data: candidates, error } =
    await supabase
      .from("candidates")
      .select(`
        id,
        candidate_number,
        name,
        class_name,
        vision,
        mission,
        photo_url
      `)
      .eq("election_id", session.electionId)
      .order("candidate_number", {
        ascending: true,
      });

  if (error) {
    console.error("Candidates error:", error);

    return (
      <main className="page">
        <section className="card">
          <div className="badge">
            NEBULA E-VOTING
          </div>

          <h1>Terjadi Kesalahan</h1>

          <p className="subtitle">
            Kandidat belum dapat dimuat.
          </p>
        </section>
      </main>
    );
  }

  if (!candidates || candidates.length === 0) {
    return (
      <main className="page">
        <section className="card">
          <div className="badge">
            NEBULA E-VOTING
          </div>

          <h1>Kandidat Belum Tersedia</h1>

          <p className="subtitle">
            Belum ada kandidat untuk pemilihan ini.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="card">

        <div className="badge">
          NEBULA E-VOTING
        </div>

        <p className="subtitle">
          {session.electionName}
        </p>

        <h1>
          Halo, {session.voterName}!
        </h1>

        <div className="info">
          <p>
            Anda telah berhasil terverifikasi sebagai
            pemilih.
          </p>

          <p>
            Silakan susun kandidat sesuai urutan
            pilihan Anda.
          </p>
        </div>

        <VoteBallot
          candidates={candidates}
        />

      </section>
    </main>
  );
}
