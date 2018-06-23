const Web3 = require('web3')
// const DeconetContract = require('../build/contracts/DeconetToken.json')
// const Contract = require('truffle-contract')


// const contractAddress = '' // put deployed contract address here

let web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))

var args = process.argv.slice(2);
if (args.length !== 3) { 
  console.log('Usage: node send_eth.js <privateKeyFromAcct> <toAddress> <weiAmount>')
  return
}

// where to send the tokens and eth
let toAddress = args[1]

// send from here
let privKey = args[0]
let acct = web3.eth.accounts.privateKeyToAccount(privKey)
let fromAddress = acct.address

// send eth
let txParams = {
  to: toAddress,
  from: fromAddress,
  value: args[2]
}

web3.eth.sendTransaction(txParams)
.then(function (receipt) {
  console.log('receipt: ', receipt)
})
