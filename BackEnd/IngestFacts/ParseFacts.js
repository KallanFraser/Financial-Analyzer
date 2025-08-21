/** @format */
/*-------------------------------------------------------------------------------
                                Imports & Globals
--------------------------------------------------------------------------------*/
import "server-only"; //tells next.js this module must never be bundled into the client

// One combined dictionary of "value-ish" keys (revenue/gross profit/etc.)
// (broad net, fine if imperfect — we only need *a* company value metric)
const VALUE_KEYS = [
	"RevenueFromContractWithCustomerExcludingAssessedTax",
	"RevenueFromContractWithCustomerIncludingAssessedTax",
	"SalesRevenueNet",
	"SalesRevenueGoodsNet",
	"SalesRevenueServicesNet",
	"Revenues",
	"Revenue",
	"OperatingRevenue",
	"TotalRevenuesAndOtherIncome",
	"RevenuesNetOfInterestExpense",
	"GrossProfit",
	"RevenueIFRS",
	"RevenueFromContractsWithCustomers",
	"TurnoverRevenue",
];

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

	// 2) CIK we need for insertion
	const cik = String(obj?.cik ?? "0000000000");

	// We don’t care if it’s revenue or gross profit — just pick something “value-like”.
	// Rule: pick entry with the most recent `end`; tie on same end → larger `val`.
	const companyValueMaybe = pickLatestValueMetric(obj);

	//console.log("company value check: ", companyValueMaybe ?? "0");

	return { cik, companyValue: companyValueMaybe ?? "0" };
}

/*-------------------------------------------------------------------------------
                                Helpers
--------------------------------------------------------------------------------*/
// returns a single string value (e.g. "123456789") or null if nothing found
function pickLatestValueMetric(obj) {
	const factsRoot = obj?.facts || {};
	const namespaces = ["us-gaap", "ifrs-full", "dei"]; // search broadly

	// Collect all candidate entries from VALUE_KEYS across namespaces
	const entries = [];
	for (const ns of namespaces) {
		const bucket = factsRoot?.[ns];
		if (!bucket) continue;
		for (const key of VALUE_KEYS) {
			const unitsObj = bucket?.[key]?.units;
			if (!unitsObj) continue;
			for (const arr of Object.values(unitsObj)) {
				for (const rec of arr || []) {
					// keep only numeric vals that have an 'end' date
					if (!rec || !rec.end) continue;
					const num = Number(rec.val);
					if (!Number.isFinite(num)) continue;
					entries.push(rec);
				}
			}
		}
	}

	if (!entries.length) return null;

	// Choose most recent by `end`; tie → larger value
	let best = null; // { endTs, valNum }
	for (const rec of entries) {
		const endTs = Date.parse(rec.end || "");
		if (!Number.isFinite(endTs)) continue;
		const valNum = Number(rec.val);
		if (!Number.isFinite(valNum)) continue;

		if (!best || endTs > best.endTs || (endTs === best.endTs && valNum > best.valNum)) {
			best = { endTs, valNum };
		}
	}

	return best ? String(best.valNum) : null;
}
