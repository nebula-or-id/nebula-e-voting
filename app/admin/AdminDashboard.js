"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

export default function AdminDashboard({
  initialStatus,
  electionName,
  totalVoters,
  votedVoters,
  notVotedVoters,
  participation,
  totalBallots,
}) {
  // ====================================================
  // STATE UMUM
  // ====================================================

  const [status, setStatus] =
    useState(initialStatus);

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  // ====================================================
  // IMPORT PEMILIH
  // ====================================================

  const [importing, setImporting] =
    useState(false);

  const [importResult, setImportResult] =
    useState(null);

  const fileInputRef =
    useRef(null);

  // ====================================================
  // KANDIDAT
  // ====================================================

  const [candidates, setCandidates] =
    useState([]);

  const [
    candidateLoading,
    setCandidateLoading,
  ] = useState(false);

  const [
    showCandidateForm,
    setShowCandidateForm,
  ] = useState(false);

  const [
    editingCandidate,
    setEditingCandidate,
  ] = useState(null);

  const [
    candidateNumber,
    setCandidateNumber,
  ] = useState("");

  const [
    candidateName,
    setCandidateName,
  ] = useState("");

  const [
    candidateClass,
    setCandidateClass,
  ] = useState("");

  const [
    candidateProgram,
    setCandidateProgram,
  ] = useState("");

  const [
    candidatePhoto,
    setCandidatePhoto,
  ] = useState(null);

  const [
    candidatePhotoPreview,
    setCandidatePhotoPreview,
  ] = useState(null);

  const [
    removeExistingPhoto,
    setRemoveExistingPhoto,
  ] = useState(false);

  const candidatePhotoRef =
    useRef(null);

  // ====================================================
  // LOAD KANDIDAT OTOMATIS
  // ====================================================

  useEffect(() => {
    loadCandidates();
  }, []);

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
      const response =
        await fetch(
          "/api/admin/election-status",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              action,
            }),
          }
        );

      const data =
        await response.json();

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
      const response =
        await fetch(
          "/api/prepare-election",
          {
            method: "POST",
          }
        );

      const data =
        await response.json();

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
          Array.isArray(
            data.errors
          )
        ) {
          errorMessage +=
            "\n\n" +
            data.errors.join(
              "\n"
            );
        }

        if (
          data.existing &&
          Array.isArray(
            data.existing
          )
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

  // ====================================================
  // DOWNLOAD TOKEN
  // ====================================================

  function downloadTokens() {
    if (
      !importResult?.voters ||
      importResult.voters.length ===
        0
    ) {
      return;
    }

    const rows = [
      [
        "NISN",
        "Nama",
        "Token",
      ],
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

    URL.revokeObjectURL(
      url
    );
  }

  // ====================================================
  // LOAD KANDIDAT
  // ====================================================

  async function loadCandidates() {
    setCandidateLoading(true);

    try {
      const response =
        await fetch(
          "/api/candidates",
          {
            method: "GET",
            cache: "no-store",
          }
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
      console.error(
        "Load candidates error:",
        error
      );

      setMessage(
        error.message ||
          "Gagal mengambil kandidat."
      );
    } finally {
      setCandidateLoading(
        false
      );
    }
  }

  // ====================================================
  // RESET FORM KANDIDAT
  // ====================================================

  function resetCandidateForm() {
    setCandidateNumber("");
    setCandidateName("");
    setCandidateClass("");
    setCandidateProgram("");
    setCandidatePhoto(null);
    setCandidatePhotoPreview(null);
    setRemoveExistingPhoto(false);

    if (
      candidatePhotoRef.current
    ) {
      candidatePhotoRef.current.value =
        "";
    }
  }

  // ====================================================
  // BUKA FORM TAMBAH
  // ====================================================

  function openCandidateForm() {
    resetCandidateForm();
    setEditingCandidate(null);
    setShowCandidateForm(true);
  }

  // ====================================================
  // BUKA FORM EDIT
  // ====================================================

  function openEditCandidate(
    candidate
  ) {
    setEditingCandidate(
      candidate
    );

    setCandidateNumber(
      String(
        candidate.candidate_number
      )
    );

    setCandidateName(
      candidate.name || ""
    );

    setCandidateClass(
      candidate.class_name ||
        ""
    );

    setCandidateProgram(
      candidate.vision || ""
    );

    setCandidatePhoto(null);

    setCandidatePhotoPreview(
      candidate.photo_url ||
        null
    );

    setRemoveExistingPhoto(
      false
    );

    if (
      candidatePhotoRef.current
    ) {
      candidatePhotoRef.current.value =
        "";
    }

    setShowCandidateForm(true);
  }

  function closeCandidateForm() {
    resetCandidateForm();
    setEditingCandidate(null);
    setShowCandidateForm(false);
  }

  // ====================================================
  // PREVIEW FOTO
  // ====================================================

  function handlePhotoChange(
    event
  ) {
    const file =
      event.target.files?.[0] ||
      null;

    setCandidatePhoto(file);

    if (!file) {
      if (editingCandidate) {
        setCandidatePhotoPreview(
          editingCandidate.photo_url ||
            null
        );
      } else {
        setCandidatePhotoPreview(
          null
        );
      }

      return;
    }

    const previewUrl =
      URL.createObjectURL(file);

    setCandidatePhotoPreview(
      previewUrl
    );

    setRemoveExistingPhoto(
      false
    );
  }

  // ====================================================
  // TAMBAH / EDIT KANDIDAT
  // ====================================================

  async function saveCandidate() {
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

    const isEditing =
      Boolean(editingCandidate);

    const actionText =
      isEditing
        ? "memperbarui"
        : "menambahkan";

    const confirmed =
      window.confirm(
        isEditing
          ? `Yakin ingin memperbarui Kandidat ${candidateNumber}?\n\nNama: ${candidateName}\nKelas: ${candidateClass}`
          : `Yakin ingin menambahkan Kandidat ${candidateNumber}?\n\nNama: ${candidateName}\nKelas: ${candidateClass}`
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

      let response;

      if (isEditing) {
        formData.append(
          "candidateId",
          editingCandidate.id
        );

        formData.append(
          "removePhoto",
          String(
            removeExistingPhoto
          )
        );

        response =
          await fetch(
            "/api/candidates",
            {
              method: "PUT",
              body: formData,
            }
          );
      } else {
        response =
          await fetch(
            "/api/candidates",
            {
              method: "POST",
              body: formData,
            }
          );
      }

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            `Gagal ${actionText} kandidat.`
        );
      }

      setMessage(
        isEditing
          ? "Kandidat berhasil diperbarui."
          : "Kandidat berhasil ditambahkan."
      );

      closeCandidateForm();

      await loadCandidates();
    } catch (error) {
      setMessage(
        error.message ||
          `Terjadi kesalahan saat ${actionText} kandidat.`
      );
    } finally {
      setCandidateLoading(
        false
      );
    }
  }

  // ====================================================
  // HAPUS KANDIDAT
  // ====================================================

  async function deleteCandidate(
    candidate
  ) {
    if (status !== "draft") {
      setMessage(
        "Kandidat hanya dapat dihapus saat status DRAFT."
      );
      return;
    }

    const confirmed =
      window.confirm(
        `Yakin ingin menghapus Kandidat ${candidate.candidate_number}?\n\n` +
          `Nama: ${candidate.name}\n\n` +
          "Data kandidat dan foto kandidat akan dihapus.\n\n" +
          "Tindakan ini tidak dapat dibatalkan."
      );

    if (!confirmed) {
      return;
    }

    setCandidateLoading(true);
    setMessage("");

    try {
      const response =
        await fetch(
          "/api/candidates",
          {
            method: "DELETE",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              candidateId:
                candidate.id,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Gagal menghapus kandidat."
        );
      }

      setMessage(
        "Kandidat berhasil dihapus."
      );

      await loadCandidates();
    } catch (error) {
      setMessage(
        error.message ||
          "Terjadi kesalahan saat menghapus kandidat."
      );
    } finally {
      setCandidateLoading(
        false
      );
    }
  }

  // ====================================================
  // RENDER
  // ====================================================

  return (
    <main className="page">
      <section className="card">

        {/* ==============================================
            HEADER
        ============================================== */}

        <div className="badge">
          NEBULA E-VOTING
        </div>

        <h1>
          Admin Dashboard
        </h1>

        <p className="subtitle">
          Panel administrasi
          pemilihan
        </p>

        <div className="info">
          <strong>
            Pemilihan:
          </strong>
          <br />
          {electionName}
        </div>

        <div className="info">
          <strong>
            Status:
          </strong>{" "}
          {status.toUpperCase()}
        </div>

        {/* ==============================================
            STATISTIK
        ============================================== */}

        <div className="stats">

          <div className="stat-card">
            <span>
              Total Pemilih
            </span>

            <strong>
              {totalVoters}
            </strong>
          </div>

          <div className="stat-card">
            <span>
              Sudah Memilih
            </span>

            <strong>
              {votedVoters}
            </strong>
          </div>

          <div className="stat-card">
            <span>
              Belum Memilih
            </span>

            <strong>
              {notVotedVoters}
            </strong>
          </div>

          <div className="stat-card">
            <span>
              Partisipasi
            </span>

            <strong>
              {Number(
                participation
              ).toFixed(2)}
              %
            </strong>
          </div>

          <div className="stat-card">
            <span>
              Total Ballot
            </span>

            <strong>
              {totalBallots}
            </strong>
          </div>

        </div>

        {/* ==============================================
            KONTROL PEMILIHAN
        ============================================== */}

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
                changeStatus(
                  "open"
                )
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
                changeStatus(
                  "close"
                )
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

        {/* ==============================================
            DATA PEMILIH
        ============================================== */}

        <div className="admin-actions">

          <h2>
            Data Pemilih
          </h2>

          <p className="subtitle">
            Import data pemilih
            dari Excel.
          </p>

          <div className="info">
            <strong>
              Format file:
            </strong>
            <br />
            NISN | Nama |
            Kategori
            <br />
            <br />

            <strong>
              Status pemilihan
              harus DRAFT.
            </strong>
          </div>

          <input
            ref={
              fileInputRef
            }
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

        {/* ==============================================
            DATA KANDIDAT
        ============================================== */}

        <div className="admin-actions">

          <h2>
            Data Kandidat
          </h2>

          <p className="subtitle">
            Kelola kandidat
            pemilihan.
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
              Kandidat dikunci
              selama pemilihan
              berlangsung.
            </p>
          )}

          {/* ============================================
              FORM TAMBAH / EDIT
          ============================================ */}

          {showCandidateForm && (
            <div className="candidate-form">

              <h3>
                {editingCandidate
                  ? "Edit Kandidat"
                  : "Tambah Kandidat"}
              </h3>

              {/* PREVIEW FOTO */}

              <div className="candidate-photo-preview-area">

                {candidatePhotoPreview ? (
                  <img
                    src={
                      candidatePhotoPreview
                    }
                    alt="Preview kandidat"
                    className="candidate-photo-preview"
                  />
                ) : (
                  <div className="candidate-photo-placeholder">
                    Preview Foto
                  </div>
                )}

              </div>

              <label>
                Foto Kandidat
              </label>

              <input
                ref={
                  candidatePhotoRef
                }
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={
                  handlePhotoChange
                }
              />

              <small>
                JPG, PNG, atau WEBP.
                Maksimal 5 MB.
                Foto akan ditampilkan
                dengan standar rasio
                3:4.
              </small>

              {editingCandidate &&
                editingCandidate.photo_url && (
                  <label className="photo-remove-option">

                    <input
                      type="checkbox"
                      checked={
                        removeExistingPhoto
                      }
                      onChange={(
                        event
                      ) => {
                        setRemoveExistingPhoto(
                          event.target
                            .checked
                        );

                        if (
                          event.target
                            .checked
                        ) {
                          setCandidatePhoto(
                            null
                          );

                          setCandidatePhotoPreview(
                            null
                          );

                          if (
                            candidatePhotoRef.current
                          ) {
                            candidatePhotoRef.current.value =
                              "";
                          }
                        } else {
                          setCandidatePhotoPreview(
                            editingCandidate.photo_url
                          );
                        }
                      }}
                    />

                    Hapus foto lama

                  </label>
                )}

              <label>
                Nomor Kandidat
              </label>

              <input
                type="number"
                min="1"
                value={
                  candidateNumber
                }
                onChange={(
                  event
                ) =>
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
                onChange={(
                  event
                ) =>
                  setCandidateName(
                    event.target
                      .value
                  )
                }
                placeholder="Nama lengkap kandidat"
              />

              <label>
                Kelas
              </label>

              <input
                type="text"
                value={
                  candidateClass
                }
                onChange={(
                  event
                ) =>
                  setCandidateClass(
                    event.target
                      .value
                  )
                }
                placeholder="Contoh: XI.1"
              />

              <label>
                Program Unggulan
              </label>

              <textarea
                value={
                  candidateProgram
                }
                onChange={(
                  event
                ) =>
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
                    saveCandidate
                  }
                  disabled={
                    candidateLoading
                  }
                >
                  {candidateLoading
                    ? "Menyimpan..."
                    : editingCandidate
                    ? "💾 Simpan Perubahan"
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

          {/* ============================================
              LOADING
          ============================================ */}

          {candidateLoading &&
            !showCandidateForm && (
              <p className="subtitle">
                Memuat data kandidat...
              </p>
            )}

          {/* ============================================
              DAFTAR KANDIDAT
          ============================================ */}

          {!candidateLoading &&
            candidates.length >
              0 && (
              <div className="candidate-list">

                {candidates.map(
                  (
                    candidate
                  ) => (
                    <div
                      className="candidate-card"
                      key={
                        candidate.id
                      }
                    >

                      {candidate.photo_url ? (
                        <img
                          src={
                            candidate.photo_url
                          }
                          alt={
                            candidate.name
                          }
                          className="candidate-photo"
                        />
                      ) : (
                        <div className="candidate-photo-placeholder">
                          Belum ada
                          foto
                        </div>
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
                          Program
                          Unggulan:
                        </strong>
                        <br />
                        {
                          candidate.vision
                        }
                      </p>

                      {status ===
                        "draft" && (
                        <div className="candidate-actions">

                          <button
                            type="button"
                            onClick={() =>
                              openEditCandidate(
                                candidate
                              )
                            }
                            disabled={
                              candidateLoading
                            }
                          >
                            ✏️ Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              deleteCandidate(
                                candidate
                              )
                            }
                            disabled={
                              candidateLoading
                            }
                          >
                            🗑️ Hapus
                          </button>

                        </div>
                      )}

                    </div>
                  )
                )}

              </div>
            )}

          {!candidateLoading &&
            candidates.length ===
              0 &&
            !showCandidateForm && (
              <div className="info">
                Belum ada data
                kandidat yang
                ditampilkan.
              </div>
            )}

        </div>

        {/* ==============================================
            PESAN SISTEM
        ============================================== */}

        {message && (
          <div className="message">
            {message}
          </div>
        )}

      </section>
    </main>
  );
}
