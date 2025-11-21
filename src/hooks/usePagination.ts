import {useEffect, useMemo, useState} from 'react';

export interface PaginationResult<T> {
  currentPage: number;
  totalPages: number;
  startItem: number;
  endItem: number;
  paginatedItems: T[];
  setPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  goToFirstPage: () => void;
  goToLastPage: () => void;
  getPageNumbers: () => (number | string)[];
}

export interface UsePaginationOptions {
  itemsPerPage?: number;
  maxVisiblePages?: number;
  resetOnItemsChange?: boolean;
}

/**
 * Custom hook for pagination logic
 *
 * @param items - Array of items to paginate
 * @param options - Pagination configuration
 * @returns Pagination state and controls
 */
export function usePagination<T>(
  items: T[],
  options: UsePaginationOptions = {}
): PaginationResult<T> {
  const {
    itemsPerPage = 20,
    maxVisiblePages = 7,
    resetOnItemsChange = true
  } = options;

  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 when items change (e.g., when filters change)
  useEffect(() => {
    if (resetOnItemsChange) {
      setCurrentPage(1);
    }
  }, [items, resetOnItemsChange]);

  // Calculate pagination values
  const totalPages = useMemo(
    () => Math.ceil(items.length / itemsPerPage),
    [items.length, itemsPerPage]
  );

  const startItem = useMemo(
    () => items.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1,
    [currentPage, items.length, itemsPerPage]
  );

  const endItem = useMemo(
    () => Math.min(currentPage * itemsPerPage, items.length),
    [currentPage, itemsPerPage, items.length]
  );

  // Get paginated items
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }, [items, currentPage, itemsPerPage]);

  // Page control functions
  const setPage = (page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
  };

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToFirstPage = () => {
    setCurrentPage(1);
  };

  const goToLastPage = () => {
    setCurrentPage(totalPages);
  };

  // Generate page numbers for pagination UI
  const getPageNumbers = (): (number | string)[] => {
    const pages: (number | string)[] = [];

    if (totalPages <= maxVisiblePages) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show subset with ellipsis
      if (currentPage <= 4) {
        // Near start
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        // Near end
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // In middle
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return {
    currentPage,
    totalPages,
    startItem,
    endItem,
    paginatedItems,
    setPage,
    nextPage,
    prevPage,
    goToFirstPage,
    goToLastPage,
    getPageNumbers
  };
}
