/** @format */
import { cleanText } from "../Core/Text.js";
import { detectUnitScales } from "../Core/Units.js";

// Parse header rows for dates + unit scales.
export function parseHeader(table, layout, $) {
	// 1) First few header rows
	const headerRows = table.find("tr:has(th)").slice(0, 3).toArray();

	// 2) Raw header text
	const headerTexts = headerRows.map((row) => $(row).text());

	// 3) Unit scales
	const { moneyScale, shareScale } = detectUnitScales(headerTexts);

	// 4) Collect <th> texts
	const thTexts = headerRows.flatMap((row) =>
		$(row)
			.find("th")
			.toArray()
			.map((th) => cleanText($(th).text()))
	);

	// 5) Keep strings that look like year labels and remove irrelevant words
	let dates = thTexts
		.filter((t) => /\b(19|20)\d{2}\b/.test(t))
		.map((t) => t.replace(/[.,]/g, "").trim())
		.filter((t) => !/statement|consolidated|unaudited|notes?/i.test(t));

	// Edge case: mislabelled first date cell
	if (dates.length >= 2 && /statement|consolidated|assets|liabilities|equity|position/i.test(dates[0])) {
		dates = dates.slice(1);
	}

	return { dates, moneyScale, shareScale };
}
