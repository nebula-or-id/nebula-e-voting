import { supabase } from "../lib/supabase";

export default async function Home() {
  const result = await supabase
    .from("elections")
    .select("name, description, status")
    .limit(1);

  const { data, error } = result;

  return (
    <main className="page">
      <section className="card">
        <div className="badge">NEBULA E-VOTING</div>

        <h1>Tes Supabase</h1>

        {error ? (
          <>
            <p className="subtitle">Database masih belum bisa dibaca.</p>

            <div className="info">
              <p>
                <strong>Code:</strong> {error.code || "Tidak ada"}
              </p>

              <p>
                <strong>Message:</strong> {error.message}
              </p>

              <p>
                <strong>Details:</strong> {error.details || "-"}
              </p>

              <p>
                <strong>Hint:</strong> {error.hint || "-"}
              </p>
            </div>
          </>
        ) : (
          <>
            <h2>{data?.[0]?.name || "Data tidak ditemukan"}</h2>

            <div className="info">
              <p>
                <strong>Status:</strong> {data?.[0]?.status || "-"}
              </p>

              <p>
                <strong>Description:</strong>{" "}
                {data?.[0]?.description || "-"}
              </p>

              <p>
                ✅ Supabase berhasil dibaca dari aplikasi Vercel.
              </p>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
