let Web3 = require('web3')
let BigNumber = require('bignumber.js')
let uuid = require('uuid')
var HDWalletProvider = require("truffle-hdwallet-provider")
let tokenJson = require('../build/contracts/DeconetToken.json')

let ownerAddress = null
let tokenContractAddress = null

var args = process.argv.slice(2);
if (args.length < 1) { 
  console.log('Usage: node pause_token.js <network>')
  return
}

let network = args[0]

let web3 = null

if (network === 'ropsten') {
  console.log('eth rpc url is ' + process.env.DECONET_ETH_RPC_URL)
  let mnemonic = process.env.DECONET_BLOCKCHAIN_ROPSTEN_MNEMONIC
  var provider = new HDWalletProvider(mnemonic, process.env.DECONET_ETH_RPC_URL)
  ownerAddress = provider.getAddress()
  web3 = new Web3(provider)
  tokenContractAddress = process.env.DECONET_TOKEN_CONTRACT_ADDRESS
} else if (network === 'development') {
  if (args.length !== 2) { 
    console.log('Usage: node unpause_token.js <network> <privateKeyOfGanacheAcctZero>')
    return
  }
  tokenContractAddress = tokenJson.networks['95'].address
  web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))
  let privKey = '0x' + args[1]
  let acct = web3.eth.accounts.privateKeyToAccount(privKey)
  ownerAddress = acct.address
}
console.log('ownerAddress: ' + ownerAddress)

let tokenContract = new web3.eth.Contract(tokenJson.abi, tokenContractAddress)

tokenContract.methods.pause()
.send({from: ownerAddress, gasLimit: '4000000'})
.on('transactionHash', (hash) => {
  console.log('hash: ')
  console.log(hash)
})
.on('receipt', (receipt) => {
  console.log('receipt:')
  console.log(receipt)
})
.on('error', console.error)
