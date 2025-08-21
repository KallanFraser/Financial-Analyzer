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
                                    Main Parser
------------------------------------------------------------------------------*/
export function parseAnnualIncomeStatement(htmlSection) {
	// 1) Extract and load HTML
	const clean = extractHtml(htmlSection);
	const $ = cheerio.load(clean);

	// 2) Find the table
	const table = $("table").first();
	if (!table.length || !table.find("tr").length) {
		return { dates: [], rows: [], unitsMeta: { ...DEFAULT_UNITS_META } };
	}

	// 3) Header: dates + unit scales
	const { dates, moneyScale, shareScale } = parseHeader(table, "income", $);

	// 4) Mixed interim-annual? bail early (your existing rule)
	if (Array.isArray(dates) && dates.length > 3) {
		console.log("[SKIP] Detected interim-period income statement (dates > 3). Dates:", dates);
		return { dates: [], rows: [], unitsMeta: { moneyScale, shareScale } };
	}

	// 5) Row collection (parsing + breakdown handling)
	const expectedCols = dates.length;
	const unitsMeta = { moneyScale, shareScale };
	const { rows: collected } = collectTableRows(table, $, parseDataRow, expectedCols, unitsMeta);

	// 6) Soft de-dupe
	const rows = softDedupRows(collected);

	// Debug
	console.log("dates: ", dates);
	console.log("rows: ", rows);
	console.log("moneyScale: ", moneyScale);
	console.log("shareScale: ", shareScale);

	// 7) Done
	return { dates, rows, unitsMeta };
}
