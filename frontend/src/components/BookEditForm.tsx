import { useState } from "react";
import type { Book } from "../types";
import { CheckIcon, XIcon } from "./Icons";

export function BookEditForm({
  book,
  onSave,
  onCancel,
  isPending,
}: {
  book: Book;
  onSave: (data: {
    title: string;
    authors: string;
    description: string;
    link: string;
  }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState(book.title);
  const [authors, setAuthors] = useState(book.authors);
  const [description, setDescription] = useState(book.description ?? "");
  const [link, setLink] = useState(book.link ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    const a = authors.trim();
    if (!t || !a) return;
    onSave({
      title: t,
      authors: a,
      description: description.trim(),
      link: link.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Book title"
        maxLength={500}
        aria-label="Edit book title"
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
      />
      <input
        type="text"
        value={authors}
        onChange={(e) => setAuthors(e.target.value)}
        placeholder="Author(s)"
        maxLength={500}
        aria-label="Edit author(s)"
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        maxLength={5000}
        aria-label="Edit description"
        rows={2}
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
      />
      <input
        type="url"
        value={link}
        onChange={(e) => setLink(e.target.value)}
        placeholder="Link (optional)"
        maxLength={2000}
        aria-label="Edit link"
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 disabled:opacity-50"
        >
          <CheckIcon /> Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
        >
          <XIcon /> Cancel
        </button>
      </div>
    </form>
  );
}
