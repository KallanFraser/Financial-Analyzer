/** @format */
/*-------------------------------------------------------------------------------
                                Imports & Globals
--------------------------------------------------------------------------------*/
import "server-only";
import { getSupabase } from "./client.js";

const MAX_CHUNK = 1000; // safety for very large arrays

/*-------------------------------------------------------------------------------
                        Upsert Company Facts → company_value
--------------------------------------------------------------------------------*/
// INPUT rows shape (from parseCompanyFacts):
// [
//   { cik: "0000320193", companyValue: "123456789" },
//   ...
// ]
export async function upsertCompanyFacts(rows) {
	// 0) sanity
	if (!rows?.length) return 0;

	// 1) shape payload (defaults applied)
	const valueRows = rows.map((r) => ({
		cik: String(r?.cik ?? "0000000000"),
		company_value: String(r?.companyValue ?? "0"),
	}));

	// 2) ensure parent company_data exists (FK backstop)
	const ciks = Array.from(new Set(valueRows.map((r) => r.cik)));
	if (ciks.length) {
		const parentRows = ciks.map((cik) => ({
			cik,
			entity_type: "",
			sic: "",
			company_name: "",
			fiscal_year_end: "",
		}));
		await upsertChunks("company_data", parentRows, "cik");
	}

	// 3) upsert into company_value on (cik)
	await upsertChunks("company_value", valueRows, "cik");

	return valueRows.length;
}

/*-------------------------------------------------------------------------------
                                Main Upsert (generic)
--------------------------------------------------------------------------------*/
// table = destination table
// rows = array of plain objects already shaped for the table
// onConflict = PK/UNIQUE cols used for INSERT ... ON CONFLICT ... DO UPDATE
async function upsertChunks(table, rows, onConflict) {
	// 0) bail early if nothing to write
	if (!rows.length) return;

	// 0.5) DEDUPE by conflict key(s) within this batch to avoid:
	// "ON CONFLICT DO UPDATE command cannot affect row a second time"
	rows = dedupeByOnConflict(rows, onConflict); // last wins for identical keys

	// 1) get a server-only supabase client
	const supabase = getSupabase();

	/*--------------------------------- PROGRESS BAR START ---------------------------------
      Visual aid so you can see long-running upserts moving forward.
      - Renders a single-line bar in TTY terminals (local dev).
      - Falls back to simple log lines in non-TTY envs (serverless logs).
    ---------------------------------------------------------------------------------------*/
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
	// --------------------------------- PROGRESS BAR END -------------------------------------------------

	// 2) set up counters for the progress UI
	const total = rows.length;
	let done = 0;

	// 3) write in fixed-size chunks
	for (let i = 0; i < rows.length; i += MAX_CHUNK) {
		const chunk = rows.slice(i, i + MAX_CHUNK);

		const { error } = await supabase.from(table).upsert(chunk, {
			onConflict, // must match a real PK/UNIQUE index in Postgres
			ignoreDuplicates: false,
			returning: "minimal", // reduce response payload size
		});

		if (error) throw new Error(`Upsert failed for ${table}: ${error.message}`);

		// progress update after a successful chunk
		done += chunk.length;
		drawProgress(`[${table}]`, done, total);
	}

	// final confirmation (TTY already printed a newline)
	if (!isTTY) console.log(`✓ [${table}] upsert complete (${total} rows)`);
}

/*-------------------------------------------------------------------------------
                                   Small Utils
--------------------------------------------------------------------------------*/
// Remove duplicate rows in-memory for the given conflict key(s). "Last wins".
function dedupeByOnConflict(rows, onConflict) {
	if (!onConflict) return rows;
	const keys = onConflict.split(",").map((s) => s.trim());
	const m = new Map();
	for (const r of rows) {
		const k = keys.map((k) => String(r[k] ?? "")).join("::");
		m.set(k, r); // setting again overwrites → last with same key is kept
	}
	return Array.from(m.values());
}
