"use client";

import { useState } from "react";

export default function CaseActions({ caseId, resolved }: { caseId: string; resolved: boolean }) {
  const [reply, setReply] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function sendReply(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const response = await fetch(`/api/support/cases/${caseId}/reply`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content: reply }) });
    const body = await response.json();
    setPending(false);
    if (!response.ok) return setMessage(body.error ?? "Reply could not be sent.");
    setReply("");
    setMessage("Reply sent.");
  }

  async function resolveCase() {
    if (!window.confirm("Mark this case as resolved?")) return;
    setPending(true);
    const response = await fetch(`/api/support/cases/${caseId}/resolve`, { method: "POST" });
    const body = await response.json();
    setPending(false);
    if (!response.ok) return setMessage(body.error ?? "Case could not be resolved.");
    setMessage("Case resolved.");
  }

  return <div className="support-actions">
    {!resolved ? <form onSubmit={sendReply}><label className="field-label" htmlFor="support-reply">Reply to user</label><textarea className="query-input support-reply-input" id="support-reply" value={reply} onChange={(event) => setReply(event.target.value)} required /><button className="primary-button" disabled={pending || !reply.trim()} type="submit">{pending ? "Sending..." : "Send reply"}</button></form> : null}
    {!resolved ? <button className="secondary-button" disabled={pending} onClick={resolveCase} type="button">Mark as resolved</button> : null}
    {message ? <p className="form-note" role="status">{message}</p> : null}
  </div>;
}
