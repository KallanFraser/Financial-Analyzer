/** @format */
// Extract GAAP taxonomy code (common SEC patterns) from a row's <a> onclick/href.
export function extractTaxonomy(row, $) {
	const a = $(row).find("a[onclick],a[href]").first();
	if (!a.length) return null;

	const blob = (a.attr("onclick") || "") + " " + (a.attr("href") || "");

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
