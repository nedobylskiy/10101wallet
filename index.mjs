import {Web3} from "web3";
import Keystorage from "./modules/Keystorage.mjs";
import {createConnector} from "@wagmi/core";

class EmbeddedWallet {
    currentAccount = null;

    constructor(urlOrProvider) {
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

        delete account.privateKey;

        return {...account, encryptedKey};
    }

    async loadAccount(password, accountName = 'mainAccount') {
        let privateKey = await Keystorage.load(password, accountName);
        await this.#loadWeb3AccountByPrivateKey(privateKey);
    }

    async getEncryptedAccount(accountName = 'mainAccount') {
        return await Keystorage.getEncryptedAccount(accountName);
    }

    async #loadWeb3AccountByPrivateKey(privateKey) {
        await this.#unloadWeb3Account(); //Unload active account to prevent key leak
        const account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
        await this.web3.eth.accounts.wallet.add(account);
        this.currentAccount = account;
    }

    async #unloadWeb3Account() {
        try {
            this.web3.eth.accounts.wallet.remove(this.currentAccount);
        }catch (e) {
        }
        this.currentAccount = null;
    }

    async sendTransaction({from, to, value, gas}) {
        return await this.web3.eth.sendTransaction({
            from: from,
            to: to,
            value: value,
            gas: gas
        });
    }

    async getAddress(){
        return this.currentAccount.address;
    }

    async getBalance(address) {
        return await this.web3.eth.getBalance(address);
    }



    async getGasPrice() {
        return await this.web3.eth.getGasPrice();
    }

    async estimateGas({from, to, value}) {
        return await this.web3.eth.estimateGas({
            from: from,
            to: to,
            value: value
        });
    }
}

export default EmbeddedWallet;


export function embedded10101WalletConnector({
    chains,
    options
                                             }){
    let wallet = new EmbeddedWallet(options);

    let id = 'embedded10101';
    let name = 'Embedded 10101';
    let type = 'wallet';

    return createConnector((config) => ({
        id,
        name,
        type,
        //getProvider,
        getProvider: async function () {
            console.log('getProvider');
        },
        connect: async function () {
            console.log('connect');
        },
        getAccounts: async function () {
            console.log('getAccounts');
        },
        signTransaction: async function () {},
        onConnect: async function () {
            console.log('onConnect');
        },
        disconnect: async function () {},
        isAuthorized: async function () {
            console.log('isAuthorized');
        },
        onDisconnect: async function () {},
        getChainId: async function () {
            console.log('getChainId');
        },
        onAccountsChanged: async function () {},

    }))
}
