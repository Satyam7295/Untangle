"use client";

import { FormEvent, useActionState, useRef, useState } from "react";

import { uploadPolicy, type PolicyUploadResult, type PolicyUploadState } from "../actions";

type InitialPolicy = {
  id: string;
  fileName: string;
  indexingStatus: string;
  pageCount: number | null;
  chunkCount: number;
  updatedAt: string;
};

const initialState: PolicyUploadState = {};
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PolicyUploadForm({ initialPolicy }: { initialPolicy: InitialPolicy | null }) {
  const [state, formAction, pending] = useActionState(uploadPolicy, initialState);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState("");
  const result: PolicyUploadResult | undefined = state.result;
  const currentPolicy = result ? {
    id: result.id,
    fileName: result.fileName,
    indexingStatus: "READY",
    pageCount: result.pageCount,
    chunkCount: result.chunkCount,
    updatedAt: result.indexedAt,
  } : initialPolicy;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const error = validationError || state.error;

  function selectFile(file: File | undefined) {
    setValidationError("");
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setSelectedFile(null);
      setValidationError("Choose a PDF file.");
      return;
    }
    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
      setSelectedFile(null);
      setValidationError(`The PDF must be between 1 byte and ${formatBytes(MAX_UPLOAD_BYTES)}.`);
      return;
    }
    setSelectedFile(file);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!selectedFile) {
      event.preventDefault();
      setValidationError("Choose a PDF policy document before uploading.");
      fileInputRef.current?.focus();
    }
  }

  function removeFile() {
    setSelectedFile(null);
    setValidationError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    fileInputRef.current?.focus();
  }

  return (
    <>
      <form action={formAction} onSubmit={handleSubmit}>
        <label
          className="upload-dropzone"
          htmlFor="policy-file"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            selectFile(event.dataTransfer.files[0]);
          }}
        >
          <span className="upload-file-icon" aria-hidden="true">PDF</span>
          <strong>{selectedFile ? "Policy document selected" : "Drop your PDF here or browse"}</strong>
          <span>PDF only · Maximum {formatBytes(MAX_UPLOAD_BYTES)}</span>
          <input
            ref={fileInputRef}
            id="policy-file"
            name="policy-file"
            type="file"
            accept="application/pdf,.pdf"
            required
            onChange={(event) => selectFile(event.currentTarget.files?.[0])}
            aria-describedby="upload-help"
            disabled={pending}
          />
          <span className="file-picker-button" aria-hidden="true">Choose file</span>
        </label>
        {selectedFile ? (
          <div className="selected-file" aria-live="polite">
            <span className="selected-file-copy">
              <span className="selected-file-badge" aria-hidden="true">PDF</span>
              <span><strong>{selectedFile.name}</strong><small>{formatBytes(selectedFile.size)}</small></span>
            </span>
            <button className="text-button" type="button" onClick={removeFile} disabled={pending}>Remove</button>
          </div>
        ) : null}
        <p id="upload-help" className="form-note">The document is extracted, chunked, and embedded before it becomes active.</p>
        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={pending || !selectedFile}>
            {pending ? "Uploading and indexing..." : "Upload and index"}
          </button>
        </div>
        {pending ? (
          <div className="indexing-progress" role="status" aria-live="polite">
            <span className="progress-indicator" aria-hidden="true" />
            <span>Uploading and indexing policy. This can take a moment.</span>
          </div>
        ) : null}
        {error ? <p id="upload-status" className="error-message" role="alert">{error}</p> : null}
      </form>

      {state.success && result ? (
        <section className="success-panel" aria-labelledby="policy-success-title" role="status">
          <span className="success-icon" aria-hidden="true">✓</span>
          <div className="success-copy">
            <h3 id="policy-success-title">Policy indexed successfully</h3>
            <p>Your policy is ready to use.</p>
          </div>
          <dl className="metadata-list">
            <div><dt>File</dt><dd>{result.fileName}</dd></div>
            <div><dt>Chunks</dt><dd>{result.chunkCount}</dd></div>
            <div><dt>Pages</dt><dd>{result.pageCount}</dd></div>
          </dl>
        </section>
      ) : null}

      <p className="sr-only" aria-live="assertive">{state.success ?? ""}</p>
      <section className="policy-status-panel" aria-labelledby="policy-status-heading">
        <div className="policy-status-copy">
          <p className="eyebrow">Current policy</p>
          <h2 id="policy-status-heading">{currentPolicy?.fileName ?? "No policy connected"}</h2>
          <p className="form-note">
            {currentPolicy
              ? `${currentPolicy.indexingStatus} · ${currentPolicy.chunkCount} chunks${currentPolicy.pageCount ? ` · ${currentPolicy.pageCount} pages` : ""}`
              : "Upload a PDF to extract and index the organization policy."}
          </p>
          {currentPolicy ? <p className="form-note">Last indexed {new Date(currentPolicy.updatedAt).toLocaleString()}</p> : null}
        </div>
        <span className={currentPolicy?.indexingStatus === "READY" ? "status-badge active" : "status-badge"}>
          {currentPolicy?.indexingStatus ?? "Not configured"}
        </span>
      </section>
      {currentPolicy?.indexingStatus === "FAILED" ? (
        <p className="error-message" role="alert">The current policy is not ready for queries. Upload a valid replacement to try again.</p>
      ) : null}
    </>
  );
}
