/** @format */
/*-------------------------------------------------------------------------------
                                    Imports
--------------------------------------------------------------------------------*/
import "server-only"; //tells next.js this module must never be bundled into the client
import { getSupabase } from "../../db/client.js";
import { processAnnualReports } from "./processAnnualReports.js";

/*-------------------------------------------------------------------------------
                                    Main
--------------------------------------------------------------------------------*/
export async function runIngestReports(cik) {
	if (!cik) throw new Error("no cik given for ingestreports.js");

	// 0) Threshold for reports we want in last x years
	const now = new Date();
	const cutoffISO = new Date(Date.UTC(now.getFullYear() - 5, now.getMonth(), now.getDate()))
		.toISOString()
		.slice(0, 10); // 'YYYY-MM-DD' format = same as stored in db.

	// 1) GET all accessionnumbers, filing_date, and form_type for a given company by CIK
	const supabase = getSupabase();

	const { data, error } = await supabase
		.from("company_forms")
		.select("accession_number, filing_date, form_type")
		.eq("cik", cik)
		.gte("filing_date", cutoffISO)
		.order("filing_date", { ascending: false })
		.order("accession_number", { ascending: false });

	if (error) {
		throw new Error(`Failed to fetch forms for CIK ${cik}: ${error.message}`);
	}
	const rows = Array.isArray(data) ? data : [];

	// 2) Organize into arrays according to report types
	const annualReports = [];
	const quarterlyReports = [];
	const currentReports = [];

	for (const row of rows) {
		let reportType = String(row.form_type || "")
			.toUpperCase()
			.trim();
		if (reportType.startsWith("10-K")) {
			annualReports.push(row);
		} else if (reportType.startsWith("10-Q")) {
			quarterlyReports.push(row);
		} else if (reportType.startsWith("8-K")) {
			currentReports.push(row);
		}
	}

	// 3) Process Each Report
	processAnnualReports(cik, annualReports);
}
