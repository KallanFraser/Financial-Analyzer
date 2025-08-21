/** @format */
/*-------------------------------------------------------------------------------
                                    Imports
--------------------------------------------------------------------------------*/
import "server-only"; //tells next.js this module must never be bundled into the client
import { isFormAllowed } from "./Helpers.js";

/*-------------------------------------------------------------------------------
                                    Main
--------------------------------------------------------------------------------*/
export function parseCompanyFile(fileName, buffer) {
	//buffer contains the file itself
	//opt is options to control what kinds of files we want. i.e 10K's 10Q's, etc.`

	let obj;
	try {
		// 1) parsing the file as a json object, for which it is
		obj = JSON.parse(buffer.toString("utf8"));
	} catch (err) {
		console.error(`Could not parse JSON for ${fileName}:`, err);
		return null;
	}

	// 2) destructuring the JSON company file for the fields we want
	// Note that there are more fields, these are just the ones we are interested in
	const {
		cik = "0000000000",
		entityType = "N/A",
		sic = "0000",
		name: companyName = "N/A",
		tickers = [],
		exchanges = [],
		fiscalYearEnd = "0000",
		filings: {
			recent: {
				accessionNumber: accessionNumbers = [],
				filingDate: filingDates = [],
				form: forms = [],
			} = {},
		} = {},
	} = obj;

	// 3) Filter for companies that file 10-K's, 10-Q's, and 8-Ks
	if (entityType !== "operating") return null;
	// operating = regular issuers
	// investmentCompany = mutual funds, ETFs, series trusts (they file different kinds of forms)
	// individual = insiders / officers (they file ownership forms and change of stock)
	// other = shells, LLC's, trusts, etc

	// array to store all our filings where each entry contains:
	// the filing accessionnumber,the date of the filing, and the type of filing
	const filings = [];

	//There should be an equal number but we still take the minimum count anyways
	const n = Math.min(accessionNumbers.length, filingDates.length, forms.length);
	for (let i = 0; i < n; i++) {
		const form = forms[i];
		if (!isFormAllowed(form)) continue;

		filings.push({
			accessionNumber: accessionNumbers[i],
			filingDate: filingDates[i],
			form,
		});
	}

	return {
		cik,
		entityType,
		sic,
		name: companyName,
		tickers,
		exchanges,
		fiscalYearEnd,
		filings,
	};
}
