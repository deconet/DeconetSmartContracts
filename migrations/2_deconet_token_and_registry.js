var DeconetToken = artifacts.require('./DeconetToken.sol')
var Registry = artifacts.require('./Registry.sol')
var APIRegistry = artifacts.require('./APIRegistry.sol')
var LicenseSales = artifacts.require('./LicenseSales.sol')
var Relay = artifacts.require('./Relay.sol')
var APICalls = artifacts.require('./APICalls.sol')

const beep = require('../utils/beep')

module.exports = function (deployer) {
  let relay, registry, deconetToken, licenseSales, apiRegistry, apiCalls
  beep()
  console.log('Deploying token contract')
  deployer.deploy(DeconetToken)
  .then(() => {
    beep()
    deconetToken = DeconetToken.at(DeconetToken.address)
    deployer.link(DeconetToken, [LicenseSales, APICalls])
    console.log('Deploying relay contract')
    return deployer.deploy(Relay)
  }).then(() => {
    beep()
    relay = Relay.at(Relay.address)
    deployer.link(Relay, [LicenseSales, APICalls])
    console.log('Deploying api registry contract')
    return deployer.deploy(APIRegistry)
  }).then(() => {
    beep()
    apiRegistry = APIRegistry.at(APIRegistry.address)
    deployer.link(APIRegistry, APICalls)
    console.log('Deploying registry contract')
    return deployer.deploy(Registry)
  }).then(() => {
    beep()
    registry = Registry.at(Registry.address)
    deployer.link(Registry, LicenseSales)
    console.log('Deploying license sales contract')
    return deployer.deploy(LicenseSales)
  }).then(() => {
    beep()
    licenseSales = LicenseSales.at(LicenseSales.address)
    console.log('Deploying api calls contract')
    return deployer.deploy(APICalls)
  }).then(() => {
    beep()
    apiCalls = APICalls.at(APICalls.address)
    console.log('Setting token contract address on license sales to ' + deconetToken.address)
    return licenseSales.setTokenContractAddress(deconetToken.address)
  }).then(() => {
    beep()
    console.log('Setting token contract address on api calls to ' + deconetToken.address)
    return apiCalls.setTokenContractAddress(deconetToken.address)
  }).then(() => {
    beep()
    console.log('Setting relay contract address on license sales to ' + relay.address)
    return licenseSales.setRelayContractAddress(relay.address)
  }).then(() => {
    beep()
    console.log('Setting relay contract address on api calls to ' + relay.address)
    return apiCalls.setRelayContractAddress(relay.address)
  }).then(() => {
    beep()
    console.log('Setting license sales contract address on relay to ' + licenseSales.address)
    return relay.setLicenseSalesContractAddress(licenseSales.address)
  }).then(() => {
    beep()
    console.log('Setting api registry contract address on relay to ' + apiRegistry.address)
    return relay.setApiRegistryContractAddress(apiRegistry.address)
  }).then(() => {
    beep()
    console.log('Setting registry contract address on relay to ' + registry.address)
    return relay.setRegistryContractAddress(registry.address)
  }).then(() => {
    beep()
    console.log('Setting api calls contract address on relay to ' + apiCalls.address)
    return relay.setApiCallsContractAddress(apiCalls.address)
  }).then(() => {
    if (process.env.DECONET_ACTIVATE_TOKEN_REWARD == "true") {
      beep()
      console.log('Giving LicenseSale contract ability to transfer 5% of owner tokens')
      let fivePercent = '50000000000000000000000000'
      return deconetToken.approve(licenseSales.address, fivePercent)
    } else {
      return Promise.resolve()
    }
  }).then(() => {
    if (process.env.DECONET_ACTIVATE_TOKEN_REWARD == "true") {
      beep()
      console.log('Giving APICalls contract ability to transfer 5% of owner tokens')
      let fivePercent = '50000000000000000000000000'
      return deconetToken.approve(apiCalls.address, fivePercent)
    } else {
      return Promise.resolve()
    }
  })
}
