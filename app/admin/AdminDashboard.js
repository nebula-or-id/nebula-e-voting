"use client";

import { useRef, useState } from "react";

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

  // ----------------------------------------------------
  // Import pemilih
  // ----------------------------------------------------

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] =
    useState(null);

  const fileInputRef = useRef(null);

  // ----------------------------------------------------
  // Kandidat
  // ----------------------------------------------------

  const [candidates, setCandidates] =
    useState([]);

  const [candidateLoading, setCandidateLoading] =
    useState(false);

  const [showCandidateForm, setShowCandidateForm] =
    useState(false);

  const [candidateNumber, setCandidateNumber] =
    useState("");

  const [candidateName, setCandidateName] =
    useState("");

  const [candidateClass, setCandidateClass] =
    useState("");

  const [candidateProgram, setCandidateProgram] =
    useState("");

  const [candidatePhoto, setCandidatePhoto] =
    useState(null);

  const candidatePhotoRef = useRef(null);

  // ====================================================
  // STATUS PEMILIHAN
  // ====================================================

  async function changeStatus(action) {
    const confirmMessage =
      action === "open"
        ? "Yakin ingin membuka pemilihan? Setelah dibuka, pemilih dapat mulai memberikan suara."
        : "Yakin ingin menutup pemilihan? Setelah ditutup, pemilih tidak dapat mengirim suara baru.";

    const confirmed =
      window.confirm(confirmMessage);

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
          data.message ||
            "Gagal mengubah status."
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

  // ====================================================
  // PREPARE ELECTION
  // ====================================================

  async function prepareElection() {
    const confirmed =
      window.confirm(
        "SIAPKAN PEMILIHAN?\n\n" +
          "Tindakan ini akan:\n" +
          "• Menghapus seluruh ballot voting.\n" +
          "• Menghapus ranking ballot.\n" +
          "• Menghapus session voting.\n" +
          "• Mengembalikan semua pemilih menjadi belum memilih.\n" +
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

  // ====================================================
  // IMPORT PEMILIH
  // ====================================================

  async function importVoters() {
    const file =
      fileInputRef.current?.files?.[0];

    if (!file) {
      setMessage(
        "Silakan pilih file Excel terlebih dahulu."
      );
      return;
    }

    const confirmed =
      window.confirm(
        `Import file "${file.name}"?\n\n` +
          "Pastikan kolom Excel adalah:\n" +
          "NISN | Nama | Kategori\n\n" +
          "Setiap pemilih baru akan mendapatkan token otomatis."
      );

    if (!confirmed) {
      return;
    }

    setImporting(true);
    setMessage("");
    setImportResult(null);

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      const response =
        await fetch(
          "/api/import-voters",
          {
            method: "POST",
            body: formData,
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        let errorMessage =
          data.message ||
          "Gagal mengimport pemilih.";

        if (
          data.errors &&
          Array.isArray(data.errors)
        ) {
          errorMessage +=
            "\n\n" +
            data.errors.join("\n");
        }

        if (
          data.existing &&
          Array.isArray(data.existing)
        ) {
          errorMessage +=
            "\n\nNISN yang sudah terdaftar:\n" +
            data.existing.join(
              ", "
            );
        }

        throw new Error(
          errorMessage
        );
      }

      setImportResult(data);

      setMessage(
        `Berhasil mengimport ${data.imported} pemilih.`
      );

      if (fileInputRef.current) {
        fileInputRef.current.value =
          "";
      }
    } catch (error) {
      setMessage(
        error.message ||
          "Terjadi kesalahan saat import."
      );
    } finally {
      setImporting(false);
    }
  }

  function downloadTokens() {
    if (
      !importResult?.voters ||
      importResult.voters.length === 0
    ) {
      return;
    }

    const rows = [
      ["NISN", "Nama", "Token"],
      ...importResult.voters.map(
        (voter) => [
          voter.nisn,
          voter.nama,
          voter.token,
        ]
      ),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) =>
            `"${String(
              cell
            ).replaceAll(
              '"',
              '""'
            )}"`
          )
          .join(",")
      )
      .join("\n");

    const blob = new Blob(
      ["\uFEFF" + csv],
      {
        type:
          "text/csv;charset=utf-8;",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement(
        "a"
      );

    link.href = url;
    link.download =
      "token-pemilih-nebula.csv";

    document.body.appendChild(
      link
    );

    link.click();

    document.body.removeChild(
      link
    );

    URL.revokeObjectURL(url);
  }

  // ====================================================
  // AMBIL KANDIDAT
  // ====================================================

  async function loadCandidates() {
    setCandidateLoading(true);
    setMessage("");

    try {
      const response =
        await fetch(
          "/api/candidates"
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Gagal mengambil data kandidat."
        );
      }

      setCandidates(
        data.candidates || []
      );
    } catch (error) {
      setMessage(
        error.message ||
          "Gagal mengambil kandidat."
      );
    } finally {
      setCandidateLoading(false);
    }
  }

  // ====================================================
  // FORM KANDIDAT
  // ====================================================

  function openCandidateForm() {
    setCandidateNumber("");
    setCandidateName("");
    setCandidateClass("");
    setCandidateProgram("");
    setCandidatePhoto(null);

    if (candidatePhotoRef.current) {
      candidatePhotoRef.current.value =
        "";
    }

    setShowCandidateForm(true);
    loadCandidates();
  }

  function closeCandidateForm() {
    setShowCandidateForm(false);
  }

  // ====================================================
  // TAMBAH KANDIDAT
  // ====================================================

  async function addCandidate() {
    if (status !== "draft") {
      setMessage(
        "Kandidat hanya dapat dikelola saat status DRAFT."
      );
      return;
    }

    if (
      !candidateNumber ||
      !candidateName ||
      !candidateClass ||
      !candidateProgram
    ) {
      setMessage(
        "Nomor, nama, kelas, dan program unggulan wajib diisi."
      );
      return;
    }

    const confirmed =
      window.confirm(
        `Simpan Kandidat ${candidateNumber}?\n\n` +
          `Nama: ${candidateName}\n` +
          `Kelas: ${candidateClass}\n\n` +
          "Data kandidat akan disimpan."
      );

    if (!confirmed) {
      return;
    }

    setCandidateLoading(true);
    setMessage("");

    try {
      const formData =
        new FormData();

      formData.append(
        "candidateNumber",
        candidateNumber
      );

      formData.append(
        "name",
        candidateName
      );

      formData.append(
        "className",
        candidateClass
      );

      formData.append(
        "program",
        candidateProgram
      );

      if (candidatePhoto) {
        formData.append(
          "photo",
          candidatePhoto
        );
      }

      const response =
        await fetch(
          "/api/candidates",
          {
            method: "POST",
            body: formData,
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Gagal menambahkan kandidat."
        );
      }

      setMessage(
        "Kandidat berhasil ditambahkan."
      );

      setShowCandidateForm(false);

      setCandidateNumber("");
      setCandidateName("");
      setCandidateClass("");
      setCandidateProgram("");
      setCandidatePhoto(null);

      if (candidatePhotoRef.current) {
        candidatePhotoRef.current.value =
          "";
      }

      await loadCandidates();
    } catch (error) {
      setMessage(
        error.message ||
          "Terjadi kesalahan saat menyimpan kandidat."
      );
    } finally {
      setCandidateLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="card">

        {/* ==================================================
            HEADER
        ================================================== */}

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

        {/* ==================================================
            STATISTIK
        ================================================== */}

        <div className="stats">

          <div className="stat-card">
            <span>Total Pemilih</span>
            <strong>
              {totalVoters}
            </strong>
          </div>

          <div className="stat-card">
            <span>Sudah Memilih</span>
            <strong>
              {votedVoters}
            </strong>
          </div>

          <div className="stat-card">
            <span>Belum Memilih</span>
            <strong>
              {notVotedVoters}
            </strong>
          </div>

          <div className="stat-card">
            <span>Partisipasi</span>
            <strong>
              {Number(
                participation
              ).toFixed(2)}
              %
            </strong>
          </div>

          <div className="stat-card">
            <span>Total Ballot</span>
            <strong>
              {totalBallots}
            </strong>
          </div>

        </div>

        {/* ==================================================
            KONTROL PEMILIHAN
        ================================================== */}

        <div className="admin-actions">

          <h2>
            Kontrol Pemilihan
          </h2>

          <button
            type="button"
            onClick={
              prepareElection
            }
            disabled={
              loading ||
              importing ||
              candidateLoading
            }
          >
            {loading
              ? "Memproses..."
              : "⚙️ Siapkan Pemilihan"}
          </button>

          {status ===
            "draft" && (
            <button
              type="button"
              onClick={() =>
                changeStatus("open")
              }
              disabled={
                loading ||
                importing ||
                candidateLoading
              }
            >
              {loading
                ? "Memproses..."
                : "🟢 Buka Pemilihan"}
            </button>
          )}

          {status ===
            "open" && (
            <button
              type="button"
              onClick={() =>
                changeStatus("close")
              }
              disabled={
                loading ||
                importing ||
                candidateLoading
              }
            >
              {loading
                ? "Memproses..."
                : "🔴 Tutup Pemilihan"}
            </button>
          )}

          {status ===
            "closed" && (
            <p className="closed-message">
              Pemilihan sudah
              ditutup. Gunakan
              tombol{" "}
              <strong>
                Siapkan Pemilihan
              </strong>{" "}
              untuk kembali ke
              kondisi DRAFT.
            </p>
          )}

        </div>

        {/* ==================================================
            DATA PEMILIH
        ================================================== */}

        <div className="admin-actions">

          <h2>
            Data Pemilih
          </h2>

          <p className="subtitle">
            Import data pemilih dari
            Excel.
          </p>

          <div className="info">
            <strong>
              Format file:
            </strong>
            <br />
            NISN | Nama | Kategori
            <br />
            <br />
            <strong>
              Status pemilihan harus
              DRAFT.
            </strong>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            disabled={
              importing ||
              loading ||
              status !== "draft"
            }
          />

          <button
            type="button"
            onClick={
              importVoters
            }
            disabled={
              importing ||
              loading ||
              status !== "draft"
            }
          >
            {importing
              ? "📥 Mengimport..."
              : "📥 Import Pemilih"}
          </button>

          {status !==
            "draft" && (
            <p className="closed-message">
              Import pemilih hanya
              dapat dilakukan saat
              status DRAFT.
            </p>
          )}

          {importResult
            ?.voters &&
            importResult.voters
              .length > 0 && (
              <div className="import-result">

                <h3>
                  Import Berhasil
                </h3>

                <p>
                  {
                    importResult.imported
                  }{" "}
                  pemilih berhasil
                  ditambahkan.
                </p>

                <button
                  type="button"
                  onClick={
                    downloadTokens
                  }
                >
                  📄 Download Token
                  Pemilih
                </button>

                <p className="subtitle">
                  Simpan file token
                  dengan aman.
                </p>

              </div>
            )}

        </div>

        {/* ==================================================
            DATA KANDIDAT
        ================================================== */}

        <div className="admin-actions">

          <h2>
            Data Kandidat
          </h2>

          <p className="subtitle">
            Kelola kandidat pemilihan.
          </p>

          {status ===
            "draft" && (
            <button
              type="button"
              onClick={
                openCandidateForm
              }
              disabled={
                loading ||
                importing ||
                candidateLoading
              }
            >
              ➕ Tambah Kandidat
            </button>
          )}

          {status !==
            "draft" && (
            <p className="closed-message">
              Kandidat dikunci selama
              pemilihan berlangsung.
            </p>
          )}

          {showCandidateForm && (
            <div className="candidate-form">

              <h3>
                Tambah Kandidat
              </h3>

              <label>
                Nomor Kandidat
              </label>

              <input
                type="number"
                min="1"
                value={
                  candidateNumber
                }
                onChange={(event) =>
                  setCandidateNumber(
                    event.target
                      .value
                  )
                }
                placeholder="Contoh: 1"
              />

              <label>
                Nama Kandidat
              </label>

              <input
                type="text"
                value={
                  candidateName
                }
                onChange={(event) =>
                  setCandidateName(
                    event.target
                      .value
                  )
                }
                placeholder="Nama lengkap"
              />

              <label>
                Kelas
              </label>

              <input
                type="text"
                value={
                  candidateClass
                }
                onChange={(event) =>
                  setCandidateClass(
                    event.target
                      .value
                  )
                }
                placeholder="Contoh: XI.1"
              />

              <label>
                Foto Kandidat
              </label>

              <input
                ref={
                  candidatePhotoRef
                }
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(
                  event
                ) => {
                  setCandidatePhoto(
                    event.target
                      .files?.[0] ||
                      null
                  );
                }}
              />

              <small>
                JPG, PNG, atau WEBP.
                Maksimal 5 MB.
              </small>

              <label>
                Program Unggulan
              </label>

              <textarea
                value={
                  candidateProgram
                }
                onChange={(event) =>
                  setCandidateProgram(
                    event.target
                      .value
                  )
                }
                placeholder="Tuliskan program unggulan kandidat..."
                rows={5}
              />

              <div className="form-actions">

                <button
                  type="button"
                  onClick={
                    addCandidate
                  }
                  disabled={
                    candidateLoading
                  }
                >
                  {candidateLoading
                    ? "Menyimpan..."
                    : "💾 Simpan Kandidat"}
                </button>

                <button
                  type="button"
                  onClick={
                    closeCandidateForm
                  }
                  disabled={
                    candidateLoading
                  }
                >
                  Batal
                </button>

              </div>

            </div>
          )}

          {/* ================================================
              DAFTAR KANDIDAT
          ================================================ */}

          {candidateLoading &&
            !showCandidateForm && (
              <p className="subtitle">
                Memuat data kandidat...
              </p>
            )}

          {candidates.length >
            0 && (
            <div className="candidate-list">

              {candidates.map(
                (candidate) => (
                  <div
                    className="candidate-card"
                    key={
                      candidate.id
                    }
                  >

                    {candidate.photo_url && (
                      <img
                        src={
                          candidate.photo_url
                        }
                        alt={
                          candidate.name
                        }
                        className="candidate-photo"
                      />
                    )}

                    <div className="candidate-number">
                      No.{" "}
                      {
                        candidate.candidate_number
                      }
                    </div>

                    <h3>
                      {
                        candidate.name
                      }
                    </h3>

                    <p>
                      <strong>
                        Kelas:
                      </strong>{" "}
                      {
                        candidate.class_name
                      }
                    </p>

                    <p>
                      <strong>
                        Program Unggulan:
                      </strong>
                      <br />
                      {
                        candidate.vision
                      }
                    </p>

                  </div>
                )
              )}

            </div>
          )}

          {candidates.length ===
            0 &&
            !candidateLoading &&
            !showCandidateForm && (
              <div className="info">
                Belum ada data kandidat
                yang ditampilkan.
              </div>
            )}

        </div>

        {/* ==================================================
            PESAN SISTEM
        ================================================== */}

        {message && (
          <div className="message">
            {message}
          </div>
        )}

      </section>
    </main>
  );
}
