type PaginationControlsProps = {
	currentPage: number;
	totalPages: number;
	onPrevious: () => void;
	onNext: () => void;
};

export function PaginationControls({
	currentPage,
	totalPages,
	onPrevious,
	onNext,
}: PaginationControlsProps) {
	if (totalPages <= 1) {
		return null;
	}

	return (
		<div className="flex items-center justify-center gap-4 mt-8 py-4">
			<button
				onClick={onPrevious}
				disabled={currentPage === 1}
				className="px-4 py-2 border border-warm-grey rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-grey-white transition-colors"
				aria-label="Previous page"
			>
				Previous
			</button>

			<span className="text-sm text-warm-grey">
				Page {currentPage} of {totalPages}
			</span>

			<button
				onClick={onNext}
				disabled={currentPage === totalPages}
				className="px-4 py-2 border border-warm-grey rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-grey-white transition-colors"
				aria-label="Next page"
			>
				Next
			</button>
		</div>
	);
}

