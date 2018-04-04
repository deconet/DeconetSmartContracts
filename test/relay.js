var Relay = artifacts.require('./Relay.sol')
var Token = artifacts.require('./DeconetToken.sol')
var Registry = artifacts.require('./Registry.sol')
var LicenseSales = artifacts.require('./LicenseSales.sol')
var BigNumber = require('bignumber.js')


contract('Relay', function (accounts) {
  it('should be possible to deploy and set license sales and registry contract addresses', async function () {
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

  it('can transfer out accidently sent erc20 tokens', async function () {
    let relay = await Relay.deployed()
    let token = await Token.deployed()

    let paused = await token.paused.call()
    if (paused) {
      // unpause token to allow transfers
      await token.unpause({from: accounts[0]})
    }

    let tokenAmount = new BigNumber('10000')

    // transfer tokens in
    await token.transfer(relay.address, tokenAmount.toString(), {from: accounts[0]})

    let contractBalanceBefore = await token.balanceOf(relay.address)
    let ownerBalanceBefore = await token.balanceOf(accounts[0])

    await relay.transferAnyERC20Token(token.address, tokenAmount.toString(), {from: accounts[0]})

    let contractBalanceAfter = await token.balanceOf(relay.address)
    let ownerBalanceAfter = await token.balanceOf(accounts[0])

    assert.equal(contractBalanceBefore.minus(tokenAmount).toString(), contractBalanceAfter.toString())
    assert.equal(ownerBalanceBefore.plus(tokenAmount).toString(), ownerBalanceAfter.toString())
  })
  it('should not let user set 0 address for license sale contract address', async function () {
    let relay = await Relay.deployed()
    let exceptionOccured = false
    try {
      await relay.setLicenseSalesContractAddress('0x0000000000000000000000000000000000000000')
    } catch (e) {
      exceptionOccured = true
    }
    assert.equal(exceptionOccured, true)
  })  
  it('should not let user set 0 address for registry', async function () {
    let relay = await Relay.deployed()
    let exceptionOccured = false
    try {
      await relay.setRegistryContractAddress('0x0000000000000000000000000000000000000000')
    } catch (e) {
      exceptionOccured = true
    }
    assert.equal(exceptionOccured, true)
  })
  it('should not let user set 0 address for api calls', async function () {
    let relay = await Relay.deployed()
    let exceptionOccured = false
    try {
      await relay.setApiCallsContractAddress('0x0000000000000000000000000000000000000000')
    } catch (e) {
      exceptionOccured = true
    }
    assert.equal(exceptionOccured, true)
  })
  it('should not let user set 0 address for api registry contract address', async function () {
    let relay = await Relay.deployed()
    let exceptionOccured = false
    try {
      await relay.setApiRegistryContractAddress('0x0000000000000000000000000000000000000000')
    } catch (e) {
      exceptionOccured = true
    }
    assert.equal(exceptionOccured, true)
  })
})
