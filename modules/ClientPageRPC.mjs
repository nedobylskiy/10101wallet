export default class ClientPageRPC {
    requests = {}; // Stores pending requests
    isActive = false; // Indicates if the service worker is active

    constructor(registration) {
        this.registration = registration;

        // Set up a message listener for communication with the service worker
        navigator.serviceWorker.addEventListener('message', async (event) => {
            // Process incoming messages from the service worker
            await this.processIncomeMessage(event.data);
        });
    }

    /**
     * Processes messages received from the service worker.
     * @param {Object} data - The data received from the service worker.
     */
    async processIncomeMessage(data) {
        if (data.rpcstarted && !this.isActive) {
            console.log('RPC started');
            this.isActive = true;
        }

        if (data.id && this.requests[data.id]) {
            if (typeof window !== 'undefined' && window.debug) {
                console.log('RPC Response:', data.id, data.result, data.error);
            }
            if (data.error) {
                this.requests[data.id].reject(data.error);
            } else {
                this.requests[data.id].resolve(data.result);
            }
            delete this.requests[data.id]; // Clean up after processing
        }
    }

    /**
     * Sends an RPC request to the service worker.
     * @param {string} method - The RPC method to call.
     * @param {Array} params - The parameters for the RPC method.
     * @returns {Promise} - A promise that resolves with the RPC response or rejects with an error.
     */
    async request(method, params) {
        let id = Math.random().toString(36).substr(2); // Generate a unique request ID
        if (typeof window !== 'undefined' && window.debug) {
            console.log('RPC Request:', id, method, params);
        }
        let request = { id, method, params };
        let response = new Promise((resolve, reject) => {
            this.requests[id] = { resolve, reject };
        });
        this.registration.active.postMessage(request); // Send the request to the service worker
        return response;
    }

    /**
     * Waits for the service worker to become active.
     * @param {number} timeout - The maximum time to wait in milliseconds.
     * @returns {Promise} - A promise that resolves when the service worker becomes active or rejects on timeout.
     */
    async waitForActive(timeout = 10000) {
        return new Promise((resolve, reject) => {
            let timeoutId = setTimeout(() => {
                reject(new Error('Timeout')); // Reject the promise if timeout is reached
            }, timeout);
            let intervalId = setInterval(() => {
                if (this.isActive) {
                    clearInterval(intervalId);
                    clearTimeout(timeoutId);
                    resolve(); // Resolve the promise when the service worker is active
                }
            }, 100);
        });
    }
}
