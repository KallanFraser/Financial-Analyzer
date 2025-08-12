/** @format */
/*-------------------------------------------------------------------------------
                                Imports & Globals
--------------------------------------------------------------------------------*/
import "server-only";
import { getSupabase } from "./client.js";

const MAX_CHUNK = 1000; // safety for very large arrays

/*-------------------------------------------------------------------------------
                        Upsert Company Facts → stock_prices
--------------------------------------------------------------------------------*/
// INPUT rows shape (from parseCompanyFacts):
// [
//   { cik: "0000320193", sharesOutstanding: [ { end: "2024-07-19", val: 15204137000, accn: "0000320193-24-000081" }, ... ] },
//   ...
// ]
export async function upsertCompanyFacts(rows) {
	// 0) sanity
	if (!rows?.length) return 0;

	// 1) flatten shares into stock_prices payload
	const stockRows = [];
	for (const r of rows) {
		const cik = String(r?.cik ?? "0000000000");
		const arr = Array.isArray(r?.sharesOutstanding) ? r.sharesOutstanding : [];
		for (const s of arr) {
			const recorded_at = toDateOnly(s?.end); // 'YYYY-MM-DD' or null
			if (!recorded_at) continue; // require a date for PK
			stockRows.push({
				cik,
				value: String(s?.val ?? "0"),
				recorded_at, // DATE column in Postgres
				from_report: String(s?.accn ?? ""), // accn we’ll FK to company_forms(accession_number)
			});
		}
	}
	if (!stockRows.length) return 0;

	// 2) FK backstops: ensure parents exist (company_data, company_forms)
	await ensureParentsForStockPrices(stockRows);

	// 3) upsert into stock_prices on (cik, recorded_at)
	await upsertChunks("stock_prices", stockRows, "cik,recorded_at");

	return stockRows.length;
}

/*-------------------------------------------------------------------------------
                               FK Backstop Helpers
--------------------------------------------------------------------------------*/
async function ensureParentsForStockPrices(stockRows) {
	const supabase = getSupabase();

	// a) ensure company_data(cik) exists
	const ciks = Array.from(new Set(stockRows.map((r) => r.cik)));
	const companyParents = ciks.map((cik) => ({
		cik,
		entity_type: "",
		sic: "",
		company_name: "",
		fiscal_year_end: "",
	}));
	if (companyParents.length) {
		await upsertChunks("company_data", companyParents, "cik");
	}

	// b) ensure company_forms (cik, accession_number) exists when we have an accn
	const formParents = [];
	const seen = new Set();
	for (const r of stockRows) {
		const accn = r.from_report?.trim();
		if (!accn) continue;
		const key = `${r.cik}::${accn}`;
		if (seen.has(key)) continue;
		seen.add(key);
		formParents.push({
			cik: r.cik,
			accession_number: accn,
			filing_date: "", // minimal placeholder (schema allows '')
			form_type: "", // minimal placeholder (schema allows '')
		});
	}
	if (formParents.length) {
		await upsertChunks("company_forms", formParents, "cik,accession_number");
	}
}

/*-------------------------------------------------------------------------------
                                Main Upsert (generic)
--------------------------------------------------------------------------------*/
// table = destination table
// rows = array of plain objects already shaped for the table
// onConflict = PK/UNIQUE cols used for INSERT ... ON CONFLICT ... DO UPDATE
async function upsertChunks(table, rows, onConflict) {
	if (!rows.length) return;

	const supabase = getSupabase();

	// --------------- PROGRESS BAR (visual aid) ---------------
	const isTTY =
		!!process.stdout &&
		!!process.stdout.isTTY &&
		typeof process.stdout.clearLine === "function" &&
		typeof process.stdout.cursorTo === "function";

	const BAR = 24;
	function drawProgress(label, done, total) {
		const pct = total ? Math.min(100, Math.floor((done * 100) / total)) : 100;
		if (isTTY) {
			const filled = Math.floor((pct / 100) * BAR);
			const bar = "█".repeat(filled) + "░".repeat(BAR - filled);
			process.stdout.clearLine(0);
			process.stdout.cursorTo(0);
			process.stdout.write(`${label} [${bar}] ${done}/${total} ${pct}%`);
			if (done >= total) process.stdout.write("\n");
		} else {
			console.log(`${label} ${done}/${total} (${pct}%)`);
		}
	}
	// ---------------------------------------------------------

	const total = rows.length;
	let done = 0;

	for (let i = 0; i < rows.length; i += MAX_CHUNK) {
		const chunk = rows.slice(i, i + MAX_CHUNK);
		const { error } = await supabase.from(table).upsert(chunk, {
			onConflict,
			ignoreDuplicates: false,
			returning: "minimal",
		});
		if (error) throw new Error(`Upsert failed for ${table}: ${error.message}`);

		done += chunk.length;
		drawProgress(`[${table}]`, done, total);
	}

	if (!isTTY) console.log(`✓ [${table}] upsert complete (${total} rows)`);
}

/*-------------------------------------------------------------------------------
                                   Small Utils
--------------------------------------------------------------------------------*/
function toDateOnly(s) {
	// Accept ISO-like strings; return first 10 chars (YYYY-MM-DD) if valid.
	const t = Date.parse(s || "");
	if (!Number.isFinite(t)) return null;
	const d = new Date(t);
	// get YYYY-MM-DD in UTC to match typical EDGAR ‘end’ date format
	const yyyy = d.getUTCFullYear();
	const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
	const dd = String(d.getUTCDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}`;
}
