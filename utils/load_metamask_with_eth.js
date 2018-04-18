const Web3 = require('web3')
// const DeconetContract = require('../build/contracts/DeconetToken.json')
// const Contract = require('truffle-contract')


// const contractAddress = '' // put deployed contract address here

let web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))

// where to send the tokens and eth
let toAddress = '0xA2266e01703E4CA0Ffc4b374635acDbDABda7793'

// send from here. key for acct index 8 in ganache
let fromAddress = '0x433Ee8dCC67A153611F1F3aDdF01a9eDA9b63f0D'
let privKey = '0x7a07f4c33e67368609cb2fdd5cdbdb63772751de1b2ba414512320240637b6fb'
web3.eth.accounts.privateKeyToAccount(privKey)

// also import contract priv key index 0 in ganache
// let contractFromAddress = '0x627306090abaB3A6e1400e9345bC60c78a8BEf57'
// let contractPrivKey = 'c87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3'
// web3.eth.accounts.privateKeyToAccount(contractPrivKey)


// send eth
let txParams = {
  to: toAddress,
  from: fromAddress,
  value: 10000000000000000000 // 10 eth
}

web3.eth.sendTransaction(txParams)
.then(function (receipt) {
  console.log('receipt: ', receipt)
})

// also send 10 eth to thi address
toAddress = '0xdbd360F30097fB6d938dcc8B7b62854B36160B45'

txParams = {
  to: toAddress,
  from: fromAddress,
  value: 10000000000000000000 // 10 eth
}

web3.eth.sendTransaction(txParams)
.then(function (receipt) {
  console.log('receipt: ', receipt)
})

// // send tokens
// const deconet = Contract(DeconetContract, contractAddress)
// deconet.setProvider(web3.currentProvider)
// deconet.methods.