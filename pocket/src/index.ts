import axios from 'axios';
import * as https from 'https';

require('dotenv').config();

const http = require('http');
const client = require('prom-client');
const register = new client.Registry();
register.setDefaultLabels({
  app: 'pocket'
})

const serverPort = process.env.SERVER_PORT;
const dataNodeURL = process.env.DATA_NODE_URL;

const axiosInstance = axios.create({
  httpsAgent: new https.Agent({  
      rejectUnauthorized: true
    }),
  baseURL: dataNodeURL,
  headers: {
      "Content-Type": "application/json"
  },
  timeout: 30000
});

async function processNodeJailings(nodes: Array<any>, height: number) {
  for (const node of nodes) {
    let nodeJailed = await fetchJailedStatus(node.address, height);
    if (nodeJailed) {
      gaugeJailed[node.name].set(1);
    }
    else {
      gaugeJailed[node.name].set(0);
    }
  }
}

async function processNodeBalancesAndClaims(nodes: Array<any>, height: number) {
  let totalBalance = 0;
  for (const node of nodes) {
    let nodeBalance = await fetchBalance(node.address, height);
    const convertedNodeBalance = Math.round(upokt(nodeBalance));
    gaugeBalance[node.name].set(convertedNodeBalance);

    gaugeClaims[node.name].set(await fetchClaims(node.address, height));

    totalBalance = totalBalance + nodeBalance;
  }
  gaugeTotalBalance.set(upokt(totalBalance));
}

async function fetchClaims(address: string, height: number): Promise<number> {
  const res = await axiosInstance.post('/query/nodeclaims', JSON.stringify({ address, height }));
  if (res.data)
  {
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
}

async function fetchJailedStatus(address: string, height: number): Promise<boolean|null> {
  const res = await axiosInstance.post('/query/node', JSON.stringify({ address, height }));
  if (res.data)
  {
    return res.data.jailed;
  }
  return null;
}

async function fetchBalance(address: string, height: number): Promise<number> {
  const res = await axiosInstance.post('/query/balance', JSON.stringify({ address, height }));
  if (res.data)
  {
    return res.data.balance;
  }
  return 0;
}

async function fetchCurrentHeight(): Promise<number> {
  const res = await axiosInstance.post('/query/height');
  if (res.data)
  {
    return res.data.height;
  }
  return 0;
}

function upokt(amount: number): number {
  return amount / 1000000;
}

const server = http.createServer(async function (req: { url: string; },res: any) {

  if (req.url === '/metrics') {
    const height = await fetchCurrentHeight();
    await processNodeJailings(nodes, height);
    await processNodeBalancesAndClaims(nodes, height);
    res.setHeader('Content-Type', register.contentType);
    res.end(await register.metrics());
  }
});

const fs = require('fs'); 
const csv = require('csv-parser');
const nodes: any[] = [];
const gaugeJailed: any[] = [];
const gaugeBalance: any[] = [];
const gaugeClaims: any[] = [];
fs.createReadStream('./nodes.csv').pipe(csv())
  .on('data', function(data: any) {
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
console.log(`Listening for Prometheus requests on ${serverPort}`)