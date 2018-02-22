var DeconetToken = artifacts.require('./DeconetToken.sol')
var Registry = artifacts.require('./Registry.sol')
var Relay = artifacts.require('./Relay.sol')

module.exports = function (deployer) {
  let relay, registry, deconetToken
  deployer.deploy(Relay)
  .then(() => {
    relay = Relay.at(Relay.address)
    return deployer.deploy(Registry)
  }).then(() => {
    registry = Registry.at(Registry.address)
    return deployer.deploy(DeconetToken)
  }).then(() => {
    deconetToken = DeconetToken.at(DeconetToken.address)
    console.log('Seting relay contract address to ' + relay.address)
    return deconetToken.setRelayContractAddress(relay.address)
  }).then(() => {
    console.log('Setting token contract address to ' + deconetToken.address)
    return relay.setTokenContractAddress(deconetToken.address)
  }).then(() => {
    console.log('Setting registry contract address to ' + registry.address)
    return relay.setRegistryContractAddress(registry.address)
  })
}
