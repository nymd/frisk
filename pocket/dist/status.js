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
const influx_1 = require("./datasources/influx");
const influxdb_client_1 = require("@influxdata/influxdb-client");
const util_1 = __importDefault(require("util"));
const exec = util_1.default.promisify(require('child_process').exec);
var argv = require('minimist')(process.argv.slice(2));
var CronJob = require('cron').CronJob;
const set = argv['_'][0];
const mode = argv['_'][1];
const nodeCSV = `./src/accounts/${set}-nodes.csv`;
const dataNodeURL = 'https://peer-1.nodes.pokt.network:4200';
const startingAmount = 100000;
const pointTimestamp = new Date();
const fs = require('fs');
const csv = require('csv-parser');
const nodes = [];
fs.createReadStream(nodeCSV).pipe(csv())
    .on('data', (data) => nodes.push(data));
var jobHeight = new CronJob('*/20 * * * * *', function () {
    processNodeHeights(nodes);
}, null, true, 'America/Vancouver');
jobHeight.start();
var jobBalance = new CronJob('0 */1 * * * *', function () {
    processNodeBalancesAndClaims(nodes);
}, null, true, 'America/Vancouver');
jobBalance.start();
var jobJailed = new CronJob('0 0 * * * *', function () {
    processNodeJailings(nodes);
}, null, true, 'America/Vancouver');
jobJailed.start();
function processNodeJailings(nodes) {
    return __awaiter(this, void 0, void 0, function* () {
        for (const node of nodes) {
            const nodeNumber = node.name.split("-").pop();
            let nodeJailed = yield fetchJailedStatus(set, nodeNumber, node.address);
            if (nodeJailed) {
                console.log(`Node: ${node.name}, jailed: ${nodeJailed}`);
                const pointJailed = new influxdb_client_1.Point('jailed')
                    .tag('set', set)
                    .tag('address', node.address)
                    .tag('moniker', node.name)
                    .stringField('jailed', 'true')
                    .timestamp(pointTimestamp);
                influx_1.writeAPI.writePoint(pointJailed);
                if (mode === "unjail") {
                    const command = `pocket --remoteCLIURL ${dataNodeURL} nodes unjail ${node.address} mainnet 10000 false`;
                    const { stdout, stderr } = yield exec(command);
                    if (!stderr) {
                        console.log(stdout);
                    }
                }
            }
        }
    });
}
function processNodeHeights(nodes) {
    return __awaiter(this, void 0, void 0, function* () {
        for (const node of nodes) {
            const nodeNumber = node.name.split("-").pop();
            const nodeHeight = yield fetchHeight(set, nodeNumber);
            if (nodeHeight) {
                const pointHeight = new influxdb_client_1.Point('height')
                    .tag('set', set)
                    .tag('address', node.address)
                    .tag('moniker', node.name)
                    .intField('height', nodeHeight)
                    .timestamp(pointTimestamp);
                influx_1.writeAPI.writePoint(pointHeight);
                console.log(`${node.name} ${nodeHeight}`);
            }
        }
        influx_1.writeAPI.flush();
    });
}
function processNodeBalancesAndClaims(nodes) {
    return __awaiter(this, void 0, void 0, function* () {
        let totalBalance = 0;
        for (const node of nodes) {
            const nodeNumber = node.name.split("-").pop();
            let nodeBalance = yield fetchBalance(set, nodeNumber, node.address);
            nodeBalance = nodeBalance - startingAmount;
            const convertedNodeBalance = Math.round(upokt(nodeBalance));
            const nodeClaims = yield fetchClaims(set, nodeNumber, node.address);
            const pointClaims = new influxdb_client_1.Point('claims')
                .tag('set', set)
                .tag('address', node.address)
                .tag('moniker', node.name)
                .intField('pokt', nodeClaims)
                .timestamp(pointTimestamp);
            influx_1.writeAPI.writePoint(pointClaims);
            if (convertedNodeBalance > 0) {
                const pointBalance = new influxdb_client_1.Point('balance')
                    .tag('set', set)
                    .tag('address', node.address)
                    .tag('moniker', node.name)
                    .floatField('pokt', convertedNodeBalance)
                    .timestamp(pointTimestamp);
                influx_1.writeAPI.writePoint(pointBalance);
            }
            console.log(`${node.name} balance: ${convertedNodeBalance}, claims: ${nodeClaims}`);
            totalBalance = totalBalance + nodeBalance;
        }
        const convertedTotalBalance = upokt(totalBalance);
        console.log(`Total node balance: ${convertedTotalBalance}`);
    });
}
function fetchHeight(set, number) {
    return __awaiter(this, void 0, void 0, function* () {
        const command = `docker exec -i ${set}${number} pocket query height`;
        const { stdout, stderr } = yield exec(command);
        if (!stderr) {
            const regex = /"height":\s([\w])+/g;
            const matches = regex.exec(stdout);
            if (matches && matches[0]) {
                const height = matches[0].replace('"height": ', '');
                return height;
            }
        }
        return "";
    });
}
function fetchClaims(set, number, address) {
    return __awaiter(this, void 0, void 0, function* () {
        const command = `docker exec -i ${set}${number} pocket query node-claims ${address}`;
        const { stdout, stderr } = yield exec(command);
        if (!stderr) {
            const regex = /"total_proofs":\s([\d])+/g;
            const matches = regex.exec(stdout);
            if (matches && matches[0]) {
                let claims = 0;
                for (const item in matches) {
                    if (item.match(/^-?\d+$/)) {
                        const claimSet = parseInt(matches[item].replace('"total_proofs": ', ''));
                        claims = claims + claimSet;
                    }
                }
                return claims;
            }
        }
        return 0;
    });
}
function fetchJailedStatus(set, number, address) {
    return __awaiter(this, void 0, void 0, function* () {
        const command = `docker exec -i ${set}${number} pocket query node ${address}`;
        const { stdout, stderr } = yield exec(command);
        if (!stderr) {
            const regex = /"jailed":\s([\w])+/g;
            const matches = regex.exec(stdout);
            if (matches && matches[0]) {
                const jailed = matches[0].replace('"jailed": ', '');
                if (jailed === "true") {
                    return true;
                }
                return false;
            }
        }
        return null;
    });
}
function fetchBalance(set, number, address) {
    return __awaiter(this, void 0, void 0, function* () {
        const command = `docker exec -i ${set}${number} pocket query balance ${address}`;
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
//# sourceMappingURL=status.js.map