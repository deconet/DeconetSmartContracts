let Web3 = require('web3')
let BigNumber = require('bignumber.js')
let uuid = require('uuid')
var HDWalletProvider = require("truffle-hdwallet-provider")
let tokenJson = require('../build/contracts/DeconetToken.json')
let relayJson = require('../build/contracts/Relay.json')

// puts "* DECONET_TOKEN_CONTRACT_ADDRESS"
// puts "* DECONET_API_USAGE_REPORTER_PRIVATE_KEY"
// puts "* DECONET_RELAY_CONTRACT_ADDRESS"
// puts "* DECONET_ETH_RPC_URL"

var args = process.argv.slice(2);
if (args.length < 1) { 
  console.log('Usage: node print_env_for_rails_tests.js <privateKeyOfGanacheAcctZero>')
  return
}

let tokenContractAddress = tokenJson.networks['95'].address
let relayContractAddress = relayJson.networks['95'].address

console.log(`
  export DECONET_TOKEN_CONTRACT_ADDRESS=${tokenContractAddress}
  export DECONET_RELAY_CONTRACT_ADDRESS=${relayContractAddress}
  export DECONET_API_USAGE_REPORTER_PRIVATE_KEY=${args[0]}
  export DECONET_ETH_RPC_URL=http://localhost:8545
`)
