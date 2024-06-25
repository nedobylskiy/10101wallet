import {Web3} from "web3";
import Keystorage from "./modules/Keystorage.mjs";
import EventEmitter from 'events';

class EmbeddedWalletWorker extends EventEmitter {
    currentAccount = null;

    constructor(urlOrProvider) {
        super();
        this.web3 = this.web3i;
        this.urlOrProvider = urlOrProvider;
    }

    get web3i() {
        if (this.web3) {
            return this.web3;
        }

        this.web3 = new Web3(this.urlOrProvider);
    }

    async changeProvider(urlOrProvider) {
        this.urlOrProvider = urlOrProvider;
        delete this.web3;
        this.web3 = this.web3i;
    }

    async generateNewAccount(password = '', accountName = 'mainAccount') {
        if (!password || password.trim().length === 0) {
            throw new Error('Password is required');
        }

        //Generate new account
        let account = this.web3.eth.accounts.create();
        let privateKey = account.privateKey;

        //Save it to encrypted local storage
        let encryptedKey = await Keystorage.save(privateKey, password, accountName);

        //Load it to web3 wallet
        await this.#loadWeb3AccountByPrivateKey(privateKey);

        //delete account.privateKey; //TODO в будущем надо будет удалять приватный ключ из объекта

        return {...account, encryptedKey, privateKey};
    }

    async loadAccount(password, accountName = 'mainAccount') {
        let privateKey = await Keystorage.load(password, accountName);
        await this.#loadWeb3AccountByPrivateKey(privateKey);
    }

    async getEncryptedAccount(accountName = 'mainAccount') {
        return await Keystorage.getEncryptedAccount(accountName);
    }

    async setEncryptedAccount(encryptedKey, password, accountName = 'mainAccount') {
        await Keystorage.setEncryptedAccount(encryptedKey, password, accountName);
    }

    async #loadWeb3AccountByPrivateKey(privateKey) {
        await this.#unloadWeb3Account(); //Unload active account to prevent key leak
        const account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
        await this.web3.eth.accounts.wallet.add(account);
        this.currentAccount = account;
    }

    async loadAccountByPrivateKey(privateKey, password = '', accountName = 'mainAccount') {
        await this.#loadWeb3AccountByPrivateKey(privateKey);
        await Keystorage.save(privateKey, password, accountName);
    }

    async #unloadWeb3Account() {
        try {
            this.web3.eth.accounts.wallet.remove(this.currentAccount);
        } catch (e) {
        }
        this.currentAccount = null;
    }


    async getAddress() {
        return this.currentAccount.address;
    }

    async isAuthorized() {
        return this.currentAccount !== null;
    }

    async hasSavedAccount() {
        return (await Keystorage.getEncryptedAccount()) !== null;
    }

    async getBalance(address) {
        return await this.web3.eth.getBalance(address);
    }

    async getGasPrice() {
        const gasPrice = await this.web3.eth.getGasPrice();
        return this.web3.utils.toWei((parseFloat(this.web3.utils.fromWei(gasPrice, 'gwei')) * 1.5).toString(), 'gwei');
    }

    /**
     * Simulate RPC provider
     * @param method
     * @param params
     * @returns {Promise<*>}
     */
    async request(rpc) {
        console.log('request', arguments);
        if (!rpc.params) {
            rpc.params = [];
        }
        return await this[rpc.method](...rpc.params);
    }


    //Provider methods
    async personal_sign(message, address) {
        this.emit('personal_sign_request', {message, address});

        try {
            await new Promise((resolve, reject) => {
                this.once('personal_sign_approved', resolve);
                this.once('personal_sign_rejected', () => {
                    reject(new Error('User rejected the sign request.'));
                });
            });

            return (await this.currentAccount.sign(message)).signature;
        } catch (error) {
            console.error('Error during personal sign:', error);
            throw error;
        }
    }

    async eth_chainId() {
        return await this.web3.eth.getChainId();
    }

    async eth_sendTransaction({data, from, to}) {
        this.emit('eth_sendTransaction_request', {data, from, to});

        try {
            const tx = await new Promise((resolve, reject) => {
                this.once('eth_sendTransaction_approved', resolve);
                this.once('eth_sendTransaction_rejected', () => {
                    reject(new Error('User rejected the transaction request.'));
                });
            });

            let signedTx = await this.currentAccount.signTransaction({...tx, gasPrice: await this.getGasPrice()});
            this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);

            return signedTx.transactionHash;
        } catch (error) {
            console.error('Error during transaction send:', error);
            throw error;
        }
    }
}

//export default EmbeddedWallet;

let worker = new EmbeddedWalletWorker('http://localhost:8545');


class HostRPC {
    requests = {};
    methods = {
        async test() {
            return 'test';
        }
    };

    async broadcast(message) {
        for (const client of await clients.matchAll({includeUncontrolled: true, type: 'window'})) {
            client.postMessage(message);
        }
    }

    async request(id, method, params, event) {
        if(!params){
            params = [];
        }
        console.log('Request:', id, method, params);
        if (method in this.methods) {
            let result = null;
            let error = null;
            try {
                result = await this.methods[method](...params);
            } catch (e) {
                error = e;
            }

            await this.broadcast({id, result, error});

        }
    }
}

const RPC = new HostRPC();


console.log('Worker started');

await RPC.broadcast({rpcstarted: true})

setInterval(async () => {
    await RPC.broadcast({rpcstarted: true});
}, 1000);

self.addEventListener('activate', event => {
    console.log('Service worker activated');
    event.waitUntil(clients.claim());
    console.log('Service worker claimed clients');
});

self.addEventListener('install', function (event) {
    console.log('Service worker installed');
});

self.addEventListener('message', async event => {

    if (event.data.method) {
        await RPC.request(event.data.id, event.data.method, event.data.params, event);
    }

   // console.log('Received message:', event.data);
    // Обработка сообщения
});
