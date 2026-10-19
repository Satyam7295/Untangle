"use client";

import { useActionState } from "react";

import { uploadPolicy, type PolicyActionState } from "./actions";

const initialState: PolicyActionState = {};

export default function PolicyUploadForm() {
  const [state, action, pending] = useActionState(uploadPolicy, initialState);
  return (
    <form action={action}>
      <label className="upload-dropzone" htmlFor="policy-file">
        <span className="upload-file-icon" aria-hidden="true">PDF</span>
        <strong>Choose a policy document</strong>
        <span>PDF files only · Maximum 10 MB</span>
        <input id="policy-file" name="policy-file" type="file" accept="application/pdf,.pdf" required aria-describedby="upload-status" />
      </label>
      <button className="primary-button" type="submit" disabled={pending}>
        {pending ? "Extracting and indexing…" : "Upload and index policy"}
      </button>
      <p id="upload-status" className={state.error ? "form-error" : "form-note"} aria-live="polite">
        {state.error || state.success || "Text is extracted and indexed before a policy becomes active."}
      </p>
    </form>
  );
}
