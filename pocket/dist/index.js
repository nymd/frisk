"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
const axios_1 = __importDefault(require("axios"));
const https = __importStar(require("https"));
require('dotenv').config();
const http = require('http');
const client = require('prom-client');
const register = new client.Registry();
register.setDefaultLabels({
    app: 'pocket'
});
const serverPort = process.env.SERVER_PORT;
const dataNodeURL = process.env.DATA_NODE_URL;
const axiosInstance = axios_1.default.create({
    httpsAgent: new https.Agent({
        rejectUnauthorized: true
    }),
    baseURL: dataNodeURL,
    headers: {
        "Content-Type": "application/json"
    },
    timeout: 30000
});
function processNodeJailings(nodes, height) {
    return __awaiter(this, void 0, void 0, function* () {
        for (const node of nodes) {
            let nodeJailed = yield fetchJailedStatus(node.address, height);
            if (nodeJailed) {
                gaugeJailed[node.name].set(1);
            }
            else {
                gaugeJailed[node.name].set(0);
            }
        }
    });
}
function processNodeBalancesAndClaims(nodes, height) {
    return __awaiter(this, void 0, void 0, function* () {
        let totalBalance = 0;
        for (const node of nodes) {
            let nodeBalance = yield fetchBalance(node.address, height);
            const convertedNodeBalance = Math.round(upokt(nodeBalance));
            gaugeBalance[node.name].set(convertedNodeBalance);
            gaugeClaims[node.name].set(yield fetchClaims(node.address, height));
            totalBalance = totalBalance + nodeBalance;
        }
        gaugeTotalBalance.set(upokt(totalBalance));
    });
}
function fetchClaims(address, height) {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield axiosInstance.post('/query/nodeclaims', JSON.stringify({ address, height }));
        if (res.data) {
            const regex = /"total_proofs":\s([\d])+/g;
            const matches = regex.exec(res.data);
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
function fetchJailedStatus(address, height) {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield axiosInstance.post('/query/node', JSON.stringify({ address, height }));
        if (res.data) {
            return res.data.jailed;
        }
        return null;
    });
}
function fetchBalance(address, height) {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield axiosInstance.post('/query/balance', JSON.stringify({ address, height }));
        if (res.data) {
            return res.data.balance;
        }
        return 0;
    });
}
function fetchCurrentHeight() {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield axiosInstance.post('/query/height');
        if (res.data) {
            return res.data.height;
        }
        return 0;
    });
}
function upokt(amount) {
    return amount / 1000000;
}
const server = http.createServer(function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        if (req.url === '/metrics') {
            const height = yield fetchCurrentHeight();
            yield processNodeJailings(nodes, height);
            yield processNodeBalancesAndClaims(nodes, height);
            res.setHeader('Content-Type', register.contentType);
            res.end(yield register.metrics());
        }
    });
});
const fs = require('fs');
const csv = require('csv-parser');
const nodes = [];
const gaugeJailed = [];
const gaugeBalance = [];
const gaugeClaims = [];
fs.createReadStream('./nodes.csv').pipe(csv())
    .on('data', function (data) {
    nodes.push(data);
    gaugeJailed[data.name] = new client.Gauge({ name: `${data.name}_jailed`, help: 'Node jailed' });
    gaugeBalance[data.name] = new client.Gauge({ name: `${data.name}_balance`, help: 'Node balance' });
    gaugeClaims[data.name] = new client.Gauge({ name: `${data.name}_claims`, help: 'Node claims' });
    register.registerMetric(gaugeJailed[data.name]);
    register.registerMetric(gaugeBalance[data.name]);
    register.registerMetric(gaugeClaims[data.name]);
});
const gaugeTotalBalance = new client.Gauge({ name: `total_node_balance`, help: 'Total balance' });
register.registerMetric(gaugeTotalBalance);
server.listen(serverPort);
console.log(`Listening for Prometheus requests on ${serverPort}`);
//# sourceMappingURL=index.js.map