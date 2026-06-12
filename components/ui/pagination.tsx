'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Rows per page:</label>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(parseInt(e.target.value))}
          className="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="5">5</option>
          <option value="10">10</option>
          <option value="25">25</option>
          <option value="50">50</option>
        </select>
      </div>

      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {startIndex} - {endIndex} of {totalItems}
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="rounded border border-gray-300 p-2 disabled:opacity-50 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let page = currentPage - 2 + i;
              if (page < 1) page = 1 + i;
              if (page > totalPages) page = totalPages - 4 + i;
              if (page < 1) page = 1;
              return page;
            })
              .filter((page, idx, arr) => idx === 0 || page !== arr[idx - 1])
              .map((page) => (
                <button
                  key={page}
                  onClick={() => onPageChange(page)}
                  className={clsx(
                    'rounded px-2 py-1 text-sm font-medium',
                    currentPage === page
                      ? 'bg-primary-600 text-white'
                      : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                  )}
                >
                  {page}
                </button>
              ))}
          </div>
          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="rounded border border-gray-300 p-2 disabled:opacity-50 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
