import { type ReactNode } from "react";
import type { Book } from "../types";

const PREVIEW_LENGTH = 100;

export function BookCard({
  book,
  meta,
  actions,
  expanded,
  onToggle,
}: {
  book: Book;
  meta?: ReactNode;
  actions?: ReactNode;
  expanded: boolean;
  onToggle: () => void;
}) {
  const linkOnly = !book.description && !!book.link;
  const previewText = book.description || book.link || "";
  const hasMore =
    previewText.length > PREVIEW_LENGTH || (!!book.description && !!book.link);

  return (
    <div>
      <div className="min-w-0">
        <p className="text-sm font-medium">{book.title}</p>
        <p className="text-xs text-stone-500">{book.authors}</p>
        {meta}
        {linkOnly ? (
          <p className="mt-1 text-xs">
            <a
              href={book.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline hover:text-blue-800"
            >
              {book.link}
            </a>
          </p>
        ) : (
          previewText && (
            <p className="mt-1 text-xs text-stone-400">
              {expanded ? (
                <>
                  {book.description && (
                    <span className="text-stone-600">{book.description}</span>
                  )}
                  {book.link && (
                    <>
                      <br />
                      <a
                        href={book.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline hover:text-blue-800"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {book.link}
                      </a>
                    </>
                  )}
                  {hasMore && (
                    <>
                      {" "}
                      <button
                        onClick={onToggle}
                        className="text-stone-400 underline hover:text-stone-600"
                      >
                        less
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
                  {previewText.length > PREVIEW_LENGTH
                    ? previewText.slice(0, PREVIEW_LENGTH) + "…"
                    : previewText}
                  {hasMore && (
                    <>
                      {" "}
                      <button
                        onClick={onToggle}
                        className="text-stone-400 underline hover:text-stone-600"
                      >
                        more
                      </button>
                    </>
                  )}
                </>
              )}
            </p>
          )
        )}
      </div>
      {actions && <div className="mt-2 flex flex-wrap gap-1">{actions}</div>}
    </div>
  );
}
