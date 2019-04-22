import Queue from "bull";

export function createQueue(name) {
	return Queue(name, process.env.REDIS_URL);
}

export const getQueue = (() => {
  const queues = {};
  
  return (name) => {
   	if (queues[name]) {
    	return queues[name]; 
    }
    // Retain our queue so we don't create multiple of the same queue
    // it won't be a big problem, we just don't want to create too mant redis clients
    queues[name] = createQueue(name);
    return queues[name];
  }
})();
