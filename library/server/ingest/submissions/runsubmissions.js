/** @format */
/*-------------------------------------------------------------------------------
                                Imports & Globals
--------------------------------------------------------------------------------*/
import "server-only"; //tells next.js this module must never be bundled into the client
import { fetchSubmissions } from "./fetchsubmissions.js";
import { webToNodeStream, processZipStream } from "../streamzipfile.js";
import { parseCompanyFile } from "./parsecompanyfile.js";
import { upsertCompaniesBatch, upsertFilingsBatch } from "../../db/submissionsupserts.js";

const COMPANY_BATCH = 500;
const FILING_BATCH = 2000;
const SUBMISSIONS_URL = "https://www.sec.gov/Archives/edgar/daily-index/bulkdata/submissions.zip";
/*-------------------------------------------------------------------------------
                                    Main
--------------------------------------------------------------------------------*/
export async function runSubmissionsIngest() {
	// 1) fetch the company submissions data (fetch function sets required headers)
	const res = await fetchSubmissions(SUBMISSIONS_URL);

	// 2) checking the response status returned from edgar API
	if (!res.ok || !res.body) {
		throw new Error(`Failed to fetch submissions.zip (${res.status})`);
	}

	// 3) converts the web stream returned from fetch() to a node stream so we can use unzipper library on it
	const nodeStream = webToNodeStream(res.body);

	// Counters for dev's & debugging
	let companies = 0;
	let keptFilings = 0;

	// Buffers to store company data and filings for batch db inserts
	const companyBuffer = [];
	const filingsBuffer = [];

	/*-------------------------------------------------------------------------------
                                Mini Helper Functions
    --------------------------------------------------------------------------------*/
	// VERY IMPORTANT FUNCTION
	// processZipStream triggers our callback many times in parallel.
	// This means two different "flushes", as seen below, can run at the same time.
	// In other words, flushcompanies() and flushfilings() can run in parallel.
	// This creates a race condition. If flushFilings wins the race, our DB can throw a FK error
	// because the parent rows are not in company_data yet.
	// Therefore we create a one wide async queue with promises
	let flushChain = Promise.resolve(); //starts a resolved promise (an empty queue)
	function withFlushLock(fn) {
		// queues fn to run after whatever is already in the queue.
		// everytime we run this function, it appends to the end of the queue and returns a promise for said run.
		const next = flushChain.then(fn, fn); //appends fn to the tail of the queue.
		// .then(fn,fn) = means run fn whether the previous task resolves or rejects
		flushChain = next.catch(() => {}); // keep chain alive on errors
		return next;
	}

	// function to batch insert submission data to db
	async function flushCompanies() {
		const toWrite = companyBuffer.splice(0, companyBuffer.length); //copies all items to toWrite and empties the buffer
		if (!toWrite.length) return; //ensure it has data
		await upsertCompaniesBatch(toWrite);
	}

	// functions to batch insert filing data to db
	async function flushFilings() {
		// FIX: ensure any pending companies are written first to satisfy FK
		if (companyBuffer.length) {
			await flushCompanies();
		}
		const toWrite = filingsBuffer.splice(0, filingsBuffer.length); //copies all items to toWrite and empties the buffer
		if (!toWrite.length) return; //ensure it has data
		await upsertFilingsBatch(toWrite);
	}

	// 4) Process the zip stream file by file
	await processZipStream(nodeStream, async (path, buffer) => {
		//path contains a files path, buffer contains a company submission file itself

		// 5) parse the company file for its data
		const parsed = parseCompanyFile(path, buffer);

		if (!parsed) return;

		//increasing our dev counter
		companies++;
		keptFilings += parsed.filings.length;

		// 6) Push company submission data to buffer
		companyBuffer.push({
			cik: parsed.cik,
			entityType: parsed.entityType,
			sic: parsed.sic,
			name: parsed.name,
			tickers: parsed.tickers, // array ok if your schema supports it; otherwise JSON.stringify here
			exchanges: parsed.exchanges, // same note as above
			fiscalYearEnd: parsed.fiscalYearEnd,
		});

		// 7) Push filings data to buffer
		for (const f of parsed.filings) {
			filingsBuffer.push({
				cik: parsed.cik,
				accessionNumber: f.accessionNumber,
				filingDate: f.filingDate,
				form: f.form,
			});
		}

		// 8) Independently flush each buffer if its own threshold is hit
		if (companyBuffer.length >= COMPANY_BATCH) {
			await withFlushLock(flushCompanies); // runs under lock
		}
		if (filingsBuffer.length >= FILING_BATCH) {
			await withFlushLock(flushFilings); // runs under lock
		}
		//debugging console log
		if (companies % 1000 === 0) {
			console.log(`Processed ${companies} companies, kept ${keptFilings} filings`);
		}
	});

	// 9) Final independent flushes (drain leftovers)
	await withFlushLock(flushCompanies); // FIX: run under lock
	await withFlushLock(flushFilings); // FIX: run under lock

	return { companies, keptFilings };
}
