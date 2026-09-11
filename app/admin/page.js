import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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
                cookieStore.set(
                  name,
                  value,
                  options
                );
              }
            );
          } catch {
            // Cookie tidak selalu dapat ditulis
            // dari Server Component.
          }
        },
      },
    }
  );
}

export default async function AdminPage() {
  const supabase =
    await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belum login → kembali ke halaman login admin
  if (!user) {
    redirect("/admin/login");
  }

  return (
    <main className="page">
      <section className="card">
        <div className="badge">
          NEBULA E-VOTING
        </div>

        <h1>Admin Dashboard</h1>

        <p className="subtitle">
          Pemilihan Ketua KIR Nebula
          <br />
          Periode 2026/2027
        </p>

        <div className="info">
          <p>
            <strong>Admin:</strong>{" "}
            {user.email}
          </p>

          <p>
            <strong>Status Sistem:</strong>{" "}
            Terhubung
          </p>
        </div>

        <h2 style={{ marginTop: "30px" }}>
          Pengelolaan Pemilihan
        </h2>

        <p className="subtitle">
          Dashboard administrasi akan kita bangun
          pada langkah berikutnya.
        </p>
      </section>
    </main>
  );
}
