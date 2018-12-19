var DeconetToken = artifacts.require('./DeconetToken.sol')
var Registry = artifacts.require('./Registry.sol')
var APIRegistry = artifacts.require('./APIRegistry.sol')
var LicenseSales = artifacts.require('./LicenseSales.sol')
var Relay = artifacts.require('./Relay.sol')
var APICalls = artifacts.require('./APICalls.sol')

const beep = require('../utils/beep')

module.exports = async (deployer) => {
  let relay, registry, deconetToken, licenseSales, apiRegistry, apiCalls
  beep()
  console.log('Deploying token contract')
  await deployer.deploy(DeconetToken)
  beep()

  deconetToken = await DeconetToken.at(DeconetToken.address)
  deployer.link(DeconetToken, [LicenseSales, APICalls])
  console.log('Deploying relay contract')
  await deployer.deploy(Relay)
  beep()

  relay = await Relay.at(Relay.address)
  deployer.link(Relay, [LicenseSales, APICalls])
  console.log('Deploying api registry contract')
  await deployer.deploy(APIRegistry)
  beep()

  apiRegistry = await APIRegistry.at(APIRegistry.address)
  deployer.link(APIRegistry, APICalls)
  console.log('Deploying registry contract')
  await deployer.deploy(Registry)
  beep()

  registry = await Registry.at(Registry.address)
  deployer.link(Registry, LicenseSales)
  console.log('Deploying license sales contract')
  await deployer.deploy(LicenseSales)
  beep()

  licenseSales = await LicenseSales.at(LicenseSales.address)
  console.log('Deploying api calls contract')
  await deployer.deploy(APICalls)
  beep()

  apiCalls = await APICalls.at(APICalls.address)
  console.log('Setting token contract address on license sales to ' + deconetToken.address)
  await licenseSales.setTokenContractAddress(deconetToken.address)
  beep()

  console.log('Setting token contract address on api calls to ' + deconetToken.address)
  await apiCalls.setTokenContractAddress(deconetToken.address)
  beep()

  console.log('Setting relay contract address on license sales to ' + relay.address)
  await licenseSales.setRelayContractAddress(relay.address)
  beep()

  console.log('Setting relay contract address on api calls to ' + relay.address)
  await apiCalls.setRelayContractAddress(relay.address)
  beep()

  console.log('Setting license sales contract address on relay to ' + licenseSales.address)
  await relay.setLicenseSalesContractAddress(licenseSales.address)
  beep()

  console.log('Setting api registry contract address on relay to ' + apiRegistry.address)
  await relay.setApiRegistryContractAddress(apiRegistry.address)
  beep()

  console.log('Setting registry contract address on relay to ' + registry.address)
  await relay.setRegistryContractAddress(registry.address)
  beep()

  console.log('Setting api calls contract address on relay to ' + apiCalls.address)
  await relay.setApiCallsContractAddress(apiCalls.address)


  if (process.env.DECONET_ACTIVATE_TOKEN_REWARD == "true") {
    beep()
    console.log('Giving LicenseSale contract ability to transfer 5% of owner tokens')
    let fivePercent = '50000000000000000000000000'
    await deconetToken.approve(licenseSales.address, fivePercent)
  }

  if (process.env.DECONET_ACTIVATE_TOKEN_REWARD == "true") {
    beep()
    console.log('Giving APICalls contract ability to transfer 5% of owner tokens')
    let fivePercent = '50000000000000000000000000'
    await deconetToken.approve(apiCalls.address, fivePercent)
  }
}
