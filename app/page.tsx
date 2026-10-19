"use client";

import { FormEvent, useState } from "react";
import { submitSupportQuery } from "./actions";

type DecisionState = Awaited<ReturnType<typeof submitSupportQuery>>;

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [decision, setDecision] = useState<DecisionState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const decisionResult = decision && "decision" in decision ? decision : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) {
      setMessage("Please write a query before submitting.");
      return;
    }
    setSubmitting(true);
    setDecision(null);
    const result = await submitSupportQuery(new FormData(event.currentTarget));
    setSubmitting(false);
    if (!("decision" in result)) {
      setMessage(result.error);
      return;
    }
    setDecision(result);
    setMessage(result.ticket ? `Ticket ${result.ticket.referenceNumber} created.` : "Query evaluated.");
  }

  return (
    <section className="hero" aria-labelledby="write-query-title">
      <p className="eyebrow">User mode</p>
      <h1 id="write-query-title">Write Query</h1>
      <p className="lead">Start with what is on your mind. Untangle will evaluate it against the active support rules.</p>
      <form className="query-form" onSubmit={handleSubmit} noValidate>
        <label className="field-label" htmlFor="query">Your query</label>
        <textarea
          className="query-input"
          id="query"
          name="query"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Describe what you need help making sense of..."
          required
          aria-describedby="query-note query-status"
        />
        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={submitting}>{submitting ? "Evaluating..." : "Submit query"}</button>
          <p className="form-note" id="query-note">Your query is evaluated by the configured deterministic rules.</p>
        </div>
        {message ? <p className={query.trim() ? "pending-message" : "error-message"} id="query-status" role="status">{message}</p> : null}
        {decisionResult ? (
          <section className="decision-panel" aria-labelledby="decision-title">
            <h2 id="decision-title">Decision: {decisionResult.decision.recommendation.replace("_", " ")}</h2>
            <p>{decisionResult.decision.conflicts.length > 0 ? "Conflicting actions require human review." : decisionResult.decision.validationErrors.length > 0 ? "Some rules could not be validated and require human review." : decisionResult.decision.recommendation === "NO_MATCH" ? "No active rule matched this query." : "The active rules produced a safe recommendation."}</p>
            <p><strong>Human review:</strong> {decisionResult.decision.recommendation === "HUMAN_REVIEW" ? "Required" : "Not required"}</p>
            <p><strong>Matched rules:</strong> {decisionResult.decision.matchedRules.map((rule) => rule.ruleName).join(", ") || "None"}</p>
            <p><strong>Proposed actions:</strong> {decisionResult.decision.proposedActions.map((action) => `${action.type}: ${action.value}`).join(", ") || "None"}</p>
          </section>
        ) : null}
      </form>
    </section>
  );
}
