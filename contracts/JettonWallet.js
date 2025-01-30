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
exports.JettonWallet = void 0;
exports.jettonWalletConfigToCell = jettonWalletConfigToCell;
const core_1 = require("@ton/core");
function jettonWalletConfigToCell(config) {
    return (0, core_1.beginCell)().endCell();
}
class JettonWallet {
    constructor(address, init) {
        this.address = address;
        this.init = init;
    }
    static createFromAddress(address) {
        return new JettonWallet(address);
    }
    static createFromConfig(config, code, workchain = 0) {
        const data = jettonWalletConfigToCell(config);
        const init = { code, data };
        return new JettonWallet((0, core_1.contractAddress)(workchain, init), init);
    }
    sendDeploy(provider, via, value) {
        return __awaiter(this, void 0, void 0, function* () {
            yield provider.internal(via, {
                value,
                sendMode: core_1.SendMode.PAY_GAS_SEPARATELY,
                body: (0, core_1.beginCell)().endCell(),
            });
        });
    }
    getJettonBalance(provider) {
        return __awaiter(this, void 0, void 0, function* () {
            let state = yield provider.getState();
            if (state.state.type !== 'active') {
                return (0, core_1.toNano)(0);
            }
            let res = yield provider.get('get_wallet_data', []);
            return res.stack.readBigNumber();
        });
    }
    static transferMessage(jetton_amount, to, responseAddress, customPayload, forward_ton_amount, forwardPayload) {
        return (0, core_1.beginCell)().storeUint(0xf8a7ea5, 32).storeUint(0, 64) // op, queryId
            .storeCoins(jetton_amount).storeAddress(to)
            .storeAddress(responseAddress)
            .storeMaybeRef(customPayload)
            .storeCoins(forward_ton_amount)
            .storeMaybeRef(forwardPayload)
            .endCell();
    }
    sendTransfer(provider, via, value, jetton_amount, to, responseAddress, customPayload, forward_ton_amount, forwardPayload) {
        return __awaiter(this, void 0, void 0, function* () {
            yield provider.internal(via, {
                sendMode: core_1.SendMode.PAY_GAS_SEPARATELY,
                body: JettonWallet.transferMessage(jetton_amount, to, responseAddress, customPayload, forward_ton_amount, forwardPayload),
                value: value,
                bounce: false
            });
        });
    }
    /*
      burn#595f07bc query_id:uint64 amount:(VarUInteger 16)
                    response_destination:MsgAddress custom_payload:(Maybe ^Cell)
                    = InternalMsgBody;
    */
    static burnMessage(jetton_amount, responseAddress, customPayload) {
        return (0, core_1.beginCell)().storeUint(0x595f07bc, 32).storeUint(0, 64) // op, queryId
            .storeCoins(jetton_amount).storeAddress(responseAddress)
            .storeMaybeRef(customPayload)
            .endCell();
    }
    sendBurn(provider, via, value, jetton_amount, responseAddress, customPayload) {
        return __awaiter(this, void 0, void 0, function* () {
            yield provider.internal(via, {
                sendMode: core_1.SendMode.PAY_GAS_SEPARATELY,
                body: JettonWallet.burnMessage(jetton_amount, responseAddress, customPayload),
                value: value
            });
        });
    }
    /*
      withdraw_tons#107c49ef query_id:uint64 = InternalMsgBody;
    */
    static withdrawTonsMessage() {
        return (0, core_1.beginCell)().storeUint(0x6d8e5e3c, 32).storeUint(0, 64) // op, queryId
            .endCell();
    }
    sendWithdrawTons(provider, via) {
        return __awaiter(this, void 0, void 0, function* () {
            yield provider.internal(via, {
                sendMode: core_1.SendMode.PAY_GAS_SEPARATELY,
                body: JettonWallet.withdrawTonsMessage(),
                value: (0, core_1.toNano)('0.1')
            });
        });
    }
    /*
      withdraw_jettons#10 query_id:uint64 wallet:MsgAddressInt amount:Coins = InternalMsgBody;
    */
    static withdrawJettonsMessage(from, amount) {
        return (0, core_1.beginCell)().storeUint(0x768a50b2, 32).storeUint(0, 64) // op, queryId
            .storeAddress(from)
            .storeCoins(amount)
            .storeMaybeRef(null)
            .endCell();
    }
    sendWithdrawJettons(provider, via, from, amount) {
        return __awaiter(this, void 0, void 0, function* () {
            yield provider.internal(via, {
                sendMode: core_1.SendMode.PAY_GAS_SEPARATELY,
                body: JettonWallet.withdrawJettonsMessage(from, amount),
                value: (0, core_1.toNano)('0.1')
            });
        });
    }
}
exports.JettonWallet = JettonWallet;
