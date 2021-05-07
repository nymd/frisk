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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = __importDefault(require("util"));
const exec = util_1.default.promisify(require('child_process').exec);
const nodeCSV = './pokt-nodes.csv';
const dataNodeURL = 'https://pokt-10.nachonodes.com:4210';
const namePrefix = 'POKT-';
const num = 1;
const remainingAmount = 60000;
const sweepWallet = '7006d985a758450b94519a62d39f5690684fe626';
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const fs = require('fs');
        const csv = require('csv-parser');
        const nodes = [];
        fs.createReadStream(nodeCSV).pipe(csv())
            .on('data', (data) => nodes.push(data))
            .on('end', () => __awaiter(this, void 0, void 0, function* () {
            yield processNodeBalancesAndClaims(nodes);
        }));
    });
}
function processNodeBalancesAndClaims(nodes) {
    return __awaiter(this, void 0, void 0, function* () {
        let totalBalance = 0;
        for (const node of nodes) {
            let nodeBalance = yield fetchBalance(node.address);
            nodeBalance = nodeBalance - remainingAmount;
            const convertedNodeBalance = Math.round(upokt(nodeBalance));
            if (convertedNodeBalance <= 0) {
                continue;
            }
            console.log(`${node.name} balance: ${convertedNodeBalance}`);
            yield sweepBalance(node.address, nodeBalance);
            totalBalance = totalBalance + nodeBalance;
        }
        const convertedTotalBalance = upokt(totalBalance);
        console.log(`Sweeping in: ${convertedTotalBalance}`);
    });
}
function sweepBalance(address, amount) {
    return __awaiter(this, void 0, void 0, function* () {
        const command = `pocket --remoteCLIURL ${dataNodeURL} accounts send-tx ${address} ${sweepWallet} ${amount} mainnet 10000 sweep`;
        const { stdout, stderr } = yield exec(command);
        if (!stderr) {
            console.log(stdout);
            return true;
        }
        return false;
    });
}
function fetchBalance(address) {
    return __awaiter(this, void 0, void 0, function* () {
        const command = `pocket --remoteCLIURL ${dataNodeURL} query balance ${address}`;
        const { stdout, stderr } = yield exec(command);
        if (!stderr) {
            const regex = /"balance":\s([\d])+/g;
            const matches = regex.exec(stdout);
            if (matches && matches[0]) {
                return parseInt(matches[0].replace('"balance": ', ''));
            }
            return 0;
        }
        return 0;
    });
}
function upokt(amount) {
    return amount / 1000000;
}
main();
//# sourceMappingURL=sweep.js.map