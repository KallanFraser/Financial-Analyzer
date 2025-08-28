/** @format */

// YYYY-MM-DD for "today minus N years" (default 5)
export function cutoffISOFromYears(yearsBack = 5) {
	// Get todays date
	const now = new Date();

	// Calculate the cutoff date (today - 5 years)
	const cutoff = new Date(Date.UTC(now.getFullYear() - yearsBack, now.getMonth(), now.getDate()));

	// Return it as an ISO string. Slice = to keep just the YYYY-MM-DD part
	return cutoff.toISOString().slice(0, 10);
}

// Normalize form type string: default "", uppercase, trim
export function normalizeFormType(formType) {
	return String(formType || "")
		.toUpperCase()
		.trim();
}
