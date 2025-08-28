/** @format */
/*------------------------------------------------------------------------------
                                    Imports
------------------------------------------------------------------------------*/
import { getSupabase } from "../Client.js";

/*------------------------------------------------------------------------------
                               Small JSON sanitizer
------------------------------------------------------------------------------*/
// Ensures we only ever store plain JSON (no class instances / circular refs).
function toPlainJson(value) {
	if (value == null) return null;
	try {
		return JSON.parse(JSON.stringify(value));
	} catch {
		return value; // last resort; Supabase client will validate
	}
}

/*------------------------------------------------------------------------------
                                 Core Upserter
------------------------------------------------------------------------------*/
/**
 * Upserts a *partial* row into reports_annual keyed by (cik, accession_number).
 * Only the fields present in `patch` are written; existing columns are preserved.
 *
 * Example `patch`:
 *   { filing_summary: {...} }
 *   { income_statement: { dates, rows, unitsMeta } }
 *   { balance_sheet_statement: { ... } }
 *   { cash_flow_statement: { ... } }
 */
export async function upsertAnnualReportPatch(cik, accession_number, patch) {
	const supabase = getSupabase();

	// Build the payload with only provided columns to avoid overwriting others.
	const payload = {
		cik,
		accession_number,
		...(patch.filing_summary !== undefined && {
			filing_summary: toPlainJson(patch.filing_summary),
		}),
		...(patch.income_statement !== undefined && {
			income_statement: toPlainJson(patch.income_statement),
		}),
		...(patch.balance_sheet_statement !== undefined && {
			balance_sheet_statement: toPlainJson(patch.balance_sheet_statement),
		}),
		...(patch.cash_flow_statement !== undefined && {
			cash_flow_statement: toPlainJson(patch.cash_flow_statement),
		}),
	};

	const { data, error } = await supabase
		.from("reports_annual")
		.upsert(payload, {
			onConflict: "cik,accession_number",
			// Critical: do not turn unspecified columns into NULL
			defaultToNull: false,
			ignoreDuplicates: false,
		})
		.select(); // optional; handy for debugging

	if (error) throw error;
	return data?.[0] ?? null;
}

/*------------------------------------------------------------------------------
                               Convenience wrappers
------------------------------------------------------------------------------*/
export async function upsertAnnualFilingSummary(cik, accession_number, filingSummaryJson) {
	return upsertAnnualReportPatch(cik, accession_number, { filing_summary: filingSummaryJson });
}
export async function upsertAnnualIncomeStatement(cik, accession_number, incomeData) {
	// incomeData is { dates, rows, unitsMeta }
	return upsertAnnualReportPatch(cik, accession_number, { income_statement: incomeData });
}
export async function upsertAnnualBalanceSheet(cik, accession_number, balanceData) {
	return upsertAnnualReportPatch(cik, accession_number, { balance_sheet_statement: balanceData });
}
export async function upsertAnnualCashFlow(cik, accession_number, cashData) {
	return upsertAnnualReportPatch(cik, accession_number, { cash_flow_statement: cashData });
}

/*------------------------------------------------------------------------------
                         Batch helper (optional ergonomic)
------------------------------------------------------------------------------*/
/**
 * If you already have several parts at once, you can call this once.
 * Any field that is `undefined` will be ignored and existing DB values kept.
 */
export async function upsertAnnualReportAll(
	cik,
	accession_number,
	{ filing_summary, income_statement, balance_sheet_statement, cash_flow_statement } = {}
) {
	return upsertAnnualReportPatch(cik, accession_number, {
		...(filing_summary !== undefined && { filing_summary }),
		...(income_statement !== undefined && { income_statement }),
		...(balance_sheet_statement !== undefined && { balance_sheet_statement }),
		...(cash_flow_statement !== undefined && { cash_flow_statement }),
	});
}
