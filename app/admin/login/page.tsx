"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function AdminLoginPage() {
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("Admin authentication is not connected yet. No sign-in attempt was sent.");
  }

  return (
    <section className="auth-page" aria-labelledby="admin-login-title">
      <p className="eyebrow">Admin mode</p>
      <h1 id="admin-login-title">Sign in</h1>
      <p className="lead">Admin tools are available only after server-verified authentication.</p>
      <form className="auth-card" onSubmit={handleSubmit} noValidate>
        <div className="auth-field">
          <label className="field-label" htmlFor="email">Email or username</label>
          <input className="auth-input" id="email" name="email" type="text" autoComplete="username" required />
        </div>
        <div className="auth-field">
          <label className="field-label" htmlFor="password">Password</label>
          <input className="auth-input" id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <button className="primary-button" type="submit">Continue</button>
        {error ? <p className="error-message" role="alert">{error}</p> : null}
      </form>
      <Link className="back-link" href="/">← Return to User mode</Link>
    </section>
  );
}
