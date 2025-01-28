const {
    TonClient,
    SendMode,
    WalletContractV4,
    internal,
    toNano,
    Address,
} = require("@ton/ton");
const { mnemonicToPrivateKey } = require("@ton/crypto");
const { getHttpEndpoint } = require("@orbs-network/ton-access");
const { config } = require("dotenv");
const { readFileSync } = require("fs");
const { DEX, pTON } = require("@ston-fi/sdk");

config();

let cms = 0n;
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * @returns {string}
 */
const getMnemonicsAt = (idx) => {
    const allMnemonics = readFileSync("./mnemonics.txt", "utf8");
    return allMnemonics.split("\n")[idx];
};

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
 * @param {bigint} transferAmount
 * @param {import("@ton/ton").OpenedContract<WalletContractV4>} sender
 * @param {import("@ton/ton").OpenedContract<WalletContractV4>} recipient
 * @param {Buffer<ArrayBufferLike>} senderSecret
 */
const transferTon = async (transferAmount, sender, recipient, senderSecret) => {
    await sender.sendTransfer({
        secretKey: senderSecret,
        seqno: await sender.getSeqno(),
        sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
        messages: [
            internal({
                to: Address.parse(recipient),
                value: transferAmount,
                bounce: false,
            }),
        ],
    });
    console.log("Transferred successfully!");
};

/**
 *
 * @param {string} recipient
 */
async function main(fromIdx, to) {
    const client = await getClient();
    let mnemonics = getMnemonicsAt(fromIdx);
    let { contract, keyPair } = await getContract(client, mnemonics);
    console.log(`SENDER: ${contract.address.toString()}`);
    let balance = await contract.getBalance();
    let transferAmount = balance - toNano("0.2");
    await transferTon(transferAmount, contract, to, keyPair.secretKey);
}

main(process.env.FROM, process.env.RECIPIENT)
    .then()
    .catch((e) => console.log(e));
