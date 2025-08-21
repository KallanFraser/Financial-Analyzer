/** @format */
/*-------------------------------------------------------------------------------
                                    Imports
--------------------------------------------------------------------------------*/
//Database
import { getSupabase } from "../../Database/Client.js";

//Fetchers
import { fetchFilingSummary } from "../Fetchers/FetchFilingSummary.js";

//Parsers
import { fetchCoreStatementSections } from "../Fetchers/FetchCoreStatementSections.js";
import { parseAnnualIncomeStatement } from "./Income/ParseIncomeStatement.js";
import { parseBalanceSheetStatement } from "./Balance/ParseBalanceSheet.js";
import { parseCashFlowStatement } from "./Cash/ParseCashFlow.js";
/*-------------------------------------------------------------------------------
                                    Main
--------------------------------------------------------------------------------*/
// Function to process each annual report (parse, upsert)
// CIK still needed for upsert into db
export const parseAnnualReports = async (cik, annualReportData) => {
	// 1) connect to our db client
	const supabase = getSupabase();

	for (const { accession_number, filing_date, form_type } of annualReportData) {
		try {
			// 1) Fetch filing summary
			const filingSummaryData = await fetchFilingSummary(cik, accession_number);

			// 2) Upsert filing summary immediately
			// TO DO

			// 3) Parse Filing Summary and Fetch raw html for each statement
			const { incomeStatement, balanceSheet, cashFlow } = await fetchCoreStatementSections(
				filingSummaryData,
				cik,
				accession_number
			);

			// 4) Parse Income statement & Upsert
			if (incomeStatement?.html) {
				//const incomeData = parseAnnualIncomeStatement(incomeStatement.html);
				//await upsertAnnualIncomeStatement(supabase, cik, accession_number, incomeData);
			} else {
				console.warn(
					`No income statement found for cik=${cik}, accession_number=${accession_number}`
				);
			}

			// 4) Parse Balance Sheet & Upsert
			if (balanceSheet?.html) {
				//const balanceData = parseBalanceSheetStatement(balanceSheet.html);
				//await upsertAnnualIncomeStatement(supabase, cik, accession_number, incomeData);
			} else {
				console.warn(`No Balance Sheet found for cik=${cik}, accession_number=${accession_number}`);
			}

			// 4) Parse Cash Flow Statement & Upsert
			if (cashFlow?.html) {
				const cashData = parseCashFlowStatement(cashFlow.html);
				//await upsertAnnualIncomeStatement(supabase, cik, accession_number, incomeData);
			} else {
				console.warn(`No Cash Flow found for cik=${cik}, accession_number=${accession_number}`);
			}
		} catch (error) {
			console.error("parseAnnualReports.js Error for cik", cik, " ", error);
			continue;
		}
	}
};
