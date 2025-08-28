/** @format */
import { extractTaxonomy } from "../Core/Taxonomy.js";
import {
	isSectionHeaderRow,
	updateBreakdownStateFromHeader,
	handleBreakdownRow,
	extractSectionLabelIS, // ⟵ NEW: pull a section/subheader label
} from "./RowsIncomeStatement.js";

/**
 * Iterate table rows, handle headers/breakdowns, parse with `parseDataRow`.
 * Returns { rows: collected[], detectedValueCols: number }
 */
export function collectTableRows(table, $, parseDataRow, valueCols, unitsMeta) {
	let inBreakdown = false;
	let detectedValueCols = valueCols ?? 0;
	let sectionLabel = null; // ⟵ NEW: track current section/subheader label
	const collected = [];

	for (const tr of table.find("tr").toArray()) {
		// Header rows: update breakdown state AND refresh section label if recognized.
		if (isSectionHeaderRow(tr, $)) {
			inBreakdown = updateBreakdownStateFromHeader(tr, $, inBreakdown);
			const maybe = extractSectionLabelIS(tr, $); // ⟵ NEW
			if (maybe) sectionLabel = maybe; // ⟵ NEW
			continue;
		}

		// If inside breakdown, decide whether to keep skipping or exit
		const { skipRow, newState } = handleBreakdownRow(tr, $, inBreakdown);
		if (skipRow) {
			inBreakdown = newState;
			continue;
		}
		inBreakdown = newState;

		// Parse numeric row
		const parsed = parseDataRow(tr, detectedValueCols, unitsMeta, $);
		if (!parsed) continue;

		const hasNum = parsed.values.some((v) => Number.isFinite(v));
		if (!hasNum) continue;

		const taxonomy = extractTaxonomy(tr, $);

		// ⟵ NEW: append active section label (mirrors Balance Sheet behavior)
		const metricWithSection = sectionLabel ? `${parsed.metric} — ${sectionLabel}` : parsed.metric;

		collected.push({
			metric: metricWithSection, // ⟵ NEW
			taxonomy,
			values: parsed.values,
			unitClass: parsed.unitClass,
		});

		if (!detectedValueCols) detectedValueCols = parsed.values.length;
	}

	return { rows: collected, detectedValueCols };
}
