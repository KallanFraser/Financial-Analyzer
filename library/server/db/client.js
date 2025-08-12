/** @format */
/*-------------------------------------------------------------------------------
                                Imports & Globals
--------------------------------------------------------------------------------*/
import "server-only";
import { createClient } from "@supabase/supabase-js";

let _supabase = null;
/*-------------------------------------------------------------------------------
                                    Database
--------------------------------------------------------------------------------*/
// Server only supabase client using the SERVICE ROLE key.
// DO NOT EXPOSE THIS KEY TO THE BROWSER!!!
export function getSupabase() {
	if (_supabase) return _supabase; //check if already in existence

	const url =
		process.env.SUPABASE_URL ||
		(process.env.SUPABASE_PROJECT_ID
			? `https://${process.env.SUPABASE_PROJECT_ID}.supabase.co`
			: `https://gyxtcffwkxmlljierlos.supabase.co`); // project id fallback

	//This key is required for service writes and upserts
	const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!url || !serviceKey) {
		throw new Error("Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY. Set them in server env.");
	}

	_supabase = createClient(url, serviceKey, {
		auth: { persistSession: false },
		global: { headers: { "X-Client-Info": "FinanceDecoded/1.0" } },
	});

	return _supabase;
}
