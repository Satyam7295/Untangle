"use client";

import Link from "next/link";
import { useActionState } from "react";

import { loginSupport } from "./actions";

export default function SupportLoginPage() {
  const [state, formAction, isPending] = useActionState(loginSupport, {});

  return (
    <section className="auth-page" aria-labelledby="support-login-title">
      <p className="eyebrow">Support mode</p>
      <h1 id="support-login-title">Sign in</h1>
      <p className="lead">Support tools are available only after server-verified authentication.</p>
      <form className="auth-card" action={formAction} noValidate>
        <div className="auth-field">
          <label className="field-label" htmlFor="support-id">Support ID</label>
          <input className="auth-input" id="support-id" name="id" type="text" autoComplete="username" required />
        </div>
        <div className="auth-field">
          <label className="field-label" htmlFor="support-password">Password</label>
          <input className="auth-input" id="support-password" name="password" type="password" autoComplete="current-password" required />
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
