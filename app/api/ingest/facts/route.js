/** @format */
/*-------------------------------------------------------------------------------
                                Imports & Globals
--------------------------------------------------------------------------------*/
import { NextResponse } from "next/server";
import { runFactsIngest } from "../../../../library/server/ingest/facts/runfacts.js";

export const runtime = "nodejs";

/*-------------------------------------------------------------------------------
                                Main POST function
--------------------------------------------------------------------------------*/
export async function POST(req) {
	// 1) extract the authorization header
	const auth = req.headers.get("authorization");

	// 2) check if the authorization header matches our admin token
	if (auth !== `Bearer ${process.env.ADMIN_TOKEN}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	// 3) if it does, run the company submissions bulk ingestion routine
	try {
		const stats = await runFactsIngest();
		return NextResponse.json({ success: true, stats });
	} catch (err) {
		console.error("Processing error:", err);
		return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
	}
}
