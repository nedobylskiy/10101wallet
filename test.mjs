import EmbeddedWallet from "./index.mjs";

let wallet = new EmbeddedWallet('http://localhost:8545');

let account = await wallet.generateNewAccount('password');

console.log(account);

console.log(await wallet.getEncryptedAccount());
