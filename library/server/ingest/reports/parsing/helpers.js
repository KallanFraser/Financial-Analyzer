/** @format */
/*------------------------------------------------------------------------------
                                    Imports
------------------------------------------------------------------------------*/
import "server-only"; // Ensures this module only runs on the server (Next.js)

/*------------------------------------------------------------------------------
                            Helpers (simple, reusable)
------------------------------------------------------------------------------*/
// Function to extract the <table> section cleanly
export function extractHtml(htmlOrBlob) {
	const m = String(htmlOrBlob).match(/<html[\s\S]*?<\/html>/i);
	return m ? m[0] : String(htmlOrBlob);
}

//Function to clean strings
export function cleanText(s) {
	return String(s ?? "") // ensures we always have a string
		.replace(/[\u00A0\u202F\u2007]/g, " ") // replace all NBSP variants with regular spaces
		.replace(/\u2212/g, "-") // replace unicode minus with ASCII minus
		.replace(/\s+/g, " ") // collapse multiple whitespace characters into one space
		.trim(); // remove leading/trailing whitespace
}

// Function to convert a raw cell to number/null.
// Handles cases like: $, commas, NBSPs, (), unicode minus, %, or stray "USD"
export function normalizeCell(raw, { stripDollar = true } = {}) {
	// 1) Null check
	if (raw == null) return null;

	// 2) Clean up input text
	let t = cleanText(raw);

	// 3) Empty, dash, or NA-style checks → return null
	if (
		t === "" || // empty
		/^[-–—]$/.test(t) || // single dash or em-dash
		/^n\/?a$/i.test(t) || // "NA" / "N/A"
		/^—$/.test(t) // lone em dash
	)
		return null;

	// 4) If wrapped in parentheses, it's a negative value → convert (123) → -123
	if (/^\((.*)\)$/.test(t)) t = "-" + t.slice(1, -1).trim();

	// 5) Strip thousands separators (commas)
	t = t.replace(/,/g, "");

	// 6) Handle percentages → return numeric value without "%"
	if (/%$/.test(t)) {
		const p = t.slice(0, -1); // remove trailing %
		const n = Number(p);
		return Number.isFinite(n) ? n : null;
	}

	// 7) Handle currency markers and units
	if (stripDollar) t = t.replace(/\$/g, ""); // strip "$" if enabled
	t = t.replace(/\b(USD|US\$|EUR|CAD)\b/gi, ""); // strip trailing "USD" etc.

	// 8) Remove any leftover non-numeric characters except digits, sign, dot, exponent
	t = t.replace(/[^0-9eE.+-]/g, "");

	// 9) Guard against invalid leftovers
	if (t === "" || t === "-" || t === "." || t === "-.") return null;

	// 10) Convert to number if valid, else return null
	const n = Number(t);
	return Number.isFinite(n) ? n : null;
}

// Helper function to be used to convert units appropriately.
// The table will say something like "in millions" therefore we convert appropriately.
export function scaleFromWord(w) {
	const s = (w || "").toLowerCase();
	// The underscores do not change the value just a readability feature.
	if (s.includes("billion")) return 1_000_000_000;
	if (s.includes("million")) return 1_000_000;
	if (s.includes("thousand")) return 1_000;
	return 1;
}

