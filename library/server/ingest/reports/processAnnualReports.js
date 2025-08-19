/** @format */
/*-------------------------------------------------------------------------------
                                    Imports
--------------------------------------------------------------------------------*/
import "server-only"; //tells next.js this module must never be bundled into the client
import { getSupabase } from "../../db/client.js";
import { fetchFilingSummary } from "./fetchfilingsummary.js";
import { parseAnnualFilingSummary } from "./parsing/annual/parseannualfilingsummary.js";

/*-------------------------------------------------------------------------------
                                    Main
--------------------------------------------------------------------------------*/
export async function processAnnualReports(cik, annualReportData) {
	// For each annual report...
	for (const { accession_number, filing_date, form_type } of annualReportData) {
		try {
			// 1) Create Filing Summary URL and fetch it
			const filingSummaryData = await fetchFilingSummary(cik, accession_number);

			// 2) Parse Filing Summary for Key Three Statement Sections (i.e R3, R4, R20)
			parseAnnualFilingSummary(filingSummaryData, cik, accession_number);

			// 3) Fetch each section

			// 4) Parse Each Section
			//parse income
			//parse balance
			//parse cash

			// 5) Upsert Database
		} catch (error) {}
	}
}
