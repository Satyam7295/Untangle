"use client";

import Link from "next/link";
import { useActionState } from "react";

import { loginAdmin } from "./actions";

export default function AdminLoginPage() {
  const [state, formAction, isPending] = useActionState(loginAdmin, {});

  return (
    <section className="auth-page" aria-labelledby="admin-login-title">
      <p className="eyebrow">Admin mode</p>
      <h1 id="admin-login-title">Sign in</h1>
      <p className="lead">Admin tools are available only after server-verified authentication.</p>
      <form className="auth-card" action={formAction} noValidate>
        <div className="auth-field">
          <label className="field-label" htmlFor="id">Email or username</label>
          <input className="auth-input" id="id" name="id" type="text" autoComplete="username" required />
        </div>
        <div className="auth-field">
          <label className="field-label" htmlFor="password">Password</label>
          <input className="auth-input" id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <button className="primary-button" type="submit" disabled={isPending}>
          {isPending ? "Signing in..." : "Continue"}
        </button>
        {state.error ? <p className="error-message" role="alert">{state.error}</p> : null}
      </form>
      <Link className="back-link" href="/">← Return to User mode</Link>
    </section>
  );
}
