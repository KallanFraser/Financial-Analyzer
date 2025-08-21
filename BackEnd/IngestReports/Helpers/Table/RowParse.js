/** @format */
import { cleanText } from "../Core/Text.js";
import { toNumberCell } from "../Core/Numbers.js";
import { inferUnitClass } from "../Core/Units.js";

// Parse one <tr> into { metric, values[], rawValues[], unitClass }
export function parseDataRow(row, expectedValueCols, scales, $) {
	const $row = $(row);

	// Cells → cleaned text
	const cells = $row
		.find("th,td")
		.toArray()
		.map((el) => cleanText($(el).text()));
	if (!cells.length) return null;

	// First non-empty = label column
	const labelIdx = cells.findIndex((c) => c !== "");
	if (labelIdx === -1) return null;

	const label = cells[labelIdx];

	// How to interpret values (percent, shares, perShare, money)
	const unitClass = inferUnitClass(label);

	// Numeric cells after label
	const rawValues = cells.slice(labelIdx + 1);

	// Normalize to numbers
	const normalized = rawValues.map((v) => toNumberCell(v));

	// Apply scaling rules
	const values = normalized.map((n) => {
		if (typeof n !== "number" || Number.isNaN(n)) return null;
		if (unitClass === "percent") return n; // unscaled
		if (unitClass === "shares") return n * (scales.shareScale ?? 1); // share scale
		if (unitClass === "perShare") return n; // unscaled
		return n * (scales.moneyScale ?? 1); // money scale
	});

	// Conform to expected column count
	let out = values;
	if (expectedValueCols && expectedValueCols > 0) {
		out = values.slice(0, expectedValueCols);
		while (out.length < expectedValueCols) out.push(null);
	}

	return {
		metric: label,
		values: out,
		rawValues: rawValues.slice(0, expectedValueCols || rawValues.length),
		unitClass,
	};
}
