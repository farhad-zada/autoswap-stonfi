const { getHttpEndpoint } = require("@orbs-network/ton-access");
const { mnemonicToPrivateKey } = require("@ton/crypto");
const { TonClient, WalletContractV4 } = require("@ton/ton");
const { readFileSync, appendFileSync } = require("fs");

async function main() {
    const endpoint = await getHttpEndpoint();
    let client = new TonClient({
        endpoint,
    });
    const mnemonics = readFileSync("./mnemonics.txt", "utf8")
        .split("\n")
        .map((mnemonic) => mnemonic.split(" "));
    let idx = 0;
    for (let mnemo of mnemonics) {
        const keyPair = await mnemonicToPrivateKey(mnemo);
         const walletInit = WalletContractV4.create({
                workchain: 0,
                publicKey: keyPair.publicKey,
            });
        const contract = client.open(walletInit);
        appendFileSync("addresses.txt", `${idx} ${contract.address.toString()}\n`);
        idx++;
    }
}

main()
    .then()
    .catch((e) => console.log(e));
