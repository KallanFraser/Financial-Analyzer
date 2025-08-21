/** @format */
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
                            Balance Sheet Parser (Annual)
------------------------------------------------------------------------------*/
export function parseBalanceSheetStatement(htmlSection) {
	// 1) Extract and load HTML
	const clean = extractHtml(htmlSection);
	const $ = cheerio.load(clean);

	// 2) Find the first table
	const table = $("table").first();
	if (!table.length || !table.find("tr").length) {
		return { dates: [], rows: [], unitsMeta: { ...DEFAULT_UNITS_META } };
		// Nothing to parse
	}

	// 3) Header: grab dates and unit scales (pass "balance" so parseHeader can apply BS heuristics)
	const { dates, moneyScale, shareScale } = parseHeader(table, "balance", $);

	// Optional sanity: if no valid dates, bail with defaults
	if (!Array.isArray(dates) || dates.length === 0) {
		return { dates: [], rows: [], unitsMeta: { moneyScale, shareScale } };
	}

	// 4) Row collection with BS-specific breakdown handling
	const expectedCols = dates.length;
	const unitsMeta = { moneyScale, shareScale };

	const { rows: collected } = collectTableRowsBalance(
		table,
		$,
		parseDataRow, // same row parser; scales come from unitsMeta
		expectedCols,
		unitsMeta
	);

	// 5) Soft de-dup (to collapse minor header/label variations)
	const rows = softDedupRows(collected);

	// Debug (keep your existing style)
	//console.log("dates: ", dates);
	//console.log("rows: ", rows);
	//console.log("moneyScale: ", moneyScale);
	//console.log("shareScale: ", shareScale);

	// 6) Done
	return { dates, rows, unitsMeta };
}
