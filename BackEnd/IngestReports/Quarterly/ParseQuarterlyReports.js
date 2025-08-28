/** @format */
/*-------------------------------------------------------------------------------
                                    Imports
--------------------------------------------------------------------------------*/
// Database
import { getSupabase } from "../../Database/Client.js";

// Fetchers
import { fetchFilingSummary } from "../Fetchers/FetchFilingSummary.js";
import { fetchCoreStatementSections } from "../Fetchers/FetchCoreStatementSections.js";

// Parsers (quarterly)
import { parseQuarterlyIncomeStatement } from "./Income/ParseIncomeStatement.js";
import { parseQuarterlyBalanceSheetStatement } from "./Balance/ParseBalanceSheet.js";
import { parseQuarterlyCashFlowStatement } from "./Cash/ParseCashFlow.js";

// Upserts (quarterly variants)
import {
	upsertQuarterlyFilingSummary,
	upsertQuarterlyIncomeStatement,
	upsertQuarterlyBalanceSheet,
	upsertQuarterlyCashFlow,
} from "../../Database/ReportMethods/UpsertQuarterlyStatements.js";

/*-------------------------------------------------------------------------------
                                    Main
--------------------------------------------------------------------------------*/
// Function to process each quarterly report
// Fetches the filing summary, parses it for the section, downloads the statements raw html
// Then parses the raw html, and then finally upserts the data into our db
// CIK is passed as an argument so as to upsert
export const parseQuarterlyReports = async (cik, quarterlyReportData) => {
	// connect to supabase if not already
	getSupabase();

	// For each report in our array of quarterly reports...
	for (const { accession_number } of quarterlyReportData) {
		try {
			// 1) Fetch the filing summary
			const filingSummaryData = await fetchFilingSummary(cik, accession_number);

			// 2) Fetch raw html for each report's statements
			const { incomeStatement, balanceSheet, cashFlow } = await fetchCoreStatementSections(
				filingSummaryData,
				cik,
				accession_number
			);

			// 3) Parse all three in parallel (fast) – no writes yet
			const [parsedIncomeData, parsedBalanceData, parsedCashData] = await Promise.all([
				incomeStatement?.html
					? Promise.resolve(parseQuarterlyIncomeStatement(incomeStatement.html))
					: Promise.resolve(null),
				balanceSheet?.html
					? Promise.resolve(parseQuarterlyBalanceSheetStatement(balanceSheet.html))
					: Promise.resolve(null),
				cashFlow?.html
					? Promise.resolve(parseQuarterlyCashFlowStatement(cashFlow.html))
					: Promise.resolve(null),
			]);

			// 4) Upsert All
			const tasks = [
				upsertQuarterlyFilingSummary(cik, accession_number, filingSummaryData),
				parsedIncomeData
					? upsertQuarterlyIncomeStatement(cik, accession_number, parsedIncomeData)
					: Promise.resolve(),
				parsedBalanceData
					? upsertQuarterlyBalanceSheet(cik, accession_number, parsedBalanceData)
					: Promise.resolve(),
				parsedCashData
					? upsertQuarterlyCashFlow(cik, accession_number, parsedCashData)
					: Promise.resolve(),
			];

			await Promise.all(tasks); // rejects if any single upsert rejects
		} catch (error) {
			console.error("parseQuarterlyReports.js Error for cik", cik, error);
			continue;
		}
	}
};
