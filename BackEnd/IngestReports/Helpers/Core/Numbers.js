/** @format */
import { cleanText } from "./Text.js";

// Convert a raw cell value to Number or null.
// Handles $, commas, (), unicode minus, %, and stray currency codes.
export function toNumberCell(raw, { stripDollar = true } = {}) {
	// 1) Null check
	if (raw == null) return null;

	// 2) Clean up input text
	let t = cleanText(raw);

	// 3) Empty, dash, or NA-style checks → null
	if (
		t === "" || // empty
		/^[-–—]$/.test(t) || // single dash or em-dash
		/^n\/?a$/i.test(t) || // "NA" / "N/A"
		/^—$/.test(t) // lone em dash
	) {
		return null;
	}

	// 4) If wrapped in parentheses, it's negative: (123) → -123
	if (/^\((.*)\)$/.test(t)) t = "-" + t.slice(1, -1).trim();

	// 5) Strip thousands separators
	t = t.replace(/,/g, "");

	// 6) Percentages → number without "%"
	if (/%$/.test(t)) {
		const p = t.slice(0, -1);
		const n = Number(p);
		return Number.isFinite(n) ? n : null;
	}

	// 7) Currency markers and units
	if (stripDollar) t = t.replace(/\$/g, ""); // "$"
	t = t.replace(/\b(USD|US\$|EUR|CAD)\b/gi, ""); // "USD" etc.

	// 8) Keep only digits, sign, dot, exponent
	t = t.replace(/[^0-9eE.+-]/g, "");

	// 9) Guard against invalid leftovers
	if (t === "" || t === "-" || t === "." || t === "-.") return null;

	// 10) Convert to number
	const n = Number(t);
	return Number.isFinite(n) ? n : null;
}

// Map unit words to numeric scales (billions/millions/thousands)
export function scaleFromWord(w) {
	const s = (w || "").toLowerCase();
	if (s.includes("billion")) return 1_000_000_000;
	if (s.includes("million")) return 1_000_000;
	if (s.includes("thousand")) return 1_000;
	return 1;
}
