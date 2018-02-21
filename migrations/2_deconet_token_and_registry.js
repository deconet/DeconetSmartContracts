var DeconetToken = artifacts.require('./DeconetToken.sol')
var Registry = artifacts.require('./Registry.sol')
var Relay = artifacts.require('./Relay.sol')

module.exports = async function (deployer) {
  await deployer.deploy(DeconetToken)
  await deployer.deploy(Registry)
  // function Relay(address _tokenContractAddress, address _registryContractAddress);
  deployer.deploy(Relay, DeconetToken.address, Registry.address)
}
