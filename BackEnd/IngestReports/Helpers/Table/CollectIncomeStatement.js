/** @format */
import { extractTaxonomy } from "../Core/Taxonomy.js";
import {
	isSectionHeaderRow,
	updateBreakdownStateFromHeader,
	handleBreakdownRow,
} from "./RowsIncomeStatement.js";

/**
 * Iterate table rows, handle headers/breakdowns, parse with `parseDataRow`.
 * Returns { rows: collected[], detectedValueCols: number }
 */
export function collectTableRows(table, $, parseDataRow, valueCols, unitsMeta) {
	let inBreakdown = false;
	let detectedValueCols = valueCols ?? 0;
	const collected = [];

	for (const tr of table.find("tr").toArray()) {
		// Header rows only affect breakdown state
		if (isSectionHeaderRow(tr, $)) {
			inBreakdown = updateBreakdownStateFromHeader(tr, $, inBreakdown);
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

		collected.push({
			metric: parsed.metric,
			taxonomy,
			values: parsed.values,
			unitClass: parsed.unitClass,
		});

		if (!detectedValueCols) detectedValueCols = parsed.values.length;
	}

	return { rows: collected, detectedValueCols };
}
