import { useState, useMemo, useEffect } from "react";

export function usePagination<T>(items: T[], itemsPerPage: number = 20) {
	const [currentPage, setCurrentPage] = useState(1);

	// Reset to page 1 when items change (e.g., filter/search changes)
	useEffect(() => {
		setCurrentPage(1);
	}, [items]);

	const totalItems = items.length;
	const totalPages = Math.ceil(totalItems / itemsPerPage);

	// Calculate paginated items for current page
	const paginatedItems = useMemo(() => {
		const startIndex = (currentPage - 1) * itemsPerPage;
		const endIndex = startIndex + itemsPerPage;
		return items.slice(startIndex, endIndex);
	}, [items, currentPage, itemsPerPage]);

	const hasNextPage = currentPage < totalPages;
	const hasPreviousPage = currentPage > 1;

	const nextPage = () => {
		if (hasNextPage) {
			setCurrentPage((prev) => prev + 1);
		}
	};

	const previousPage = () => {
		if (hasPreviousPage) {
			setCurrentPage((prev) => prev - 1);
		}
	};

	const goToPage = (page: number) => {
		const validPage = Math.max(1, Math.min(page, totalPages));
		setCurrentPage(validPage);
	};

	const reset = () => {
		setCurrentPage(1);
	};

	return {
		paginatedItems,
		currentPage,
		totalPages,
		totalItems,
		hasNextPage,
		hasPreviousPage,
		nextPage,
		previousPage,
		goToPage,
		reset,
	};
}

