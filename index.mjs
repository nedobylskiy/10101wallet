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
        }catch (e) {
        }
        this.currentAccount = null;
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



    /**
     * Simulate RPC provider
     * @param method
     * @param params
     * @returns {Promise<*>}
     */
    async request(rpc){
        console.log('request', arguments);
        if(!rpc.params){
            rpc.params = [];
        }
        return await this[rpc.method](...rpc.params);
    }


    //Provider methods
    async personal_sign(message, address){
        //TODO тут надо отобразить окно с "Message sign" и отобразить что он подписывает
        return (await this.currentAccount.sign(message)).signature;

    }

    async eth_chainId(){
        return await this.web3.eth.getChainId();
    }

    async eth_sendTransaction({data, from, to}){

        //TODO тут надо отобразить окно с "Transaction sign" и отобразить что он подписывает транзакцию, адрес от какого кошелька и куда

        let tx = {
            data,
            from,
            to,
            gasPrice: await this.getGasPrice(),
        };

        let signedTx = await this.currentAccount.signTransaction(tx);

        let sendedTx = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        console.log('EMBEDDED WALLET: SEND TX', signedTx, sendedTx);

        return sendedTx.transactionHash;

    }
}

export default EmbeddedWallet;


export function embedded10101WalletConnector({network,
    chains,
    options
                                             }){
    console.log('embedded10101WalletConnector', network, chains, options);
    let wallet = new EmbeddedWallet(network.rpcUrls.default.http[0]);

    let id = 'embedded10101';
    let name = 'Embedded 10101';
    let type = 'wallet';


    return createConnector((config) => ({
        id,
        name,
        type,
        getProvider: async function () {
            return wallet;
        },
        connect: async function () {
            console.log('connect');

            let password = 'password'; //TODO это замоканный пароль для примера, дальше запрашивать их надо в каждой ситуации отдельно

            if(await wallet.hasSavedAccount()) {

                try {
                    //TODO Здесь мы запрашиваем пароль юзера для загрузки аккаунта
                    await wallet.loadAccount(password);
                } catch (e) {
                    //TODO Тут мы отображаем что пароль был кривой
                    console.error('Invalid password', e);
                    throw e;
                }

            }else{
              //TODO Здесь мы генерим новый аккаунт и нам надо отобразить юзеру этот ключ и попросить его сохранить ИЛИ импортировать новый
              // По идее тут надо получить что ввел юзер и либо дернуть wallet.generateNewAccount(password) либо wallet.loadAccountByPrivateKey(privateKey, password)
              let generatedAccount =   await wallet.generateNewAccount(password);
              //TODO Приватка лежит  в generatedAccount.privateKey

            }

            return {
                accounts: [await wallet.getAddress()],
                chainId: await wallet.eth_chainId()
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
        onDisconnect: async function () {},
        getChainId: async function () {
            return await wallet.eth_chainId();
        },
        onAccountsChanged: async function () {},
        onMessage: async function () {
            console.log('onMessage', arguments);
        },
        switchChain: async function () {

        }

    }))
}
