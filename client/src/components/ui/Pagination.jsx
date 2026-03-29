import React from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import ui from "../../styles/ui.module.css";

export default function Pagination({ currentPage, totalPages, totalItems, startIndex, endIndex, onPageChange }) {
  if (!totalItems) return null;

  const pageNumbers = [];
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

  for (let page = startPage; page <= endPage; page += 1) pageNumbers.push(page);

  return (
    <div className={ui.paginationWrap}>
      <div className={ui.paginationMeta}>
        Showing <strong>{totalItems === 0 ? 0 : startIndex + 1}</strong>–<strong>{endIndex}</strong> of <strong>{totalItems}</strong>
      </div>

      <div className={ui.paginationControls}>
        <button type="button" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1} className={ui.paginationButton}>
          <FaChevronLeft />
        </button>

        {startPage > 1 ? (
          <>
            <button type="button" onClick={() => onPageChange(1)} className={[ui.paginationButton, currentPage === 1 ? ui.paginationButtonActive : ""].filter(Boolean).join(" ")}>1</button>
            {startPage > 2 ? <span className={ui.paginationDots}>...</span> : null}
          </>
        ) : null}

        {pageNumbers.map((page) => (
          <button key={page} type="button" onClick={() => onPageChange(page)} className={[ui.paginationButton, currentPage === page ? ui.paginationButtonActive : ""].filter(Boolean).join(" ")}>
            {page}
          </button>
        ))}

        {endPage < totalPages ? (
          <>
            {endPage < totalPages - 1 ? <span className={ui.paginationDots}>...</span> : null}
            <button type="button" onClick={() => onPageChange(totalPages)} className={[ui.paginationButton, currentPage === totalPages ? ui.paginationButtonActive : ""].filter(Boolean).join(" ")}>{totalPages}</button>
          </>
        ) : null}

        <button type="button" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages} className={ui.paginationButton}>
          <FaChevronRight />
        </button>
      </div>
    </div>
  );
}
