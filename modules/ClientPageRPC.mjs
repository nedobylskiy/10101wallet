export default class ClientPageRPC {
    requests = {};
    isActive = false;

    constructor(registration) {
        this.registration = registration;
        navigator.serviceWorker.addEventListener('message', async (event) => {
           // console.log('Message from service worker:', event.data);
            await this.processIncomeMessage(event.data);
        });
    }

    async processIncomeMessage(data) {
        if (data.rpcstarted && !this.isActive) {
            console.log('RPC started');
            this.isActive = true;
        }
        if (data.id && this.requests[data.id]) {
            if (data.error) {
                this.requests[data.id].reject(data.error);
            } else {
                this.requests[data.id].resolve(data.result);
            }
            delete this.requests[data.id];
        }
    }

    async request(method, params) {
        let id = Math.random().toString(36);
        let request = {id, method, params};
        let response = new Promise((resolve, reject) => {
            this.requests[id] = {resolve, reject};
        });
        this.registration.active.postMessage(request);
        return response;
    }

    async waitForActive(timeout = 10000) {
        return new Promise((resolve, reject) => {
            let timeoutId = setTimeout(() => {
                reject(new Error('Timeout'));
            }, timeout);
            let intervalId = setInterval(() => {
                if (this.isActive) {
                    clearInterval(intervalId);
                    clearTimeout(timeoutId);
                    resolve();
                }
            }, 100);
        });
    }


}
