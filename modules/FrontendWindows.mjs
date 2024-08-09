export default class FrontendWindows{
    static async requestPassword(wallet){
        wallet.emit('password_request');

        return await new Promise((resolve, reject) => {
            wallet.once('password_provided', resolve);
            wallet.once('password_rejected', () => {
                reject(new Error('User rejected the password request.'));
            });
        });
    }
}
