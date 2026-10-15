import { useEffect } from "react";

const NoteView = ({ note, onClose }: { note: { title: string; text: string }; onClose: () => void }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Tab") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm -rotate-1 bg-[#e9e2c9] px-6 py-5 text-[#2b2620] shadow-2xl"
        style={{ backgroundImage: "repeating-linear-gradient(transparent 0 27px, rgba(70,90,140,0.18) 27px 28px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 font-ui text-xs uppercase tracking-[0.2em] text-[#6b6150]">{note.title}</div>
        <p className="whitespace-pre-wrap font-note text-lg leading-7">{note.text}</p>
        <button
          onClick={onClose}
          className="mt-4 font-ui text-sm font-semibold uppercase tracking-wider text-[#6b6150] underline-offset-4 hover:underline focus:outline-none focus-visible:underline"
        >
          Put it away
        </button>
      </div>
    </div>
  );
};

export default NoteView;