// Look across the first few header lines for units to figure out the scale used.
// Accepts: "$ in Millions", "Amounts in thousands", "(in millions)", "shares in thousands", etc.
export function parseUnitsFromHeaders(headerTexts) {
	// 1) Join and normalize
	const blob = headerTexts.map(cleanText).join(" • ");

	// 2) Detect shares units first
	let shareScale = 1;
	const mShares =
		blob.match(/shares?\s+in\s+(billions|millions|thousands)\b/i) ||
		blob.match(/\(\s*shares?\s+in\s+(billions|millions|thousands)\s*\)/i);
	if (mShares) shareScale = scaleFromWord(mShares[1].toLowerCase());

	// 3) Remove any shares-in-... clause so money parsing can't accidentally match it
	const blobNoShares = blob.replace(/\(?\s*shares?\s+in\s+(?:billions|millions|thousands)\s*\)?/gi, "");

	// 4) Detect money units; require a currency signal ($ or USD)
	let moneyScale = 1;
	const mMoney =
		// patterns like: ", $ in Millions" or "USD in Millions"
		blobNoShares.match(
			/(?:^|[,\-–—;•]\s*)(?:\$|usd)\s*(?:amounts?\s+)?in\s+(billions|millions|thousands)\b/i
		) ||
		// patterns like: "Amounts in Millions (USD)" or "(Amounts in Millions)"
		blobNoShares.match(/amounts?\s+in\s+(billions|millions|thousands)(?:\s*(?:usd|dollars|\$))?\b/i) ||
		// parenthetical: "(in Millions)" possibly with currency
		blobNoShares.match(
			/\(\s*(?:in|amounts?\s+in)\s+(billions|millions|thousands)(?:\s*(?:usd|dollars|\$))?\s*\)/i
		);

	if (mMoney) moneyScale = scaleFromWord(mMoney[1].toLowerCase());

	return { moneyScale, shareScale };
}

// Function to decide what kind of unit to apply to the row's values given its label
export function classifyUnitFromLabel(label) {
	// 1) Light string cleanup
	const s = (label || "").toLowerCase().trim();

	// 2) Normalize common Unicode dashes to a space
	const t = s.replace(/[—–]/g, " ");

	// Per Share Units
	if (
		/\beps\b/.test(t) ||
		/\bearnings\s+per\s+share\b/.test(t) ||
		/\bdividends?\s+per\s+share\b/.test(t) ||
		/\bbook\s+value\s+per\s+share\b/.test(t) ||
		/\bper\s+(common|basic|diluted|ordinary)?\s*share(s)?\b/.test(t) ||
		/\b(per|\/)\s*share(s)?\b/.test(t) ||
		/\b(?:usd|\$)\s*\/\s*share(s)?\b/.test(t) ||
		/\bper\s+(ads|adr)\b/.test(t)
	) {
		return "perShare"; // ← key change: do not scale these by moneyScale
	}

	// Percent Units
	if (
		(/\bpercent(age)?\b/.test(t) ||
			/%/.test(t) ||
			/\bpct\b/.test(t) ||
			/\b(margin|rate|yield)\b/.test(t)) &&
		!/\bgross\s+margin\b/i.test(t)
	) {
		return "percent";
	}

	// Share Units
	if (/\bshares?\b/.test(t) && !/\bshare-?based\s+comp(ensation)?\b/.test(t)) {
		return "shares";
	}

	// Default = money as it is the majority
	return "money";
}

// Extract taxonomy from onclick/href (supports common SEC patterns).
export function extractTaxonomy(row, $) {
	// 1) Search inside row for the first <a> element with their onclick or href attribute
	const a = $(row).find("a[onclick],a[href]").first();

	// 2) If no anchor tag just return
	if (!a.length) return null;

	// 3) Combine into a string string to search
	const blob = (a.attr("onclick") || "") + " " + (a.attr("href") || "");

	// 4) 3 edge cases for which the taxonomy can be contained within...

	// defref_us-gaap_Foo
	const m1 = blob.match(/defref_([a-z0-9-]+_[\w.=+-]+)/i);
	if (m1 && !/abstract/i.test(m1[1])) return m1[1];

	// us-gaap_Foo
	const m2 = blob.match(/(us-gaap_[\w.=+-]+)/i);
	if (m2 && !/abstract/i.test(m2[1])) return m2[1];

	// defref_Anything
	const m3 = blob.match(/defref_([\w.=+-]+)/i);
	if (m3 && !/abstract/i.test(m3[1])) return m3[1];

	return null;
}
