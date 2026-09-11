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
  const [status, setStatus] =
    useState(initialStatus);

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  async function changeStatus(action) {
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
          body: JSON.stringify({
            action,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage(
          data.message ||
            "Perubahan status gagal."
        );
        return;
      }

      setStatus(data.status);

      setMessage(
        data.status === "open"
          ? "Pemilihan berhasil dibuka."
          : "Pemilihan berhasil ditutup."
      );
    } catch (error) {
      console.error(error);

      setMessage(
        "Tidak dapat terhubung ke server."
      );
    } finally {
      setLoading(false);
    }
  }

  const statusLabel = {
    draft: "DRAFT",
    open: "OPEN",
    closed: "CLOSED",
  };

  return (
    <div>

      {/* STATUS */}
      <div className="info">
        <p>
          <strong>Pemilihan</strong>
        </p>

        <p>{electionName}</p>

        <p style={{ marginTop: "20px" }}>
          <strong>Status</strong>
        </p>

        <p
          style={{
            fontSize: "24px",
            fontWeight: "700",
          }}
        >
          {statusLabel[status]}
        </p>
      </div>


      {/* STATISTIK */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "12px",
          marginTop: "20px",
        }}
      >

        <div className="info">
          <p
            style={{
              fontSize: "13px",
              color: "#667085",
            }}
          >
            Total Pemilih
          </p>

          <p
            style={{
              fontSize: "28px",
              fontWeight: "700",
              margin: "8px 0 0",
            }}
          >
            {totalVoters}
          </p>
        </div>


        <div className="info">
          <p
            style={{
              fontSize: "13px",
              color: "#667085",
            }}
          >
            Sudah Memilih
          </p>

          <p
            style={{
              fontSize: "28px",
              fontWeight: "700",
              margin: "8px 0 0",
            }}
          >
            {votedVoters}
          </p>
        </div>


        <div className="info">
          <p
            style={{
              fontSize: "13px",
              color: "#667085",
            }}
          >
            Belum Memilih
          </p>

          <p
            style={{
              fontSize: "28px",
              fontWeight: "700",
              margin: "8px 0 0",
            }}
          >
            {notVotedVoters}
          </p>
        </div>


        <div className="info">
          <p
            style={{
              fontSize: "13px",
              color: "#667085",
            }}
          >
            Partisipasi
          </p>

          <p
            style={{
              fontSize: "28px",
              fontWeight: "700",
              margin: "8px 0 0",
            }}
          >
            {participation}%
          </p>
        </div>

      </div>


      {/* TOTAL BALLOT */}
      <div
        className="info"
        style={{ marginTop: "12px" }}
      >
        <p>
          <strong>Total Ballot Tercatat</strong>
        </p>

        <p
          style={{
            fontSize: "24px",
            fontWeight: "700",
          }}
        >
          {totalBallots}
        </p>
      </div>


      {/* KONTROL PEMILIHAN */}

      {status === "draft" && (
        <button
          type="button"
          onClick={() =>
            changeStatus("open")
          }
          disabled={loading}
        >
          {loading
            ? "Membuka..."
            : "Buka Pemilihan"}
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
            ? "Menutup..."
            : "Tutup Pemilihan"}
        </button>
      )}

      {status === "closed" && (
        <div
          className="info"
          style={{ marginTop: "20px" }}
        >
          <p>
            🔒 Pemilihan telah ditutup.
          </p>
        </div>
      )}


      {message && (
        <div
          className="info"
          style={{ marginTop: "20px" }}
        >
          <p>{message}</p>
        </div>
      )}

    </div>
  );
}
