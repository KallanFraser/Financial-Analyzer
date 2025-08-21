/** @format */
/*-------------------------------------------------------------------------------
                                    Imports
--------------------------------------------------------------------------------*/
import axios from "axios";

/*-------------------------------------------------------------------------------
                                    Main
--------------------------------------------------------------------------------*/
export async function fetchFilingSummary(cik, accession_number) {
	try {
		// Format CIK & Accession_number for URL creation
		const formattedCIK = String(cik).trim().replace(/^0+/, "");
		const formattedAccessionNumber = String(accession_number).trim().replace(/-/g, "");

		// Create URL
		const url = `https://www.sec.gov/Archives/edgar/data/${formattedCIK}/${formattedAccessionNumber}/FilingSummary.xml`;

		// Fetch
		const res = await axios.get(url, {
			headers: {
				"User-Agent": "FinanceDecoded/1.0 (kallanfraser@icloud.com)",
				Accept: "application/xml,text/xml;q=0.9,*/*;q=0.8",
			},
			responseType: "text", // ensure we get raw XML as text
			validateStatus: (status) => status >= 200 && status < 300, // default, explicit for clarity
		});

		// Axios throws on non-2xx, so if we're here it's OK

		// Extract data
		const xml = res.data;

		// Return data
		return xml;
	} catch (error) {
		console.error("FetchFilingSummary.js Error:", error);
		throw error;
	}
}
