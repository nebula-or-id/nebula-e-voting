export default function Home() {
  return (
    <main className="page">
      <section className="card">
        <div className="badge">NEBULA E-VOTING</div>

        <h1>Pemilihan Ketua</h1>

        <p className="subtitle">
          Sistem pemilihan digital dengan metode Weighted Borda Count.
        </p>

        <div className="info">
          <p>
            <strong>1 Pemilih = 1 Suara</strong>
          </p>
          <p>
            Silakan gunakan NISN/ID dan token yang telah diberikan.
          </p>
        </div>

        <button>Mulai Memilih</button>
      </section>
    </main>
  );
}
