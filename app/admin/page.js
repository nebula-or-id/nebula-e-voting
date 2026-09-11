import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import AdminDashboard from "./AdminDashboard";

async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
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
                cookieStore.set(name, value, options);
              }
            );
          } catch {
            // Tidak selalu dapat menulis cookie
            // dari Server Component.
          }
        },
      },
    }
  );
}

export default async function AdminPage() {
  const supabaseAuth =
    await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  // Untuk sementara hanya admin utama
  if (user.email !== "admin@nebula.or.id") {
    redirect("/");
  }

  // ----------------------------------------------------
  // Client server menggunakan SECRET KEY
  // Dipakai hanya di server untuk statistik admin.
  // ----------------------------------------------------

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  // ----------------------------------------------------
  // Ambil election
  // ----------------------------------------------------

  const { data: election, error: electionError } =
    await supabaseAdmin
      .from("elections")
      .select(
        "id, name, description, status, opened_at, closed_at"
      )
      .eq(
        "name",
        "Pemilihan Ketua KIR Nebula Periode 2026/2027"
      )
      .limit(1)
      .single();

  if (electionError || !election) {
    return (
      <main className="page">
        <section className="card">
          <div className="badge">
            NEBULA E-VOTING
          </div>

          <h1>Admin Dashboard</h1>

          <div className="info">
            <p>
              Data pemilihan tidak ditemukan.
            </p>
          </div>
        </section>
      </main>
    );
  }

  // ----------------------------------------------------
  // Statistik pemilih
  // ----------------------------------------------------

  const { count: totalVoters, error: voterError } =
    await supabaseAdmin
      .from("voters")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("election_id", election.id);

  const {
    count: votedVoters,
    error: votedError,
  } = await supabaseAdmin
    .from("voters")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("election_id", election.id)
    .eq("has_voted", true);

  if (voterError || votedError) {
    console.error(
      "Voter statistics error:",
      voterError || votedError
    );
  }

  const total =
    totalVoters || 0;

  const voted =
    votedVoters || 0;

  const notVoted =
    Math.max(total - voted, 0);

  const participation =
    total > 0
      ? ((voted / total) * 100).toFixed(2)
      : "0.00";

  // ----------------------------------------------------
  // Jumlah ballot
  // ----------------------------------------------------

  const {
    count: totalBallots,
    error: ballotError,
  } = await supabaseAdmin
    .from("ballots")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("election_id", election.id);

  if (ballotError) {
    console.error(
      "Ballot statistics error:",
      ballotError
    );
  }

  return (
    <main className="page">
      <section className="card">

        <div className="badge">
          NEBULA E-VOTING
        </div>

        <h1>Admin Dashboard</h1>

        <p className="subtitle">
          Panel administrasi pemilihan
        </p>

        <AdminDashboard
          initialStatus={election.status}
          electionName={election.name}
          totalVoters={total}
          votedVoters={voted}
          notVotedVoters={notVoted}
          participation={participation}
          totalBallots={totalBallots || 0}
        />

      </section>
    </main>
  );
}
