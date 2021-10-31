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
const fs = require('fs'); 
const csv = require('csv-parser');
const nodes: any[] = [];
let pointHeights: Point[] = [];
let pointBalances: Point[] = [];
let pointClaims: Point[] = [];

fs.createReadStream(nodeCSV).pipe(csv())
.on('data', (data: any) => nodes.push(data));

var jobHeight = new CronJob('*/20 * * * * *', async function() {
  await processNodeHeights(nodes)
  writeAPI.writePoints(pointHeights)
  writeAPI.flush()
}, null, true, 'America/Vancouver');
jobHeight.start();

var jobBalance = new CronJob('0 */1 * * * *', async function() {
  await processNodeBalancesAndClaims(nodes);
  writeAPI.writePoints(pointBalances)
  writeAPI.writePoints(pointClaims)
  writeAPI.flush()
}, null, true, 'America/Vancouver');
jobBalance.start();

var jobJailed = new CronJob('0 0 * * * *', function() {
  processNodeJailings(nodes);
}, null, true, 'America/Vancouver');
jobJailed.start();

async function processNodeJailings(nodes: Array<any>) {
  for (const node of nodes) {

    const pointTimestamp = new Date()
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

  pointHeights = [];
  for (const node of nodes) {
    
    const pointTimestamp = new Date()
    const nodeNumber = node.name.split("-").pop()
    await fetchHeight(node, set, nodeNumber, pointTimestamp);
  }
}

async function processNodeBalancesAndClaims(nodes: Array<any>) {

  let totalBalance = 0;

  for (const node of nodes) {

    const pointTimestamp = new Date()
    const nodeNumber = node.name.split("-").pop()
    await fetchClaims(node, set, nodeNumber, node.address, pointTimestamp);
    await fetchBalance(node, set, nodeNumber, node.address, pointTimestamp);

  }
  const convertedTotalBalance = upokt(totalBalance);
  console.log(`Total node balance: ${convertedTotalBalance}`);
}

async function fetchHeight(node: any, set: string, number: number, pointTimestamp: Date): Promise<string> {

  const command = `docker exec -i ${set}${number} pocket query height`;
  const { stdout, stderr } = await exec(command);
  if (!stderr)
  {
    const regex = /"height":\s([\w])+/g;
    const matches = regex.exec(stdout);
    if (matches && matches[0]) {
      const height = matches[0].replace('"height": ', '');
      if (height) {
        const pointHeight = new Point('height')
            .tag('set', set)
            .tag('address', node.address)
            .tag('moniker', node.name)
            .intField('height', height)
            .timestamp(pointTimestamp)

        pointHeights.push(pointHeight) 
      }
    }
  }
  return "";
}

async function fetchClaims(node: any, set: string, number: number, address: string, pointTimestamp: Date): Promise<number> {

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
      const pointClaim = new Point('claims')
        .tag('set', set)
        .tag('address', node.address)
        .tag('moniker', node.name)
        .intField('pokt', claims)
        .timestamp(pointTimestamp)

      pointClaims.push(pointClaim)  
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

async function fetchBalance(node: any, set: string, number: number, address: string, pointTimestamp: Date): Promise<number> {

  const command = `docker exec -i ${set}${number} pocket query balance ${address}`;
  const { stdout, stderr } = await exec(command);
  if (!stderr)
  {
    const regex = /"balance":\s([\d])+/g;
    const matches = regex.exec(stdout);
    if (matches && matches[0]) {
      let nodeBalance = parseInt(matches[0].replace('"balance": ', ''));
      nodeBalance = nodeBalance - startingAmount;
      const convertedNodeBalance = Math.round(upokt(nodeBalance));
      
      if (convertedNodeBalance > 0) {
        const pointBalance = new Point('balance')
            .tag('set', set)
            .tag('address', node.address)
            .tag('moniker', node.name)
            .floatField('pokt', convertedNodeBalance)
            .timestamp(pointTimestamp)

        pointBalances.push(pointBalance)
        console.log(`${node.name} balance: ${convertedNodeBalance}`);
      }
    }
    // return 0;
  }
  return 0;
}

function upokt(amount: number): number {
  return amount / 1000000;
}