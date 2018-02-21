var uuid = require('uuid')
var BigNumber = require('bignumber.js')

var Registry = artifacts.require('./Registry.sol')

contract('Registry', function (accounts) {
  it('should let a user list and edit and get a module', async function () {
    let sellerUsername = uuid.v4().substr(0, 32)
    let moduleName = uuid.v4().substr(0, 32)
    let modulePrice = 100000
    let licenseId = '0x00000001'
    let registry = await Registry.deployed()

    let usernameAndProjectName = `${sellerUsername}/${moduleName}`
    let numModulesBefore = await registry.numModules.call()

    await registry.listModule(modulePrice, sellerUsername, moduleName, usernameAndProjectName, licenseId, { from: accounts[1] })

    let numModulesAfter = await registry.numModules.call()
    assert.equal(numModulesAfter.toNumber(), numModulesBefore.toNumber() + 1)

    // // check that the module is actually in the registry
    let moduleId = await registry.getModuleId(usernameAndProjectName)
    assert.notEqual(moduleId.toNumber(), 0)

    let module = await registry.getModule(moduleId, { from: accounts[4] })
    assert.equal(module.length, 5)
    assert.equal(module[0].toNumber(), modulePrice)
    assert.equal(web3.toAscii(module[1]), sellerUsername)
    assert.equal(web3.toAscii(module[2]), moduleName)
    assert.equal(module[3], accounts[1])
    assert.equal(module[4], licenseId)

    // test editing the module
    let newPrice = 50000
    let newLicenseId = '0x00000002'
    await registry.editModule(moduleId, newPrice, accounts[2], newLicenseId, { from: accounts[0] })

    module = await registry.getModule(moduleId, { from: accounts[4] })
    assert.equal(module.length, 5)
    assert.equal(module[0].toNumber(), newPrice)
    assert.equal(web3.toAscii(module[1]), sellerUsername)
    assert.equal(web3.toAscii(module[2]), moduleName)
    assert.equal(module[3], accounts[2])
    assert.equal(module[4], newLicenseId)
  })

  it('should be possible to enumerate all modules', async function () {
    let registry = await Registry.new()
    let numModules = await registry.numModules.call({ from: accounts[4] })

    for(let i = 1; i <= numModules.toNumber(); i++) {
      let module = await registry.getModule(i, { from: accounts[4] })
      assert.equal(module.length, 4)
      assert.notEqual(module[0].toNumber(), false)
      assert.notEqual(module[1], false)
      assert.notEqual(module[2], false)
      assert.notEqual(module[3], false)
      assert.notEqual(module[4], false)
    }
  })
})
