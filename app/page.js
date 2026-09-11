import { supabase } from "../lib/supabase";

export default async function Home() {
  const { data, error } = await supabase
    .from("elections")
    .select("name, description, status")
    .limit(1)
    .single();

  if (error) {
    return (
      <main className="page">
        <section className="card">
          <div className="badge">NEBULA E-VOTING</div>

          <h1>Koneksi Database Gagal</h1>

          <p className="subtitle">
            Aplikasi belum berhasil membaca data dari Supabase.
          </p>

          <div className="info">
            <p>
              <strong>Error:</strong>
            </p>
            <p>{error.message}</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="card">
        <div className="badge">NEBULA E-VOTING</div>

        <h1>{data.name}</h1>

        <p className="subtitle">
          Database Supabase berhasil terhubung.
        </p>

        <div className="info">
          <p>
            <strong>Status Pemilihan:</strong> {data.status}
          </p>

          <p>{data.description}</p>
        </div>
      </section>
    </main>
  );
}
