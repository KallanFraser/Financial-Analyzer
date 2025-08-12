/** @format */
/*-------------------------------------------------------------------------------
                                Imports & Globals
--------------------------------------------------------------------------------*/
import "server-only";
import { getSupabase } from "./client.js";

const MAX_CHUNK = 1000; // safety for very large arrays

/*-------------------------------------------------------------------------------
                        Upsert Function For Company Data
--------------------------------------------------------------------------------*/
// Batch insert function for public.company_data
// PK = cik
// Columns used = cik, entity_type, sic, company_name, fiscal_year_end
// Also upserts to public.tickers using (cik, ticker) composite key
export async function upsertCompaniesBatch(rows) {
	// 0) Sanity check for input
	if (!rows?.length) return 0;

	// 1) Build payload and provide safe default values
	const companiesPayload = rows.map((r) => ({
		cik: r.cik ?? "0000000000",
		entity_type: r.entityType ?? "",
		sic: r.sic ?? "",
		company_name: r.name ?? "",
		fiscal_year_end: r.fiscalYearEnd ?? "",
		// NOTE: We intentionally do not write r.tickers to company_data (tickers live in public.tickers)
	}));

	// 2) Upsert companies
	await upsertChunks("company_data", companiesPayload, "cik");

	// 3) Clean up tickers and upsert as chunks
	const tickerRows = buildTickerPairs(rows);
	if (tickerRows.length) {
		// Requires a UNIQUE or PK on (cik, ticker)
		await upsertChunks("tickers", tickerRows, "cik,ticker");
	}

	return companiesPayload.length;
}

/*-------------------------------------------------------------------------------
                        Upsert Function For Company Filings
--------------------------------------------------------------------------------*/
// Batch insert function for public.company_forms
// PK = (cik, accession_number)
// Columns used = cik, accession_number, filing_date, form_type
// ------------------- IMPORTANT NOTE ----------------------
// If a filings batch hits an FK race (company_data row not present yet),
// we upsert minimal parent rows into company_data and retry once.
// That can produce another [company_forms] progress line for the same batch.
export async function upsertFilingsBatch(rows) {
	// 0) Sanity check for input
	if (!rows?.length) return 0;

	// 1) Build the payload for upsert && give safe default values
	//    Skip rows missing accessionNumber to avoid '' PK collisions.
	const payload = rows
		.filter((r) => r.accessionNumber && String(r.accessionNumber).trim() !== "")
		.map((r) => ({
			cik: r.cik ?? "0000000000",
			accession_number: r.accessionNumber ?? "",
			filing_date: r.filingDate ?? "",
			form_type: r.form ?? "",
		}));

	if (!payload.length) return 0;

	// 2) Upsert company_forms with FK backstop + single retry
	try {
		await upsertChunks("company_forms", payload, "cik,accession_number");
	} catch (err) {
		const msg = String(err?.message || err);
		if (msg.includes('foreign key constraint "company_forms_cik_fkey"')) {
			// Backstop: ensure parent rows exist, then retry once.
			const parentRows = Array.from(new Set(payload.map((p) => p.cik))).map((cik) => ({
				cik,
				entity_type: "",
				sic: "",
				company_name: "",
				fiscal_year_end: "",
			}));
			await upsertChunks("company_data", parentRows, "cik");
			await upsertChunks("company_forms", payload, "cik,accession_number");
		} else {
			throw err;
		}
	}

	// 3) Categorize into reports_* tables (uses company_forms as parent)
	const annualRows = [];
	const quarterlyRows = [];
	const currentRows = [];

	for (const p of payload) {
		const cat = classifyForm(p.form_type);
		if (cat === "annual") {
			annualRows.push({ cik: p.cik, accession_number: p.accession_number, filing_summary: null });
		} else if (cat === "quarterly") {
			quarterlyRows.push({ cik: p.cik, accession_number: p.accession_number, filing_summary: null });
		} else if (cat === "current") {
			currentRows.push({ cik: p.cik, accession_number: p.accession_number, filing_summary: null });
		}
	}

	if (annualRows.length) await upsertChunks("reports_annual", annualRows, "cik,accession_number");
	if (quarterlyRows.length) await upsertChunks("reports_quarterly", quarterlyRows, "cik,accession_number");
	if (currentRows.length) await upsertChunks("reports_current", currentRows, "cik,accession_number");

	return payload.length;
}

