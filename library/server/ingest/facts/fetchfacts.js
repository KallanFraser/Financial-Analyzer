/** @format */
/*-------------------------------------------------------------------------------
                                  Imports & Globals
--------------------------------------------------------------------------------*/
import "server-only";

/*-------------------------------------------------------------------------------
                                    Function
--------------------------------------------------------------------------------*/
export async function fetchFacts(url, init = {}) {
	//SEC Edgar requires we set specific headers hence we do so here
	const headers = new Headers(init.headers || {});
	headers.set("User-Agent", "FinanceDecoded/1.0 (kallanfraser@icloud.com)");
	headers.set("Accept-Encoding", "gzip, deflate");
	return fetch(url, { ...init, headers });
}
