"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JettonMinter = void 0;
const core_1 = require("@ton/core");
class JettonMinter {
    constructor(address, init) {
        this.address = address;
        this.init = init;
    }
    static createFromAddress(address) {
        return new JettonMinter(address);
    }
    getTotalSupply(provider) {
        return __awaiter(this, void 0, void 0, function* () {
            let res = yield this.getJettonData(provider);
            return res.totalSupply;
        });
    }
    getAdminAddress(provider) {
        return __awaiter(this, void 0, void 0, function* () {
            let res = yield this.getJettonData(provider);
            return res.adminAddress;
        });
    }
    getContent(provider) {
        return __awaiter(this, void 0, void 0, function* () {
            let res = yield this.getJettonData(provider);
            return res.content;
        });
    }
    getJettonData(provider) {
        return __awaiter(this, void 0, void 0, function* () {
            let res = yield provider.get("get_jetton_data", []);
            let totalSupply = res.stack.readBigNumber();
            let mintable = res.stack.readBoolean();
            let adminAddress = res.stack.readAddress();
            let content = res.stack.readCell();
            let walletCode = res.stack.readCell();
            return {
                totalSupply,
                mintable,
                adminAddress,
                content,
                walletCode,
            };
        });
    }
    getWalletAddress(provider, owner) {
        return __awaiter(this, void 0, void 0, function* () {
            let slice = (0, core_1.beginCell)().storeAddress(owner).endCell();
            let res = yield provider.get("get_wallet_address", [
                { type: "slice", cell: slice },
            ]);
            let walletAddress = res.stack.readAddress();
            return walletAddress;
        });
    }
    getWalletData(provider) {
        return __awaiter(this, void 0, void 0, function* () {
            let res = yield provider.get("get_wallet_data", []);
            let balance = res.stack.readBigNumber();
            let owner = res.stack.readAddress();
            let jetton = res.stack.readAddress();
            let jettonWalletCode = res.stack.readCell();
            return {
                balance,
                owner,
                jetton,
                jettonWalletCode,
            };
        });
    }
}
exports.JettonMinter = JettonMinter;
