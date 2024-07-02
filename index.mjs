import {Web3} from "web3";
import Keystorage from "./modules/Keystorage.mjs";
import {createConnector} from "@wagmi/core";
import EventEmitter from 'events';
import ClientPageRPC from "./modules/ClientPageRPC.mjs";
import FrontendWindows from "./modules/FrontendWindows.mjs";

const SERVICE_WORKER_URL = '/dist/service-worker.js';
const FIRST_ENDPOINT = 'https://cloudflare-eth.com';


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
        if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
            try {
                console.log('Wallet: Service worker registration...');
                const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL);
                console.log('Wallet: Service worker registered:', registration);

                this.RPC = new ClientPageRPC(registration);
                window.RPC = this.RPC;

                await this.RPC.waitForActive();

                if (this.urlOrProvider) {
                    await this.changeProvider(this.urlOrProvider);
                }


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
        return Number(await this.RPC.request('eth_chainId'));
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

    async removeEncryptedAccount(accountName = 'mainAccount') {
        return await this.RPC.request('removeEncryptedAccount', [accountName]);
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

    async isLocked() {
        return await this.RPC.request('isLocked');
    }

    async unlock(password) {
        return await this.RPC.request('unlock', [password]);
    }


    async personal_sign(message, address) {

        console.log('REquest personal sign', message, address);

        let isLocked = await this.isLocked();

        console.log('isLocked', isLocked);

        this.emit('personal_sign_request', {message, address});

        try {
            await new Promise((resolve, reject) => {
                this.once('personal_sign_approved', resolve);
                this.once('personal_sign_rejected', () => {
                    reject(new Error('User rejected the sign request.'));
                });
            });

            if (isLocked) {
                console.log('2isLocked', isLocked);
                await this.unlock(await FrontendWindows.requestPassword(this));
            }

            return await this.RPC.request('personal_sign', [message, address]);
        } catch (error) {
            console.error('Error during personal sign:', error);
            throw error;
        }
    }

    async eth_sendTransaction({data, from, to}) {

        let isLocked = await this.isLocked();

        this.emit('eth_sendTransaction_request', {data, from, to});

        try {
            const tx = await new Promise((resolve, reject) => {
                this.once('eth_sendTransaction_approved', resolve);
                this.once('eth_sendTransaction_rejected', () => {
                    reject(new Error('User rejected the transaction request.'));
                });
            });

            if (isLocked) {
                await this.unlock(await FrontendWindows.requestPassword(this));
            }

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

let wallet = new EmbeddedWallet(FIRST_ENDPOINT);

wallet.init(); //TODO я хуй знает куда это вставить в асинхронном режиме, так что будет такой костыль, надеюсь будет работать

if (typeof window !== 'undefined') {
    if (!window.web310101Wallet) {
        window.web310101Wallet = wallet;
    } else {
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


    return createConnector((config) => {

        return {
            id,
            name,
            type,
            getProvider: async function () {
                return wallet;
            },
            connect: async function ({isReconnecting}) {
                await wallet.init();
                await wallet.changeProvider(network.rpcUrls.default.http[0]);

                if (isReconnecting) {
                    return {
                        accounts: [await wallet.getAddress()],
                        chainId: await wallet.eth_chainId()
                    };
                }




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
                            wallet.emit('private_key_provided', generatedAccount);
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
                await wallet.removeEncryptedAccount();
            },
            disconnectAccount: async function () {
                console.log('disconnectAccount');
                await wallet.removeEncryptedAccount();
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
