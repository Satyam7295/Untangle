"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Message = {
  id: number;
  role: "user" | "system";
  content: string;
  sources?: Array<{
    id: string;
    excerpt: string;
    pageStart: number | null;
    pageEnd: number | null;
    sectionHeading: string | null;
  }>;
};

type PolicyAvailability = "loading" | "ready" | "not-configured" | "unavailable";

const suggestions = [
  "I need help understanding a company policy",
  "How do I request access to a tool?",
  "I want to report a workplace issue",
];

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [policyAvailability, setPolicyAvailability] = useState<PolicyAvailability>("loading");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const conversationIdRef = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    let cancelled = false;
    const statusRequest = window.setTimeout(() => {
      fetch("/api/policy-status")
        .then(async (response) => {
          if (!response.ok) throw new Error("Policy status unavailable");
          return response.json() as Promise<{ status?: string }>;
        })
        .then((result) => {
          if (!cancelled) setPolicyAvailability(result.status === "READY" ? "ready" : "not-configured");
        })
        .catch(() => {
          if (!cancelled) setPolicyAvailability("unavailable");
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(statusRequest);
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = query.trim();
    if (!text) {
      setNotice("Write a message first.");
      inputRef.current?.focus();
      return;
    }

    setMessages((current) => [...current, { id: Date.now(), role: "user", content: text }]);
    setQuery("");
    setNotice("");
    setPending(true);
    try {
      const response = await fetch("/api/policy-query", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-conversation-id": conversationIdRef.current,
        },
        body: JSON.stringify({ query: text }),
      });
      const result = await response.json() as {
        answer?: string;
        sources?: Message["sources"];
        clarificationQuestion?: string;
      };
      if (!response.ok || typeof result.answer !== "string") {
        throw new Error("The policy query could not be completed.");
      }
      const answer = result.answer;
      setMessages((current) => [
        ...current,
        {
          id: Date.now(),
          role: "system",
          content: result.clarificationQuestion
            ? `${answer}\n\n${result.clarificationQuestion}`
            : answer,
          sources: result.sources,
        },
      ]);
    } catch {
      setNotice("Policy search is temporarily unavailable. Please try again.");
    } finally {
      setPending(false);
      conversationIdRef.current = crypto.randomUUID();
    }
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
    setPending(false);
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
          <span className={policyAvailability === "ready" ? "topbar-status ready" : "topbar-status"}>
            <span aria-hidden="true" /> {policyAvailability === "ready" ? "Policy ready" : policyAvailability === "loading" ? "Checking policy" : "Policy unavailable"}
          </span>
        </header>

        <div className={messages.length ? "chat-content chat-content-active" : "chat-content"}>
          {policyAvailability !== "ready" ? (
            <p className="policy-availability" role={policyAvailability === "unavailable" ? "alert" : undefined} aria-live="polite">
              {policyAvailability === "loading"
                ? "Checking whether your organization policy is available..."
                : policyAvailability === "not-configured"
                  ? "No active policy is available yet. You can write a question, but policy-grounded answers are not available."
                  : "Policy search is temporarily unavailable. Please try again later."}
            </p>
          ) : null}
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
            <div className="message-list" aria-live="polite" aria-label="Conversation">
              {messages.map((message) => (
                <article className={message.role === "user" ? "message-row message-user" : "message-row message-system"} key={message.id}>
                  {message.role === "system" ? <span className="assistant-avatar" aria-hidden="true">u</span> : null}
                  <div className={message.role === "user" ? "message-bubble user-bubble" : "message-bubble system-bubble"}>
                    <span>{message.content}</span>
                    {message.sources?.length ? (
                      <span className="message-preview-label">
                        SOURCES: {message.sources.map((source) => source.sectionHeading || `Page ${source.pageStart ?? "?"}`).join(" · ")}
                      </span>
                    ) : null}
                  </div>
                </article>
              ))}
              {pending ? (
                <article className="message-row message-system">
                  <span className="assistant-avatar" aria-hidden="true">u</span>
                  <div className="message-bubble system-bubble">Searching the current policy...</div>
                </article>
              ) : null}
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
            <button className="chat-send-button" type="submit" aria-label="Send message" disabled={!query.trim() || pending}>
              <span aria-hidden="true">↑</span>
            </button>
          </form>
          <div className="composer-meta">
            <p id="composer-note">Enter to send · Shift + Enter for a new line</p>
            <p id="composer-status" role="status">{notice || (pending ? "Searching policy..." : policyAvailability === "ready" ? "Answers are grounded in the current policy" : "Policy-grounded answers are currently unavailable")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
