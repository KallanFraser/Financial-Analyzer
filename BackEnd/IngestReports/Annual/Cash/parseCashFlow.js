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
                              Cash Flow Parser (Annual)
------------------------------------------------------------------------------*/
export function parseCashFlowStatement(htmlSection) {
	// 1) Extract and load HTML
	const clean = extractHtml(htmlSection);
	const $ = cheerio.load(clean);

	// 2) Find the first table
	const table = $("table").first();
	if (!table.length || !table.find("tr").length) {
		return { dates: [], rows: [], unitsMeta: { ...DEFAULT_UNITS_META } };
		// Nothing to parse
	}

	// 3) Header: grab dates and unit scales (pass "cashflow" for CF heuristics, if any)
	const { dates, moneyScale, shareScale } = parseHeader(table, "cashflow", $);

	//console.log("[CF] dates from header:", dates);
	//console.log("[CF] scales from header:", { moneyScale, shareScale });

	// Optional sanity: if no valid dates, bail with defaults
	if (!Array.isArray(dates) || dates.length === 0) {
		return { dates: [], rows: [], unitsMeta: { moneyScale, shareScale } };
	}

	// (Optional) Treat >3 columns as interim CF and bail (mirrors your IS logic)
	if (dates.length > 3) {
		//console.log("[SKIP] Detected interim-period cash flow (dates > 3). Dates:", dates);
		return { dates: [], rows: [], unitsMeta: { moneyScale, shareScale } };
	}

	// 4) Row collection with CF-specific breakdown handling + section-label disambiguation
	const expectedCols = dates.length;
	const unitsMeta = { moneyScale, shareScale, cashOnly: true };

	//console.log("[CF] unitsMeta used:", unitsMeta);

	const { rows: collected } = collectTableRowsCashFlow(
		table,
		$,
		parseDataRow, // same row parser; scales come from unitsMeta
		expectedCols,
		unitsMeta
	);

	// 5) Soft de-dup (collapse near-duplicate untagged rows)
	const rows = softDedupRows(collected);

	// Debug (keep your existing style)
	console.log("dates: ", dates);
	console.log("rows: ", rows);
	console.log("moneyScale: ", moneyScale);
	console.log("shareScale: ", shareScale);

	// 6) Done
	return { dates, rows, unitsMeta };
}
