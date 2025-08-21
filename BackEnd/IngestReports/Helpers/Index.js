/** @format */
// Core Helper Exports
export { extractHtml, cleanText } from "./Core/Text.js";
export { toNumberCell, scaleFromWord } from "./Core/Numbers.js";
export { detectUnitScales, inferUnitClass } from "./Core/Units.js";
export { extractTaxonomy } from "./Core/Taxonomy.js";

// Table Helper Exports
export { parseHeader } from "./Table/Header.js";
export { parseDataRow } from "./Table/RowParse.js";
export {
	isSectionHeaderRow,
	updateBreakdownStateFromHeader,
	handleBreakdownRow,
	softDedupRows,
} from "./Table/RowsIncomeStatement.js";
export { collectTableRows } from "./Table/CollectIncomeStatement.js";
export { collectTableRowsBalance } from "./Table/CollectBalanceSheet.js";
export { collectTableRowsCashFlow } from "./Table/CollectCashFlow.js";

// Ingestion Helper Exports
export { cutoffISOFromYears, normalizeFormType } from "./Ingestion/Forms.js";
