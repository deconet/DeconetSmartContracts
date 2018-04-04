var uuid = require('uuid')
var BigNumber = require('bignumber.js')

var Registry = artifacts.require('./Registry.sol')
var Token = artifacts.require('./DeconetToken.sol')

contract('Registry', function (accounts) {
  it('should have a version', async function () {
    let registry = await Registry.deployed()
    let version = await registry.version.call({ from: accounts[4] })
    assert.notEqual(version, 0)
  })

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

    let module = await registry.getModuleById(moduleId, { from: accounts[4] })
    assert.equal(module.length, 5)
    assert.equal(module[0].toNumber(), modulePrice)
    assert.equal(web3.toAscii(module[1]), sellerUsername)
    assert.equal(web3.toAscii(module[2]), moduleName)
    assert.equal(module[3], accounts[1])
    assert.equal(module[4], licenseId)

    // test editing the module as contract owner
    let newPrice = 50000
    let newLicenseId = '0x00000002'
    await registry.editModule(moduleId, newPrice, accounts[2], newLicenseId, { from: accounts[0] })

    module = await registry.getModuleById(moduleId, { from: accounts[4] })
    assert.equal(module.length, 5)
    assert.equal(module[0].toNumber(), newPrice)
    assert.equal(web3.toAscii(module[1]), sellerUsername)
    assert.equal(web3.toAscii(module[2]), moduleName)
    assert.equal(module[3], accounts[2])
    assert.equal(module[4], newLicenseId)

    // test editing the module as module owner
    newPrice = 25000
    newLicenseId = '0x00000003'
    await registry.editModule(moduleId, newPrice, accounts[3], newLicenseId, { from: accounts[2] })

    module = await registry.getModuleById(moduleId, { from: accounts[4] })
    assert.equal(module.length, 5)
    assert.equal(module[0].toNumber(), newPrice)
    assert.equal(web3.toAscii(module[1]), sellerUsername)
    assert.equal(web3.toAscii(module[2]), moduleName)
    assert.equal(module[3], accounts[3])
    assert.equal(module[4], newLicenseId)

    // test editing the module as a random non-owner account (should fail)
    let exceptionGenerated = false
    try {
      await registry.editModule(moduleId, 20000, accounts[5], '0x00000004', { from: accounts[4] })
    } catch (e) {
      exceptionGenerated = true
    }
    assert.equal(exceptionGenerated, true)

    // test editing with bad inputs
    exceptionGenerated = false
    try {
      // test editing the module as a random non-owner account (should fail)
      await registry.editModule('0', '0', '0x0000000000000000000000000000000000000000', '0x00000000', { from: accounts[3] })
    } catch (e) {
      exceptionGenerated = true
    }
    assert.equal(exceptionGenerated, true)


    // test editing a nonexistant module
    exceptionGenerated = false
    try {
      // test editing the module as a random non-owner account (should fail)
      await registry.editModule('99999999', 20000, accounts[3], '0x00000004', { from: accounts[3] })
    } catch (e) {
      exceptionGenerated = true
    }
    assert.equal(exceptionGenerated, true)

    module = await registry.getModuleById(moduleId, { from: accounts[4] })
    assert.equal(module.length, 5)
    assert.equal(module[0].toNumber(), newPrice)
    assert.equal(web3.toAscii(module[1]), sellerUsername)
    assert.equal(web3.toAscii(module[2]), moduleName)
    assert.equal(module[3], accounts[3])
    assert.equal(module[4], newLicenseId)
  })

  it('should be possible to enumerate all modules', async function () {
    let registry = await Registry.new()
    let numModules = await registry.numModules.call({ from: accounts[4] })

    for(let i = 1; i <= numModules.toNumber(); i++) {
      let module = await registry.getModuleById(i, { from: accounts[4] })
      assert.equal(module.length, 4)
      assert.notEqual(module[0].toNumber(), false)
      assert.notEqual(module[1], false)
      assert.notEqual(module[2], false)
      assert.notEqual(module[3], false)
      assert.notEqual(module[4], false)
    }
  })

  it('should let a user list and get a module by name', async function () {
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

    // make sure that we can't list a module with a name that is already listed
    let exceptionGenerated = false
    try {
      await registry.listModule(modulePrice, sellerUsername, moduleName, usernameAndProjectName, licenseId, { from: accounts[1] })
    } catch (e) {
      exceptionGenerated = true
    }
    assert.equal(exceptionGenerated, true)

    // // check that the module is actually in the registry
    let moduleId = await registry.getModuleId(usernameAndProjectName)
    assert.notEqual(moduleId.toNumber(), 0)

    let module = await registry.getModuleByName(usernameAndProjectName, { from: accounts[4] })
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

    module = await registry.getModuleByName(usernameAndProjectName, { from: accounts[4] })
    assert.equal(module.length, 5)
    assert.equal(module[0].toNumber(), newPrice)
    assert.equal(web3.toAscii(module[1]), sellerUsername)
    assert.equal(web3.toAscii(module[2]), moduleName)
    assert.equal(module[3], accounts[2])
    assert.equal(module[4], newLicenseId)
  })

  it('should return 0 if you try to get a module id that does not exist', async function () {
    let registry = await Registry.deployed()
    let moduleId = await registry.getModuleId('fakenonexistantuser/fakenonexistantname')
    assert.equal(moduleId, 0)
  })

    it('should return 0 if you try to get a module by an id that does not exist', async function () {
    let registry = await Registry.deployed()
    //getModuleById(uint moduleId) public view returns (uint price, bytes32 sellerUsername, bytes32 moduleName, address sellerAddress, bytes4 licenseId)
    let moduleInfo = await registry.getModuleById('999999999')
    assert.equal(moduleInfo[0].toString(), '0')
    assert.equal(moduleInfo[1], '0x0000000000000000000000000000000000000000000000000000000000000000')
    assert.equal(moduleInfo[2], '0x0000000000000000000000000000000000000000000000000000000000000000')
    assert.equal(moduleInfo[3], '0x0000000000000000000000000000000000000000')
    assert.equal(moduleInfo[4], '0x00000000')
  })

  it('should return a null struct if you try to get a module by a name that does not exist', async function () {
    let registry = await Registry.deployed()
    let moduleInfo = await registry.getModuleByName('fakenonexistantuser/fakenonexistantname')
    // should look like the below array
    // [ BigNumber { s: 1, e: 0, c: [ 0 ] },
    // '0x0000000000000000000000000000000000000000000000000000000000000000',
    // '0x0000000000000000000000000000000000000000000000000000000000000000',
    // '0x0000000000000000000000000000000000000000',
    // '0x00000000' ]
    assert.equal(moduleInfo[0].toString(), '0')
    assert.equal(moduleInfo[1], '0x0000000000000000000000000000000000000000000000000000000000000000')
    assert.equal(moduleInfo[2], '0x0000000000000000000000000000000000000000000000000000000000000000')
    assert.equal(moduleInfo[3], '0x0000000000000000000000000000000000000000')
    assert.equal(moduleInfo[4], '0x00000000')
  })

  it('can transfer out accidently sent erc20 tokens', async function () {
    let registry = await Registry.deployed()
    let token = await Token.deployed()

    let paused = await token.paused.call()
    if (paused) {
      // unpause token to allow transfers
      await token.unpause({from: accounts[0]})
    }

    let tokenAmount = new BigNumber('10000')

    // transfer tokens in
    await token.transfer(registry.address, tokenAmount.toString(), {from: accounts[0]})

    let contractBalanceBefore = await token.balanceOf(registry.address)
    let ownerBalanceBefore = await token.balanceOf(accounts[0])

    await registry.transferAnyERC20Token(token.address, tokenAmount.toString(), {from: accounts[0]})

    let contractBalanceAfter = await token.balanceOf(registry.address)
    let ownerBalanceAfter = await token.balanceOf(accounts[0])

    assert.equal(contractBalanceBefore.minus(tokenAmount).toString(), contractBalanceAfter.toString())
    assert.equal(ownerBalanceBefore.plus(tokenAmount).toString(), ownerBalanceAfter.toString())
  })

  it('should not let a user list a module with bad inputs', async function () {
    let sellerUsername = ''
    let moduleName = ''
    let modulePrice = '0'
    let licenseId = '0x00000000'
    let registry = await Registry.deployed()

    let usernameAndProjectName = `${sellerUsername}/${moduleName}`
    let numModulesBefore = await registry.numModules.call()

    let exceptionGenerated = false

    try {
      await registry.listModule(modulePrice, sellerUsername, moduleName, usernameAndProjectName, licenseId, { from: accounts[1] })
    } catch (e) {
      exceptionGenerated = true
    }

    assert.equal(exceptionGenerated, true)

    let numModulesAfter = await registry.numModules.call()
    assert.equal(numModulesAfter.toNumber(), numModulesBefore.toNumber())
  })
})
