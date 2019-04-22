import express from "express";
import { createReportQueue, createReportStore, requestGenerateReport } from "./reports.js";
import assert from "assert";

const app = express();

// Allows us to grab these within our request handlers
app.locals.store = createReportStore();
app.locals.queue = createReportQueue(app.locals.store);

app.post("/report", express.json(), (request, response, next) => {
  if (!Array.isArray(request.body)) {
    return response.sendStatus(400); // Bad request, we expected an array
  }
  Promise.all(
    request.body.map(async ({ url, options }) => {
      assert(typeof url === "string", "Expected url to be provided");
      // We want to return an array for each item so we can match up the url
      return [
        url,
        await requestGenerateReport(
          request.app.locals.store,
          request.app.locals.queue,
          url,
          options
        ) 
      ];
    })
  )
    .then(identifiers => response.send(identifiers))
    // Catch any errors and allow express to handle it
    .catch(next);
});

app.get("/report/:id", (request, response, next) => {
  request.app.locals.store
    .get(request.params.id)
    .then(report => {
      if (!report) {
        return response.sendStatus(404); // We couldn't find it
      }
      return response.send(report);
    })
    // Catch any errors and allow express to handle it
    .catch(next);
});

app.delete("/report/:id", (request, response, next) => {
    request.app.locals.store
    .get(request.params.id)
    .then(report => {
      if (!report) {
        return response.sendStatus(404); // We couldn't find it, may have already been deleted
      }
      return app.locals.store
        .del(request.params.id)
        .then(() => response.sendStatus(204)); // All deleted
    })
    // Catch any errors and allow express to handle it
    .catch(next);
});

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