/** @format */
/*-------------------------------------------------------------------------------
                                    Imports
--------------------------------------------------------------------------------*/
import { getSupabase } from "../Client.js";

/*-------------------------------------------------------------------------------
                                    Main Function
--------------------------------------------------------------------------------*/
export const fetchReportMetaData = async (cik, CUTOFF_ISO) => {
	try {
		// Argument Check
		if (cik === undefined || cik === null || String(cik).trim() === "") {
			throw new Error("fetchReportMetaData: CIK not valid");
		}

		// 1) Create client.
		const supabase = getSupabase();

		// 2) Pull the fields we need.
		const { data, error } = await supabase
			.from("company_forms")
			.select("accession_number, filing_date, form_type")
			.eq("cik", String(cik).trim())
			.gte("filing_date", CUTOFF_ISO)
			.order("filing_date", { ascending: false })
			.order("accession_number", { ascending: false });

		if (error) {
			throw new Error(`Failed to fetch forms for CIK ${cik}: ${error.message}`);
		}

		// 3) Convert to array or else empty array
		const rows = Array.isArray(data) ? data : [];

		// 4) return
		return rows;
	} catch (error) {
		console.error("fetchReportMetaData Error: ", error);
		return;
	}
	return;
};
