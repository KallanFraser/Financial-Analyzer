/** @format */

import "server-only";
/*-------------------------------------------------------------------------------
                                    Functions
--------------------------------------------------------------------------------*/
export function normalizeForm(s) {
	return (s || "").toUpperCase().trim();
}

//Currently only parsing current, annuals, and quarterlies
export function isFormAllowed(f) {
	const x = normalizeForm(f);
	if (x === "8-K") return true;
	if (x.startsWith("10-K")) return true; // 10-K, 10-K/A, 10-KT
	if (x.startsWith("10-Q")) return true; // 10-Q, 10-Q/A, 10-QT
	if (x.startsWith("NT 10-K") || x.startsWith("NT 10-Q")) return true;
	return false;
}
