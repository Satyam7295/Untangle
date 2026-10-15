"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="auth-page" aria-labelledby="error-title">
      <p className="eyebrow">Something went wrong</p>
      <h1 id="error-title">We could not load this page.</h1>
      <button className="primary-button" type="button" onClick={() => reset()}>Try again</button>
    </section>
  );
}
