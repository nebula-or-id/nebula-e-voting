import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { getVotingSession } from "../../lib/voting-auth";

export default async function VotePage() {
  const session = await getVotingSession();

  // Jika tidak punya session valid,
  // kembali ke halaman login.
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

  const { data: candidates, error } = await supabase
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
            Anda telah berhasil terverifikasi sebagai pemilih.
          </p>

          <p>
            Silakan lanjutkan ke proses pemilihan.
          </p>
        </div>

        <h2 style={{ marginTop: "30px" }}>
          Kandidat Ketua KIR Nebula
        </h2>

        <div style={{ marginTop: "20px" }}>
          {candidates?.map((candidate) => (
            <div
              key={candidate.id}
              style={{
                padding: "18px",
                marginBottom: "12px",
                border: "1px solid #e2e8f0",
                borderRadius: "14px",
                textAlign: "left",
                background: "#f8fafc",
              }}
            >
              <strong>
                No. {candidate.candidate_number}
              </strong>

              <h3 style={{ margin: "8px 0" }}>
                {candidate.name}
              </h3>

              <p style={{ margin: "0", color: "#667085" }}>
                {candidate.class_name}
              </p>
            </div>
          ))}
        </div>

      </section>
    </main>
  );
}
