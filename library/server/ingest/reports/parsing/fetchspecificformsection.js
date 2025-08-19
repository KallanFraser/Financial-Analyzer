/** @format */
/*-------------------------------------------------------------------------------
                                    Imports
--------------------------------------------------------------------------------*/
import "server-only"; //tells next.js this module must never be bundled into the client

/*-------------------------------------------------------------------------------
                                    Main
--------------------------------------------------------------------------------*/
export async function fetchSpecificFormSection(cik, accessionNumber, section) {
	// Normalize identifiers
	const formattedCIK = String(cik).trim().replace(/^0+/, "");
	const formattedAccessionNumber = String(accessionNumber).trim().replace(/-/g, "");

	const url = `https://www.sec.gov/Archives/edgar/data/${formattedCIK}/${formattedAccessionNumber}/${section}`;
	try {
		const res = await fetch(url, {
			method: "GET",
			headers: {
				"User-Agent": "FinanceDecoded/1.0 (kallanfraser@icloud.com)",
				Accept: "text/html,application/xhtml+xml",
			},
		});

		if (!res.ok) {
			throw new Error(`Failed to fetch file section: ${res.status} ${res.statusText} @ ${url}`);
		}

		return await res.text(); // HTML content
	} catch (error) {
		console.error("GetAnnualReportData.js: FetchReport Function: Error:", error.message);
		throw error;
	}
	return null;
}
