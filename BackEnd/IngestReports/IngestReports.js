/** @format */
/*-------------------------------------------------------------------------------
                                    Imports
--------------------------------------------------------------------------------*/
//Database
import { getSupabase } from "../Database/Client.js";
import { fetchReportMetaData } from "../Database/ReportMethods/FetchReportMetaData.js";

//Parsers
import { parseAnnualReports } from "./Annual/ParseAnnualReports.js";

//Helpers
import { cutoffISOFromYears, normalizeFormType } from "./Helpers/Index.js";

/*-------------------------------------------------------------------------------
                                    Main
--------------------------------------------------------------------------------*/
// Takes CIK argument, and runs the full report ingestion for that company.
// End Result = All Annual, Quarterly, and Current Reports Parsed & Saved to DB.
export const runIngestReports = async (cik) => {
	try {
		// 0) Argument Check
		if (cik === undefined || cik === null || String(cik).trim() === "") {
			throw new Error("runIngestReports: CIK not valid");
		}

		// 1) Configure time window (last 5 years by default).
		const CUTOFF_ISO = cutoffISOFromYears(5);

		// 2) Fetch all report meta data for the company
		const rows = await fetchReportMetaData(cik, CUTOFF_ISO);

		// 3) Create arrays to store data into categories by report type.
		const annualReports = [];
		const quarterlyReports = [];
		const currentReports = [];

		// 4) Organize data into categories
		for (const row of rows) {
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

		// 7) Process currents

		return;
	} catch (error) {
		console.error("IngestReports Error: ", error);
		return;
	}
	return;
};
