"use client";

import { useState } from "react";

export default function Home() {
  const [voterCode, setVoterCode] = useState("");
  const [token, setToken] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function verifyVoter(event) {
    event.preventDefault();

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/verify-voter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          voterCode,
          token,
        }),
      });

      const data = await response.json();

      setResult({
        ok: response.ok,
        data,
      });
    } catch (error) {
      setResult({
        ok: false,
        data: {
          message: "Tidak dapat terhubung ke server.",
        },
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="card">
        <div className="badge">NEBULA E-VOTING</div>

        <h1>Verifikasi Pemilih</h1>

        <p className="subtitle">
          Tes login menggunakan NISN/ID dan token pemilih.
        </p>

        <form onSubmit={verifyVoter}>
          <div style={{ marginBottom: "16px", textAlign: "left" }}>
            <label>
              <strong>NISN / ID Pemilih</strong>
            </label>

            <input
              type="text"
              value={voterCode}
              onChange={(e) => setVoterCode(e.target.value)}
              placeholder="Masukkan NISN / ID"
              autoComplete="off"
              style={{
                width: "100%",
                padding: "12px",
                marginTop: "8px",
                borderRadius: "10px",
                border: "1px solid #d0d5dd",
                fontSize: "16px",
              }}
            />
          </div>

          <div style={{ marginBottom: "20px", textAlign: "left" }}>
            <label>
              <strong>Token</strong>
            </label>

            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Masukkan token"
              autoComplete="off"
              style={{
                width: "100%",
                padding: "12px",
                marginTop: "8px",
                borderRadius: "10px",
                border: "1px solid #d0d5dd",
                fontSize: "16px",
              }}
            />
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "Memverifikasi..." : "Verifikasi Pemilih"}
          </button>
        </form>

        {result && (
          <div className="info" style={{ marginTop: "24px" }}>
            {result.ok ? (
              <>
                <h2>✅ Pemilih Terverifikasi</h2>

                <p>
                  <strong>Nama:</strong>{" "}
                  {result.data.voter?.name}
                </p>

                <p>
                  <strong>Bobot:</strong>{" "}
                  {result.data.voter?.weight}
                </p>

                <p>
                  <strong>Pemilihan:</strong>{" "}
                  {result.data.election?.name}
                </p>
              </>
            ) : (
              <>
                <h2>❌ Verifikasi Gagal</h2>

                <p>{result.data.message}</p>
              </>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
