/** @format */
/*------------------------------------------------------------------------------
                                    Imports
------------------------------------------------------------------------------*/
import * as cheerio from "cheerio";
import {
	extractHtml,
	parseHeader,
	parseDataRow,
	collectTableRows,
	softDedupRows,
} from "../../Helpers/Index.js";

/*------------------------------------------------------------------------------
                                    Globals
------------------------------------------------------------------------------*/
const DEFAULT_UNITS_META = { moneyScale: 1, shareScale: 1 };

/*------------------------------------------------------------------------------
                           Income/Operations Parser (Quarterly)
  Notes vs annual:
   - Do NOT bail on dates.length > 3; quarterlies often have 3M & 9M columns.
   - Keep all columns returned by parseHeader; downstream can decide what to use.
------------------------------------------------------------------------------*/
export function parseQuarterlyIncomeStatement(htmlSection) {
	// 1) Extract and load HTML
	const clean = extractHtml(htmlSection);
	const $ = cheerio.load(clean);

	// 2) Find the table
	const table = $("table").first();
	if (!table.length || !table.find("tr").length) {
		return { dates: [], rows: [], unitsMeta: { ...DEFAULT_UNITS_META, isQuarterly: true } };
	}

	// 3) Header: dates + unit scales
	const { dates, moneyScale, shareScale } = parseHeader(table, "income", $);

	// 4) Row collection
	const expectedCols = Array.isArray(dates) ? dates.length : 0;
	const unitsMeta = { moneyScale, shareScale, isQuarterly: true };

	const { rows: collected } = collectTableRows(table, $, parseDataRow, expectedCols, unitsMeta);

	// 5) Soft de-dupe
	const rows = softDedupRows(collected);

	// Debug
	console.log("dates: ", dates);
	console.log("rows: ", rows);
	console.log("moneyScale: ", moneyScale);
	console.log("shareScale: ", shareScale);

	// 6) Done
	return { dates, rows, unitsMeta };
}
