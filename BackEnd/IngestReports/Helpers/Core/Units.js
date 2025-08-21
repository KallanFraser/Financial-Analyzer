/** @format */
import { cleanText } from "./Text.js";
import { scaleFromWord } from "./Numbers.js";

// Detect money/share scales from header lines like "$ in Millions", "(in thousands)", "shares in thousands", etc.
export function detectUnitScales(headerTexts, opts = {}) {
	const layout = opts.layout || null;

	// Normalize and join all header lines we collected
	const blob = headerTexts
		.map((t) => cleanText(String(t || "")))
		.filter(Boolean)
		.join(" • ");

	// Shares (skip for cashflow entirely)
	let shareScale = 1;
	if (layout !== "cashflow") {
		const mShares =
			blob.match(/shares?\s+in\s+(billions|millions|thousands)\b/i) ||
			blob.match(/\(\s*shares?\s+in\s+(billions|millions|thousands)\s*\)/i);
		if (mShares) shareScale = scaleFromWord(mShares[1].toLowerCase());
	}

	// Remove "shares in ..." so money regex can't be confused by it
	const blobNoShares = blob.replace(/\(?\s*shares?\s+in\s+(?:billions|millions|thousands)\s*\)?/gi, "");

	// Money scale:
	// Try the common phrasings first, then accept "USD ($) $ in Millions" and finally a safe "\bin millions\b".
	let moneyScale = 1;
	let match = null;

	const patterns = [
		// "$ in millions" or "USD in millions"
		/(?:^|[,\-–—;•]\s*)(?:\$|usd)\s*(?:amounts?\s+)?in\s+(billions|millions|thousands)\b/i,

		// "(in millions)" or "(amounts in millions)"
		/\(\s*(?:in|amounts?\s+in)\s+(billions|millions|thousands)(?:\s*(?:usd|dollars|\$))?\s*\)/i,

		// "amounts in millions"
		/amounts?\s+in\s+(billions|millions|thousands)(?:\s*(?:usd|dollars|\$))?\b/i,

		// Apple-style: "USD ($) $ in Millions" (allow a few non-letters between USD/$ and "in")
		/\b(?:usd|\$)[^a-zA-Z]{0,12}\bin\s+(billions|millions|thousands)\b/i,

		// Last-resort: plain "in millions" (word boundary avoids matching "beginning")
		/\bin\s+(billions|millions|thousands)\b/i,
	];

	for (const re of patterns) {
		match = blobNoShares.match(re);
		if (match) {
			moneyScale = scaleFromWord(match[1].toLowerCase());
			break;
		}
	}

	return { moneyScale, shareScale };
}

// Decide the unit class for a row based on its label: "perShare" | "percent" | "shares" | "money"
export function inferUnitClass(label) {
	const s = (label || "").toLowerCase().trim();
	const t = s.replace(/[—–]/g, " "); // normalize dashes

	// Per Share
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
		return "perShare"; // do not scale per-share by moneyScale
	}

	// Percent
	if (
		(/\bpercent(age)?\b/.test(t) ||
			/%/.test(t) ||
			/\bpct\b/.test(t) ||
			/\b(margin|rate|yield)\b/.test(t)) &&
		!/\bgross\s+margin\b/i.test(t)
	) {
		return "percent";
	}

	// Shares
	if (/\bshares?\b/.test(t) && !/\bshare-?based\s+comp(ensation)?\b/.test(t)) {
		return "shares";
	}

	// Default: money
	return "money";
}
