let Web3 = require('web3')
let BigNumber = require('bignumber.js')
let uuid = require('uuid')
var HDWalletProvider = require("truffle-hdwallet-provider")
let tokenJson = require('../build/contracts/DeconetToken.json')

let ownerAddress = null
let tokenContractAddress = '0x396a6f136180fe8ab7106478535496f3ba07f61c' // process.env.DECONET_TOKEN_CONTRACT_ADDRESS

const network = 'ropsten'

let web3 = null

if (network === 'ropsten') {
  console.log('eth rpc url is ' + process.env.DECONET_ETH_RPC_URL)
  let mnemonic = process.env.DECONET_BLOCKCHAIN_ROPSTEN_MNEMONIC
  var provider = new HDWalletProvider(mnemonic, process.env.DECONET_ETH_RPC_URL)
  ownerAddress = provider.getAddress()
  web3 = new Web3(provider)
} else if (network === 'development') {
  ownerAddress = '0x433Ee8dCC67A153611F1F3aDdF01a9eDA9b63f0D'
  web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))
  let privKey = '0x7a07f4c33e67368609cb2fdd5cdbdb63772751de1b2ba414512320240637b6fb'
  web3.eth.accounts.privateKeyToAccount(privKey)
}
console.log('ownerAddress: ' + ownerAddress)

let tokenContract = new web3.eth.Contract(tokenJson.abi, tokenContractAddress)

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
