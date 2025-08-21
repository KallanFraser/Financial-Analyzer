/** @format */
/*-------------------------------------------------------------------------------
                                Imports & Globals
--------------------------------------------------------------------------------*/
import "server-only"; //tells next.js this module must never be bundled into the client
import { fetchFacts } from "./FetchFacts.js";
import { webToNodeStream, processZipStream } from "../../library/server/ingest/streamzipfile.js";
import { parseCompanyFacts } from "./ParseFacts.js";
import { upsertCompanyFacts } from "../../db/factsupserts.js";

const COMPANY_BATCH = 200;
const FACTS_URL = "https://www.sec.gov/Archives/edgar/daily-index/xbrl/companyfacts.zip";
/*-------------------------------------------------------------------------------
                                    Main
--------------------------------------------------------------------------------*/
export async function runFactsIngest() {
	// 1) fetch the company submissions data (fetch function sets required headers)
	const res = await fetchFacts(FACTS_URL);

	// 2) checking the response status returned from edgar API
	if (!res.ok || !res.body) {
		throw new Error(`Failed to fetch facts.zip (${res.status})`);
	}

	// 3) converts the web stream returned from fetch() to a node stream so we can use unzipper library on it
	const nodeStream = webToNodeStream(res.body);

	// Counters for dev's & debugging
	let companies = 0;

	// Buffers to store company data and filings for batch db inserts
	const companyBuffer = [];

	// function to batch insert submission data to db
	async function flushCompanies() {
		const toWrite = companyBuffer.splice(0, companyBuffer.length); //copies all items to toWrite and empties the buffer
		if (!toWrite.length) return; //ensure it has data
		await upsertCompanyFacts(toWrite); // make sure your upsert layer handles { cik, sharesOutstanding, companyValue }
	}

	// 4) Process the zip stream file by file
	await processZipStream(nodeStream, async (path, buffer) => {
		//path contains a files path, buffer contains a company facts file itself

		// 5) parse the company file for its data
		const parsed = parseCompanyFacts(path, buffer);

		if (!parsed) return;

		//increasing our dev counter
		companies++;

		// 6) Push parsed facts to buffer (includes sharesOutstanding + companyValue if present)
		companyBuffer.push(parsed);

		// 8) Flush buffer if full
		if (companyBuffer.length >= COMPANY_BATCH) {
			await flushCompanies();
		}
	});

	// 9) Final buffer flush
	await flushCompanies();

	return { companies };
}
