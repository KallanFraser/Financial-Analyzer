/** @format */
/*-------------------------------------------------------------------------------
                                    Imports
--------------------------------------------------------------------------------*/
import axios from "axios";

/*-------------------------------------------------------------------------------
                                    Main
--------------------------------------------------------------------------------*/
export async function fetchSpecificFormSection(cik, accessionNumber, section) {
	// Normalize identifiers for URL creation
	const formattedCIK = String(cik).trim().replace(/^0+/, "");
	const formattedAccessionNumber = String(accessionNumber).trim().replace(/-/g, "");

	// Create the URL
	const url = `https://www.sec.gov/Archives/edgar/data/${formattedCIK}/${formattedAccessionNumber}/${section}`;

	try {
		// Fetch
		const res = await axios.get(url, {
			headers: {
				"User-Agent": "FinanceDecoded/1.0 (kallanfraser@icloud.com)",
				Accept: "text/html,application/xhtml+xml",
			},
			responseType: "text", // Ensure raw HTML comes back as text
		});

		// Axios throws on non-2xx by default, so no manual status check needed

		// Return raw html content
		return res.data;
	} catch (error) {
		console.error("GetAnnualReportData.js: fetchSpecificFormSection Error:", error.message);
		throw error;
	}
}
