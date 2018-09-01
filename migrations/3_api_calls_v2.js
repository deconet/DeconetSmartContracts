var DeconetToken = artifacts.require('./DeconetToken.sol')
var Registry = artifacts.require('./Registry.sol')
var APIRegistry = artifacts.require('./APIRegistry.sol')
var LicenseSales = artifacts.require('./LicenseSales.sol')
var Relay = artifacts.require('./Relay.sol')
var APICalls = artifacts.require('./APICalls.sol')

const beep = require('../utils/beep')

module.exports = function (deployer, network, accounts) {
  let relay, deconetToken, apiCalls
  deconetToken = DeconetToken.at(DeconetToken.address)
  relay = Relay.at(Relay.address)
  apiCalls = APICalls.at(APICalls.address)
  deployer.then(() => {
    // check if we already gave an allowance to the old apicalls contract, and remove it if so
    beep()
    console.log('checking if token allowance exists for api calls contract v2')
    return deconetToken.allowance(accounts[0], apiCalls.address)
  })
  .then((result) => {
    console.log('token allowance for apicalls: ' + result)
    if (result != 0) {
      console.log('decreasing approval for old apicalls')
      return deconetToken.decreaseApproval(apiCalls.address, result)
    } else { 
      return Promise.resolve()
    }
  }).then(() => {
    beep()
    console.log('Deploying api calls contract v2')
    return deployer.deploy(APICalls)
  }).then(() => {
    beep()
    apiCalls = APICalls.at(APICalls.address)
    console.log('Setting token contract address on api calls to ' + deconetToken.address)
    return apiCalls.setTokenContractAddress(deconetToken.address)
  }).then(() => {
    beep()
    console.log('Setting relay contract address on api calls to ' + relay.address)
    return apiCalls.setRelayContractAddress(relay.address)
  }).then(() => {
    beep()
    console.log('Setting api calls contract address on relay to ' + apiCalls.address)
    return relay.setApiCallsContractAddress(apiCalls.address)
  }).then(() => {
    if (process.env.DECONET_ACTIVATE_TOKEN_REWARD == "true") {
      beep()
      console.log('Giving APICalls contract ability to transfer 5% of owner tokens')
      let fivePercent = '50000000000000000000000000'
      return deconetToken.approve(apiCalls.address, fivePercent)
    } else {
      return Promise.resolve()
    }
  }).then(() => {
    beep(3)
    console.log('Done')
  })
}
