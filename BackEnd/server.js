/** @format */
//Node Library imports
import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import axios from "axios";

//File system variables
const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);

// Tell dotenv to load the .env file from the project root (one level up)
dotenv.config({ path: path.join(currentDirectory, "..", ".env") });

//Express App Setup
const app = express();
app.use(express.json()); //Lets express routes understand JSON payloads from the front end.
app.use(cors()); //Must be called before routes are defined
const PORT = 3000;

//Function Imports
import { runIngestReports } from "./IngestReports/IngestReports.js";

//Server start point
app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
	runIngestReports("0000320193");
});