/*-------------------------------------------------------------------------------
                                Main Upsert Function
--------------------------------------------------------------------------------*/
// table = what table we are referring to in the DB.
// rows = an array of plain objects already shaped for the tables columns.
// onConflict = list that matches a unique index or PK in DB. For INSERT ... ON CONFLICT ... DO UPDATE
async function upsertChunks(table, rows, onConflict) {
	// 0) bail early if nothing to write
	if (!rows.length) return;

	// 1) get a server-only supabase client
	const supabase = getSupabase();

	/*--------------------------------- PROGRESS BAR START ---------------------------------
	  Visual aid so you can see long-running upserts moving forward.
	  - Renders a single-line bar in TTY terminals (local dev).
	  - Falls back to simple log lines in non-TTY envs (serverless logs).
	---------------------------------------------------------------------------------------*/
	//checks if we can draw a progress bar in server terminal
	const isTTY =
		!!process.stdout &&
		!!process.stdout.isTTY &&
		typeof process.stdout.clearLine === "function" &&
		typeof process.stdout.cursorTo === "function";

	const BAR = 24; //visual width of the progress bar in character widths. Can be tweaked.

	function drawProgress(label, done, total) {
		//calculate current completion as a percentage
		const pct = total ? Math.min(100, Math.floor((done * 100) / total)) : 100;

		// if we can draw a progress bar...
		if (isTTY) {
			//what percent of 100 can be filled
			const filled = Math.floor((pct / 100) * BAR);
			//put the rest as unfilled
			const bar = "█".repeat(filled) + "░".repeat(BAR - filled);
			process.stdout.clearLine(0); //erase current line
			process.stdout.cursorTo(0); //move cursor to column 0
			process.stdout.write(`${label} [${bar}] ${done}/${total} ${pct}%`); //write the progress bar
			if (done >= total) process.stdout.write("\n"); // newline on completion
		} else {
			// if we cannot draw a progress bar, just output a simple log
			console.log(`${label} ${done}/${total} (${pct}%)`);
		}
	}
	// --------------------------------- PROGRESS BAR END -------------------------------------------------
	// 2) set up counters for the progress UI
	const total = rows.length;
	let done = 0;

	// 3) write in fixed-size chunks
	for (let i = 0; i < rows.length; i += MAX_CHUNK) {
		const chunk = rows.slice(i, i + MAX_CHUNK); // copy a window of rows

		// 3a) perform the upsert (INSERT ... ON CONFLICT DO UPDATE)
		const { error } = await supabase.from(table).upsert(chunk, {
			onConflict, // must match a real PK/UNIQUE index in Postgres
			ignoreDuplicates: false, // must match a real PK/UNIQUE index in Postgres
			returning: "minimal", // reduce response payload size
		});

		// 3b) fail fast so the caller can handle/log/retry as needed
		if (error) throw new Error(`Upsert failed for ${table}: ${error.message}`);

		// 3c) bump progress after a successful chunk
		done += chunk.length;
		drawProgress(`[${table}]`, done, total);
	}

	// 4) final confirmation (TTY already printed a newline)
	if (!isTTY) console.log(`✓ [${table}] upsert complete (${total} rows)`);
}

/*-------------------------------------------------------------------------------
                                Ticker Helper
--------------------------------------------------------------------------------*/
// Flattens the rows array and removes duplicate pairs of (cik, ticker)
function buildTickerPairs(companyRows) {
	const out = []; //accumulator for flattened rows
	const seen = new Set(); //tracks which pairs we have already seen

	//for each company row...
	for (const r of companyRows) {
		//use the row's cik or fall back to default value
		const cik = r.cik ?? "0000000000";

		//If tickers is already an array, then use it.
		//otherwise treat it as a CSV string and clean it up
		const arr = Array.isArray(r.tickers)
			? r.tickers
			: (r.tickers ?? "")
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean);

		//for each ticker in the normalized array...
		//build a unique key combining both fields to check if we have already seen it
		//otherwise mark as seen and push to the output
		for (const t of arr) {
			const key = `${cik}::${t}`;
			if (seen.has(key)) continue;
			seen.add(key);
			out.push({ cik, ticker: t });
		}
	}
	return out;
}

/*-------------------------------------------------------------------------------
                            Form Classifier Helper
--------------------------------------------------------------------------------*/
function classifyForm(formType) {
	const x = (formType || "").toUpperCase().trim();
	if (x.startsWith("8-K")) return "current";
	if (x.startsWith("10-K") || x.startsWith("NT 10-K")) return "annual";
	if (x.startsWith("10-Q") || x.startsWith("NT 10-Q")) return "quarterly";
	return null; // ignore everything else
}
