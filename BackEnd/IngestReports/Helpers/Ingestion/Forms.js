/** @format */
// EDGAR/general ingestion helpers

// YYYY-MM-DD for "today minus N years" (default 5)
export function cutoffISOFromYears(yearsBack = 5) {
	const now = new Date();
	const cutoff = new Date(Date.UTC(now.getFullYear() - yearsBack, now.getMonth(), now.getDate()));
	return cutoff.toISOString().slice(0, 10);
}

// Normalize form type string: default "", uppercase, trim
export function normalizeFormType(formType) {
	return String(formType || "")
		.toUpperCase()
		.trim();
}
