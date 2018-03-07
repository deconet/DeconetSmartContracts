var DeconetToken = artifacts.require('./DeconetToken.sol')
var Registry = artifacts.require('./Registry.sol')
var APIRegistry = artifacts.require('./APIRegistry.sol')
var LicenseSales = artifacts.require('./LicenseSales.sol')
var Relay = artifacts.require('./Relay.sol')

module.exports = function (deployer) {
  let relay, registry, deconetToken, licenseSales, apiRegistry
  console.log('Deploying relay contract')
  deployer.deploy(Relay)
  .then(() => {
    relay = Relay.at(Relay.address)
    console.log('Deploying api registry contract')
    return deployer.deploy(APIRegistry)
  }).then(() => {
    apiRegistry = APIRegistry.at(APIRegistry.address)
    console.log('Deploying registry contract')
    return deployer.deploy(Registry)
  }).then(() => {
    registry = Registry.at(Registry.address)
    console.log('Deploying license sales contract')
    return deployer.deploy(LicenseSales)
  }).then(() => {
    licenseSales = LicenseSales.at(LicenseSales.address)
    console.log('Deploying token contract')
    return deployer.deploy(DeconetToken)
  }).then(() => {
    deconetToken = DeconetToken.at(DeconetToken.address)
    console.log('Setting token contract address on license sales to ' + deconetToken.address)
    return licenseSales.setTokenContractAddress(deconetToken.address)
  }).then(() => {
    console.log('Seting relay contract address on license sales to ' + relay.address)
    return licenseSales.setRelayContractAddress(relay.address)
  }).then(() => {
    console.log('Setting license sales contract address on relay to ' + licenseSales.address)
    return relay.setLicenseSalesContractAddress(licenseSales.address)
  }).then(() => {
    console.log('Setting api registry contract address on relay to ' + apiRegistry.address)
    return relay.setApiRegistryContractAddress(apiRegistry.address)
  }).then(() => {
    console.log('Setting registry contract address on relay to ' + registry.address)
    return relay.setRegistryContractAddress(registry.address)
  }).then(() => {
    console.log('Giving LicenseSale contract ability to transfer 10% of owner tokens')
    let tenPercent = '100000000000000000000000000'
    return deconetToken.approve(licenseSales.address, tenPercent)
  })
}
