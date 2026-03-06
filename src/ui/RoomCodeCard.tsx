import { useState } from "react";

interface RoomCodeCardProps {
  /** Full peer ID (used for copy). */
  peerId: string;
  /** Short display code (optional; defaults to peerId). */
  displayCode?: string;
}

export function RoomCodeCard({ peerId, displayCode }: RoomCodeCardProps) {
  const [copied, setCopied] = useState(false);
  const showCode = displayCode ?? peerId;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(peerId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select so user can copy manually
      const el = document.createElement("input");
      el.value = peerId;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="rounded-lg border-2 border-slate-600 bg-slate-800/80 p-4 text-center">
      <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Room code</p>
      <p className="font-mono text-xl sm:text-2xl font-bold text-white tracking-widest break-all">
        {showCode}
      </p>
      <p className="text-slate-500 text-xs mt-1">Share the full code below for your friend to join</p>
      <button
        type="button"
        onClick={handleCopy}
        className="mt-3 px-4 py-2 rounded bg-slate-600 hover:bg-slate-500 text-white text-sm font-medium transition-colors"
      >
        {copied ? "Copied!" : "Copy full code"}
      </button>
    </div>
  );
}
