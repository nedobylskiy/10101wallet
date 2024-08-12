import { Web3 } from "web3";
import Keystorage from "./modules/Keystorage.mjs";
import EventEmitter from "events";

const FIRST_ENDPOINT = "https://cloudflare-eth.com";
const AUTOLOCK_TIMEOUT = 1000 * 30;

class EmbeddedWalletWorker extends EventEmitter {
    currentAccount = null;

    constructor(urlOrProvider) {
        super();
        this.urlOrProvider = urlOrProvider;
        this.web3 = this.web3i();
        this.locked = true;
    }

    web3i() {
        if (this.web3) {
            return this.web3;
        }

        this.web3 = new Web3(this.urlOrProvider);

        return this.web3;
    }

    async changeProvider(urlOrProvider) {
        // Security improvement: Validate the new provider URL format to ensure it's a legitimate endpoint
        this.urlOrProvider = urlOrProvider;
        delete this.web3;
        this.web3 = this.web3i();
    }

    async generateNewAccount(password = "", accountName = "mainAccount") {
        if (!password || password.trim().length === 0) {
            throw new Error("Password is required");
        }

        // Security improvement: Consider using a stronger mechanism to validate password complexity

        // Generate new account
        let account = this.web3.eth.accounts.create();
        let privateKey = account.privateKey;

        // Save it to encrypted local storage
        let encryptedKey = await Keystorage.save(privateKey, password, accountName);

        // Load it to web3 wallet
        await this.#loadWeb3AccountByPrivateKey(privateKey);

        // TODO: Security improvement: Ensure the private key is securely wiped from memory after use
        // delete account.privateKey;

        return { address: account.address, encryptedKey, privateKey };
    }

    #startAutolockTimer() {
        this.locked = false;
        if (this.autolockTimer) {
            clearTimeout(this.autolockTimer);
        }
        this.autolockTimer = setTimeout(async () => {
            console.log("Autolock");
            this.locked = true;
            await this.#unloadWeb3Account();
        }, AUTOLOCK_TIMEOUT);
    }

    async loadAccount(password, accountName = "mainAccount") {
        // Security improvement: Use more robust error handling to manage incorrect passwords or account names
        let privateKey = await Keystorage.load(password, accountName);
        await this.#loadWeb3AccountByPrivateKey(privateKey);
        this.#startAutolockTimer();
    }

    async changeAccountPassword(
        oldPassword,
        newPassword,
        accountName = "mainAccount"
    ) {
        // Security improvement: Validate new password complexity
        await Keystorage.changeEcnryptedAccountPassword(
            oldPassword,
            newPassword,
            accountName
        );
    }

    async getEncryptedAccount(accountName = "mainAccount") {
        return await Keystorage.getEncryptedAccount(accountName);
    }

    async setEncryptedAccount(encryptedKey, password, accountName = "mainAccount") {
        await Keystorage.setEncryptedAccount(encryptedKey, password, accountName);
    }

    async removeEncryptedAccount(accountName = "mainAccount") {
        return await Keystorage.removeEncryptedAccount(accountName);
    }

    async #loadWeb3AccountByPrivateKey(privateKey) {
        await this.#unloadWeb3Account(); // Unload active account to prevent key leak
        const account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
        await this.web3.eth.accounts.wallet.add(account);
        this.currentAccount = account;
    }

    async loadAccountByPrivateKey(
        privateKey,
        password = "",
        accountName = "mainAccount"
    ) {
        await this.#loadWeb3AccountByPrivateKey(privateKey);
        await Keystorage.save(privateKey, password, accountName);
        this.#startAutolockTimer();
    }

    async #unloadWeb3Account() {
        try {
            this.web3.eth.accounts.wallet.remove(this.currentAccount);
        } catch (e) {
            // Security improvement: Log the error and ensure sensitive information isn't exposed
        }
        this.currentAccount = null;
    }

    async getAddress() {
        return this.currentAccount.address;
    }

    async isAuthorized() {
        return this.currentAccount !== null;
    }

    async isLocked() {
        return this.locked;
    }

    async unlock(password) {
        if (!this.locked) {
            return;
        }

        // Security improvement: Validate the password before proceeding
        let privateKey = await Keystorage.load(password);
        await this.#loadWeb3AccountByPrivateKey(privateKey);
        await this.#startAutolockTimer();
    }

    async hasSavedAccount() {
        return (await Keystorage.getEncryptedAccount()) !== null;
    }

    async getBalance(address) {
        return await this.web3.eth.getBalance(address);
    }

    async getGasPrice() {
        // Enhancement: Add error handling for network requests
        const gasPrice = await this.web3.eth.getGasPrice();
        return this.web3.utils.toWei(
            (parseFloat(this.web3.utils.fromWei(gasPrice, "gwei")) * 1.5).toString(),
            "gwei"
        );
    }

    /**
     * Simulate RPC provider
     * @param method
     * @param params
     * @returns {Promise<*>}
     */
    async request(rpc) {
        console.log("request", arguments);
        if (!rpc.params) {
            rpc.params = [];
        }
        // Security improvement: Validate and sanitize RPC parameters to prevent injection attacks
        return await this[rpc.method](...rpc.params);
    }

    // Provider methods
    async personal_sign(message, address) {
        // Security improvement: Validate the message format and ensure the address matches the current account
        return (await this.currentAccount.sign(message)).signature;
    }

    async eth_chainId() {
        return await this.web3i().eth.getChainId();
    }

    async eth_sendTransaction({ data, from, to }) {
        // Security improvement: Validate transaction parameters before signing
        let signedTx = await this.currentAccount.signTransaction({
            ...tx,
            gasPrice: await this.getGasPrice(),
        });
        this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        return signedTx.transactionHash;
    }
}

