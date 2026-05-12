import { useRef } from "react";
import { Bold, Italic, List } from "lucide-react";

export default function RichDescriptionInput({ value, onChange }) {
  const taRef = useRef(null);

  const insertAtCursor = (before, after = "", defaultText = "") => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end) || defaultText;
    const newVal = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(newVal);
    // Restore cursor after react re-render
    setTimeout(() => {
      ta.selectionStart = start + before.length;
      ta.selectionEnd = start + before.length + selected.length;
      ta.focus();
    }, 0);
  };

  const addBullet = () => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    // Find the start of the current line
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const newVal = value.slice(0, lineStart) + "• " + value.slice(lineStart);
    onChange(newVal);
    setTimeout(() => {
      ta.selectionStart = start + 2;
      ta.selectionEnd = start + 2;
      ta.focus();
    }, 0);
  };

  const handleKeyDown = (e) => {
    // Auto-continue bullet list on Enter
    if (e.key === "Enter") {
      const start = taRef.current?.selectionStart;
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const currentLine = value.slice(lineStart, start);
      if (currentLine.startsWith("• ")) {
        e.preventDefault();
        const insertion = "\n• ";
        const newVal = value.slice(0, start) + insertion + value.slice(start);
        onChange(newVal);
        setTimeout(() => {
          taRef.current.selectionStart = start + insertion.length;
          taRef.current.selectionEnd = start + insertion.length;
          taRef.current.focus();
        }, 0);
      }
    }
  };

  return (
    <div className="border border-input rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-ring">
      {/* Mini toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1 bg-muted border-b border-input">
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); insertAtCursor("**", "**", "bold text"); }}
          className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-900 transition-colors"
          title="Bold"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); insertAtCursor("_", "_", "italic text"); }}
          className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-900 transition-colors"
          title="Italic"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-4 bg-gray-300 mx-1" />
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); addBullet(); }}
          className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-900 transition-colors"
          title="Add bullet point"
        >
          <List className="w-3.5 h-3.5" />
        </button>
      </div>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={3}
        placeholder="Details... (supports • bullet points, **bold**, _italic_)"
        className="w-full px-3 py-2 text-sm bg-white resize-none outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}