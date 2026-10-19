"use client";

import { useActionState } from "react";

import { uploadPolicy, type PolicyUploadState } from "../actions";

const initialState: PolicyUploadState = {};

export default function PolicyUploadForm() {
  const [state, formAction, pending] = useActionState(uploadPolicy, initialState);
  return (
    <form action={formAction}>
      <label className="upload-dropzone" htmlFor="policy-file">
        <span className="upload-file-icon" aria-hidden="true">PDF</span>
        <strong>Choose a policy document</strong>
        <span>PDF files only · One active policy per organization</span>
        <input
          id="policy-file"
          name="policy-file"
          type="file"
          accept="application/pdf,.pdf"
          required
          aria-describedby="upload-status"
        />
      </label>
      <div className="form-actions">
        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? "Indexing policy..." : "Upload and index"}
        </button>
      </div>
      <p id="upload-status" className={state.error ? "error-message" : "form-note"} aria-live="polite">
        {state.error ?? state.success ?? "The PDF is extracted and indexed before it becomes active."}
      </p>
    </form>
  );
}
