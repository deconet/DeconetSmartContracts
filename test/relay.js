var Relay = artifacts.require('./Relay.sol')
var Token = artifacts.require('./DeconetToken.sol')
var Registry = artifacts.require('./Registry.sol')
var LicenseSales = artifacts.require('./LicenseSales.sol')


contract('Relay', function (accounts) {
  it('should be possible to deploy and set token and registry contract addresses', async function () {
    let ls = await LicenseSales.deployed()
    let registry = await Registry.deployed()

    assert.equal(LicenseSales.address.length, 42)
    assert.equal(Registry.address.length, 42)

    let relay = await Relay.deployed()

    let newLicenseSalesContractAddress = '0xc2fa1bace4dda22d84a466884493fad6f71e0275'
    await relay.setLicenseSalesContractAddress(newLicenseSalesContractAddress)

    let licenseSalesContractAddress = await relay.licenseSalesContractAddress.call({ from: accounts[4] })
    assert.equal(newLicenseSalesContractAddress, licenseSalesContractAddress)

    let newRegistryContractAddress = '0xcbffa1ee1e37ee59923c444c727c54720c774c62'
    await relay.setRegistryContractAddress(newRegistryContractAddress)

    let registryContractAddress = await relay.registryContractAddress.call({ from: accounts[4] })
    assert.equal(newRegistryContractAddress, registryContractAddress)

    // and set back to real addresses
    await relay.setLicenseSalesContractAddress(ls.address)

    licenseSalesContractAddress = await relay.licenseSalesContractAddress.call({ from: accounts[4] })
    assert.equal(ls.address, licenseSalesContractAddress)

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
