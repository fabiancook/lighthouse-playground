import { createBrowser, createReportWithBrowser } from "./lighthouse-util.js";
import fs from "fs";
import Assert from "assert";

// IIFE (https://developer.mozilla.org/en-US/docs/Glossary/IIFE) so that we can use async in the top level
(async () => {
  
  const browser = await createBrowser();
  
  const result = await createReportWithBrowser(
    browser,
    "https://example.com",
    {
    	output: "html"  
    }
  );

  Assert(result.report, "No report returned");

  fs.writeFileSync("report.html", result.report, "utf-8");
  fs.writeFileSync("report.json", JSON.stringify(result, null, "  "), "utf-8");

  await browser.close();
})()
	// Catch anything that went wrong!
	.catch(console.error)
	.then(() => {
	   console.log("Finished!"); 
	});