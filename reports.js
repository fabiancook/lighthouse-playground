import levelup from "levelup";
import leveldown from "leveldown";
import uuid from "uuid";
import assert from "assert";
import { createBrowser, createReportWithBrowser } from "./lighthouse-util.js";
import Jobs from "level-jobs";

export function createReportStore() {
  const database = leveldown("./store");
  return levelup(database);
}

async function doReportWork(store, payload) {
  assert(payload.id, "Expected payload to have an id");
  assert(payload.url, "Expected payload to have a url");
  
  const browser = await createBrowser();  

  const result = await createReportWithBrowser(
    browser,
    payload.url,
    payload.options || { output: "html" }
  );

  await browser.close();

  // Save our result ready to be retrieved by the client
  console.log(`Saving report for ${payload.id}`);

  const document = Object.assign({}, payload, {
    result
  });

  await store.put(payload.id, JSON.stringify(document));
}

function createReportWorker(store) {
  return (unused, payload, callback) => {
    doReportWork(store, payload)
      .then(
        () => callback(),
        (error) => callback(error)
      );
  };
}

export function createReportQueue(store) {
  const options = {
    maxConcurrency: 1
  };
  return Jobs(store, createReportWorker(store), options);
}

export async function requestGenerateReport(store, queue, url, options = { output: "html" }) {
  const id = `report:${uuid.v4()}`;
  // Notice the use of JSON.stringify, levelup will accept Buffers or strings, so we want
  // to use JSON for our value
  const document = {
    id,
    url,
    options
  };
  await store.put(id, JSON.stringify(document));
  await new Promise(
    (resolve, reject) => queue.push(document, error => error ? reject(error) : resolve())
  );
  return id;
}