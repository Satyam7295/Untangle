"use client";

import { useActionState } from "react";

import { retryPolicy, type PolicyActionState } from "./actions";

export default function PolicyRetryForm({ documentId }: { documentId: string }) {
  const [state, action, pending] = useActionState(retryPolicy, {} as PolicyActionState);
  return (
    <form action={action} className="policy-retry-form">
      <input type="hidden" name="documentId" value={documentId} />
      <button className="secondary-button" type="submit" disabled={pending}>
        {pending ? "Retrying…" : "Retry indexing"}
      </button>
      {state.error && <p className="form-error" aria-live="polite">{state.error}</p>}
      {state.success && <p className="form-note" aria-live="polite">{state.success}</p>}
    </form>
  );
}
