/** @format */
/*------------------------------------------------------------------------------
                                Imports
------------------------------------------------------------------------------*/
import { cleanText, extractTaxonomy } from "./ParsingHelpers.js";
/*------------------------------------------------------------------------------
                                Regexes & Constants
------------------------------------------------------------------------------*/
const breakdownHeaderRe =
	/\b(products?|services?|segments?|segment|geographic|by\s+segment|by\s+category|revenue\s+by|sales\s+by)\b/i;

const coreLineRe =
	/\b(net\s+sales|total\s+revenue|revenue\s+from|net\s+income(?:\s*\(loss\))?|earnings\s+per\s+share|basic|diluted)\b/i;
/*------------------------------------------------------------------------------
                                Helpers
------------------------------------------------------------------------------*/
//Decide if a <tr> is a header row (non-numeric, not GAAP-tagged).
export function isSectionHeaderRow(tr, $) {
	// GAAP-tagged rows are data, not headers
	if (extractTaxonomy(tr, $)) return false;

	const texts = $(tr)
		.find("th,td")
		.toArray()
		.map((el) => cleanText($(el).text()));

	if (texts.every((t) => t === "")) return false;

	const hasNumber = texts.some((t) => /^[+-]?\d*\.?\d+(e[+-]?\d+)?%?$/.test(t.replace(/[$,()]/g, "")));

	return !hasNumber;
}

/**
 * Update breakdown-mode state based on a header row’s text.
 * Returns the new boolean state for `inBreakdown`.
 */
export function updateBreakdownStateFromHeader(tr, $, currentState) {
	const headerText = cleanText($(tr).text());
	if (breakdownHeaderRe.test(headerText)) return true; // enter breakdown
	return false; // any other header ends breakdown
}

/**
 * If in breakdown mode, decide whether to keep skipping or exit for a core/GAAP row.
 * Returns { skipRow: boolean, newState: boolean }
 */
export function handleBreakdownRow(tr, $, inBreakdown) {
	if (!inBreakdown) return { skipRow: false, newState: false };

	const labelText = cleanText($(tr).find("th,td").first().text());
	const maybeTax = extractTaxonomy(tr, $);

	// Allow through if GAAP-tagged OR looks like a core total/EPS line
	if (!maybeTax && !coreLineRe.test(labelText)) {
		return { skipRow: true, newState: true }; // keep skipping inside breakdown
	}
	return { skipRow: false, newState: false }; // exit breakdown, process this row
}

/**
 * Given parsed row objects, dedupe:
 * - GAAP-tagged rows are kept as-is (unique by taxonomy).
 * - Untagged rows: keep one per (metric,width), prefer larger |sum|.
 */
export function softDedupRows(collected) {
	const seenTaxonomies = new Set();
	const picked = new Map(); // key(metric::width) -> { row, score }
	const order = [];
	const out = [];

	// First: take GAAP-tagged rows and mark their taxonomies
	for (const r of collected) {
		if (r.taxonomy) {
			if (seenTaxonomies.has(r.taxonomy)) continue; // already kept
			seenTaxonomies.add(r.taxonomy);
			out.push(r); // preserve original order for GAAP-tagged
		}
	}

	// Then: handle untagged rows with preference by |sum|
	const key = (r) => `${r.metric}::${r.values.length}`;
	for (const r of collected) {
		if (r.taxonomy) continue;
		const k = key(r);
		const score = r.values.reduce((acc, v) => acc + (typeof v === "number" ? Math.abs(v) : 0), 0);
		const prev = picked.get(k);
		if (!prev) {
			picked.set(k, { row: r, score });
			order.push(k);
		} else if (score > prev.score) {
			picked.set(k, { row: r, score });
		}
	}

	for (const k of order) {
		const entry = picked.get(k);
		if (entry?.row) out.push(entry.row);
	}

	return out;
}
