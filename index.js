const {
    TonClient,
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
const getTimeBaku = require("./getTimeBaku");

config();

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

let mnemonics = readFileSync("./mnemonics.txt", "utf8").split("\n");

let lastWalletIdx = readFileSync("./last_wallet_idx.txt", "utf8") * 1 ?? 0;
let lastSoldIdx = readFileSync("./last_sold_idx.txt", "utf8") * 1 ?? 0;
let client;
let dex;
let proxyTon;
let master;
let masterKeyPair;

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
    const randomOptions = process.env.AMOUNTS.split(",");
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
const transferToSlave = async (
    transferAmount,
    sender,
    receiver,
    senderSecret
) => {
    console.log(
        getTimeBaku() +
            "Transferring " +
            fromNano(transferAmount) +
            " tons to receiver!"
    );
    await sender.sendTransfer({
        secretKey: senderSecret,
        seqno: await sender.getSeqno(),
        messages: [
            internal({
                to: receiver.address,
                value: transferAmount,
                bounce: false,
            }),
        ],
    });
    console.log(
        getTimeBaku() +
            "Transferred " +
            fromNano(transferAmount) +
            " tons to receiver!"
    );

    let start = Date.now();
    console.log(getTimeBaku() + "Waiting for 60 seconds!");
    await delay(60000);
    console.log(getTimeBaku() + "Waited for 60 seconds!");
    let balance = await sender.getBalance();
    if (transferAmount <= balance + toNano("0.2")) {
        console.log(getTimeBaku() + "Transferred successfully!");
    } else if (Date.now() - start > 50000) {
        console.log(
            getTimeBaku() +
                "Something went wrong! Could not transfer tons of amount " +
                transferAmount.toString()
        );
    }
};

const getRandomWaitTime = () => {
    let ms = 1000;
    return (Math.random() * (360 * ms - 60 * ms + 1) + 60 * ms).toFixed(0) * 1;
};

async function buyXopt(idx) {
    console.log(getTimeBaku() + "Buying XOPT!");
    console.log(getTimeBaku() + "Last Wallet Idx: ", lastWalletIdx);
    console.log(getTimeBaku() + "Getting slave contract!");
    const { slave, keyPair: slaveKeyPair } = await getSlaveContract(
        client,
        mnemonics[idx]
    );
    console.log(getTimeBaku() + "Got slave contract");
    console.log(getTimeBaku() + "Slave address: ", slave.address.toString());
    console.log(getTimeBaku() + "Setting last wallet idx to: ", idx);
    setLastWalletIdx(idx);
    console.log(getTimeBaku() + "Set last wallet idx to: ", idx);
    console.log(getTimeBaku() + "Getting random transfer amount in tons!");
    const transferAmount = getRandomTransferAmountInTons();
    console.log(
        getTimeBaku() + "Got random transfer amount in tons: ",
        fromNano(transferAmount)
    );
    console.log(getTimeBaku() + "Getting slave balance!");
    const slaveBalance = await slave.getBalance();
    console.log(getTimeBaku() + "Slave balance: ", fromNano(slaveBalance));
    if (slaveBalance < transferAmount - toNano("0.2")) {
        console.log(
            getTimeBaku() + "Slave balance is less than transfer amount!"
        );
        console.log(
            getTimeBaku() +
                "Filling slave wallet with " +
                fromNano(transferAmount - slaveBalance + toNano("0.2")) +
                " tons!"
        );
        await transferToSlave(
            transferAmount - slaveBalance + toNano("0.2"),
            master,
            slave,
            masterKeyPair.secretKey
        );
        console.log(
            getTimeBaku() +
                "Filled slave wallet with " +
                fromNano(transferAmount - slaveBalance + toNano("0.2")) +
                " tons!"
        );
    }

    console.log(getTimeBaku() + "Slave wallet is ready to buy XOPT!");
    console.log(getTimeBaku() + "Configuring TON to XOPT swap args!");
    let randomWaitMilliseconds = getRandomWaitTime();
    const offerAmount = transferAmount - toNano("0.5");
    let tonToXoptArgs = {
        userWalletAddress: slave.address,
        offerAmount: offerAmount,
        askJettonAddress: process.env.XOPT_TOKEN,
        minAskAmount: toNano("1"),
        proxyTon,
        queryId: 1234n,
        bounce: false,
    };
    console.log(getTimeBaku() + "Configured TON to XOPT swap args!");
    console.log(getTimeBaku() + "Getting TON to XOPT swap params!");
    let tonToXoptParams = await dex.getSwapTonToJettonTxParams(tonToXoptArgs);
    console.log(getTimeBaku() + "Got TON to XOPT swap params!");
    console.log(getTimeBaku() + "Sending transfer!");
    await slave.sendTransfer({
        seqno: await slave.getSeqno(),
        secretKey: slaveKeyPair.secretKey,
        messages: [internal(tonToXoptParams)],
    });
    console.log(getTimeBaku() + "Sent transfer!");
    console.log(
        getTimeBaku() +
            `Waiting for ${(randomWaitMilliseconds / 1000).toFixed()} seconds!`
    );
    await delay(randomWaitMilliseconds);
    console.log(
        getTimeBaku() + "Waited for ",
        (randomWaitMilliseconds / 1000).toFixed(),
        " seconds!"
    );
}

/**
 *
 * @param {number} idx
 * @returns {Promise<void>}
 */
async function sellXopt(idx) {
    console.log(getTimeBaku() + "Selling XOPT!");
    console.log(getTimeBaku() + "Last Sold Idx: ", lastSoldIdx);
    lastSoldIdx++;
    const { slave: sellerSlave, keyPair: sellerSlaveKeyPair } =
        await getSlaveContract(client, mnemonics[lastSoldIdx]);
    console.log(getTimeBaku() + "Seller Slave address: ", sellerSlave.address);
    console.log(getTimeBaku() + "Setting last sold idx to: ", lastSoldIdx);
    setLastSoldIdx(lastSoldIdx);
    console.log(getTimeBaku() + "Set last sold idx to: ", lastSoldIdx);
    let xoptAddress = process.env.XOPT_TOKEN;
    console.log(getTimeBaku() + "XOPT Address: ", xoptAddress);
    let xoptContract = client.open(
        JettonMaster.create(Address.parse(xoptAddress))
    );
    let walletAddress = await xoptContract.getWalletAddress(
        sellerSlave.address
    );
    console.log(getTimeBaku() + "Seller Wallet Address: ", walletAddress);
    let walletContract = client.open(JettonWallet.create(walletAddress));
    let balance = await walletContract.getBalance();
    console.log(getTimeBaku() + "Seller Wallet Balance: ", fromNano(balance));
    if (balance < toNano("70000")) {
        console.log(getTimeBaku() + "Seller Wallet balance is less than 70000");
        return false;
    }
    let sellerTonBalance = await sellerSlave.getBalance();
    console.log(
        getTimeBaku() + "Seller TON Balance: ",
        fromNano(sellerTonBalance)
    );
    if (sellerTonBalance < toNano("0.5")) {
        console.log(getTimeBaku() + "Seller TON balance is less than 0.5");
        console.log(getTimeBaku() + "Filling seller Wallet with 0.05 tons!");
        await transferToSlave(
            toNano("0.5"),
            master,
            sellerSlave,
            masterKeyPair.secretKey
        );
        console.log(getTimeBaku() + "Filled seller Wallet with 0.05 tons!");
    }

    console.log(getTimeBaku() + "Seller Wallet is ready to sell XOPT!");
    console.log(getTimeBaku() + "Configuring XOPT to TON swap args!");
    let xoptToTonArgs = {
        userWalletAddress: sellerSlave.address,
        recevierAddress: sellerSlave.address,
        offerAmount: balance - toNano("100"),
        offerJettonAddress: xoptAddress,
        minAskAmount: toNano("0.0005"),
        proxyTon: pTON.v2_1.create(
            "EQBnGWMCf3-FZZq1W4IWcWiGAc3PHuZ0_H-7sad2oY00o83S"
        ),
        queryId: 1234n,
        bounce: false,
    };

    console.log(getTimeBaku() + "Getting XOPT to TON swap params!");
    let xoptToTonParams = await dex.getSwapJettonToTonTxParams(xoptToTonArgs);
    console.log(getTimeBaku() + "Got XOPT to TON swap params!");
    console.log(getTimeBaku() + "Sending XOPT to TON swap transaction!");
    await sellerSlave.sendTransfer({
        seqno: await sellerSlave.getSeqno(),
        secretKey: sellerSlaveKeyPair.secretKey,
        messages: [internal(xoptToTonParams)],
    });
    console.log(getTimeBaku() + "Sent XOPT to TON swap transaction!");
    console.log(getTimeBaku() + "Waiting for 60 seconds!");
    await delay(60000);
    console.log(getTimeBaku() + "Waited for 60 seconds!");
    let sellerTonBalanceAfter = await sellerSlave.getBalance();
    console.log(
        getTimeBaku() + "Seller TON Balance After: ",
        fromNano(sellerTonBalanceAfter)
    );
    console.log(getTimeBaku() + "Transferring balance to master!");
    await transferToSlave(
        sellerTonBalanceAfter - toNano("0.01"),
        sellerSlave,
        master,
        sellerSlaveKeyPair.secretKey
    );
    let randomWaitMilliseconds = getRandomWaitTime();
    console.log(
        getTimeBaku() +
            `Waiting for ${(randomWaitMilliseconds / 1000).toFixed()} seconds!`
    );
    await delay(randomWaitMilliseconds);
    console.log(
        getTimeBaku() + "Waited for ",
        (randomWaitMilliseconds / 1000).toFixed(),
        " seconds!"
    );
}

async function main() {
    console.log(getTimeBaku() + "Starting main function!");
    console.log(getTimeBaku() + "Getting client!");
    client = await getClient();
    console.log(getTimeBaku() + "Got client!");
    console.log(getTimeBaku() + "Opening DEX!");
    dex = client.open(
        DEX.v2_2.Router.create(
            "EQCiz74FCV2lYlvFPEYhL3Jql8WwIO7QvbvYT-LQH0SmtCgI"
        )
    );
    console.log(getTimeBaku() + "Opened DEX!");
    console.log(getTimeBaku() + "Opening pTON!");
    proxyTon = pTON.v2_1.create(
        "EQBnGWMCf3-FZZq1W4IWcWiGAc3PHuZ0_H-7sad2oY00o83S"
    );
    console.log(getTimeBaku() + "Opened pTON!");
    console.log(getTimeBaku() + "Getting master contract!");
    const masterRes = await getMasterContract(client);
    master = masterRes.master;
    masterKeyPair = masterRes.keyPair;
    console.log(getTimeBaku() + "Got master contract!");
    console.log(getTimeBaku() + "Master address: ", master.address.toString());
    console.log(
        getTimeBaku() + "Master balance: ",
        fromNano(await master.getBalance())
    );

    for (let idx = lastWalletIdx; idx < mnemonics.length; idx++) {
        try {
            const masterBalance = await master.getBalance();
            if (masterBalance < toNano("2")) {
                console.log(
                    getTimeBaku() + "Not enough balance in the master wallet!"
                );
            }
            if (process.env.BUY) {
                await buyXopt(idx);
            }
            if (process.env.SELL) {
                await sellXopt(idx);
            }
        } catch (e) {
            console.log(getTimeBaku() + e);
        }
    }
}

main()
    .then()
    .catch((e) => console.log(getTimeBaku() + e));
