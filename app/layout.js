import "./globals.css";

export const metadata = {
  title: "Pemilihan Ketua KIR Nebula 2026/2027",
  description:
    "NEBULA E-Voting - Pemilihan Ketua KIR Nebula Periode 2026/2027",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
