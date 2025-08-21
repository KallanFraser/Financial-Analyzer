/** @format */
// Balance Sheet variants of the row/breakdown helpers.
// These are drop-in siblings to the income-statement helpers in Rows.js.

import { cleanText } from "../Core/Text.js";
import { extractTaxonomy } from "../Core/Taxonomy.js";

// Heuristics for detecting breakdown sections and core lines (Balance Sheet flavored)
const breakdownHeaderReBS = /\b(by\s+(class|category|segment|geography)|components?\s+of|detail\s+of)\b/i;

const coreLineReBS =
	/\b(total\s+assets|total\s+liabilities(?:\s+and\s+stockholders[’']?\s*equity)?|total\s+equity|total\s+shareholders[’']?\s*equity)\b/i;

// Re-export: use the same header predicate as IS (GAAP-tagged = data; no numbers = header)
export { isSectionHeaderRow } from "./RowsIncomeStatement.js";

/**
 * Update breakdown-mode state based on a header row’s text.
 * Returns the new boolean state for `inBreakdown`.
 * Signature: (tr, $, currentState) => boolean
 */
export function updateBreakdownStateFromHeaderBS(tr, $, currentState) {
	const headerText = cleanText($(tr).text());
	// Enter breakdown only for explicit BS breakdown cues.
	if (breakdownHeaderReBS.test(headerText)) return true;
	// Any other header ends breakdown (safe default for BS).
	return false;
}

/**
 * If in breakdown mode, decide whether to keep skipping or exit for a core/GAAP row.
 * Returns { skipRow: boolean, newState: boolean }
 * Signature: (tr, $, inBreakdown) => { skipRow, newState }
 */
export function handleBreakdownRowBS(tr, $, inBreakdown) {
	if (!inBreakdown) return { skipRow: false, newState: false };

	const labelText = cleanText($(tr).find("th,td").first().text());
	const maybeTax = extractTaxonomy(tr, $);

	// While inside a breakdown: skip untagged, non-core rows.
	if (!maybeTax && !coreLineReBS.test(labelText)) {
		return { skipRow: true, newState: true };
	}
	// GAAP-tagged or a core anchor → exit breakdown and process this row.
	return { skipRow: false, newState: false };
}

/* -----------------------------------------------------------------------------
   Section label extraction (for disambiguating duplicate metric names)
   Examples: "Current assets", "Noncurrent liabilities", "Stockholders’ equity"
----------------------------------------------------------------------------- */

const sectionLabelReBS =
	/\b(?:(current|non[-\s]?current)\s+)?(assets?|liabilities|stockholders[’']?\s*equity|shareholders[’']?\s*equity|equity)\b/i;

function toTitleCase(s) {
	return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

/**
 * Extract a normalized balance-sheet section label from a header row.
 * Returns null if not recognized.
 */
export function extractSectionLabelBS(tr, $) {
	const headerText = cleanText($(tr).text());
	const m = headerText.match(sectionLabelReBS);
	if (!m) return null;

	const adjective = m[1] ? m[1].replace(/\s+/g, " ").toLowerCase() : "";
	const adjNorm = adjective === "current" ? "Current" : adjective.startsWith("non") ? "Noncurrent" : "";
	const noun = m[2].replace(/\s+/g, " ").toLowerCase();

	const label = ((adjNorm ? `${adjNorm} ` : "") + noun).trim();
	return toTitleCase(label);
}

/** Optionally export internals for unit tests */
export const __internalsBS = {
	breakdownHeaderReBS,
	coreLineReBS,
	sectionLabelReBS,
	toTitleCase,
};
