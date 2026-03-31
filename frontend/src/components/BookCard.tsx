import { type ReactNode } from "react";
import type { Book } from "../types";

const PREVIEW_LENGTH = 200;

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
        <p className="text-base font-semibold">{book.title}</p>
        <p className="mt-0.5 text-sm text-stone-500">{book.authors}</p>
        {meta && <div className="mt-1">{meta}</div>}
        {linkOnly ? (
          <p className="mt-2 text-xs">
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
            <p className="mt-2 text-sm text-stone-600">
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
                        className="text-stone-500 underline hover:text-stone-700"
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
                        className="text-stone-500 underline hover:text-stone-700"
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
      {actions && <div className="mt-3 flex flex-wrap gap-1">{actions}</div>}
    </div>
  );
}
