/** @format */
// Cash Flow variants of the row/breakdown helpers.
// Mirrors RowsIncomeStatement/RowsBalanceSheet with CF-specific heuristics.

import { cleanText } from "../Core/Text.js";
import { extractTaxonomy } from "../Core/Taxonomy.js";

// Heuristics for detecting breakdown sections and core anchor lines (Cash Flow flavored)
const breakdownHeaderReCF =
	/\b(components?\s+of|detail\s+of|reconciliation(?:\s+of)?|supplemental\s+(?:cash\s+flow|disclosures?)|non[-\s]?cash)\b/i;

const coreLineReCF =
	/\b(net\s+cash\s+(?:provided\s+by|used\s+in)\s+(?:operating|investing|financing)\s+activities|net\s+increase\s*\(?\s*decrease\)?\s+in\s+cash(?:\s+and\s+cash\s+equivalents)?|cash\s+and\s+cash\s+equivalents,\s*end\s+of\s+period|cash\s+and\s+cash\s+equivalents,\s*beginning\s+of\s+period)\b/i;

// Re-export generic header detector (works fine for CF tables)
export { isSectionHeaderRow } from "./RowsIncomeStatement.js";

/**
 * Update breakdown-mode state based on a header row’s text.
 * CF tables often include "Reconciliation" / "Supplemental" blocks we should skip.
 * Returns the new boolean for `inBreakdown`.
 */
export function updateBreakdownStateFromHeaderCF(tr, $, currentState) {
	const headerText = cleanText($(tr).text());
	// Enter breakdown for explicit CF breakdown cues.
	if (breakdownHeaderReCF.test(headerText)) return true;
	// Any other header ends breakdown by default.
	return false;
}

/**
 * If in breakdown mode, decide whether to keep skipping or exit for a core/GAAP row.
 * Returns { skipRow: boolean, newState: boolean }
 */
export function handleBreakdownRowCF(tr, $, inBreakdown) {
	if (!inBreakdown) return { skipRow: false, newState: false };

	const labelText = cleanText($(tr).find("th,td").first().text());
	const maybeTax = extractTaxonomy(tr, $);

	// While inside a breakdown: skip untagged, non-core rows.
	if (!maybeTax && !coreLineReCF.test(labelText)) {
		return { skipRow: true, newState: true };
	}
	// GAAP-tagged or a core anchor → exit breakdown and process this row.
	return { skipRow: false, newState: false };
}

/* -----------------------------------------------------------------------------
   Section label extraction (for disambiguating duplicate metric names)
   Examples: "Operating activities", "Investing activities", "Financing activities"
----------------------------------------------------------------------------- */

const sectionLabelReCF = /\b(operating|investing|financing)\s+activities\b/i;

function toTitleCase(s) {
	return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

/**
 * Extract a normalized cash-flow section label from a header row.
 * Returns null if not recognized.
 */
export function extractSectionLabelCF(tr, $) {
	const headerText = cleanText($(tr).text());
	const m = headerText.match(sectionLabelReCF);
	if (!m) return null;

	const label = `${toTitleCase(m[1])} Activities`;
	return label;
}

/** Optionally export internals for unit tests */
export const __internalsCF = {
	breakdownHeaderReCF,
	coreLineReCF,
	sectionLabelReCF,
	toTitleCase,
};
