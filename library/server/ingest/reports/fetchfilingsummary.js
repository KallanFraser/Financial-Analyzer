/** @format */
/*-------------------------------------------------------------------------------
                                    Imports
--------------------------------------------------------------------------------*/
import "server-only"; //tells next.js this module must never be bundled into the client

/*-------------------------------------------------------------------------------
                                    Main
--------------------------------------------------------------------------------*/
export async function fetchFilingSummary(cik, accession_number) {
	try {
		const formattedCIK = String(cik).trim().replace(/^0+/, "");
		const formattedAccessionNumber = String(accession_number).trim().replace(/-/g, "");
		const url = `https://www.sec.gov/Archives/edgar/data/${formattedCIK}/${formattedAccessionNumber}/FilingSummary.xml`;

		const res = await fetch(url, {
			method: "GET",
			headers: {
				"User-Agent": "FinanceDecoded/1.0 (kallanfraser@icloud.com)",
				Accept: "application/xml,text/xml;q=0.9,*/*;q=0.8",
			},
		});

		if (!res.ok) {
			throw new Error(`Failed to fetch filing summary: ${res.status} ${res.statusText}`);
		}

		const xml = await res.text();
		return xml;
	} catch (error) {
		console.error("Error fetching EDGAR data:", error);
		throw error;
	}
}
