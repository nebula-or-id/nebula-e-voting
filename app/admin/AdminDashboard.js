"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "pdf-lib";

const CATEGORY_OPTIONS = [
  "Pembina",
  "Ketua & Ketua Divisi",
  "Anggota Senior",
  "Anggota Baru",
];

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
  // DATA PEMILIH - PREVIEW
  // ====================================================

  const [previewVoters, setPreviewVoters] =
    useState([]);

  const [previewErrors, setPreviewErrors] =
    useState([]);

  const [importing, setImporting] =
    useState(false);

  const [savingVoters, setSavingVoters] =
    useState(false);

  const voterFileInputRef =
    useRef(null);

  // ====================================================
  // HASIL FINALISASI
  // ====================================================

  const [savedVotersResult, setSavedVotersResult] =
    useState(null);

  // ====================================================
  // DAFTAR PEMILIH
  // ====================================================

  const [voterList, setVoterList] =
    useState([]);

  const [voterListLoading, setVoterListLoading] =
    useState(false);

  const [voterFilter, setVoterFilter] =
    useState("all");

  // ====================================================
  // KANDIDAT
  // ====================================================

  const [candidates, setCandidates] =
    useState([]);

  const [candidateLoading, setCandidateLoading] =
    useState(false);

  const [showCandidateForm, setShowCandidateForm] =
    useState(false);

  const [editingCandidate, setEditingCandidate] =
    useState(null);

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

  const [candidatePhotoPreview, setCandidatePhotoPreview] =
    useState(null);

  const [removeExistingPhoto, setRemoveExistingPhoto] =
    useState(false);

  const candidatePhotoRef =
    useRef(null);

  // ====================================================
  // LOAD AWAL
  // ====================================================

  useEffect(() => {
    loadCandidates();
    loadVoters();
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
      window.confirm(
        confirmMessage
      );

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

      setStatus(
        data.status
      );

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

      setStatus(
        "draft"
      );

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
  // IMPORT EXCEL → PREVIEW
  // ====================================================

  async function importVoters() {
    const file =
      voterFileInputRef.current?.files?.[0];

    if (!file) {
      setMessage(
        "Silakan pilih file Excel terlebih dahulu."
      );
      return;
    }

    const confirmed =
      window.confirm(
        `Baca file "${file.name}"?\n\n` +
          "Data belum akan disimpan ke database.\n" +
          "Sistem hanya akan membuat PREVIEW untuk diperiksa."
      );

    if (!confirmed) {
      return;
    }

    setImporting(true);
    setMessage("");
    setPreviewErrors([]);
    setPreviewVoters([]);
    setSavedVotersResult(null);

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
          "Gagal membaca file Excel.";

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

      setPreviewVoters(
        data.preview || []
      );

      const existing =
        data.existing || [];

      if (existing.length > 0) {
        setMessage(
          `Preview berhasil. Ada ${existing.length} NISN yang sudah terdaftar dan harus diperiksa.`
        );
      } else {
        setMessage(
          `Preview berhasil. ${data.total || 0} data siap diperiksa.`
        );
      }

      if (
        voterFileInputRef.current
      ) {
        voterFileInputRef.current.value =
          "";
      }
    } catch (error) {
      console.error(
        "Import preview error:",
        error
      );

      setMessage(
        error.message ||
          "Terjadi kesalahan saat membaca Excel."
      );
    } finally {
      setImporting(false);
    }
  }

  // ====================================================
  // EDIT PREVIEW PEMILIH
  // ====================================================

  function updatePreviewVoter(
    index,
    field,
    value
  ) {
    setPreviewVoters(
      (current) =>
        current.map(
          (voter, voterIndex) =>
            voterIndex === index
              ? {
                  ...voter,
                  [field]:
                    value,
                }
              : voter
        )
    );
  }

  // ====================================================
  // HAPUS PREVIEW PEMILIH
  // ====================================================

  function removePreviewVoter(
    index
  ) {
    const voter =
      previewVoters[index];

    const confirmed =
      window.confirm(
        `Hapus baris ini dari preview?\n\n${voter?.nama || ""}\n${voter?.nisn || ""}`
      );

    if (!confirmed) {
      return;
    }

    setPreviewVoters(
      (current) =>
        current.filter(
          (_, voterIndex) =>
            voterIndex !== index
        )
    );
  }

  // ====================================================
  // TAMBAH PEMILIH MANUAL
  // ====================================================

  function addPreviewVoter() {
    setPreviewVoters(
      (current) => [
        ...current,
        {
          nisn: "",
          nama: "",
          kategori:
            "Anggota Baru",
        },
      ]
    );

    setMessage(
      "Baris pemilih baru ditambahkan. Silakan lengkapi datanya."
    );
  }

  // ====================================================
  // BERSIHKAN PREVIEW
  // ====================================================

  function clearPreviewVoters() {
    if (
      previewVoters.length === 0
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Hapus seluruh preview?\n\nData yang sedang diperiksa akan hilang dari layar, tetapi data database yang sudah ada tidak terpengaruh."
      );

    if (!confirmed) {
      return;
    }

    setPreviewVoters([]);
    setPreviewErrors([]);
    setSavedVotersResult(null);

    setMessage(
      "Preview berhasil dibersihkan."
    );
  }

  // ====================================================
  // VALIDASI PREVIEW
  // ====================================================

  function validatePreviewVoters() {
    const errors = [];
    const usedNisn =
      new Set();

    previewVoters.forEach(
      (voter, index) => {
        const row =
          index + 1;

        const nisn =
          String(
            voter.nisn || ""
          ).trim();

        const nama =
          String(
            voter.nama || ""
          ).trim();

        const kategori =
          String(
            voter.kategori || ""
          ).trim();

        if (!nisn) {
          errors.push(
            `Baris ${row}: NISN belum diisi.`
          );
        }

        if (!nama) {
          errors.push(
            `Baris ${row}: Nama belum diisi.`
          );
        }

        if (!kategori) {
          errors.push(
            `Baris ${row}: Kategori belum dipilih.`
          );
        }

        if (
          kategori &&
          !CATEGORY_OPTIONS.includes(
            kategori
          )
        ) {
          errors.push(
            `Baris ${row}: Kategori "${kategori}" tidak valid.`
          );
        }

        const normalized =
          nisn.toLowerCase();

        if (
          normalized &&
          usedNisn.has(
            normalized
          )
        ) {
          errors.push(
            `Baris ${row}: NISN "${nisn}" duplikat di preview.`
          );
        }

        if (
          normalized
        ) {
          usedNisn.add(
            normalized
          );
        }
      }
    );

    setPreviewErrors(
      errors
    );

    return errors;
  }

  // ====================================================
  // SIMPAN & GENERATE TOKEN
  // ====================================================

  async function saveVoters() {
    if (
      previewVoters.length ===
      0
    ) {
      setMessage(
        "Belum ada data preview yang akan disimpan."
      );
      return;
    }

    const validationErrors =
      validatePreviewVoters();

    if (
      validationErrors.length >
      0
    ) {
      setMessage(
        "Perbaiki data pada preview terlebih dahulu."
      );
      return;
    }

    const confirmed =
      window.confirm(
        `SIMPAN & GENERATE TOKEN?\n\n` +
          `${previewVoters.length} pemilih akan disimpan ke database.\n\n` +
          "Setelah disimpan, token baru akan dibuat otomatis.\n" +
          "Pastikan data sudah benar.\n\n" +
          "Lanjutkan?"
      );

    if (!confirmed) {
      return;
    }

    setSavingVoters(true);
    setMessage("");
    setSavedVotersResult(null);

    try {
      const response =
        await fetch(
          "/api/save-voters",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              voters:
                previewVoters.map(
                  (voter) => ({
                    nisn:
                      String(
                        voter.nisn ||
                          ""
                      ).trim(),

                    nama:
                      String(
                        voter.nama ||
                          ""
                      ).trim(),

                    kategori:
                      String(
                        voter.kategori ||
                          ""
                      ).trim(),
                  })
                ),
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        let errorMessage =
          data.message ||
          "Gagal menyimpan pemilih.";

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

        throw new Error(
          errorMessage
        );
      }

      setSavedVotersResult(
        data
      );

      setPreviewVoters([]);
      setPreviewErrors([]);

      setMessage(
        `✅ ${data.saved || 0} pemilih berhasil disimpan dan token berhasil dibuat.`
      );

      // Refresh daftar pemilih
      await loadVoters();
    } catch (error) {
      console.error(
        "Save voters error:",
        error
      );

      setMessage(
        error.message ||
          "Terjadi kesalahan saat menyimpan pemilih."
      );
    } finally {
      setSavingVoters(
        false
      );
    }
  }

  // ====================================================
  // LOAD DAFTAR PEMILIH
  // ====================================================

  async function loadVoters() {
    setVoterListLoading(
      true
    );

    try {
      const response =
        await fetch(
          "/api/voters",
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
            "Gagal mengambil daftar pemilih."
        );
      }

      setVoterList(
        data.voters || []
      );
    } catch (error) {
      console.error(
        "Load voters error:",
        error
      );

      setMessage(
        error.message ||
          "Gagal mengambil daftar pemilih."
      );
    } finally {
      setVoterListLoading(
        false
      );
    }
  }

  // ====================================================
  // FILTER DAFTAR PEMILIH
  // ====================================================

  const filteredVoters =
    voterList.filter(
      (voter) => {
        if (
          voterFilter ===
          "voted"
        ) {
          return voter.has_voted;
        }

        if (
          voterFilter ===
          "not-voted"
        ) {
          return !voter.has_voted;
        }

        return true;
      }
    );

  // ====================================================
  // DOWNLOAD REKAP TOKEN DARI HASIL BARU
  // ====================================================

  function downloadSavedTokens() {
    const voters =
      savedVotersResult?.voters;

    if (
      !voters ||
      voters.length === 0
    ) {
      return;
    }

    const rows = [
      [
        "NISN",
        "Nama",
        "Kategori",
        "Token",
      ],
      ...voters.map(
        (voter) => [
          voter.nisn,
          voter.nama,
          voter.kategori,
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

    const blob =
      new Blob(
        ["\uFEFF" + csv],
        {
          type:
            "text/csv;charset=utf-8;",
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href = url;

    link.download =
      "rekap-token-pemilih-nebula.csv";

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
  // GENERATE KARTU DARI HASIL FINALISASI
  // ====================================================

  async function downloadSavedVoterCards() {
    const voters =
      savedVotersResult?.voters;

    if (
      !voters ||
      voters.length === 0
    ) {
      setMessage(
        "Belum ada token hasil finalisasi yang dapat dibuat menjadi kartu."
      );
      return;
    }

    const confirmed =
      window.confirm(
        "Buat Kartu Pemilih A4?\n\n" +
          `Jumlah kartu: ${voters.length}\n` +
          "Layout: A4, 2 kolom × 4 baris.\n\n" +
          "Lanjutkan?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setMessage(
        "Sedang membuat PDF Kartu Pemilih..."
      );

      const pdfDoc =
        await PDFDocument.create();

      const fontRegular =
        await pdfDoc.embedFont(
          StandardFonts.Helvetica
        );

      const fontBold =
        await pdfDoc.embedFont(
          StandardFonts.HelveticaBold
        );

      const pageWidth =
        595.28;

      const pageHeight =
        841.89;

      const columns = 2;
      const rowsPerPage = 4;

      const margin = 24;
      const gap = 12;

      const cardWidth =
        (pageWidth -
          margin * 2 -
          gap) /
        columns;

      const cardHeight =
        (pageHeight -
          margin * 2 -
          gap * 3) /
        rowsPerPage;

      const dark =
        rgb(
          0.09,
          0.13,
          0.20
        );

      const gray =
        rgb(
          0.35,
          0.39,
          0.45
        );

      const border =
        rgb(
          0.72,
          0.76,
          0.82
        );

      const light =
        rgb(
          0.96,
          0.97,
          0.98
        );

      const accent =
        rgb(
          0.93,
          0.95,
          1
        );

      voters.forEach(
        (voter, index) => {
          const cardsPerPage =
            columns *
            rowsPerPage;

          const indexInPage =
            index %
            cardsPerPage;

          if (
            indexInPage === 0
          ) {
            pdfDoc.addPage([
              pageWidth,
              pageHeight,
            ]);
          }

          const page =
            pdfDoc.getPage(
              pdfDoc.getPageCount() -
                1
            );

          const column =
            indexInPage %
            columns;

          const row =
            Math.floor(
              indexInPage /
                columns
            );

          const x =
            margin +
            column *
              (cardWidth +
                gap);

          const y =
            pageHeight -
            margin -
            (row + 1) *
              cardHeight -
            row * gap;

          page.drawRectangle({
            x,
            y,
            width:
              cardWidth,
            height:
              cardHeight,
            borderColor:
              border,
            borderWidth: 1,
          });

          page.drawRectangle({
            x:
              x + 8,
            y:
              y +
              cardHeight -
              43,
            width:
              cardWidth -
              16,
            height: 31,
            color:
              accent,
          });

          page.drawText(
            "NEBULA E-VOTING",
            {
              x:
                x + 16,
              y:
                y +
                cardHeight -
                29,
              size: 11,
              font:
                fontBold,
              color:
                dark,
            }
          );

          page.drawText(
            "PEMILIHAN KETUA KIR NEBULA",
            {
              x:
                x + 16,
              y:
                y +
                cardHeight -
                40,
              size: 6.5,
              font:
                fontRegular,
              color:
                gray,
            }
          );

          const left =
            x + 16;

          let identityY =
            y +
            cardHeight -
            58;

          page.drawText(
            "NAMA",
            {
              x: left,
              y: identityY,
              size: 6.5,
              font:
                fontBold,
              color:
                gray,
            }
          );

          identityY -= 12;

          page.drawText(
            String(
              voter.nama ??
                "-"
            ),
            {
              x: left,
              y: identityY,
              size: 8.8,
              font:
                fontBold,
              color:
                dark,
            }
          );

          identityY -= 19;

          page.drawText(
            "NISN",
            {
              x: left,
              y: identityY,
              size: 6.5,
              font:
                fontBold,
              color:
                gray,
            }
          );

          identityY -= 12;

          page.drawText(
            String(
              voter.nisn ??
                "-"
            ),
            {
              x: left,
              y: identityY,
              size: 8.5,
              font:
                fontRegular,
              color:
                dark,
            }
          );

          const tokenBoxHeight =
            48;

          const tokenBoxY =
            y + 29;

          page.drawRectangle({
            x:
              x + 12,
            y:
              tokenBoxY,
            width:
              cardWidth -
              24,
            height:
              tokenBoxHeight,
            color:
              light,
            borderColor:
              border,
            borderWidth: 0.8,
          });

          page.drawText(
            "TOKEN",
            {
              x:
                x + 20,
              y:
                tokenBoxY +
                tokenBoxHeight -
                15,
              size: 7,
              font:
                fontBold,
              color:
                gray,
            }
          );

          const token =
            String(
              voter.token ??
                "-"
            ).trim();

          const tokenSize =
            token.length > 10
              ? 14
              : 16;

          const tokenWidth =
            fontBold.widthOfTextAtSize(
              token,
              tokenSize
            );

          page.drawText(
            token,
            {
              x:
                x +
                (cardWidth -
                  tokenWidth) /
                  2,
              y:
                tokenBoxY +
                13,
              size:
                tokenSize,
              font:
                fontBold,
              color:
                dark,
              characterSpacing:
                1.5,
            }
          );

          page.drawText(
            "Gunakan token ini satu kali untuk memberikan suara.",
            {
              x: left,
              y: y + 13,
              size: 5.5,
              font:
                fontRegular,
              color:
                gray,
            }
          );

          page.drawText(
            `Kartu ${index + 1}`,
            {
              x:
                x +
                cardWidth -
                44,
              y:
                y + 13,
              size: 5.5,
              font:
                fontRegular,
              color:
                gray,
            }
          );
        }
      );

      const pdfBytes =
        await pdfDoc.save();

      const blob =
        new Blob(
          [pdfBytes],
          {
            type:
              "application/pdf",
          }
        );

      const url =
        URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href = url;

      link.download =
        "kartu-pemilih-nebula-A4.pdf";

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

      setMessage(
        "Kartu Pemilih A4 berhasil dibuat."
      );
    } catch (error) {
      console.error(
        "PDF generation error:",
        error
      );

      setMessage(
        "Gagal membuat PDF Kartu Pemilih: " +
          (error.message ||
            "kesalahan tidak diketahui.")
      );
    }
  }

  // ====================================================
  // KANDIDAT
  // ====================================================

  async function loadCandidates() {
    setCandidateLoading(
      true
    );

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

  function resetCandidateForm() {
    setCandidateNumber("");
    setCandidateName("");
    setCandidateClass("");
    setCandidateProgram("");
    setCandidatePhoto(null);
    setCandidatePhotoPreview(
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
  }

  function openCandidateForm() {
    resetCandidateForm();

    setEditingCandidate(
      null
    );

    setShowCandidateForm(
      true
    );

    setMessage("");
  }

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

    setShowCandidateForm(
      true
    );

    setMessage("");
  }

  function closeCandidateForm() {
    resetCandidateForm();

    setEditingCandidate(
      null
    );

    setShowCandidateForm(
      false
    );

    setMessage("");
  }

  function handlePhotoChange(
    event
  ) {
    const file =
      event.target.files?.[0] ||
      null;

    setCandidatePhoto(
      file
    );

    if (!file) {
      if (
        editingCandidate
      ) {
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
      URL.createObjectURL(
        file
      );

    setCandidatePhotoPreview(
      previewUrl
    );

    setRemoveExistingPhoto(
      false
    );
  }

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
      Boolean(
        editingCandidate
      );

    const confirmed =
      window.confirm(
        isEditing
          ? `Yakin ingin memperbarui Kandidat ${candidateNumber}?\n\nNama: ${candidateName}\nKelas: ${candidateClass}`
          : `Yakin ingin menambahkan Kandidat ${candidateNumber}?\n\nNama: ${candidateName}\nKelas: ${candidateClass}`
      );

    if (!confirmed) {
      return;
    }

    setCandidateLoading(
      true
    );

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
            "Gagal menyimpan kandidat."
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
      console.error(
        "Save candidate error:",
        error
      );

      setMessage(
        error.message ||
          "Terjadi kesalahan saat menyimpan kandidat."
      );
    } finally {
      setCandidateLoading(
        false
      );
    }
  }

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

    setCandidateLoading(
      true
    );

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
      console.error(
        "Delete candidate error:",
        error
      );

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

        {/* HEADER */}

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

        {/* INFO */}

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

        {/* STATISTIK */}

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

        {/* KONTROL PEMILIHAN */}

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
              savingVoters ||
              candidateLoading ||
              voterListLoading
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
                savingVoters ||
                candidateLoading ||
                voterListLoading
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
                savingVoters ||
                candidateLoading ||
                voterListLoading
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
            Import, periksa, koreksi,
            simpan, dan pantau status
            pemilih.
          </p>

          {/* IMPORT */}

          <div className="info">

            <strong>
              Alur:
            </strong>

            <br />

            Import Excel → Preview →
            Koreksi → Simpan &
            Generate Token

            <br />
            <br />

            <strong>
              Format Excel:
            </strong>

            <br />

            NISN | Nama | Kategori

          </div>

          <input
            ref={
              voterFileInputRef
            }
            type="file"
            accept=".xlsx,.xls,.csv"
            disabled={
              importing ||
              savingVoters ||
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
              savingVoters ||
              loading ||
              status !== "draft"
            }
          >
            {importing
              ? "📥 Membaca Excel..."
              : "📥 Import / Preview Excel"}
          </button>

          {status !==
            "draft" && (
            <p className="closed-message">
              Pengelolaan data pemilih
              dikunci selama pemilihan
              berlangsung.
            </p>
          )}

          {/* =================================================
              PREVIEW
          ================================================= */}

          {previewVoters.length >
            0 && (
            <div
              className="voter-preview"
              style={{
                marginTop:
                  "24px",
                textAlign:
                  "left",
              }}
            >

              <h3>
                Preview Data Pemilih
              </h3>

              <p className="subtitle">
                Periksa semua data
                sebelum disimpan.
              </p>

              {previewErrors.length >
                0 && (
                <div
                  className="message"
                  style={{
                    whiteSpace:
                      "pre-line",
                  }}
                >
                  <strong>
                    Data perlu
                    diperbaiki:
                  </strong>
                  <br />
                  {previewErrors.join(
                    "\n"
                  )}
                </div>
              )}

              <div
                style={{
                  overflowX:
                    "auto",
                  marginTop:
                    "16px",
                }}
              >
                <table
                  style={{
                    width:
                      "100%",
                    borderCollapse:
                      "collapse",
                    fontSize:
                      "14px",
                  }}
                >
                  <thead>
                    <tr>

                      <th
                        style={{
                          padding:
                            "10px",
                          border:
                            "1px solid #d0d5dd",
                          background:
                            "#f8fafc",
                        }}
                      >
                        No
                      </th>

                      <th
                        style={{
                          padding:
                            "10px",
                          border:
                            "1px solid #d0d5dd",
                          background:
                            "#f8fafc",
                        }}
                      >
                        NISN
                      </th>

                      <th
                        style={{
                          padding:
                            "10px",
                          border:
                            "1px solid #d0d5dd",
                          background:
                            "#f8fafc",
                        }}
                      >
                        Nama
                      </th>

                      <th
                        style={{
                          padding:
                            "10px",
                          border:
                            "1px solid #d0d5dd",
                          background:
                            "#f8fafc",
                        }}
                      >
                        Kategori
                      </th>

                      <th
                        style={{
                          padding:
                            "10px",
                          border:
                            "1px solid #d0d5dd",
                          background:
                            "#f8fafc",
                        }}
                      >
                        Aksi
                      </th>

                    </tr>
                  </thead>

                  <tbody>

                    {previewVoters.map(
                      (
                        voter,
                        index
                      ) => (
                        <tr
                          key={`${index}-${voter.nisn}`}
                        >

                          <td
                            style={{
                              padding:
                                "8px",
                              border:
                                "1px solid #d0d5dd",
                              textAlign:
                                "center",
                            }}
                          >
                            {index +
                              1}
                          </td>

                          <td
                            style={{
                              padding:
                                "8px",
                              border:
                                "1px solid #d0d5dd",
                            }}
                          >
                            <input
                              type="text"
                              value={
                                voter.nisn ||
                                ""
                              }
                              onChange={(
                                event
                              ) =>
                                updatePreviewVoter(
                                  index,
                                  "nisn",
                                  event
                                    .target
                                    .value
                                )
                              }
                              style={{
                                width:
                                  "100%",
                                padding:
                                  "8px",
                                border:
                                  "1px solid #d0d5dd",
                                borderRadius:
                                  "8px",
                              }}
                            />
                          </td>

                          <td
                            style={{
                              padding:
                                "8px",
                              border:
                                "1px solid #d0d5dd",
                            }}
                          >
                            <input
                              type="text"
                              value={
                                voter.nama ||
                                ""
                              }
                              onChange={(
                                event
                              ) =>
                                updatePreviewVoter(
                                  index,
                                  "nama",
                                  event
                                    .target
                                    .value
                                )
                              }
                              style={{
                                width:
                                  "100%",
                                padding:
                                  "8px",
                                border:
                                  "1px solid #d0d5dd",
                                borderRadius:
                                  "8px",
                              }}
                            />
                          </td>

                          <td
                            style={{
                              padding:
                                "8px",
                              border:
                                "1px solid #d0d5dd",
                            }}
                          >
                            <select
                              value={
                                voter.kategori ||
                                "Anggota Baru"
                              }
                              onChange={(
                                event
                              ) =>
                                updatePreviewVoter(
                                  index,
                                  "kategori",
                                  event
                                    .target
                                    .value
                                )
                              }
                              style={{
                                width:
                                  "100%",
                                padding:
                                  "8px",
                                border:
                                  "1px solid #d0d5dd",
                                borderRadius:
                                  "8px",
                                background:
                                  "#fff",
                              }}
                            >
                              {CATEGORY_OPTIONS.map(
                                (
                                  category
                                ) => (
                                  <option
                                    key={
                                      category
                                    }
                                    value={
                                      category
                                    }
                                  >
                                    {
                                      category
                                    }
                                  </option>
                                )
                              )}
                            </select>
                          </td>

                          <td
                            style={{
                              padding:
                                "8px",
                              border:
                                "1px solid #d0d5dd",
                              textAlign:
                                "center",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                removePreviewVoter(
                                  index
                                )
                              }
                              style={{
                                margin:
                                  "0",
                                padding:
                                  "8px 12px",
                                fontSize:
                                  "13px",
                              }}
                            >
                              🗑️ Hapus
                            </button>
                          </td>

                        </tr>
                      )
                    )}

                  </tbody>
                </table>
              </div>

              <div
                style={{
                  marginTop:
                    "16px",
                }}
              >

                <button
                  type="button"
                  onClick={
                    addPreviewVoter
                  }
                  disabled={
                    savingVoters
                  }
                >
                  ➕ Tambah Pemilih
                </button>

                <button
                  type="button"
                  onClick={
                    clearPreviewVoters
                  }
                  disabled={
                    savingVoters
                  }
                >
                  🧹 Bersihkan Preview
                </button>

                <button
                  type="button"
                  onClick={
                    saveVoters
                  }
                  disabled={
                    savingVoters
                  }
                >
                  {savingVoters
                    ? "💾 Menyimpan..."
                    : "💾 Simpan & Generate Token"}
                </button>

              </div>

            </div>
          )}

          {/* =================================================
              HASIL FINALISASI
          ================================================= */}

          {savedVotersResult?.voters &&
            savedVotersResult
              .voters.length >
              0 && (
              <div className="import-result">

                <h3>
                  ✅ Pemilih Berhasil
                  Disimpan
                </h3>

                <p>
                  {
                    savedVotersResult.saved
                  }{" "}
                  pemilih berhasil
                  disimpan.
                </p>

                <button
                  type="button"
                  onClick={
                    downloadSavedTokens
                  }
                >
                  📄 Download Rekap
                  Token
                </button>

                <button
                  type="button"
                  onClick={
                    downloadSavedVoterCards
                  }
                >
                  🪪 Download Kartu
                  Pemilih A4
                </button>

                <div className="info">
                  <strong>
                    Penting:
                  </strong>
                  <br />
                  Simpan file token dan
                  PDF kartu dengan aman.
                  Token tidak ditampilkan
                  dalam daftar pemilih.
                </div>

              </div>
            )}

          {/* =================================================
              DAFTAR PEMILIH TERSIMPAN
          ================================================= */}

          <div
            style={{
              marginTop:
                "32px",
              textAlign:
                "left",
            }}
          >

            <div
              style={{
                display:
                  "flex",
                flexWrap:
                  "wrap",
                alignItems:
                  "center",
                justifyContent:
                  "space-between",
                gap:
                  "10px",
              }}
            >

              <div>

                <h3
                  style={{
                    marginBottom:
                      "4px",
                  }}
                >
                  Daftar Pemilih
                </h3>

                <p className="subtitle">
                  {
                    voterList.length
                  }{" "}
                  pemilih tersimpan.
                </p>

              </div>

              <button
                type="button"
                onClick={
                  loadVoters
                }
                disabled={
                  voterListLoading
                }
              >
                {voterListLoading
                  ? "🔄 Memuat..."
                  : "🔄 Refresh"}
              </button>

            </div>

            {/* FILTER */}

            <div
              style={{
                marginTop:
                  "16px",
                display:
                  "flex",
                flexWrap:
                  "wrap",
                gap:
                  "8px",
              }}
            >

              <button
                type="button"
                onClick={() =>
                  setVoterFilter(
                    "all"
                  )
                }
                disabled={
                  voterFilter ===
                  "all"
                }
              >
                Semua
              </button>

              <button
                type="button"
                onClick={() =>
                  setVoterFilter(
                    "voted"
                  )
                }
                disabled={
                  voterFilter ===
                  "voted"
                }
              >
                Sudah Memilih
              </button>

              <button
                type="button"
                onClick={() =>
                  setVoterFilter(
                    "not-voted"
                  )
                }
                disabled={
                  voterFilter ===
                  "not-voted"
                }
              >
                Belum Memilih
              </button>

            </div>

            {/* TABEL */}

            {voterListLoading ? (
              <div className="info">
                Memuat daftar
                pemilih...
              </div>
            ) : voterList.length ===
              0 ? (
              <div className="info">
                Belum ada data
                pemilih tersimpan.
              </div>
            ) : (
              <div
                style={{
                  overflowX:
                    "auto",
                  marginTop:
                    "16px",
                }}
              >

                <table
                  style={{
                    width:
                      "100%",
                    minWidth:
                      "700px",
                    borderCollapse:
                      "collapse",
                    fontSize:
                      "13px",
                  }}
                >

                  <thead>

                    <tr>

                      <th
                        style={{
                          padding:
                            "10px",
                          border:
                            "1px solid #d0d5dd",
                          background:
                            "#f8fafc",
                        }}
                      >
                        No
                      </th>

                      <th
                        style={{
                          padding:
                            "10px",
                          border:
                            "1px solid #d0d5dd",
                          background:
                            "#f8fafc",
                        }}
                      >
                        NISN
                      </th>

                      <th
                        style={{
                          padding:
                            "10px",
                          border:
                            "1px solid #d0d5dd",
                          background:
                            "#f8fafc",
                        }}
                      >
                        Nama
                      </th>

                      <th
                        style={{
                          padding:
                            "10px",
                          border:
                            "1px solid #d0d5dd",
                          background:
                            "#f8fafc",
                        }}
                      >
                        Kategori
                      </th>

                      <th
                        style={{
                          padding:
                            "10px",
                          border:
                            "1px solid #d0d5dd",
                          background:
                            "#f8fafc",
                        }}
                      >
                        Status
                      </th>

                      <th
                        style={{
                          padding:
                            "10px",
                          border:
                            "1px solid #d0d5dd",
                          background:
                            "#f8fafc",
                        }}
                      >
                        Waktu
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {filteredVoters.map(
                      (
                        voter
                      ) => (
                        <tr
                          key={
                            voter.id
                          }
                        >

                          <td
                            style={{
                              padding:
                                "10px",
                              border:
                                "1px solid #d0d5dd",
                              textAlign:
                                "center",
                            }}
                          >
                            {
                              voter.no
                            }
                          </td>

                          <td
                            style={{
                              padding:
                                "10px",
                              border:
                                "1px solid #d0d5dd",
                              fontWeight:
                                "600",
                            }}
                          >
                            {
                              voter.nisn
                            }
                          </td>

                          <td
                            style={{
                              padding:
                                "10px",
                              border:
                                "1px solid #d0d5dd",
                            }}
                          >
                            {
                              voter.nama
                            }
                          </td>

                          <td
                            style={{
                              padding:
                                "10px",
                              border:
                                "1px solid #d0d5dd",
                            }}
                          >
                            {
                              voter.kategori
                            }
                          </td>

                          <td
                            style={{
                              padding:
                                "10px",
                              border:
                                "1px solid #d0d5dd",
                              textAlign:
                                "center",
                              fontWeight:
                                "700",
                            }}
                          >

                            {voter.has_voted
                              ? "✅ Sudah"
                              : "⏳ Belum"}

                          </td>

                          <td
                            style={{
                              padding:
                                "10px",
                              border:
                                "1px solid #d0d5dd",
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            {voter.voted_at
                              ? new Date(
                                  voter.voted_at
                                ).toLocaleString(
                                  "id-ID"
                                )
                              : "-"}

                          </td>

                        </tr>
                      )
                    )}

                  </tbody>

                </table>

                <p
                  className="subtitle"
                  style={{
                    marginTop:
                      "12px",
                    textAlign:
                      "left",
                  }}
                >
                  Menampilkan{" "}
                  {
                    filteredVoters.length
                  }{" "}
                  dari{" "}
                  {
                    voterList.length
                  }{" "}
                  pemilih.
                </p>

              </div>
            )}

          </div>

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
                savingVoters ||
                candidateLoading ||
                voterListLoading
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

          {/* FORM KANDIDAT */}

          {showCandidateForm && (
            <div className="candidate-form">

              <h3>
                {editingCandidate
                  ? "Edit Kandidat"
                  : "Tambah Kandidat"}
              </h3>

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
                Standar tampilan 3:4.
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
                      const checked =
                        event.target
                          .checked;

                      setRemoveExistingPhoto(
                        checked
                      );

                      if (checked) {
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
                    event.target.value
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
                    event.target.value
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
                    event.target.value
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
                    event.target.value
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

          {/* LOADING KANDIDAT */}

          {candidateLoading &&
            !showCandidateForm && (
            <p className="subtitle">
              Memuat data kandidat...
            </p>
          )}

          {/* DAFTAR KANDIDAT */}

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
                          onClick={(
                            event
                          ) => {
                            event.preventDefault();
                            event.stopPropagation();

                            openEditCandidate(
                              candidate
                            );
                          }}
                          disabled={
                            candidateLoading
                          }
                        >
                          ✏️ Edit
                        </button>

                        <button
                          type="button"
                          onClick={(
                            event
                          ) => {
                            event.preventDefault();
                            event.stopPropagation();

                            deleteCandidate(
                              candidate
                            );
                          }}
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
              Belum ada data kandidat
              yang ditampilkan.
            </div>
          )}

        </div>

        {/* PESAN */}

        {message && (
          <div className="message">
            {message}
          </div>
        )}

      </section>
    </main>
  );
}
