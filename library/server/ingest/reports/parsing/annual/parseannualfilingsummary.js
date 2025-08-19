/** @format */
/*-------------------------------------------------------------------------------
                                    Imports
--------------------------------------------------------------------------------*/
import "server-only"; // Ensures this module only runs on the server (Next.js)
import statementkeys from "../statementkeys.json"; // Keyword lists for the 3 core statements
import { XMLParser } from "fast-xml-parser"; // XML -> JS object
import { fetchSpecificFormSection } from "../fetchspecificformsection.js"; // Fetch HTML by filename

import { parseAnnualIncomeStatement } from "./parsestatements.js";

/*-------------------------------------------------------------------------------
                                    Main
--------------------------------------------------------------------------------*/
export async function parseAnnualFilingSummary(filingSummary, cik, accessionNumber) {
	try {
		// 1) Parse FilingSummary XML into a JS object
		const parser = new XMLParser({
			ignoreAttributes: false, // keep attributes like instance="..."
			attributeNamePrefix: "@_", // prefix attributes with @_
			trimValues: true, // trim whitespace
			parseTagValue: true, // parse text nodes into native types when possible
		});
		const doc = parser.parse(filingSummary);

		// 2) Normalize: `Report` can be a single object or an array
		const raw = doc?.FilingSummary?.MyReports?.Report ?? [];
		const reports = Array.isArray(raw) ? raw : [raw];

		// 3) Case-insensitive "does LongName contain any of these keys?"
		const containsAny = (text = "", keys = []) => {
			const t = String(text).toLowerCase();
			return keys.some((k) => t.includes(String(k).toLowerCase()));
		};

		// 4) For a given key list (income/balance/cashflow):
		//    - filter matching reports
		//    - fetch each candidate's HTML
		//    - return the single largest by HTML size
		const pickLargestSection = async (keys) => {
			const candidates = reports.filter((r) => r?.HtmlFileName && containsAny(r?.LongName, keys));
			if (candidates.length === 0) return null;

			const fetched = await Promise.all(
				candidates.map(async (r) => {
					const fileName = r.HtmlFileName;
					const html = await fetchSpecificFormSection(cik, accessionNumber, fileName);
					return { fileName, html, size: html?.length ?? 0 };
				})
			);

			// Select the max by size (tie-break: longer filename for determinism)
			return fetched.reduce((best, cur) => {
				if (cur.size !== best.size) return cur.size > best.size ? cur : best;
				return (cur.fileName?.length ?? 0) > (best.fileName?.length ?? 0) ? cur : best;
			});
		};

		// 5) Resolve all three statements in parallel
		const [incomeStatement, balanceSheet, cashFlow] = await Promise.all([
			pickLargestSection(statementkeys.income_statement),
			pickLargestSection(statementkeys.balance_sheet),
			pickLargestSection(statementkeys.cash_flow_statement),
		]);

		// 6) Return a compact, explicit shape (null if not found)
		//console.log("income ", incomeStatement.fileName);
		/*
		return {
			incomeStatement, // { fileName, html, size } | null
			balanceSheet, // { fileName, html, size } | null
			cashFlow, // { fileName, html, size } | null
		};
        */
		parseAnnualIncomeStatement(incomeStatement.html);
	} catch (error) {
		console.error("parseAnnualFilingSummary error:", error);
		throw error;
	}
}
