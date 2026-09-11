"use client";

import { useState } from "react";

export default function Home() {
  const [voterCode, setVoterCode] = useState("");
  const [token, setToken] = useState("");

  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  async function verifyVoter(event) {
    event.preventDefault();

    setLoading(true);
    setVerified(null);
    setErrorMessage("");

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

      if (!response.ok || !data.success) {
        setErrorMessage(
          data.message || "Data pemilih tidak dapat diverifikasi."
        );
        return;
      }

      setVerified(data);
    } catch (error) {
      setErrorMessage(
        "Tidak dapat terhubung ke server. Silakan coba lagi."
      );
    } finally {
      setLoading(false);
    }
  }

  function resetVerification() {
    setVerified(null);
    setErrorMessage("");
    setToken("");
  }

  return (
    <main className="page">
      <section className="card">

        <div className="badge">
          NEBULA E-VOTING
        </div>

        {!verified ? (
          <>
            <h1>Verifikasi Pemilih</h1>

            <p className="subtitle">
              Pemilihan Ketua KIR Nebula
              <br />
              Periode 2026/2027
            </p>

            <form onSubmit={verifyVoter}>

              <div style={{ marginBottom: "18px", textAlign: "left" }}>
                <label>
                  <strong>NISN / ID Pemilih</strong>
                </label>

                <input
                  type="text"
                  value={voterCode}
                  onChange={(e) => setVoterCode(e.target.value)}
                  placeholder="Masukkan NISN"
                  autoComplete="off"
                  required
                  style={{
                    width: "100%",
                    padding: "13px",
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
                  placeholder="Masukkan token pada kartu"
                  autoComplete="off"
                  required
                  style={{
                    width: "100%",
                    padding: "13px",
                    marginTop: "8px",
                    borderRadius: "10px",
                    border: "1px solid #d0d5dd",
                    fontSize: "16px",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
              >
                {loading
                  ? "Memverifikasi..."
                  : "Verifikasi Pemilih"}
              </button>

            </form>

            {errorMessage && (
              <div className="info" style={{ marginTop: "20px" }}>
                <h3>Verifikasi Gagal</h3>

                <p>{errorMessage}</p>
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ fontSize: "42px" }}>
              ✅
            </div>

            <h1>Pemilih Terverifikasi</h1>

            <p className="subtitle">
              Data pemilih berhasil diverifikasi.
            </p>

            <div
              className="info"
              style={{
                marginTop: "24px",
                textAlign: "left",
              }}
            >
              <p>
                <strong>Nama</strong>
              </p>

              <p style={{ fontSize: "20px" }}>
                {verified.voter.name}
              </p>

              <p>
                <strong>Pemilihan</strong>
              </p>

              <p>
                {verified.election.name}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                window.location.href = "/vote";
              }}
            >
              Lanjut Memilih
            </button>

            <button
              type="button"
              onClick={resetVerification}
              style={{
                marginTop: "12px",
                background: "transparent",
                color: "#172033",
                border: "1px solid #d0d5dd",
              }}
            >
              Kembali
            </button>
          </>
        )}

      </section>
    </main>
  );
}