// export default EmbeddedWallet;

let worker = new EmbeddedWalletWorker(FIRST_ENDPOINT);

class HostRPC {
    requests = {};
    methods = {};
    debug = false;

    async broadcast(message) {
        if (this.debug) {
            console.log("Broadcasting", message);
        }
        for (const client of await clients.matchAll({
            includeUncontrolled: true,
            type: "window",
        })) {
            client.postMessage(message);
        }
    }

    async request(id, method, params, event) {
        if (!params) {
            params = [];
        }
        // Console.log('Request:', id, method, params);
        if (method in this.methods) {
            let result = null;
            let error = null;
            try {
                result = await this.methods[method](...params);
                // console.log('result ok', id);
            } catch (e) {
                // console.log('result error', id, e);
                error = e;
            }

            // console.log('Boradcasting', id);
            await this.broadcast({ id, result, error });
        }
    }
}

const RPC = new HostRPC();
self.RPC = RPC;

RPC.methods = {
    eth_chainId: worker.eth_chainId.bind(worker),
    getGasPrice: worker.getGasPrice.bind(worker),
    generateNewAccount: worker.generateNewAccount.bind(worker),
    loadAccount: worker.loadAccount.bind(worker),
    getAddress: worker.getAddress.bind(worker),
    isAuthorized: worker.isAuthorized.bind(worker),
    hasSavedAccount: worker.hasSavedAccount.bind(worker),
    getBalance: worker.getBalance.bind(worker),
    getEncryptedAccount: worker.getEncryptedAccount.bind(worker),
    setEncryptedAccount: worker.setEncryptedAccount.bind(worker),
    removeEncryptedAccount: worker.removeEncryptedAccount.bind(worker),
    loadAccountByPrivateKey: worker.loadAccountByPrivateKey.bind(worker),
    changeProvider: worker.changeProvider.bind(worker),
    personal_sign: worker.personal_sign.bind(worker),
    eth_sendTransaction: worker.eth_sendTransaction.bind(worker),
    isLocked: worker.isLocked.bind(worker),
    unlock: worker.unlock.bind(worker),
    changeAccountPassword: worker.changeAccountPassword.bind(worker),
};

console.log("Worker started");

await RPC.broadcast({ rpcstarted: true });

setInterval(async () => {
    await RPC.broadcast({ rpcstarted: true });
}, 1000);

self.addEventListener("activate", (event) => {
    console.log("Wallet: Service worker activated");
    event.waitUntil(clients.claim());
    console.log("Wallet: Service worker claimed clients");
});

self.addEventListener("install", function (event) {
    console.log("Wallet: Service worker installed");
});

self.addEventListener("message", async (event) => {
    if (event.data.method) {
        await RPC.request(event.data.id, event.data.method, event.data.params, event);
    }

    // console.log('Received message:', event.data);
    // Обработка сообщения
});
