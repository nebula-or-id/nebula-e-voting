export default function Home() {
  return (
    <main className="page">
      <section className="card">
        <div className="badge">NEBULA E-VOTING</div>

        <h1>Pemilihan Ketua KIR Nebula</h1>

        <p className="subtitle">
          Periode 2026/2027
        </p>

        <div className="info">
          <p>
            <strong>1 Pemilih = 1 Suara</strong>
          </p>

          <p>
            Pemilihan menggunakan metode Weighted Borda Count.
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
