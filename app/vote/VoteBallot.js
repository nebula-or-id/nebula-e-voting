"use client";

import { useState } from "react";

export default function VoteBallot({ candidates }) {
  const [items, setItems] = useState(candidates);
  const [dragIndex, setDragIndex] = useState(null);

  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [success, setSuccess] = useState(false);

  function handleDragStart(index) {
    setDragIndex(index);
  }

  function handleDragOver(event) {
    event.preventDefault();
  }

  function handleDrop(index) {
    if (dragIndex === null) return;

    const updated = [...items];

    const [moved] = updated.splice(dragIndex, 1);

    updated.splice(index, 0, moved);

    setItems(updated);
    setDragIndex(null);
  }

  async function submitVote() {
    setSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch(
        "/api/submit-ballot",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ranking: items.map(
              (candidate) => candidate.id
            ),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        setErrorMessage(
          data.message ||
            "Suara gagal direkam."
        );
        return;
      }

      setSuccess(true);

    } catch (error) {
      setErrorMessage(
        "Tidak dapat terhubung ke server."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="info">
        <div
          style={{
            fontSize: "56px",
            textAlign: "center",
          }}
        >
          ✅
        </div>

        <h2 style={{ textAlign: "center" }}>
          Suara Berhasil Direkam
        </h2>

        <p style={{ textAlign: "center" }}>
          Terima kasih telah menggunakan hak pilih Anda.
        </p>

        <p style={{ textAlign: "center" }}>
          Anda dapat meninggalkan halaman ini.
        </p>
      </div>
    );
  }

  if (confirming) {
    return (
      <div>
        <h2>Konfirmasi Pilihan</h2>

        <p>
          Pastikan urutan pilihan Anda sudah benar.
        </p>

        <div style={{ marginTop: "20px" }}>
          {items.map((candidate, index) => (
            <div
              key={candidate.id}
              style={{
                padding: "14px",
                marginBottom: "10px",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
              }}
            >
              <strong>
                Peringkat {index + 1}
              </strong>

              <div>
                {candidate.name}
              </div>
            </div>
          ))}
        </div>

        {errorMessage && (
          <div
            className="info"
            style={{ marginTop: "16px" }}
          >
            <p>{errorMessage}</p>
          </div>
        )}

        <button
          type="button"
          onClick={submitVote}
          disabled={submitting}
        >
          {submitting
            ? "Merekam Suara..."
            : "Kirim Suara"}
        </button>

        <button
          type="button"
          onClick={() =>
            setConfirming(false)
          }
          disabled={submitting}
          style={{
            marginTop: "10px",
            background: "transparent",
            color: "#172033",
            border: "1px solid #d0d5dd",
          }}
        >
          Kembali
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2>
        Susun Urutan Pilihan
      </h2>

      <p className="subtitle">
        Tarik kandidat untuk mengurutkan dari
        pilihan pertama hingga terakhir.
      </p>

      <div style={{ marginTop: "24px" }}>
        {items.map((candidate, index) => (
          <div
            key={candidate.id}
            draggable
            onDragStart={() =>
              handleDragStart(index)
            }
            onDragOver={handleDragOver}
            onDrop={() =>
              handleDrop(index)
            }
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              padding: "16px",
              marginBottom: "12px",
              border: "1px solid #d0d5dd",
              borderRadius: "14px",
              cursor: "grab",
              background: "white",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                background: "#eef2ff",
                fontWeight: "700",
              }}
            >
              {index + 1}
            </div>

            <div style={{ flex: 1 }}>
              <strong>
                {candidate.name}
              </strong>

              <div
                style={{
                  color: "#667085",
                  marginTop: "4px",
                }}
              >
                {candidate.class_name}
              </div>
            </div>

            <div
              style={{
                fontSize: "20px",
                color: "#98a2b3",
              }}
            >
              ⋮⋮
            </div>
          </div>
        ))}
      </div>

      {errorMessage && (
        <div
          className="info"
          style={{ marginTop: "16px" }}
        >
          <p>{errorMessage}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() =>
          setConfirming(true)
        }
      >
        Lanjut ke Konfirmasi
      </button>
    </div>
  );
}
