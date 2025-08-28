/** @format */
/*------------------------------------------------------------------------------
                                    Imports
------------------------------------------------------------------------------*/
import { cleanText } from "../Core/Text.js";
import { detectUnitScales } from "../Core/Units.js";

/*------------------------------------------------------------------------------
                                    Functions
------------------------------------------------------------------------------*/
// Parse header rows for dates + unit scales.
// Table = the raw html of the statement table
// Layout = income, balance, or cash
export function parseHeader(table, layout, $) {
	// A) Caption often contains "(in millions)"
	const captionText = cleanText(table.find("caption").first().text());

	// B) First few rows regardless of th — units often live here
	const anyHeaderRows = table.find("tr").slice(0, 5).toArray();

	// C) Rows that have th — usually where date labels live
	const thHeaderRows = table.find("tr:has(th)").slice(0, 3).toArray();

	// Unit-detection text = caption + first few 'th' rows + first few any rows
	const headerTexts = [
		captionText,
		...thHeaderRows.map((row) => $(row).text()),
		...anyHeaderRows.map((row) => $(row).text()),
	].filter(Boolean);

	// Detect scales (cashflow ignores shares)
	const { moneyScale, shareScale } = detectUnitScales(headerTexts, { layout });

	// Extract year labels from 'th' cells
	const thTexts = thHeaderRows.flatMap((row) =>
		$(row)
			.find("th")
			.toArray()
			.map((th) => cleanText($(th).text()))
	);

	let dates = thTexts
		.filter((t) => /\b(19|20)\d{2}\b/.test(t))
		.map((t) => t.replace(/[.,]/g, "").trim())
		.filter((t) => !/statement|consolidated|unaudited|notes?/i.test(t));

	// Edge case: first 'date' cell is actually a title
	if (dates.length >= 2 && /statement|consolidated|assets|liabilities|equity|position/i.test(dates[0])) {
		dates = dates.slice(1);
	}

	return { dates, moneyScale, shareScale };
}
