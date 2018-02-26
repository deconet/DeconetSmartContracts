var Relay = artifacts.require('./Relay.sol')
var Token = artifacts.require('./DeconetToken.sol')
var Registry = artifacts.require('./Registry.sol')


contract('Relay', function (accounts) {
  it('should be possible to deploy and set token and registry contract addresses', async function () {
    let token = await Token.deployed()
    let registry = await Registry.deployed()

    assert.equal(Token.address.length, 42)
    assert.equal(Registry.address.length, 42)

    let relay = await Relay.deployed()

    let newTokenContractAddress = '0xc2fa1bace4dda22d84a466884493fad6f71e0275'
    await relay.setTokenContractAddress(newTokenContractAddress)

    let tokenContractAddress = await relay.tokenContractAddress.call({ from: accounts[4] })
    assert.equal(newTokenContractAddress, tokenContractAddress)

    let newRegistryContractAddress = '0xcbffa1ee1e37ee59923c444c727c54720c774c62'
    await relay.setRegistryContractAddress(newRegistryContractAddress)

    let registryContractAddress = await relay.registryContractAddress.call({ from: accounts[4] })
    assert.equal(newRegistryContractAddress, registryContractAddress)

    // and set back to real addresses
    await relay.setTokenContractAddress(token.address)

    tokenContractAddress = await relay.tokenContractAddress.call({ from: accounts[4] })
    assert.equal(token.address, tokenContractAddress)

    await relay.setRegistryContractAddress(registry.address)

    registryContractAddress = await relay.registryContractAddress.call({ from: accounts[4] })
    assert.equal(registry.address, registryContractAddress)
  })

  it('should have a version', async function () {
    let token = await Token.deployed()
    let version = await token.version.call({ from: accounts[4] })
    assert.notEqual(version, 0)
  })
})
