import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
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
            // Server Component tidak selalu dapat menulis cookie.
          }
        },
      },
    }
  );
}

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belum login sebagai admin
  if (!user) {
    redirect("/admin/login");
  }

  // Untuk sementara hanya akun admin utama
  if (user.email !== "admin@nebula.or.id") {
    redirect("/");
  }

  // Ambil data pemilihan
  const { data: election, error } = await supabase
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

  if (error || !election) {
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
        />
      </section>
    </main>
  );
}
