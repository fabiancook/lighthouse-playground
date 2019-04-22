import { createReportQueue, createReportStore, requestGenerateReport } from "./reports.js";

// IIFE (https://developer.mozilla.org/en-US/docs/Glossary/IIFE) so that we can use async in the top level
(async () => {
  
  const store = createReportStore();
  const queue = createReportQueue(store);

  await requestGenerateReport(store, queue, "https://example.com");
  await requestGenerateReport(store, queue, "https://example.com");
  await requestGenerateReport(store, queue, "https://example.com");
  await requestGenerateReport(store, queue, "https://example.com");

})()
	// Catch anything that went wrong!
	.catch(console.error)
	.then(() => {
	   console.log("Finished!"); 
	});