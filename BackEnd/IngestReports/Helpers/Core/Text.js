/** @format */
// Core text utilities: HTML extraction + string cleanup

// Extract the <html>...</html> block, or return the input as string.
export function extractHtml(htmlOrBlob) {
	const m = String(htmlOrBlob).match(/<html[\s\S]*?<\/html>/i);
	return m ? m[0] : String(htmlOrBlob);
}

// Normalize whitespace and minus signs, collapse spaces, trim.
export function cleanText(s) {
	return String(s ?? "")
		.replace(/[\u00A0\u202F\u2007]/g, " ") // NBSP variants → space
		.replace(/\u2212/g, "-") // unicode minus → ASCII
		.replace(/\s+/g, " ") // collapse whitespace
		.trim();
}
