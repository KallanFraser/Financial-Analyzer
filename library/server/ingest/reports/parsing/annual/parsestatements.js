/** @format */
/*------------------------------------------------------------------------------
                                    Imports
------------------------------------------------------------------------------*/
import "server-only"; // Ensures this module only runs on the server (Next.js)
import * as cheerio from "cheerio";
import { extractHtml, cleanText, extractTaxonomy } from "../helpers.js";
import { parseHeader, parseDataRow } from "./subparsers.js";
/*------------------------------------------------------------------------------
                                    Main Parser
------------------------------------------------------------------------------*/
export function parseAnnualIncomeStatement(htmlSection) {
	// 1) extract the <table> portion of the html
	const clean = extractHtml(htmlSection);

	// 2) load into cheerio so we can query it easierly
	const $ = cheerio.load(clean);

	// 3) find the first instance of the table (there is only one)
	const table = $("table").first();
	if (!table.length || !table.find("tr").length) {
		return { dates: [], rows: [], unitsMeta: { moneyScale: 1, shareScale: 1 } };
	}

	// 4) Parse the header
	const { dates, moneyScale, shareScale } = parseHeader(table, "income", $);

	// 5) Expected number of numeric columns with data entries
	let valueCols = dates.length;

	// 6) Regex for sub headers that contain no values for which we can skip
	const breakdownHeaderRe =
		/\b(products?|services?|segments?|segment|geographic|by\s+segment|by\s+category|revenue\s+by|sales\s+by)\b/i;

	// 7) Regex for core lines that should be captured.
	const coreLineRe =
		/\b(net\s+sales|total\s+revenue|revenue\s+from|net\s+income(?:\s*\(loss\))?|earnings\s+per\s+share|basic|diluted)\b/i;

	// 8) Helper that decides whether a <tr> is a header row rather than containing actual data.
	const isSectionHeaderRow = (tableRowElement) => {
		// GAAP-tagged rows are data, not headers therefore return false
		if (extractTaxonomy(tableRowElement, $)) return false;

		// Grab all text and clean it
		const texts = $(tableRowElement)
			.find("th,td")
			.toArray()
			.map((element) => cleanText($(element).text()));

		// If empty row, then not a header row
		if (texts.every((t) => t === "")) return false;

		// Check if any cell has a number in it just in case
		const hasNumber = texts.some((t) => /^[+-]?\d*\.?\d+(e[+-]?\d+)?%?$/.test(t.replace(/[$,()]/g, "")));

		// header = texty and NO numeric tokens at all
		return !hasNumber;
	};

	// Variable to let us know if we are in a non core section of the statement
	// i.e rows that are used to refer to net sales of some products
	let inBreakdown = false;

	// Set to track taxonomies already seen to avoid duplicates / non core row entries
	const seenTaxonomies = new Set();

	// Accumulator for parsed rows before final de dupe
	const collected = [];

	// 9) For each table row of the table...
	for (const tr of table.find("tr").toArray()) {
		// If the row looks like a header...
		if (isSectionHeaderRow(tr)) {
			// Pull the header text
			const headerText = cleanText($(tr).text());

			// If it is a breakdown header, enter breakdown mode and skip the header row
			if (breakdownHeaderRe.test(headerText)) {
				inBreakdown = true; // enter breakdown
				continue;
			}
			inBreakdown = false; // any other header ends a breakdown
			continue; // headers carry no data
		}

		// If inside breakdown, we will skip most rows until a signal to exit
		if (inBreakdown) {
			const labelText = cleanText($(tr).find("th,td").first().text());
			const maybeTax = extractTaxonomy(tr, $);

			// Allow through if it’s GAAP-tagged OR looks like a core total/EPS line
			if (!maybeTax && !coreLineRe.test(labelText)) {
				continue; // still inside breakdown; skip
			}
			// Either GAAP-tagged or core line => end breakdown and process this row
			inBreakdown = false;
		}

		// Parse the row into {metric, values, unitClass}
		const parsed = parseDataRow(tr, valueCols, { moneyScale, shareScale }, $);
		if (!parsed) continue;

		// Only keep the row if it has at least one numeric value
		const hasNum = parsed.values.some((v) => typeof v === "number" && Number.isFinite(v));
		if (!hasNum) continue;

		// Extract taxonomy and de-dupe by first occurrence
		const taxonomy = extractTaxonomy(tr, $);
		if (taxonomy && seenTaxonomies.has(taxonomy)) continue;
		if (taxonomy) seenTaxonomies.add(taxonomy);

		collected.push({
			metric: parsed.metric,
			taxonomy,
			values: parsed.values,
			unitClass: parsed.unitClass,
		});

		// Lock width if dates were absent
		if (!valueCols) valueCols = parsed.values.length;
	}

	// Soft de-dupe for rows without taxonomy: keep one per (metric,width), prefer larger |sum|
	const rows = (() => {
		const key = (r) => `${r.metric}::${r.values.length}`;
		const picked = new Map();
		const order = [];

		for (const r of collected) {
			if (r.taxonomy) {
				const sym = Symbol();
				picked.set(sym, { row: r, score: Infinity });
				order.push(sym);
				continue;
			}
			const k = key(r);
			const score = r.values.reduce((acc, v) => acc + (typeof v === "number" ? Math.abs(v) : 0), 0);
			const prev = picked.get(k);
			if (!prev) {
				picked.set(k, { row: r, score });
				order.push(k);
			} else if (score > prev.score) {
				picked.set(k, { row: r, score });
			}
		}

		const out = [];
		for (const k of order) {
			const entry = picked.get(k);
			if (entry?.row) out.push(entry.row);
		}
		return out;
	})();

	console.log("dates: ", dates);
	console.log("rows: ", rows);
	console.log("moneyScale: ", moneyScale);
	console.log("shareScale: ", shareScale);

	return { dates, rows, unitsMeta: { moneyScale, shareScale } };
}
