import util from 'util';
const exec = util.promisify(require('child_process').exec);

const nodeCSV = './pokt-nodes.csv';
const dataNodeURL = 'https://pokt-10.nachonodes.com:4210'
const namePrefix = 'POKT-';
const num = 1;
const remainingAmount = 60000;
const sweepWallet = '7006d985a758450b94519a62d39f5690684fe626';

async function main() {
  const fs = require('fs'); 
  const csv = require('csv-parser');
  const nodes: any[] = [];

  fs.createReadStream(nodeCSV).pipe(csv())
  .on('data', (data: any) => nodes.push(data))
  .on('end', async () => {
    await processNodeBalancesAndClaims(nodes);
  });
}

async function processNodeBalancesAndClaims(nodes: Array<any>) {
  let totalBalance = 0;
  for (const node of nodes) {
    let nodeBalance = await fetchBalance(node.address);
    nodeBalance = nodeBalance - remainingAmount;
    const convertedNodeBalance = Math.round(upokt(nodeBalance));

    if (convertedNodeBalance <= 0) { continue; }

    console.log(`${node.name} balance: ${convertedNodeBalance}`);
    await sweepBalance(node.address, nodeBalance);

    totalBalance = totalBalance + nodeBalance;
  }
  const convertedTotalBalance = upokt(totalBalance);
  console.log(`Sweeping in: ${convertedTotalBalance}`);
}

async function sweepBalance(address: string, amount: number): Promise<boolean> {
  const command = `pocket --remoteCLIURL ${dataNodeURL} accounts send-tx ${address} ${sweepWallet} ${amount} mainnet 10000 sweep`;
  const { stdout, stderr } = await exec(command);
  if (!stderr)
  {
    console.log(stdout);
    return true;
  }
  return false;
}

async function fetchBalance(address: string): Promise<number> {
  const command = `pocket --remoteCLIURL ${dataNodeURL} query balance ${address}`;
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

main();
