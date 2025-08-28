/** @format */
/*------------------------------------------------------------------------------
                                    Imports
------------------------------------------------------------------------------*/
import * as cheerio from "cheerio";
import {
	extractHtml,
	parseHeader,
	parseDataRow,
	softDedupRows,
	collectTableRowsBalance,
} from "../../Helpers/Index.js";

/*------------------------------------------------------------------------------
                                    Globals
------------------------------------------------------------------------------*/
const DEFAULT_UNITS_META = { moneyScale: 1, shareScale: 1 };

/*------------------------------------------------------------------------------
                         Balance Sheet Parser (Quarterly)
  Notes:
   - Balance sheets in 10-Q are typically point-in-time + prior year end.
   - Logic is identical to annual; we just tag isQuarterly.
------------------------------------------------------------------------------*/
export function parseQuarterlyBalanceSheetStatement(htmlSection) {
	// 1) Extract and load HTML
	const clean = extractHtml(htmlSection);
	const $ = cheerio.load(clean);

	// 2) First table
	const table = $("table").first();
	if (!table.length || !table.find("tr").length) {
		return { dates: [], rows: [], unitsMeta: { ...DEFAULT_UNITS_META, isQuarterly: true } };
	}

	// 3) Header
	const { dates, moneyScale, shareScale } = parseHeader(table, "balance", $);

	if (!Array.isArray(dates) || dates.length === 0) {
		return { dates: [], rows: [], unitsMeta: { moneyScale, shareScale, isQuarterly: true } };
	}

	// 4) Collect rows with BS breakdown handling (current/non-current, etc.)
	const expectedCols = dates.length;
	const unitsMeta = { moneyScale, shareScale, isQuarterly: true };

	const { rows: collected } = collectTableRowsBalance(table, $, parseDataRow, expectedCols, unitsMeta);

	// 5) De-dup
	const rows = softDedupRows(collected);

	// Debug
	// console.log("[Q-BS] dates:", dates);
	// console.log("[Q-BS] units:", unitsMeta);
	// console.log("[Q-BS] rows:", rows?.length);

	// 6) Done
	return { dates, rows, unitsMeta };
}
