import {Web3} from "web3";
import Keystorage from "./modules/Keystorage.mjs";
import {createConnector} from "@wagmi/core";
import EventEmitter from 'events';
import ClientPageRPC from "./modules/ClientPageRPC.mjs";

const SERVICE_WORKER_URL = '/dist/service-worker.js';

class EmbeddedWalletOld extends EventEmitter {
    currentAccount = null;

    constructor(urlOrProvider) {
        super();
        this.web3 = new Web3(urlOrProvider);
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

//The RPCied version of the class
class EmbeddedWallet extends EventEmitter {
    constructor(urlOrProvider) {
        super();
        this.urlOrProvider = urlOrProvider;
        this.inited = false;
    }

    ifInitialized() {
        this.inited = true;
    }

    async init() {
        if (this.inited) {
            return this.RPC;
        }
        this.inited = true;
        if ('serviceWorker' in navigator) {
            try {
                console.log('Wallet: Service worker registration...');
                const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL);
                console.log('Wallet: Service worker registered:', registration);

                this.RPC = new ClientPageRPC(registration);
                window.RPC = this.RPC;

                await this.RPC.waitForActive();

                await this.changeProvider(this.urlOrProvider);



                return this.RPC;

            } catch (error) {
                console.error('Wallet: Service worker registration failed:', error);
                throw error;
            }

        }
    }

    async changeProvider(urlOrProvider) {
        //console.log('!!!changeProvider', urlOrProvider);
        this.urlOrProvider = urlOrProvider;
        return await this.RPC.request('changeProvider', [urlOrProvider]);
    }

    async eth_chainId() {
        return await this.RPC.request('eth_chainId');
    }

    async getGasPrice() {
        return await this.RPC.request('getGasPrice');
    }

    async getBalance(address) {
        return await this.RPC.request('getBalance', [address]);
    }

    async getAddress() {
        return await this.RPC.request('getAddress');
    }

    async isAuthorized() {
        return await this.RPC.request('isAuthorized');
    }

    async hasSavedAccount() {
        return await this.RPC.request('hasSavedAccount');
    }

    async getEncryptedAccount() {
        return await this.RPC.request('getEncryptedAccount');
    }

    async setEncryptedAccount(encryptedKey, password, accountName = 'mainAccount') {
        return await this.RPC.request('setEncryptedAccount', [encryptedKey, password, accountName]);
    }

    async loadAccountByPrivateKey(privateKey, password = '', accountName = 'mainAccount') {
        return await this.RPC.request('loadAccountByPrivateKey', [privateKey, password, accountName]);
    }

    async loadAccount(password, accountName = 'mainAccount') {
        return await this.RPC.request('loadAccount', [password, accountName]);
    }

    async generateNewAccount(password = '', accountName = 'mainAccount') {
        return await this.RPC.request('generateNewAccount', [password, accountName]);
    }


    async personal_sign(message, address) {
        this.emit('personal_sign_request', {message, address});

        try {
            await new Promise((resolve, reject) => {
                this.once('personal_sign_approved', resolve);
                this.once('personal_sign_rejected', () => {
                    reject(new Error('User rejected the sign request.'));
                });
            });

            return await this.RPC.request('personal_sign', [message, address]);
        } catch (error) {
            console.error('Error during personal sign:', error);
            throw error;
        }
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

            return await this.RPC.request('eth_sendTransaction', [{data, from, to}]);
        } catch (error) {
            console.error('Error during transaction send:', error);
            throw error;
        }
    }

    async request(rpc) {
        console.log('request', arguments);
        if (!rpc.params) {
            rpc.params = [];
        }
        return await this[rpc.method](...rpc.params);
    }
}

export default EmbeddedWallet;

let wallet = new EmbeddedWallet(SERVICE_WORKER_URL);

if(window){
    if(!window.web310101Wallet) {
        window.web310101Wallet = wallet;
    }else{
        wallet = window.web310101Wallet;
    }
}




export function embedded10101WalletConnector({
                                                 network,
                                                 chains,
                                                 options
                                             }) {
    console.log('embedded10101WalletConnector', network, chains, options);
    console.log(network.rpcUrls.default.http);
    //let wallet = new EmbeddedWallet(network.rpcUrls.default.http[0]);


    let id = 'embedded10101';
    let name = 'Embedded 10101';
    let type = 'wallet';


    return createConnector(async (config) => {

        await wallet.init();
        return {
            id,
            name,
            type,
            getProvider: async function () {
                return wallet;
            },
            connect: async function () {
                console.log('connect');

                await wallet.init();


                try {
                    if (await wallet.hasSavedAccount()) {
                        wallet.emit('password_request');

                        const password = await new Promise((resolve, reject) => {
                            wallet.once('password_provided', resolve);
                            wallet.once('password_rejected', () => {
                                reject(new Error('User rejected the password request.'));
                            });
                        });

                        try {
                            await wallet.loadAccount(password);
                        } catch (e) {
                            console.error('Invalid password', e);
                            throw e;
                        }
                    } else {
                        wallet.emit('account_action_request');

                        const {action, privateKey, password} = await new Promise((resolve, reject) => {
                            wallet.once('account_action_provided', resolve);
                            wallet.once('account_action_rejected', () => {
                                reject(new Error('User rejected the account action request.'));
                            });
                        });

                        if (action === 'generate') {
                            const generatedAccount = await wallet.generateNewAccount(password);
                            wallet.emit('private_key_provided', generatedAccount.privateKey);
                        } else if (action === 'import') {
                            await wallet.loadAccountByPrivateKey(privateKey, password);
                        } else {
                            throw new Error("Invalid action. Please provide 'generate' or 'import'.");
                        }
                    }

                    return {
                        accounts: [await wallet.getAddress()],
                        chainId: await wallet.eth_chainId()
                    };

                } catch (e) {
                    console.error('Error during connect', e);
                    throw e;
                }
            },
            getAccounts: async function () {
                return [await wallet.getAddress()];
            },
            onConnect: async function () {
            },
            disconnect: async function () {
            },
            isAuthorized: async function () {
                return await wallet.isAuthorized();
            },
            onDisconnect: async function () {
            },
            getChainId: async function () {
                return await wallet.eth_chainId();
            },
            onAccountsChanged: async function () {
            },
            onMessage: async function () {
                console.log('onMessage', arguments);
            },
            switchChain: async function () {

            }

        }
    })
}
