const { TonClient, toNano, fromNano } = require("@ton/ton");
const { getHttpEndpoint } = require("@orbs-network/ton-access");
const { config } = require("dotenv");
const { readFileSync } = require("fs");
const { DEX, pTON } = require("@ston-fi/sdk");

config();

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
 * @returns {string[]}
 */
const getAddresses = () =>
    readFileSync("./addresses.txt", "utf8")
        .split("\n")
        .map((line) => line.split(" ")[1]);
/**
 *
 * @param {string} recipient
 */
async function main(fromIdx, to) {
    const client = await getClient();
    let addresses = getAddresses();
    for (let i = 0; i < addresses.length; i++) {
        let address = addresses[i];
        let balance = await client.getBalance(address);
        let color = "";
        if (balance > toNano("0.1")) {
            color = "\x1b[32m";
        } else {
            color = "\x1b[33m";
        }

        console.log(`${color} ${i} ${address} - ${fromNano(balance)}\x1b[0m`);
    }
}

main()
    .then()
    .catch((e) => console.log(e));
