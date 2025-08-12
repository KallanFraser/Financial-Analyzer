/** @format */
"use client";

/*------------------------------------------------------------------------------
                                    Imports
-------------------------------------------------------------------------------*/
import React, { useState, useEffect } from "react";
import { SearchBar } from "../components/searchbar/searchbar.jsx";
import { NavigationBar } from "../components/navigationbar/navigationbar.jsx";

/*------------------------------------------------------------------------------
                                    Page
-------------------------------------------------------------------------------*/
export default function Index() {
	const [result, setResult] = useState(null);

	const updateCompanySubmissions = async () => {
		try {
			const response = await fetch("/api/fetchparsebulkdata", {
				method: "POST",
			});
			const data = await response.json();
			setResult(data);
		} catch (error) {
			console.error("Client error:", error);
		}
	};

	return (
		<div id="landing-page">
			<NavigationBar />
			<SearchBar />
		</div>
	);
}
