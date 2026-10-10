interface PaginationProps {
  /** Accessible name, e.g. "Ranking pages". */
  label: string;
  page: number;
  totalPages: number;
  /** True while the next page is loading (the old page is still on screen). */
  isLoadingPage: boolean;
  onChange: (page: number) => void;
}

export function Pagination({ label, page, totalPages, isLoadingPage, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav className="pagination" aria-label={label}>
      <button
        type="button"
        className="small-button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
      >
        Previous
      </button>
      <span aria-live="polite">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        className="small-button"
        onClick={() => onChange(page + 1)}
        // Blocked while loading, so the page number never runs ahead of the data.
        disabled={page >= totalPages || isLoadingPage}
      >
        Next
      </button>
    </nav>
  );
}
