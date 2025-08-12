/** @format */
/*-------------------------------------------------------------------------------
                                Imports & Globals
--------------------------------------------------------------------------------*/
import "server-only"; //tells next.js this module must never be bundled into the client

/*-------------------------------------------------------------------------------
                                    Main
--------------------------------------------------------------------------------*/
export function parseCompanyFacts(fileName, buffer) {
	//buffer contains the facts file itself (JSON)

	let obj;
	try {
		// 1) parse the file as a JSON object
		obj = JSON.parse(buffer.toString("utf8"));
	} catch (err) {
		console.error(`Could not parse JSON for ${fileName}:`, err);
		return null;
	}

	// 2) cik we need for insertion
	const cik = String(obj?.cik ?? "0000000000");
	const entityName = String(obj?.entityName ?? "");

	// 3) dig into facts → dei → EntityCommonStockSharesOutstanding → units
	//    then transform the object into an array of individual objects
	const unitsObj = obj?.facts?.dei?.EntityCommonStockSharesOutstanding?.units || {};
	const allEntries = Object.values(unitsObj).flat(); // [{ end, val, accn, form, filed, ... }, ...]

	// 4) if no entries, return early
	if (!allEntries.length) {
		console.log("");
		console.log("Company: ", entityName, " did not have share entries in its company facts.");
		console.log("");
		return { cik, sharesOutstanding: [] };
	}

	// 5) dedupe by 'end' — LAST WINS (overwrites previous)
	// this is for the case of amended versions but the stock price does not change so does not matter which is picked.
	const byEnd = new Map(); //creates a dictionary where keys are unique (key = date, value = record object)
	for (const rec of allEntries) {
		const end = rec?.end; //skips falsey end rows
		if (!end) continue;
		byEnd.set(end, rec); // inserts or replaces the value for that end date
	}

	// 6) pulling out our deduped records from the map and stripping the values we want
	const sharesOutstanding = Array.from(byEnd.values())
		.map((r) => ({ end: r.end ?? "1/1/2000", val: r.val ?? "0", accn: r.accn ?? "" }))
		.sort((a, b) => (Date.parse(a.end) || 0) - (Date.parse(b.end) || 0));

	return { cik, sharesOutstanding };
}
