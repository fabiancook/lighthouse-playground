import uuid from "uuid";
import assert from "assert";
import { createBrowser, createReportWithBrowser } from "./lighthouse-util.js";
import { getStore } from "./store";
import { getQueue } from "./schedule";
import { putDocument, getDocument, removeDocument } from "./storage";

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

  const currentReport = await getReport(payload.id);
  if (!(currentReport && currentReport.id)) {
    // We must have deleted the report while the job was processing
    // So remove everything
    await removeReport(payload.id)
      .catch(() => {});
    return job.remove()
      .catch(() => {}); // No longer valid
  }

  const document = Object.assign({ results: [] }, currentReport);
  document.results.push({
    id: uuid.v4(),
    path: reportPath,
    createdAt: new Date().toISOString()
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
  const queueOptions = {
    jobId: id,
    removeOnComplete: true,
    removeOnFail: true // We have no way to handle this atm 
  };
  const allowedOptions = [
    "repeat",
    "backoff",
    "attempts",
    "delay"
  ];
  allowedOptions
    // Add if the options has that key
    .filter(key => options.hasOwnProperty(key))
    .forEach(
      key => queueOptions[key] = options[key]
    );
  await reportGenerationQueue.add(document, queueOptions);
  return id;
}

export async function getReport(id) {
  const store = await getStore();
  const documentJSON = await store.get(id);
  if (!documentJSON) {
    return undefined;
  }
  return JSON.parse(documentJSON);
}

export async function getReportResult(id, resultId, document = undefined) {
  document = document || await getReport(id);
  if (!(document || Array.isArray(document.results))) {
    return undefiend;
  }
  return document.results
    .find(({ id }) => id === resultId);
}

export async function getReportResultDocument(id, resultId) {
  const result = await getReportResult(id, resultId);
  if (!result) {
    return undefined;
  }
  const reportJSONBuffer = await getDocument(result.path);
  if (!reportJSONBuffer) {
    throw new Error("Unable to find report result"); 
  }
  return JSON.parse(reportJSONBuffer.toString("utf-8"));
}

export async function removeReportResult(id, resultId) {
  const document = await getReport(id);
  const result = await getReportResult(id, resultId, document);
  if (!result) {
    return false;
  }
  await removeDocument(result.path);
  const newDocument = Object.assign({}, document, {
    results: document.results
      // Filter out our result
      .filter(({ id }) => id !== resultId)
  });
  const store = await getStore();
  await store.set(id, JSON.stringify(newDocument));
  return true;
}

export async function removeReport(id) {
  const document = await getReport(id);
  if (!document) {
    return false;
  }
  const store = await getStore();
  let promises = [];
  if (document.results) {
    promises = promises.concat(
      document.results.map(({ path }) => removeDocument(path))
    );
  }
  promises.push(store.del(id));
  async function removeQueueJob() {
    const job = await reportGenerationQueue.getJob(id);
    if (!job) {
      return; // Already completed
    }
    // This may throw an error, but I'm unsure what to do with that atm, we should probably 
    // do this function first so we can handle it
    await job.remove();
  }
  promises.push(removeQueueJob);
  await Promise.all(promises);
  return true;
}

export async function listReports() {
  const store = await getStore();
  const keys = await store.keys("report:*");
  return Promise.all(
    keys.map(key => getReport(key))
  );
}
