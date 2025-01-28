import { mnemonicNew } from "@ton/crypto";
import {appendFile} from "fs/promises";

let start = 0;
let end = 200;
for (let i = start; i < end; i++) {
    const mnemonic = await mnemonicNew(24);
    appendFile("mnemonics.txt", mnemonic.join(" ") + "\n");
}
console.log(`\x1b[32mCreated ${end-start} number of mnemonic strings!`)