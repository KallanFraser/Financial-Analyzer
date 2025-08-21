/** @format */

/**
 * Upserts just the filing_summary JSON into reports_annual
 * for the given (cik, accession_number).
 *
 * @param {SupabaseClient} supabase
 * @param {string} cik
 * @param {string} accession_number
 * @param {object} filingSummaryData
 */
async function upsertAnnualFilingSummary(supabase, cik, accession_number, filingSummaryData) {
	const payload = {
		cik: String(cik),
		accession_number: String(accession_number),
		filing_summary: filingSummaryData,
	};

	const { error } = await supabase.from("reports_annual").upsert(payload, {
		onConflict: "cik,accession_number",
		ignoreDuplicates: false,
		returning: "minimal",
	});

	if (error) {
		throw new Error(
			`Supabase upsert (filing_summary) failed for cik=${cik}, accession_number=${accession_number}: ${error.message}`
		);
	}
}
