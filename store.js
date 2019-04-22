import { createClient } from "redis";
import { promisify } from "util";

function getPromiseClient(client) {
  client.set = promisify(client.set.bind(client));
  client.get = promisify(client.get.bind(client));
  client.del = promisify(client.del.bind(client));
  client.keys = promisify(client.keys.bind(client));
  return client;
}

export const getStore = (() => {
  let singletonClient;
  return async () => {
    // Already created, no need to try and make another
   	if (singletonClient) {
     	return singletonClient; 
    }
    const options = {
      // Include in the case that its passed, else will default to local
      url: process.env.REDIS_URL
    };
    // Create a local variable that we will use later on to reset our client
    // if we run into issues
    const client = getPromiseClient(createClient(options));
    // We want to reset the client if we run into an issue that we can't handle, or for some reason our client was closed
    function onReset() {
      // Remove our listeners so this function is cleaned up 
      client.removeListener("error", onReset);
      client.removeListener("end", onReset);
      if (singletonClient !== client) {
       	// This client is no longer the singletonClient, so don't try and reset it
        return;
      }
      // Reset the client
      singletonClient = undefined;
    }
    client.once("error", onReset);
    client.once("end", onReset);
    
    // Set our singleton client as a promise that resolves once we have a connection
   	// This means when the next caller comes along we won't need to wait for the same process
    const connectedPromise = new Promise(
      (resolve, reject) => {
        function reset() {
          // Remove all our listeners
          client.removeListener("error", onError);
     			client.removeListener("connect", onReset);
        }
        function onError(error) {
          reset(); // Remove listeners
          reject(error);
        }
        function onConnect() {
          reset(); // Remove listeners
          // Resolve this promise with our client, so whoever is waiting will get the clientr rather than just waiting for a connection
          resolve(client); 
        }
        client.once("error", onError);
        client.once("connect", onConnect);
      }
    );
    singletonClient = connectedPromise;
    await connectedPromise;
    if (singletonClient === connectedPromise) {
      // If we're still the primary client, get rid of the promise
      // and replace the singleton with the client directly
    	singletonClient = client;
    }
    return client;
  }
})();