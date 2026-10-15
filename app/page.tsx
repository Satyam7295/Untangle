"use client";

import { FormEvent, useState } from "react";

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) {
      setMessage("Please write a query before submitting.");
      return;
    }
    setMessage("Query processing is not available yet. Your draft has not been sent.");
  }

  return (
    <section className="hero" aria-labelledby="write-query-title">
      <p className="eyebrow">User mode</p>
      <h1 id="write-query-title">Write Query</h1>
      <p className="lead">Start with what is on your mind. Untangle will give this query a clearer path in a future release.</p>
      <form className="query-form" onSubmit={handleSubmit} noValidate>
        <label className="field-label" htmlFor="query">Your query</label>
        <textarea
          className="query-input"
          id="query"
          name="query"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Describe what you need help making sense of..."
          aria-describedby="query-note query-status"
        />
        <div className="form-actions">
          <button className="primary-button" type="submit">Submit query</button>
          <p className="form-note" id="query-note">This is an interface preview. No query is sent yet.</p>
        </div>
        {message ? <p className={query.trim() ? "pending-message" : "error-message"} id="query-status" role="status">{message}</p> : null}
      </form>
    </section>
  );
}
