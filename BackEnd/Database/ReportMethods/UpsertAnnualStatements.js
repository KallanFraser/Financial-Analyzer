/**
 * Upserts the parsed income statement JSON into reports_annual.income_statement
 * for the given (cik, accession_number).
 *
 * @format
 * @param {SupabaseClient} supabase
 * @param {string} cik
 * @param {string} accession_number
 * @param {object} incomeData
 */

async function upsertAnnualIncomeStatement(supabase, cik, accession_number, incomeData) {
	if (
		!incomeData ||
		!Array.isArray(incomeData.dates) ||
		!Array.isArray(incomeData.rows) ||
		typeof incomeData.unitsMeta !== "object"
	) {
		throw new Error(`Invalid incomeData shape for cik=${cik}, accession_number=${accession_number}`);
	}

	const payload = {
		cik: String(cik),
		accession_number: String(accession_number),
		income_statement: incomeData,
	};

	const { error } = await supabase.from("reports_annual").upsert(payload, {
		onConflict: "cik,accession_number",
		ignoreDuplicates: false,
		returning: "minimal",
	});

	if (error) {
		throw new Error(
			`Supabase upsert (income_statement) failed for cik=${cik}, accession_number=${accession_number}: ${error.message}`
		);
	}
}
