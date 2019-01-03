var DeconetToken = artifacts.require('./DeconetToken.sol')
var Registry = artifacts.require('./Registry.sol')
var APIRegistry = artifacts.require('./APIRegistry.sol')
var LicenseSales = artifacts.require('./LicenseSales.sol')
var Relay = artifacts.require('./Relay.sol')
var APICalls = artifacts.require('./APICalls.sol')

const beep = require('../utils/beep')

module.exports = async (deployer, network, accounts) => {
  let relay, deconetToken, apiCalls
  deconetToken = await DeconetToken.at(DeconetToken.address)
  relay = await Relay.at(Relay.address)
  apiCalls = await APICalls.at(APICalls.address)

  // check if we already gave an allowance to the old apicalls contract, and remove it if so
  beep()
  console.log('checking if token allowance exists for api calls contract v2')
  let result = await deconetToken.allowance(accounts[0], apiCalls.address)
  console.log('token allowance for apicalls: ' + result)
  if (result != 0) {
    console.log('decreasing approval for old apicalls')
    await deconetToken.decreaseApproval(apiCalls.address, result)
  }
  beep()

  console.log('Deploying api calls contract v2')
  await deployer.deploy(APICalls)
  beep()

  apiCalls = await APICalls.at(APICalls.address)
  console.log('Setting token contract address on api calls to ' + deconetToken.address)
  await apiCalls.setTokenContractAddress(deconetToken.address)
  beep()

  console.log('Setting relay contract address on api calls to ' + relay.address)
  await apiCalls.setRelayContractAddress(relay.address)
  beep()

  console.log('Setting api calls contract address on relay to ' + apiCalls.address)
  await relay.setApiCallsContractAddress(apiCalls.address)


  if (process.env.DECONET_ACTIVATE_TOKEN_REWARD == "true") {
    beep()
    console.log('Giving APICalls contract ability to transfer 5% of owner tokens')
    let fivePercent = '50000000000000000000000000'
    await deconetToken.approve(apiCalls.address, fivePercent)
  }

  beep(3)
  console.log('Done')
}
