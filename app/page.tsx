"use client";

import { useEffect, useRef, useState } from "react";

type MessageRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  subject: string;
  concept: string;
  canSave?: boolean;
  saving?: boolean;
  saved?: boolean;
  error?: string;
};

function extractList(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^[-*•\s]+/, ""))
    .filter((line) => line.length > 0);
}

function parseSavePayload(content: string, subject: string, concept: string) {
  const normalized = content.replace(/\r/g, "");
  const masteryMatch = normalized.match(/mastery level[:\s]+(.+?)(?:\n|$)/i);
  const strongMatch = normalized.match(/strong areas?[:\s]+(.+?)(?:\n|$)/i);
  const weakMatch = normalized.match(/weak areas?[:\s]+(.+?)(?:\n|$)/i);
  const nextStepsMatch = normalized.match(/next steps?[:\s]*([\s\S]+)/i);

  const paragraphChunks = normalized
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const overviewGist = paragraphChunks[0] ?? "";
  const deepDiveGist = paragraphChunks.slice(1, 4);

  const strongAreas = strongMatch
    ? strongMatch[1].split(/,|;/).map((item) => item.trim()).filter(Boolean)
    : [];
  const weakAreas = weakMatch
    ? weakMatch[1].split(/,|;/).map((item) => item.trim()).filter(Boolean)
    : [];

  const nextSteps = nextStepsMatch ? extractList(nextStepsMatch[1]) : [];

  return {
    subject,
    concept,
    masteryLevel: masteryMatch ? masteryMatch[1].trim() : "",
    overviewGist: overviewGist.slice(0, 400),
    deepDiveGist,
    strongAreas,
    weakAreas,
    nextSteps,
    notes: normalized,
  };
}

function isConceptDetected(subject: string, concept: string) {
  return subject.trim().length > 0 && concept.trim().length > 0;
}

export default function HomePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const userMessage = input.trim();
    if (!userMessage || isSending) return;

    setErrorText(null);
    setIsSending(true);
    setInput("");

    const userId = crypto.randomUUID();
    const newUserMessage: ChatMessage = {
      id: `user-${userId}`,
      role: "user",
      content: userMessage,
      subject: "",
      concept: "",
    };
    setMessages((prev) => [...prev, newUserMessage]);

    let detectedSubject = "";
    let detectedConcept = "";

    try {
      const detectResponse = await fetch("/api/detect-concept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userMessage }),
      });
      if (detectResponse.ok) {
        const detectJson = await detectResponse.json();
        detectedSubject = typeof detectJson.subject === "string" ? detectJson.subject : "";
        detectedConcept = typeof detectJson.concept === "string" ? detectJson.concept : "";
      }
    } catch (err) {
      console.error(err);
    }

    const assistantId = `assistant-${crypto.randomUUID()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        subject: detectedSubject,
        concept: detectedConcept,
        canSave: false,
        saved: false,
      },
    ]);

    try {
      const chatResponse = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userMessage, subject: detectedSubject, concept: detectedConcept }),
      });

      if (!chatResponse.ok || !chatResponse.body) {
        const errorBody = await chatResponse.text();
        throw new Error(errorBody || "Failed to stream chat response.");
      }

      const reader = chatResponse.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        assistantContent += chunk;
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId ? { ...message, content: assistantContent } : message
          )
        );
      }

      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content: assistantContent,
                canSave: isConceptDetected(detectedSubject, detectedConcept),
              }
            : message
        )
      );
    } catch (chatError) {
      const errorMessage = chatError instanceof Error ? chatError.message : "Unknown chat error.";
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId ? { ...message, content: `Error: ${errorMessage}`, error: errorMessage } : message
        )
      );
      setErrorText(errorMessage);
    } finally {
      setIsSending(false);
    }
  }

  async function handleSave(message: ChatMessage) {
    if (!message.subject || !message.concept) return;

    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === message.id ? { ...msg, saving: true, saved: false } : msg
      )
    );

    const payload = parseSavePayload(message.content, message.subject, message.concept);

    try {
      const response = await fetch("/api/save-concept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(errorBody || "Failed to save concept.");
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === message.id ? { ...msg, saving: false, saved: true, canSave: false } : msg
        )
      );
    } catch (saveError) {
      const errorMessage = saveError instanceof Error ? saveError.message : "Unknown save error.";
      console.error(errorMessage);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === message.id ? { ...msg, saving: false } : msg
        )
      );
      setErrorText(errorMessage);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col border-l border-r border-slate-800 bg-slate-950">
        <header className="border-b border-slate-800 px-6 py-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Study Agent</p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-50">Concept chat assistant</h1>
            </div>
            <p className="max-w-md text-sm leading-6 text-slate-400">
              Ask a study question, detect the concept automatically, and save progress when a concept is found.
            </p>
          </div>
        </header>

        <main className="flex-1 overflow-hidden px-6 py-6">
          <div
            ref={scrollRef}
            className="flex h-full flex-col gap-4 overflow-y-auto rounded-3xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg shadow-slate-950/20"
          >
            {messages.length === 0 ? (
              <div className="mx-auto my-16 flex max-w-2xl flex-col items-center gap-4 text-center text-slate-500">
                <p className="text-lg text-slate-400">Start by asking a concept question below.</p>
                <p className="text-sm leading-6">User messages appear on the right, assistant replies on the left.</p>
              </div>
            ) : (
              messages.map((message) => {
                const isUser = message.role === "user";
                return (
                  <div key={message.id} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-3xl px-4 py-3 shadow-sm ${
                        isUser ? "bg-blue-900 text-slate-100" : "bg-slate-800 text-slate-100"
                      }`}
                    >
                      {message.content ? (
                        <p className="whitespace-pre-wrap break-words text-sm leading-7">{message.content}</p>
                      ) : (
                        <p className="text-sm leading-7 text-slate-400">Typing...</p>
                      )}
                    </div>
                    {!isUser && isConceptDetected(message.subject, message.concept) && (
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                        <span className="rounded-full bg-slate-700/70 px-2 py-1">Subject: {message.subject}</span>
                        <span className="rounded-full bg-slate-700/70 px-2 py-1">Concept: {message.concept}</span>
                      </div>
                    )}
                    {!isUser && message.canSave && !message.saved && (
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSave(message)}
                          disabled={message.saving}
                          className="inline-flex items-center rounded-full bg-slate-700 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {message.saving ? "Saving..." : "Save progress"}
                        </button>
                        <span className="text-xs text-slate-500">Save the detected concept and progress from this reply.</span>
                      </div>
                    )}
                    {!isUser && message.saved && (
                      <p className="mt-3 text-xs text-emerald-400">Progress saved.</p>
                    )}
                    {message.error && (
                      <p className="mt-2 text-xs text-rose-400">{message.error}</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </main>

        <form onSubmit={handleSubmit} className="border-t border-slate-800 bg-slate-950 px-6 py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="sr-only" htmlFor="message-input">
              Send a message
            </label>
            <textarea
              id="message-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              rows={2}
              placeholder="Ask a study question about a subject or concept..."
              className="min-h-[80px] flex-1 rounded-3xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none ring-1 ring-transparent transition focus:border-blue-500 focus:ring-blue-500/30"
            />
            <button
              type="submit"
              disabled={!input.trim() || isSending}
              className="inline-flex h-12 items-center justify-center rounded-3xl bg-blue-600 px-6 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSending ? "Sending..." : "Send"}
            </button>
          </div>
          {errorText && <p className="mt-3 text-sm text-rose-400">{errorText}</p>}
        </form>
      </div>
    </div>
  );
}
