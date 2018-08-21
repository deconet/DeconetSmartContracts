let Web3 = require('web3')
let BigNumber = require('bignumber.js')
let uuid = require('uuid')

const LedgerWalletProvider = require('truffle-ledger-provider');

const ledgerOptions = {
  networkId: 1,
  path: "44'/60'/0'/0",
  askConfirm: false,
  accountsLength: 1,
  accountsOffset: 0,
};  

let apiCallsJson = require('../build/contracts/APICalls.json')

var provider = new LedgerWalletProvider(ledgerOptions, 'http://18.208.64.51:8545')
let web3 = new Web3(provider)

web3.eth.getAccounts()
.then(accounts => {
  let ownerAddress = accounts[0]
  console.log('owner address is '+ownerAddress)
  // api calls contract address
  let apiCallsContractAddress = '0x65b85b31813df46726a2600d853b6f0db1b3f425'
  let apiCallsContract = new web3.eth.Contract(apiCallsJson.abi, apiCallsContractAddress)

  let usageReportingAddress = '0x63277d65a34769cd6d46b3cebdef54a811e7ba84'

  return apiCallsContract.methods.setUsageReportingAddress(usageReportingAddress).send({
    from: ownerAddress,
    gas: 3000000,
    gasPrice: '5000000000' // 5 gwei
  })
})
.then(function (response) {
    console.log(response)
})

