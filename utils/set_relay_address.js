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

let relayJson = require('../build/contracts/Relay.json')

var provider = new LedgerWalletProvider(ledgerOptions, 'https://mainnet.infura.io/JTdaA5dJvlwfCfdgT5Cm')
let web3 = new Web3(provider)

web3.eth.getAccounts()
.then(accounts => {
  let ownerAddress = accounts[0]
  console.log('owner address is '+ownerAddress)
  // api calls contract address
  let relayContractAddress = '0x26a572eeb6036ae1af510d561f59520f626857b9'
  let relayContract = new web3.eth.Contract(relayJson.abi, relayContractAddress)

  let oldApiCallsContractAddress = '0x65b85b31813df46726a2600d853b6f0db1b3f425'
  let newApiCallsContractAddress = '0xc657F717D0F5A3Df5aeEE0368dC814fB52578397'


  return relayContract.methods.setApiCallsContractAddress(newApiCallsContractAddress).send({
    from: ownerAddress,
    gas: 300000,
    gasPrice: '5000000000' // 5 gwei
  })
})
.then(function (response) {
    console.log(response)
})
.catch(e => console.log(e))




