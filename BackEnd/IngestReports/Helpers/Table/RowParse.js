/** @format */
import { cleanText } from "../Core/Text.js";
import { toNumberCell } from "../Core/Numbers.js";
import { inferUnitClass } from "../Core/Units.js";

// Parse one <tr> into { metric, values[], rawValues[], unitClass }
export function parseDataRow(row, expectedValueCols, scales, $) {
	const $row = $(row);
	const cells = $row.find("th,td").toArray();
	if (!cells.length) return null;

	// Label is the first cell
	const labelIdx = 0;
	const label = cleanText($(cells[labelIdx]).text());
	if (!label) return null;

	// Decide unit class
	let unitClass = inferUnitClass(label);

	// Cash Flow edge case: rows containing "shares" are still MONEY on CF
	if (scales && scales.cashOnly && unitClass === "shares") {
		//console.log("[ROW] cashOnly override: treating 'shares' as 'money' for label:", label);
		unitClass = "money";
	}

	// Numeric cells after the label → normalize text → number/null
	const rawCells = cells.slice(labelIdx + 1);
	const normalized = rawCells.map((el) => toNumberCell(cleanText($(el).text())));

	// Respect expected column count if provided
	const valuesSlice =
		typeof expectedValueCols === "number" && expectedValueCols > 0
			? normalized.slice(0, expectedValueCols)
			: normalized;

	// Scale
	const values = valuesSlice.map((n) => {
		if (typeof n !== "number" || Number.isNaN(n)) return null;
		if (unitClass === "percent") return n;
		if (unitClass === "perShare") return n;
		if (unitClass === "shares") return n * (scales?.shareScale ?? 1);
		return n * (scales?.moneyScale ?? 1);
	});

	// Keep rows that have at least one numeric value
	if (!values.some((v) => Number.isFinite(v))) return null;

	return { metric: label, values, unitClass };
}
