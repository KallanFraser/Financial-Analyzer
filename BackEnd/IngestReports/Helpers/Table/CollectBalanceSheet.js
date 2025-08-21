/** @format */
// Collector for Balance Sheet tables that appends the current section header
// to each parsed metric (e.g., "Marketable securities — Current Assets").

import { extractTaxonomy } from "../Core/Taxonomy.js";
import {
	isSectionHeaderRow,
	updateBreakdownStateFromHeaderBS,
	handleBreakdownRowBS,
	extractSectionLabelBS,
} from "./RowsBalanceSheet.js";

/**
 * Iterate balance sheet table rows, track section headers, handle breakdowns,
 * and parse with `parseDataRow`.
 *
 * @param {Cheerio} table
 * @param {CheerioStatic} $
 * @param {(tr, expectedCols, unitsMeta, $) => ParsedRow|null} parseDataRow
 * @param {number} valueCols
 * @param {{moneyScale:number, shareScale:number}} unitsMeta
 * @returns {{ rows: Array<{metric:string,taxonomy:string|null,values:any[],unitClass:string}>, detectedValueCols:number }}
 */
export function collectTableRowsBalance(table, $, parseDataRow, valueCols, unitsMeta) {
	let inBreakdown = false;
	let detectedValueCols = valueCols ?? 0;
	let sectionLabel = null; // Track current BS section header
	const collected = [];

	for (const tr of table.find("tr").toArray()) {
		// Header rows: update breakdown state AND refresh section label if recognized.
		if (isSectionHeaderRow(tr, $)) {
			inBreakdown = updateBreakdownStateFromHeaderBS(tr, $, inBreakdown);
			const maybe = extractSectionLabelBS(tr, $);
			if (maybe) sectionLabel = maybe; // Persist until a new header yields a label
			continue;
		}

		// If inside breakdown, decide whether to skip or exit
		const { skipRow, newState } = handleBreakdownRowBS(tr, $, inBreakdown);
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

		// Append the active section header to disambiguate duplicate labels
		const metricWithSection = sectionLabel ? `${parsed.metric} — ${sectionLabel}` : parsed.metric;

		collected.push({
			metric: metricWithSection,
			taxonomy,
			values: parsed.values,
			unitClass: parsed.unitClass,
		});

		if (!detectedValueCols) detectedValueCols = parsed.values.length;
	}

	return { rows: collected, detectedValueCols };
}
