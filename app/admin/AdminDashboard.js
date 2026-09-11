"use client";

import { useState } from "react";

export default function AdminDashboard({
  initialStatus,
  electionName,
  totalVoters,
  votedVoters,
  notVotedVoters,
  participation,
  totalBallots,
}) {
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function changeStatus(action) {
    const confirmMessage =
      action === "open"
        ? "Yakin ingin membuka pemilihan? Setelah dibuka, pemilih dapat mulai memberikan suara."
        : "Yakin ingin menutup pemilihan? Setelah ditutup, pemilih tidak dapat mengirim suara baru.";

    const confirmed = window.confirm(confirmMessage);

    if (!confirmed) {
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/admin/election-status",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Gagal mengubah status."
        );
      }

      setStatus(data.status);
      setMessage(
        action === "open"
          ? "Pemilihan berhasil dibuka."
          : "Pemilihan berhasil ditutup."
      );
    } catch (error) {
      setMessage(
        error.message ||
          "Terjadi kesalahan."
      );
    } finally {
      setLoading(false);
    }
  }

  async function prepareElection() {
    const confirmed = window.confirm(
      "SIAPKAN PEMILIHAN?\n\n" +
        "Tindakan ini akan:\n" +
        "• Menghapus seluruh ballot voting.\n" +
        "• Menghapus ranking ballot.\n" +
        "• Menghapus session voting.\n" +
        "• Mengembalikan status semua pemilih menjadi belum memilih.\n" +
        "• Mengembalikan status pemilihan menjadi DRAFT.\n\n" +
        "Data pemilih, kandidat, dan kategori pemilih TIDAK dihapus.\n\n" +
        "Lanjutkan?"
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/prepare-election",
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Gagal menyiapkan pemilihan."
        );
      }

      setStatus("draft");

      setMessage(
        "Pemilihan berhasil disiapkan kembali. Status sekarang DRAFT."
      );

      // Refresh halaman agar seluruh statistik ikut diperbarui
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      setMessage(
        error.message ||
          "Terjadi kesalahan saat menyiapkan pemilihan."
      );
    } finally {
      setLoading(false);
    }
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

        <div className="info">
          <strong>Pemilihan:</strong>
          <br />
          {electionName}
        </div>

        <div className="info">
          <strong>Status:</strong>{" "}
          {status.toUpperCase()}
        </div>

        <div className="stats">
          <div className="stat-card">
            <span>Total Pemilih</span>
            <strong>{totalVoters}</strong>
          </div>

          <div className="stat-card">
            <span>Sudah Memilih</span>
            <strong>{votedVoters}</strong>
          </div>

          <div className="stat-card">
            <span>Belum Memilih</span>
            <strong>{notVotedVoters}</strong>
          </div>

          <div className="stat-card">
            <span>Partisipasi</span>
            <strong>
              {Number(participation).toFixed(2)}%
            </strong>
          </div>

          <div className="stat-card">
            <span>Total Ballot</span>
            <strong>{totalBallots}</strong>
          </div>
        </div>

        <div className="admin-actions">
          <h2>Kontrol Pemilihan</h2>

          <button
            type="button"
            onClick={prepareElection}
            disabled={loading}
          >
            {loading
              ? "Memproses..."
              : "⚙️ Siapkan Pemilihan"}
          </button>

          {status === "draft" && (
            <button
              type="button"
              onClick={() =>
                changeStatus("open")
              }
              disabled={loading}
            >
              {loading
                ? "Memproses..."
                : "🟢 Buka Pemilihan"}
            </button>
          )}

          {status === "open" && (
            <button
              type="button"
              onClick={() =>
                changeStatus("close")
              }
              disabled={loading}
            >
              {loading
                ? "Memproses..."
                : "🔴 Tutup Pemilihan"}
            </button>
          )}

          {status === "closed" && (
            <p className="closed-message">
              Pemilihan sudah ditutup.
              Gunakan tombol{" "}
              <strong>
                Siapkan Pemilihan
              </strong>{" "}
              untuk mengembalikan pemilihan
              ke kondisi DRAFT.
            </p>
          )}

          {message && (
            <div className="message">
              {message}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
