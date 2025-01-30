const {
    TonClient,
    WalletContractV4,
} = require("@ton/ton");
const { mnemonicToPrivateKey } = require("@ton/crypto");
const { getHttpEndpoint } = require("@orbs-network/ton-access");
const { config } = require("dotenv");
const { readFileSync } = require("fs");

config();

let client;
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

let mnemonics = readFileSync("./holders.txt", "utf8").split("\n");

/**
 *
 * @returns {Promise<import("@ton/ton").TonClient>}
 */
const getClient = async () => {
    const endpoint = await getHttpEndpoint();
    return new TonClient({
        endpoint,
    });
};

/**
 *
 * @param {import("@ton/ton").TonClient} client
 * @param {import("@ton/crypto").KeyPair} keyPair
 * @returns {import("@ton/ton").OpenedContract<WalletContractV4>}
 */
function createWallet(client, keyPair) {
    const walletInit = WalletContractV4.create({
        workchain: 0,
        publicKey: keyPair.publicKey,
    });
    const walletContract = client.open(walletInit);
    return walletContract;
}

/**
 * @param {import("@ton/ton").TonClient} client
 * @param {string} mnemonics
 * @returns {Promise<{contract: import("@ton/ton").OpenedContract<WalletContractV4>, keyPair: import("@ton/crypto").KeyPair}>}
 */
const getContract = async (client, mnemonics) => {
    const keyPair = await mnemonicToPrivateKey(mnemonics.split(" "));
    return {
        contract: createWallet(client, keyPair),
        keyPair: keyPair,
    };
};

/**
 *
 * @param {number} fromIdx
 * @param {number} toIdx
 */
async function main(fromIdx, toIdx) {
    console.log(`From index: ${fromIdx}`);
    client = await getClient();
    for (let i = fromIdx; i < toIdx; i++) {
        console.log("Index: ", i);
        let { contract, keyPair } = await getContract(client, mnemonics[i]);
        console.log(`SENDER: ${contract.address.toString()}`);

        let res = await fetch(
            "http://localhost:3456/send/EQCBPTfghL-_KsmnASLFSAMVKTY8lepp2qb5ra4l4XsBwYKM",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    address: contract.address.toString(),
                    amount: "100",
                }),
            }
        );
        if (res.status == 429) {
            i--;
            continue;
        }

        console.log(await res.json());

        await delay(12500);
    }
}

// 180, 286, 387
main(500, 700)
    .then()
    .catch((e) => console.log(e));
