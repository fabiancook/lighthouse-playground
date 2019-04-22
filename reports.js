import uuid from "uuid";
import assert from "assert";
import { createBrowser, createReportWithBrowser } from "./lighthouse-util.js";
import { getStore } from "./store";
import { getQueue } from "./schedule";
import { putDocument, getDocument } from "./storage";

const reportGenerationQueue = getQueue("report-generation");

reportGenerationQueue.process(1, doReportWork);

async function doReportWork(job) {
  const payload = job.data;

  if (!(payload && payload.id && payload.url)) {
    console.warn("doReportWork received invalid payload", payload);
    return job.moveToFailed("Invalid payload");
  }
  
  console.log(`Creating browser instance for ${payload.id}`);
  const browser = await createBrowser();  


  console.log(`Creating report for ${payload.id}`);
  const result = await createReportWithBrowser(
    browser,
    payload.url,
    payload.options || { output: "html" }
  );

  await browser.close();

  // Save our result ready to be retrieved by the client
  console.log(`Saving report for ${payload.id}`);

  const reportPath = `${uuid.v4()}.json`;

  await putDocument(
    reportPath, 
    Buffer.from(
      JSON.stringify(result),
      "utf-8"
    )
  )
    .catch((error) => {
      console.warn('Error while saving document', error);
      return Promise.reject(error);
    })

  const document = Object.assign({}, payload, {
    reportPath
  });

  const store = await getStore();
  await store.set(payload.id, JSON.stringify(document));
}

export async function requestGenerateReport(url, options = { output: "html" }) {
  const id = `report:${uuid.v4()}`;
  // Notice the use of JSON.stringify, levelup will accept Buffers or strings, so we want
  // to use JSON for our value
  const document = {
    id,
    url,
    options
  };
  const store = await getStore();
  await store.set(id, JSON.stringify(document));
  await reportGenerationQueue.add(document, {
    removeOnComplete: true,
    removeOnFail: true // We have no way to handle this atm 
  });
  return id;
}

export async function getReportWithResult(id) {
  const store = await getStore();
  const documentJSON = await store.get(id);
  if (!documentJSON) {
    return undefined;
  }
  const document = JSON.parse(documentJSON);
  if (!document.reportPath) {
    // Not complete
    return document;
  }
  const reportJSONBuffer = await getDocument(document.reportPath);
  if (!reportJSONBuffer) {
    throw new Error("Unable to find report result"); 
  }
  return Object.assign({}, document, { result: JSON.parse(reportJSONBuffer.toString("utf-8")) });
}