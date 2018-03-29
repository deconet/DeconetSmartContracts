let Web3 = require('web3')
let BigNumber = require('bignumber.js')
let uuid = require('uuid')
var HDWalletProvider = require("truffle-hdwallet-provider")

console.log('eth rpc url is ' + process.env.DECONET_ETH_RPC_URL)
let mnemonic = process.env.DECONET_BLOCKCHAIN_ROPSTEN_MNEMONIC
var provider = new HDWalletProvider(mnemonic, process.env.DECONET_ETH_RPC_URL);
let web3 = new Web3(provider)
let tokenJson = require('../build/contracts/DeconetToken.json')

let ownerAddress = '0x648D692e5c507c233d0f9d9fea062429003b3144'

let tokenContractAddress = process.env.DECONET_TOKEN_CONTRACT_ADDRESS
let tokenContract = new web3.eth.Contract(tokenJson.abi, tokenContractAddress)

console.log('ownerAddress: ' + ownerAddress)
tokenContract.methods.unpause()
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
