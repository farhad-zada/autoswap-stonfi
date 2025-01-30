const { mnemonicNew } = require( "@ton/crypto");
const { appendFile } = require("fs/promises");


async function generateMnemonics(start, end) {
    for (let i = start; i < end; i++) {
        const mnemonic = await mnemonicNew(24);
        appendFile("holders.txt", mnemonic.join(" ") + "\n");
    }
    console.log(`\x1b[32mCreated ${end-start} number of mnemonic strings!`)
}

generateMnemonics(0, 1500);