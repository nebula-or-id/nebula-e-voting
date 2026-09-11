"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLogin(event) {
    event.preventDefault();

    setLoading(true);
    setErrorMessage("");

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      );

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage("Email atau password admin salah.");
        return;
      }

      window.location.href = "/admin";
    } catch (error) {
      console.error(error);

      setErrorMessage(
        "Terjadi kesalahan. Silakan coba lagi."
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

        <h1>Admin Login</h1>

        <p className="subtitle">
          Panel administrasi pemilihan Ketua KIR Nebula
          <br />
          Periode 2026/2027
        </p>

        <form onSubmit={handleLogin}>

          <div
            style={{
              marginBottom: "18px",
              textAlign: "left",
            }}
          >
            <label>
              <strong>Email Admin</strong>
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              placeholder="Email admin"
              autoComplete="username"
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

          <div
            style={{
              marginBottom: "20px",
              textAlign: "left",
            }}
          >
            <label>
              <strong>Password</strong>
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="Password admin"
              autoComplete="current-password"
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

          {errorMessage && (
            <div
              className="info"
              style={{
                marginBottom: "18px",
              }}
            >
              <p>{errorMessage}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Memproses..."
              : "Masuk sebagai Admin"}
          </button>

        </form>

      </section>
    </main>
  );
}
