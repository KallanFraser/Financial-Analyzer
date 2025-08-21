/** @format */
/*
-------------------------------------------------------------------------------
                                    Helpers
------------------------------------------------------------------------------*/
// Returns an ISO date string (YYYY-MM-DD)
// Represents "today minus N years".
// Used as a comparison to the date of the forms.
// Allows us to say "we want reports from today to 5 years ago today"
// Default value = 5
export function cutoffISOFromYears(yearsBack = 5) {
	const now = new Date();
	const cutoff = new Date(Date.UTC(now.getFullYear() - yearsBack, now.getMonth(), now.getDate()));
	return cutoff.toISOString().slice(0, 10);
}

// Normalize's a form type
// Should not be necessary but just in case.
// Just trims the string, provides a default value, and converts to uppercase
export function normalizeFormType(formType) {
	return String(formType || "")
		.toUpperCase()
		.trim();
}
