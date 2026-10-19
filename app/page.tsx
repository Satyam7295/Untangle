"use client";

import { FormEvent, KeyboardEvent, useRef, useState } from "react";
import Link from "next/link";

type Message = {
  id: number;
  role: "user" | "system";
  content: string;
};

const suggestions = [
  "I need help understanding a company policy",
  "How do I request access to a tool?",
  "I want to report a workplace issue",
];

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = query.trim();
    if (!text) {
      setNotice("Write a message first.");
      inputRef.current?.focus();
      return;
    }

    setMessages((current) => [
      ...current,
      { id: Date.now(), role: "user", content: text },
      {
        id: Date.now() + 1,
        role: "system",
        content:
          "Your message is shown in this interface preview only. Query processing is not connected yet, so nothing was sent and no ticket was created.",
      },
    ]);
    setQuery("");
    setNotice("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function startNewConversation() {
    setMessages([]);
    setQuery("");
    setNotice("");
    inputRef.current?.focus();
  }

  return (
    <section className="chat-workspace" aria-label="Untangle assistant">
      <aside className="chat-sidebar">
        <Link className="chat-brand" href="/" aria-label="Untangle home">
          <span className="chat-brand-mark" aria-hidden="true">u</span>
          <span>untangle</span>
        </Link>

        <button className="new-chat-button" type="button" onClick={startNewConversation}>
          <span aria-hidden="true">＋</span> New conversation
        </button>

        <div className="sidebar-section">
          <p className="sidebar-label">WORKSPACE</p>
          <Link className="sidebar-link sidebar-link-active" href="/" aria-current="page">
            <span aria-hidden="true">◌</span> Ask Untangle
          </Link>
        </div>

        <div className="sidebar-bottom">
          <div className="preview-pill"><span aria-hidden="true" /> Interface preview</div>
          <a className="sidebar-link" href="/admin/login"><span aria-hidden="true">⚙</span> Admin sign-in</a>
        </div>
      </aside>

      <div className="chat-main">
        <header className="chat-topbar">
          <div>
            <p className="chat-topbar-title">Ask Untangle</p>
            <p className="chat-topbar-subtitle">Policy-guided assistance</p>
          </div>
          <span className="topbar-status"><span aria-hidden="true" /> Preview</span>
        </header>

        <div className={messages.length ? "chat-content chat-content-active" : "chat-content"}>
          {messages.length === 0 ? (
            <div className="chat-welcome">
              <div className="welcome-mark" aria-hidden="true"><span>u</span></div>
              <p className="chat-eyebrow">A clearer way forward</p>
              <h1>What can we help<br className="desktop-break" /> you figure out?</h1>
              <p className="chat-welcome-copy">
                Describe your question in your own words. Untangle is designed to help you understand policy and find the right next step.
              </p>
              <div className="suggestion-list" aria-label="Example prompts">
                {suggestions.map((suggestion) => (
                  <button
                    className="suggestion-chip"
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setQuery(suggestion);
                      setNotice("");
                      inputRef.current?.focus();
                    }}
                  >
                    <span aria-hidden="true">↗</span>{suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="message-list" aria-live="polite" aria-label="Conversation preview">
              {messages.map((message) => (
                <article className={message.role === "user" ? "message-row message-user" : "message-row message-system"} key={message.id}>
                  {message.role === "system" ? <span className="assistant-avatar" aria-hidden="true">u</span> : null}
                  <div className={message.role === "user" ? "message-bubble user-bubble" : "message-bubble system-bubble"}>
                    {message.content}
                    {message.role === "system" ? <span className="message-preview-label">PREVIEW NOTICE</span> : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="composer-area">
          <form className="chat-composer" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="chat-query">Message Untangle</label>
            <textarea
              ref={inputRef}
              id="chat-query"
              name="query"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                if (notice) setNotice("");
              }}
              onKeyDown={handleKeyDown}
              placeholder="Message Untangle..."
              rows={1}
              aria-describedby="composer-note composer-status"
            />
            <button className="chat-send-button" type="submit" aria-label="Preview message" disabled={!query.trim()}>
              <span aria-hidden="true">↑</span>
            </button>
          </form>
          <div className="composer-meta">
            <p id="composer-note">Enter to preview · Shift + Enter for a new line</p>
            <p id="composer-status" role="status">{notice || "Preview only · Messages are not sent to a backend"}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
