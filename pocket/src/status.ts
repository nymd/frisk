import { writeAPI } from './datasources/influx'
import { Point } from '@influxdata/influxdb-client'
import util from 'util';
const exec = util.promisify(require('child_process').exec);
var argv = require('minimist')(process.argv.slice(2));
var CronJob = require('cron').CronJob;

const set = argv['_'][0];
const mode = argv['_'][1];
const nodeCSV = `./src/accounts/${set}-nodes.csv`;
const dataNodeURL = 'https://peer-1.nodes.pokt.network:4200'
const startingAmount = 100000;
const pointTimestamp = new Date()
const fs = require('fs'); 
const csv = require('csv-parser');
const nodes: any[] = [];


fs.createReadStream(nodeCSV).pipe(csv())
.on('data', (data: any) => nodes.push(data));

var jobHeight = new CronJob('*/20 * * * * *', async function() {
  await processNodeHeights(nodes)

}, null, true, 'America/Vancouver');
jobHeight.start();

var jobBalance = new CronJob('0 */5 * * * *', function() {
  processNodeBalancesAndClaims(nodes);
}, null, true, 'America/Vancouver');
jobBalance.start();

var jobJailed = new CronJob('0 0 * * * *', function() {
  processNodeJailings(nodes);
}, null, true, 'America/Vancouver');
jobJailed.start();

async function processNodeJailings(nodes: Array<any>) {
  for (const node of nodes) {
    const nodeNumber = node.name.split("-").pop()
    let nodeJailed = await fetchJailedStatus(set, nodeNumber, node.address);

    if (nodeJailed) {
      console.log(`Node: ${node.name}, jailed: ${nodeJailed}`);
    
      const pointJailed = new Point('jailed')
          .tag('set', set)
          .tag('address', node.address)
          .tag('moniker', node.name)
          .stringField('jailed', 'true')
          .timestamp(pointTimestamp)

      writeAPI.writePoint(pointJailed)
      writeAPI.flush()

      if (mode === "unjail") {
        const command = `pocket --remoteCLIURL ${dataNodeURL} nodes unjail ${node.address} mainnet 10000 false`;
        const { stdout, stderr } = await exec(command);
        if (!stderr)
        {
          console.log(stdout);
        }
      }
    }
  }
}

async function processNodeHeights(nodes: Array<any>) {

  for (const node of nodes) {
    
    const nodeNumber = node.name.split("-").pop()
    const nodeHeight = await fetchHeight(node, set, nodeNumber);
    const pointHeight = new Point('height')
            .tag('set', set)
            .tag('address', node.address)
            .tag('moniker', node.name)
            .intField('height', nodeHeight)
            .timestamp(pointTimestamp)
    
    writeAPI.writePoint(pointHeight)
    writeAPI.flush()
  }
}

async function processNodeBalancesAndClaims(nodes: Array<any>) {

  let totalBalance = 0;

  for (const node of nodes) {

    const nodeNumber = node.name.split("-").pop()
    let nodeBalance = await fetchBalance(set, nodeNumber, node.address);

    nodeBalance = nodeBalance - startingAmount;
    const convertedNodeBalance = Math.round(upokt(nodeBalance));

    const nodeClaims = await fetchClaims(set, nodeNumber, node.address);
    
    const pointClaims = new Point('claims')
        .tag('set', set)
        .tag('address', node.address)
        .tag('moniker', node.name)
        .intField('pokt', nodeClaims)
        .timestamp(pointTimestamp)

    writeAPI.writePoint(pointClaims)

    if (convertedNodeBalance > 0) {
      const pointBalance = new Point('balance')
          .tag('set', set)
          .tag('address', node.address)
          .tag('moniker', node.name)
          .floatField('pokt', convertedNodeBalance)
          .timestamp(pointTimestamp)

      writeAPI.writePoint(pointBalance)
      writeAPI.flush()
    }
    console.log(`${node.name} balance: ${convertedNodeBalance}, claims: ${nodeClaims}`);
    totalBalance = totalBalance + nodeBalance;
  }
  const convertedTotalBalance = upokt(totalBalance);
  console.log(`Total node balance: ${convertedTotalBalance}`);
}

async function fetchHeight(node: any, set: string, number: number): Promise<string> {
  const command = `docker exec -i ${set}${number} pocket query height`;
  const { stdout, stderr } = await exec(command);
  if (!stderr)
  {
    const regex = /"height":\s([\w])+/g;
    const matches = regex.exec(stdout);
    if (matches && matches[0]) {
      const height = matches[0].replace('"height": ', '');
      if (height) {
        return height
      }
    }
  }
  return "";
}

async function fetchClaims(set: string, number: number, address: string): Promise<number> {
  const command = `docker exec -i ${set}${number} pocket query node-claims ${address}`;
  const { stdout, stderr } = await exec(command);
  if (!stderr)
  {
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
}

async function fetchJailedStatus(set: string, number: number, address: string): Promise<boolean|null> {
  const command = `docker exec -i ${set}${number} pocket query node ${address}`;
  const { stdout, stderr } = await exec(command);
  if (!stderr)
  {
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
}

async function fetchBalance(set: string, number: number, address: string): Promise<number> {
  const command = `docker exec -i ${set}${number} pocket query balance ${address}`;
  const { stdout, stderr } = await exec(command);
  if (!stderr)
  {
    const regex = /"balance":\s([\d])+/g;
    const matches = regex.exec(stdout);
    if (matches && matches[0]) {
      return parseInt(matches[0].replace('"balance": ', ''));
    }
    return 0;
  }
  return 0;
}

function upokt(amount: number): number {
  return amount / 1000000;
}