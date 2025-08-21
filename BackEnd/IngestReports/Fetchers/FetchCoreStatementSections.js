/** @format */
/*-------------------------------------------------------------------------------
                                    Imports
--------------------------------------------------------------------------------*/
import statementkeys from "../statementkeys.json" with { type: "json" }; // Keyword lists for the 3 core statements
import { XMLParser } from "fast-xml-parser"; // XML -> JS object
import { fetchSpecificFormSection } from "./FetchFormSection.js"; // Fetch HTML by filename
/*-------------------------------------------------------------------------------
                                    Main
--------------------------------------------------------------------------------*/
export const fetchCoreStatementSections = async (filingSummary, cik, accessionNumber) => {
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

		// Function for: Does LongName contain any of the keys we are interested in
		const containsAny = (text = "", keys = []) => {
			const t = String(text).toLowerCase();
			return keys.some((k) => t.includes(String(k).toLowerCase()));
		};

		// Function For a given key list (income/balance/cashflow):
		//    - select all the candidates for the current statement being observed
		//    - fetch each candidate's raw HTML
		//    - ignore any candidates with empty or invalid HTML
		//    - return the single largest statement by HTML size
		const pickLargestSection = async (keys) => {
			// Find all the candidates for the statement we are interested in
			// Ensure it has a HtmlFileName and contains any of the keys in our dictionary
			const candidates = reports.filter((r) => r?.HtmlFileName && containsAny(r?.LongName, keys));

			// Early return if none
			if (candidates.length === 0) return null;

			// If there are candidate form sections for the given statement...
			// Fetch all of the candidates
			const fetched = await Promise.all(
				// For each candidate...
				candidates.map(async (report) => {
					// Get the filename. i.e R3 R6 R20
					const fileName = report.HtmlFileName;
					// Fetch the raw HTML
					const html = await fetchSpecificFormSection(cik, accessionNumber, fileName);
					// Get the size of the raw HTML (0 if invalid or empty)
					const size = typeof html === "string" ? html.length : 0;
					// If no valid HTML, drop this candidate
					if (!size) return null;
					// Return the filename, raw HTML, and size for comparisons later
					return { fileName, html, size };
				})
			);

			// Filter out invalid or empty candidates
			const valid = fetched.filter(Boolean);
			if (valid.length === 0) return null;

			// Function to return the largest statement out of the candidates
			// This is because the largest is likely to be the actual statement and not some child statement
			return valid.reduce((best, current) => {
				if (current.size !== best.size) return current.size > best.size ? current : best;
				return (current.fileName?.length ?? 0) > (best.fileName?.length ?? 0) ? current : best;
			});
		};

		// 3) Resolve all three statements in parallel
		const [incomeStatement, balanceSheet, cashFlow] = await Promise.all([
			pickLargestSection(statementkeys.income_statement),
			pickLargestSection(statementkeys.balance_sheet),
			pickLargestSection(statementkeys.cash_flow_statement),
		]);

		// 4) Enforce ALL-or-NONE:
		// If any of the three statements are missing, throw an error instead of returning partial results
		if (!incomeStatement || !balanceSheet || !cashFlow) {
			throw new Error("Missing one or more core statements (income, balance sheet, cash flow).");
		}

		// 5) Return a compact, explicit shape (all statements guaranteed non-null)
		return {
			incomeStatement, // { fileName, html, size }
			balanceSheet, // { fileName, html, size }
			cashFlow, // { fileName, html, size }
		};
	} catch (error) {
		console.error("fetchCoreStatementSections.js error:", error);
		throw error;
	}
};
