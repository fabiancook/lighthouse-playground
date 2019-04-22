import { writeFile, readFile, mkdir, unlink } from "fs";
import { join, basename, dirname } from "path";
import { promisify } from "util";

function getPath(name) {
	// Use basename to ensure the name isn't a reference to a seperate directory
	return join("./documents/", basename(name));
}

export async function putDocument(name, buffer) {
	const path = getPath(name);
	console.log(path);
	// Ensure the directory exists
	await promisify(mkdir)(dirname(path))
		// Catch if exists
		.catch(() => {});
	await promisify(writeFile)(path, buffer);
}

export function getDocument(name) {
	const path = getPath(name);
	return promisify(readFile)(path)
		// Return undefined if we ran into an issue
		.catch(() => {});
}

export function removeDocument(name) {
 	const path = getPath(name);
  	return promisify(unlink)(path)
		// Return undefined if we ran into an issue
		.catch(() => {});
}