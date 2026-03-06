import { useState } from "react";

interface RoomCodeCardProps {
  /** Full peer ID (used for copy). */
  peerId: string;
  /** Short display code (optional; defaults to peerId). */
  displayCode?: string;
}

export function RoomCodeCard({ peerId }: RoomCodeCardProps) {
  const [copied, setCopied] = useState(false);

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
      <p className="font-mono text-xs sm:text-sm font-bold text-white tracking-wider break-all select-all px-2">
        {peerId}
      </p>
      <p className="text-slate-500 text-xs mt-2">Copy and share this code with your friend</p>
      <button
        type="button"
        onClick={handleCopy}
        className="mt-3 px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
      >
        {copied ? "✓ Copied!" : "📋 Copy Code"}
      </button>
    </div>
  );
}
