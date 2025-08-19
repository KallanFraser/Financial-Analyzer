/** @format */
/*------------------------------------------------------------------------------
                                    Imports
------------------------------------------------------------------------------*/
import "server-only"; // Ensures this module only runs on the server (Next.js)
import { cleanText, normalizeCell, parseUnitsFromHeaders, classifyUnitFromLabel } from "../helpers.js";
/*------------------------------------------------------------------------------
                            Helpers (simple, reusable)
------------------------------------------------------------------------------*/
export function parseHeader(table, layout, $) {
	// 1) Find all rows that have the <th> tag
	const headerRows = table.find("tr:has(th)").slice(0, 3).toArray();

	// 2) Then extract all the text from those header rows
	const headerTexts = headerRows.map((row) => $(row).text());

	// 3) Parse the units from the headers
	const { moneyScale, shareScale } = parseUnitsFromHeaders(headerTexts);

	// 4) Collect header th texts for dates
	const thTexts = headerRows.flatMap((row) =>
		$(row)
			.find("th")
			.toArray()
			.map((th) => cleanText($(th).text()))
	);

	// 5) Keep strings that look like they contain a year, trim string, remove irrelevant words
	let dates = thTexts
		.filter((t) => /\b(19|20)\d{2}\b/.test(t))
		.map((t) => t.replace(/[.,]/g, "").trim())
		.filter((t) => !/statement|consolidated|unaudited|notes?/i.test(t));

	// Edge case where the first date cell is mislabelled.
	if (dates.length >= 2 && /statement|consolidated|assets|liabilities|equity|position/i.test(dates[0])) {
		dates = dates.slice(1);
	}

	return { dates, moneyScale, shareScale };
}

// $ = cheerio instance
// expectedValueCols = how many numeric columns we expect
export function parseDataRow(row, expectedValueCols, scales, $) {
	// 1) Wrap the row in cheerio so we can query it easily
	const $row = $(row);

	// 2) Find all the <tr> and <td>, extract, and clean them
	const cells = $row
		.find("th,td")
		.toArray()
		.map((el) => cleanText($(el).text()));
	if (!cells.length) return null;

	// 3) Find the first non empty cell index, for which is the label column
	const labelIdx = cells.findIndex((c) => c !== "");
	if (labelIdx === -1) return null;

	// 4) Extract the label
	const label = cells[labelIdx];
	//console.log(label);

	// 5) Determine how the values should be interpreted (percent, shares, pershare, or money)
	const unitClass = classifyUnitFromLabel(label);

	// 6) Get all the cells after the label - which are the numeric columns (raw values)
	const rawValues = cells.slice(labelIdx + 1);

	// 7) Clean the values
	const normalized = rawValues.map((v) => normalizeCell(v));

	// 8) Iterate over the normalized number and scale them appropriately
	const values = normalized.map((n) => {
		if (typeof n !== "number" || Number.isNaN(n)) return null;
		if (unitClass === "percent") return n; // do not scale percent
		if (unitClass === "shares") return n * (scales.shareScale ?? 1);
		if (unitClass === "perShare") return n; // ← per-share amounts are unscaled
		return n * (scales.moneyScale ?? 1); // default: money totals
	});

	// 9) Conform to expected number of columns, by adding padding or truncating
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
