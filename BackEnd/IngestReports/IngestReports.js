/** @format */
/*-------------------------------------------------------------------------------
                                    Imports
--------------------------------------------------------------------------------*/
// Database
import { fetchReportMetaData } from "../Database/ReportMethods/FetchReportMetaData.js";

// Parsers
import { parseAnnualReports } from "./Annual/ParseAnnualReports.js";
import { parseQuarterlyReports } from "./Quarterly/ParseQuarterlyReports.js";

// Helpers
import { cutoffISOFromYears, normalizeFormType } from "./Helpers/Index.js";

/*-------------------------------------------------------------------------------
                                    Main
--------------------------------------------------------------------------------*/
// Takes CIK argument, and runs the full report ingestion for that company.
// End Result = All Annual, Quarterly, and Current Reports Parsed & Saved to DB.
// If there already exists DB entries, will overwrite.
export const runIngestReports = async (cik) => {
	try {
		// 0) Argument Check
		if (cik === undefined || cik === null || String(cik).trim() === "" || String(cik).length != 10) {
			// Execution will stop immediately, throw the excepetion object, and trigger the catch block.
			throw new Error("runIngestReports: CIK not valid or not valid format");
		}

		// 1) Configure time window (last 5 years by default).
		const CUTOFF_ISO = cutoffISOFromYears(5);

		// 2) Fetch all report meta data for the company (annuals, quarterlies, and currents)
		const rows = await fetchReportMetaData(cik, CUTOFF_ISO);

		// 3) Create arrays to store data into categories by report type.
		const annualReports = [];
		const quarterlyReports = [];
		const currentReports = [];

		// 4) Organize data into categories
		for (const row of rows) {
			// trim, convert uppercase, make easier for comparison
			const type = normalizeFormType(row.form_type);

			if (type.startsWith("10-K")) {
				annualReports.push(row);
			} else if (type.startsWith("10-Q")) {
				quarterlyReports.push(row);
			} else if (type.startsWith("8-K")) {
				currentReports.push(row);
			}
		}

		// 5) Process annuals
		await parseAnnualReports(cik, annualReports);

		// 6) Process quartlies
		await parseQuarterlyReports(cik, quarterlyReports);

		// 7) Process currents
		// To Do in the future

		console.log("Successfully upserted all forms for CIK: ", cik);
		return;
	} catch (error) {
		// Print the provided error object to standard error stream for debugging
		console.error("IngestReports Error: ", error);
		return;
	}
};
