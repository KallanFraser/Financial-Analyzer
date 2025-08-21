/** @format */

/*-------------------------------------------------------------------------------
                                    Imports
--------------------------------------------------------------------------------*/
import "server-only"; //tells next.js this module must never be bundled into the client
import unzipper from "unzipper"; //library that parses ZIP archives as a stream. We feed it bytes, it emits entries without loading the whole zip into memory
import { PassThrough } from "stream"; //Node;s stream, we use it to bridge web streams to node streams

/*-------------------------------------------------------------------------------
                                    Main
--------------------------------------------------------------------------------*/
//Async function that takes a stream of zip data and a a callback for each file.
export async function processZipStream(zipNodeStream, onFile) {
	//Promise is for the whole ZIP to complete once we finished processing all files.
	await new Promise((resolve, reject) => {
		const parser = unzipper.Parse();
		//Keeps track of promises for each file.
		//Outer promise does not resolve untill all these per file tasks settle
		const pending = [];
		zipNodeStream.pipe(parser);

		parser
			.on("entry", (fileEntry) => {
				// 1) Skips no files. i.e directories.
				// autodrain = consumes and discards the entry so stream can continue
				if (fileEntry.type !== "File") return fileEntry.autodrain();

				// 2) Consume only JSON files (there are some random README's we want to ignore)
				const p = (fileEntry.path || "").toLowerCase();
				if (!p.endsWith(".json")) return fileEntry.autodrain(); // <-- skip non-JSON

				// 3) Process File
				// buffer = loads the file fully into memory.
				// after we buffer we call the onFile parser to parse the file (lives in parsecompanyfile.js)
				const job = fileEntry
					.buffer()
					.then((buffer) => onFile(fileEntry.path, buffer))
					.catch((err) => console.error(`Error buffering ${fileEntry.path}:`, err));
				pending.push(job);
			})
			.on("close", async () => {
				// 4) waits for all file promises to settle
				await Promise.allSettled(pending);
				//resolves the outer promise
				resolve();
			})
			.on("error", reject);
	});
}

/*-------------------------------------------------------------------------------
                                    Helper
--------------------------------------------------------------------------------*/
//Takes the web stream returned from fetch() and converts it to a node stream
//This is because unzipper library only works with node streams and not web streams
export function webToNodeStream(webStream) {
	const pass = new PassThrough(); //the stream we will write into
	const reader = webStream.getReader(); //the stream we will read chunks from

	(async function pump() {
		try {
			while (true) {
				const { done, value } = await reader.read(); // reads chunks from web stream
				if (done) {
					//if reached end of web stream, complete
					pass.end();
					break;
				}
				pass.write(Buffer.from(value)); //write the chunk
			}
		} catch (err) {
			pass.destroy(err);
		}
	})();
	return pass; //returns a node readable stream
}
