/** @format */
/*-------------------------------------------------------------------------------
                                Imports & Globals
--------------------------------------------------------------------------------*/
import { createClient } from "@supabase/supabase-js"; // Pull in the official client
let _supabase = null; // Module scoped so as to cache
/*-------------------------------------------------------------------------------
                                    Database
--------------------------------------------------------------------------------*/
// Function to create client or return it if already in existence
export const getSupabase = () => {
	// 1) Check if we already created it, if so just return it to the code asking
	if (_supabase) return _supabase;

	// 2) Use url from env, else create it using project id as a fallback
	const url =
		process.env.SUPABASE_URL ||
		(process.env.SUPABASE_PROJECT_ID
			? `https://${process.env.SUPABASE_PROJECT_ID}.supabase.co`
			: `https://gyxtcffwkxmlljierlos.supabase.co`);

	// 3) Grab the service key (has superpowers = read, write, etc)
	const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

	// 4) Quick debugging check
	if (!url || !serviceKey) {
		// Execution will stop immediately, throw the excepetion object, and crash the program
		throw new Error("Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY. Set them in server env.");
	}

	// 5) Build the client
	// persistSession: false = server code will not stash auth sessions
	// header = for identification
	_supabase = createClient(url, serviceKey, {
		auth: { persistSession: false },
		global: { headers: { "X-Client-Info": "FinanceDecoded/1.0" } },
	});

	// 6) Return the initialized client
	return _supabase;
};
