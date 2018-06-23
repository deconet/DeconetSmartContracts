let Web3 = require('web3')
let BigNumber = require('bignumber.js')
let uuid = require('uuid')
var HDWalletProvider = require("truffle-hdwallet-provider")
let apiCallsJson = require('../build/contracts/APICalls.json')
let licenseSalesJson = require('../build/contracts/LicenseSales.json')
let relayJson = require('../build/contracts/Relay.json')

let ownerAddress = null
let apiCallsContractAddress = null

var args = process.argv.slice(2);
if (args.length != 2) { 
  console.log('Usage: node set_token_reward.js <network> <newReward>')
  return
}

let network = args[0]
let newReward = args[1]

let web3 = null



// if (network === 'ropsten') {
  console.log('eth rpc url is ' + process.env.DECONET_ETH_RPC_URL)
  let mnemonic = process.env.DECONET_BLOCKCHAIN_ROPSTEN_MNEMONIC
  var provider = new HDWalletProvider(mnemonic, process.env.DECONET_ETH_RPC_URL)
  ownerAddress = provider.getAddress()
  web3 = new Web3(provider)

  // relay contract address
  let relayContractAddress = '0x19f5ad811036f6db2d494085a7b54fbb45954aea'
  let relayContract = new web3.eth.Contract(relayJson.abi, relayContractAddress)

  // get license sales contract address
  relayContract.methods.licenseSalesContractAddress()
  .call()
  .then(function (address) {
    let licenseSalesContract = new web3.eth.Contract(licenseSalesJson.abi, address)
    return licenseSalesContract.methods.setTokenReward(newReward).send({from: ownerAddress, gasLimit: '4000000'})
  })
  .then(function (response) {
    console.log(response)
  })

  // get api calls contract address
  relayContract.methods.apiCallsContractAddress()
  .call()
  .then(function (address) {
    let apiCallsContract = new web3.eth.Contract(apiCallsJson.abi, address)
    return apiCallsContract.methods.setTokenReward(newReward).send({from: ownerAddress, gasLimit: '4000000'})
  })
  .then(function (response) {
    console.log(response)
  })
// } else if (network === 'development') {
//   if (args.length !== 2) { 
//     console.log('Usage: node unpause_token.js <network> <privateKeyOfGanacheAcctZero>')
//     return
//   }
//   tokenContractAddress = tokenJson.networks['95'].address
//   web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))
//   let privKey = '0x' + args[1]
//   let acct = web3.eth.accounts.privateKeyToAccount(privKey)
//   ownerAddress = acct.address
// }
