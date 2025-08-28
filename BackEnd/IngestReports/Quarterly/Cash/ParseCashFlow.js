/** @format */
/*------------------------------------------------------------------------------
                                    Imports
------------------------------------------------------------------------------*/
import * as cheerio from "cheerio";
import { extractHtml, parseHeader, parseDataRow, softDedupRows } from "../../Helpers/Index.js";
import { collectTableRowsCashFlow } from "../../Helpers/Table/CollectCashFlow.js";

/*------------------------------------------------------------------------------
                                    Globals
------------------------------------------------------------------------------*/
const DEFAULT_UNITS_META = { moneyScale: 1, shareScale: 1 };

/*------------------------------------------------------------------------------
                          Cash Flow Parser (Quarterly)
  Notes vs annual:
   - No "dates.length > 3" bail; keep 3M & 9M together if present.
------------------------------------------------------------------------------*/
export function parseQuarterlyCashFlowStatement(htmlSection) {
	// 1) Extract and load HTML
	const clean = extractHtml(htmlSection);
	const $ = cheerio.load(clean);

	// 2) First table
	const table = $("table").first();
	if (!table.length || !table.find("tr").length) {
		return { dates: [], rows: [], unitsMeta: { ...DEFAULT_UNITS_META, isQuarterly: true } };
	}

	// 3) Header
	const { dates, moneyScale, shareScale } = parseHeader(table, "cashflow", $);

	if (!Array.isArray(dates) || dates.length === 0) {
		return { dates: [], rows: [], unitsMeta: { moneyScale, shareScale, isQuarterly: true } };
	}

	// 4) Collect rows with CF-specific handling
	const expectedCols = dates.length;
	const unitsMeta = { moneyScale, shareScale, cashOnly: true, isQuarterly: true };

	const { rows: collected } = collectTableRowsCashFlow(table, $, parseDataRow, expectedCols, unitsMeta);

	// 5) De-dup
	const rows = softDedupRows(collected);

	// Debug
	// console.log("[Q-CF] dates:", dates);
	// console.log("[Q-CF] units:", unitsMeta);
	// console.log("[Q-CF] rows:", rows?.length);

	// 6) Done
	return { dates, rows, unitsMeta };
}
