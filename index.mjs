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

        return {...account, encryptedKey, privateKey};
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
        return await this.web3.eth.getGasPrice();
    }

    async estimateGas({from, to, value}) {
        return await this.web3.eth.estimateGas({
            from: from,
            to: to,
            value: value
        });
    }

   //TODO univeersal getter
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
    let chainId = 1;

    //Make proxy for wallet for logging every call

    let walletProxy = new Proxy(wallet, {
        get: function(target, prop, receiver) {
            console.log(`Proxy: GET ${prop}`);
            return target[prop];
        },
    });

    wallet = walletProxy;


    return createConnector((config) => ({
        id,
        name,
        type,
        //getProvider,
        getProvider: async function () {
            console.log('getProvider');
            return wallet;
        },
        connect: async function () {
            console.log('connect');

            let password = 'password';

            if(await wallet.hasSavedAccount()) {

                try {
                    //Todo request password
                    await wallet.loadAccount(password);
                } catch (e) {
                    //Todo invalid password error
                    console.error('Invalid password', e);
                }

            }else{
                //Todo request password
              let generatedAccount =   await wallet.generateNewAccount(password);

              console.log('Generated private key:', generatedAccount.privateKey);
            }

            return {
                accounts: [await wallet.getAddress()],
                chainId: chainId
            }
        },
        getAccounts: async function () {
            console.log('getAccounts');

            return [await wallet.getAddress()];
        },
        signTransaction: async function () {
            console.log('signTransaction');
        },
        onConnect: async function () {
            console.log('onConnect');
        },
        disconnect: async function () {},
        isAuthorized: async function () {
            console.log('isAuthorized');
            return await wallet.isAuthorized();
        },
        onDisconnect: async function () {},
        getChainId: async function () {
            console.log('getChainId');
        },
        onAccountsChanged: async function () {},
        onMessage: async function () {
            console.log('onMessage');
        },

    }))
}
