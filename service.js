import express from "express";
import { requestGenerateReport, getReport, removeReport, getReportResultDocument, removeReportResult, listReports } from "./reports.js";
import assert from "assert";
import { getStore } from "./store";
import { asyncHandler } from "./handler";

const app = express();

app.post("/report", express.json(), asyncHandler(async (request, response) => {
  if (!Array.isArray(request.body)) {
    return response.sendStatus(400); // Bad request, we expected an array
  }
  const identifiers = await Promise.all(
    request.body.map(async ({ url, options }) => {
      assert(typeof url === "string", "Expected url to be provided");
      // We want to return an array for each item so we can match up the url
      return [
        url,
        await requestGenerateReport(
          url,
          options
        ) 
      ];
    })
  );
  response.json(identifiers);
}));

app.get("/report/:id", asyncHandler(async (request, response) => {
  const report = await getReport(request.params.id);
  if (!report) {
    return response.sendStatus(404); // We couldn't find it
  }
  response.set("Content-Type", "application/json");
  // report here is a JSON string
  return response.send(report);
}));

app.get("/report/:id/result/:resultId", asyncHandler(async (request, response) => {
  const result = await getReportResultDocument(request.params.id, request.params.resultId);
  if (!result) {
    return response.sendStatus(404);
  }
  if (request.query.html) {
    response.set("Content-Type", "text/html");
    // result.report is an HTML string
    return response.send(result.report);
  } else {
    // JSON by default with all the contents
    response.set("Content-Type", "application/json");
    return response.send(result);
  }
}));

app.delete("/report/:id", asyncHandler(async (request, response) => {
  const foundAndDeleted = await removeReport(request.params.id);
  response.sendStatus(foundAndDeleted ? 204 : 404);
}));

app.delete("/report/:id/result/:resultId", asyncHandler(async (request, response) => {
  const foundAndDeleted = await removeReportResult(request.params.id, request.params.resultId);
  response.sendStatus(foundAndDeleted ? 204 : 404);
}));

app.get("/report", asyncHandler(async (request, response) => {
  response.json(await listReports());
}))

app.get("/", (request, response) => response.sendFile(`${process.cwd()}/index.html`));

// IIFE so we don't need to define `port` as `let` ¯\_(ツ)_/¯
const port = (() => {
  if (/^\d+$/.test(process.env.PORT)) {
    return +process.env.PORT;  
  }
  // Maybe you have other defaults you want to check here to decide on the port
  return 8080;
})();

app.listen(port, () => console.log(`Listening on port ${port}`));