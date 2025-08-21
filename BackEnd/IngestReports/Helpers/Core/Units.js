/** @format */
import { cleanText } from "./Text.js";
import { scaleFromWord } from "./Numbers.js";

// Detect money/share scales from header lines like "$ in Millions", "(in thousands)", "shares in thousands", etc.
export function detectUnitScales(headerTexts) {
	// 1) Join and normalize
	const blob = headerTexts.map(cleanText).join(" • ");

	// 2) Detect shares units first
	let shareScale = 1;
	const mShares =
		blob.match(/shares?\s+in\s+(billions|millions|thousands)\b/i) ||
		blob.match(/\(\s*shares?\s+in\s+(billions|millions|thousands)\s*\)/i);
	if (mShares) shareScale = scaleFromWord(mShares[1].toLowerCase());

	// 3) Remove the shares-in-... clause so money parsing doesn't match it
	const blobNoShares = blob.replace(/\(?\s*shares?\s+in\s+(?:billions|millions|thousands)\s*\)?/gi, "");

	// 4) Detect money units; require a currency signal ($ or USD)
	let moneyScale = 1;
	const mMoney =
		// ", $ in Millions" or "USD in Millions"
		blobNoShares.match(
			/(?:^|[,\-–—;•]\s*)(?:\$|usd)\s*(?:amounts?\s+)?in\s+(billions|millions|thousands)\b/i
		) ||
		// "Amounts in Millions (USD)" or "(Amounts in Millions)"
		blobNoShares.match(/amounts?\s+in\s+(billions|millions|thousands)(?:\s*(?:usd|dollars|\$))?\b/i) ||
		// Parenthetical "(in Millions)" possibly with currency
		blobNoShares.match(
			/\(\s*(?:in|amounts?\s+in)\s+(billions|millions|thousands)(?:\s*(?:usd|dollars|\$))?\s*\)/i
		);

	if (mMoney) moneyScale = scaleFromWord(mMoney[1].toLowerCase());

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
