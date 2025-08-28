/** @format */
/*-------------------------------------------------------------------------------
                     Upserts for 10-Q into public.reports_quarterly
  Your SQL columns:
    cik varchar, accession_number varchar,
    filing_summary jsonb,
    income_statement jsonb,
    balance_sheet_statement jsonb,
    cash_flow_statement jsonb
--------------------------------------------------------------------------------*/
import { getSupabase } from "../Client.js";

/**
 * Upsert exactly one JSON column in reports_quarterly, keyed by (cik, accession_number).
 * - Only sends (cik, accession_number, [column]) — no extra fields.
 * - Leaves other JSON columns untouched.
 * - Uses composite onConflict that matches your PK.
 */
async function upsertReportsQuarterlyColumn({ cik, accession_number, column, value }) {
	const supabase = getSupabase();

	const payload = {
		cik,
		accession_number,
		[column]: value ?? {}, // store empty object if null/undefined
	};

	const { data, error } = await supabase
		.from("reports_quarterly")
		.upsert(payload, {
			onConflict: "cik,accession_number",
			ignoreDuplicates: false,
		})
		.select("cik,accession_number"); // forces a response for clearer debugging

	if (error) {
		// Log the whole error for real signal when debugging
		console.error("[reports_quarterly] upsert error:", JSON.stringify(error, null, 2));
		throw new Error(`[reports_quarterly.${column}] upsert failed: ${error.message || "unknown error"}`);
	}

	return data;
}

/*-------------------------------------------------------------------------------
                               Public API
--------------------------------------------------------------------------------*/
export async function upsertQuarterlyFilingSummary(cik, accession_number, filingSummaryData) {
	return upsertReportsQuarterlyColumn({
		cik,
		accession_number,
		column: "filing_summary",
		value: filingSummaryData,
	});
}

export async function upsertQuarterlyIncomeStatement(cik, accession_number, incomeData) {
	return upsertReportsQuarterlyColumn({
		cik,
		accession_number,
		column: "income_statement",
		value: incomeData,
	});
}

export async function upsertQuarterlyBalanceSheet(cik, accession_number, balanceData) {
	return upsertReportsQuarterlyColumn({
		cik,
		accession_number,
		column: "balance_sheet_statement",
		value: balanceData,
	});
}

export async function upsertQuarterlyCashFlow(cik, accession_number, cashData) {
	return upsertReportsQuarterlyColumn({
		cik,
		accession_number,
		column: "cash_flow_statement",
		value: cashData,
	});
}
