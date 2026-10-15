import Link from "next/link";

export default function NotFound() {
  return (
    <section className="auth-page" aria-labelledby="not-found-title">
      <p className="eyebrow">404</p>
      <h1 id="not-found-title">Page not found</h1>
      <p className="lead">That route does not exist yet.</p>
      <Link className="back-link" href="/">Return to User mode</Link>
    </section>
  );
}
