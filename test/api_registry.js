var uuid = require('uuid')
var BigNumber = require('bignumber.js')

var APIRegistry = artifacts.require('./APIRegistry.sol')

contract('APIRegistry', function (accounts) {
  it('should have a version', async function () {
    let registry = await APIRegistry.deployed()
    let version = await registry.version.call({ from: accounts[4] })
    assert.notEqual(version, 0)
  })

  it('should let a user list and edit and get an api', async function () {
    let sellerUsername = uuid.v4().substr(0, 32)
    let apiName = uuid.v4().substr(0, 32)
    let hostname = uuid.v4() + '.com'
    let docsUrl = hostname + '/docs'
    let pricePerCall = 10000
    let apiRegistry = await APIRegistry.deployed()

    let numApisBefore = await apiRegistry.numApis.call()

    await apiRegistry.listApi(pricePerCall, sellerUsername, apiName, hostname, docsUrl, { from: accounts[1] })

    let numApisAfter = await apiRegistry.numApis.call()
    assert.equal(numApisAfter.toNumber(), numApisBefore.toNumber() + 1)

    // check that the api is actually in the registry
    let apiId = await apiRegistry.getApiId(hostname)
    assert.notEqual(apiId.toNumber(), 0)

    let api = await apiRegistry.getApiById(apiId, { from: accounts[4] })
    assert.equal(api.length, 6)
    assert.equal(api[0].toNumber(), pricePerCall)
    assert.equal(web3.toAscii(api[1]), sellerUsername)
    assert.equal(web3.toAscii(api[2]), apiName)
    assert.equal(api[3], accounts[1])
    assert.equal(api[4], hostname)
    assert.equal(api[5], docsUrl)

    // test editing the api as contract owner
    let newPrice = 50000
    let newDocsUrl = hostname + '/newDocs'
    await apiRegistry.editApi(apiId, newPrice, accounts[2], newDocsUrl, { from: accounts[0] })

    api = await apiRegistry.getApiById(apiId, { from: accounts[4] })
    assert.equal(api.length, 6)
    assert.equal(api[0].toNumber(), newPrice)
    assert.equal(web3.toAscii(api[1]), sellerUsername)
    assert.equal(web3.toAscii(api[2]), apiName)
    assert.equal(api[3], accounts[2])
    assert.equal(api[4], hostname)
    assert.equal(api[5], newDocsUrl)

    // test editing the module as module owner
    newPrice = 25000
    newDocsUrl = hostname + '/evenNewerDocs'
    await apiRegistry.editApi(apiId, newPrice, accounts[3], newDocsUrl, { from: accounts[2] })

    api = await apiRegistry.getApiById(apiId, { from: accounts[4] })
    assert.equal(api.length, 6)
    assert.equal(api[0].toNumber(), newPrice)
    assert.equal(web3.toAscii(api[1]), sellerUsername)
    assert.equal(web3.toAscii(api[2]), apiName)
    assert.equal(api[3], accounts[3])
    assert.equal(api[4], hostname)
    assert.equal(api[5], newDocsUrl)

    let exceptionGenerated = false
    try {
      // test editing the module as a random non-owner account (should fail)
      await apiRegistry.editApi(apiId, 20000, accounts[5], 'scam.com/docs', { from: accounts[4] })
    } catch (e) {
      exceptionGenerated = true
    }

    assert.equal(exceptionGenerated, true)

    api = await apiRegistry.getApiById(apiId, { from: accounts[4] })
    assert.equal(api.length, 6)
    assert.equal(api[0].toNumber(), newPrice)
    assert.equal(web3.toAscii(api[1]), sellerUsername)
    assert.equal(web3.toAscii(api[2]), apiName)
    assert.equal(api[3], accounts[3])
    assert.equal(api[4], hostname)
    assert.equal(api[5], newDocsUrl)
  })

  // it('should be possible to enumerate all modules', async function () {
  //   let registry = await Registry.new()
  //   let numModules = await registry.numModules.call({ from: accounts[4] })

  //   for(let i = 1; i <= numModules.toNumber(); i++) {
  //     let module = await registry.getModuleById(i, { from: accounts[4] })
  //     assert.equal(module.length, 4)
  //     assert.notEqual(module[0].toNumber(), false)
  //     assert.notEqual(module[1], false)
  //     assert.notEqual(module[2], false)
  //     assert.notEqual(module[3], false)
  //     assert.notEqual(module[4], false)
  //   }
  // })

  // it('should let a user list and get a module by name', async function () {
  //   let sellerUsername = uuid.v4().substr(0, 32)
  //   let moduleName = uuid.v4().substr(0, 32)
  //   let modulePrice = 100000
  //   let licenseId = '0x00000001'
  //   let registry = await Registry.deployed()

  //   let usernameAndProjectName = `${sellerUsername}/${moduleName}`
  //   let numModulesBefore = await registry.numModules.call()

  //   await registry.listModule(modulePrice, sellerUsername, moduleName, usernameAndProjectName, licenseId, { from: accounts[1] })

  //   let numModulesAfter = await registry.numModules.call()
  //   assert.equal(numModulesAfter.toNumber(), numModulesBefore.toNumber() + 1)

  //   // // check that the module is actually in the registry
  //   let moduleId = await registry.getModuleId(usernameAndProjectName)
  //   assert.notEqual(moduleId.toNumber(), 0)

  //   let module = await registry.getModuleByName(usernameAndProjectName, { from: accounts[4] })
  //   assert.equal(module.length, 5)
  //   assert.equal(module[0].toNumber(), modulePrice)
  //   assert.equal(web3.toAscii(module[1]), sellerUsername)
  //   assert.equal(web3.toAscii(module[2]), moduleName)
  //   assert.equal(module[3], accounts[1])
  //   assert.equal(module[4], licenseId)

  //   // test editing the module
  //   let newPrice = 50000
  //   let newLicenseId = '0x00000002'
  //   await registry.editModule(moduleId, newPrice, accounts[2], newLicenseId, { from: accounts[0] })

  //   module = await registry.getModuleByName(usernameAndProjectName, { from: accounts[4] })
  //   assert.equal(module.length, 5)
  //   assert.equal(module[0].toNumber(), newPrice)
  //   assert.equal(web3.toAscii(module[1]), sellerUsername)
  //   assert.equal(web3.toAscii(module[2]), moduleName)
  //   assert.equal(module[3], accounts[2])
  //   assert.equal(module[4], newLicenseId)
  // })

  // it('should return 0 if you try to get a module by an id that does not exist', async function () {
  //   let registry = await Registry.deployed()
  //   let moduleId = await registry.getModuleId('fakenonexistantuser/fakenonexistantname')
  //   assert.equal(moduleId, 0)
  // })

  // it('should return a null struct if you try to get a module by a name that does not exist', async function () {
  //   let registry = await Registry.deployed()
  //   let moduleInfo = await registry.getModuleByName('fakenonexistantuser/fakenonexistantname')
  //   // should look like the below array
  //   // [ BigNumber { s: 1, e: 0, c: [ 0 ] },
  //   // '0x0000000000000000000000000000000000000000000000000000000000000000',
  //   // '0x0000000000000000000000000000000000000000000000000000000000000000',
  //   // '0x0000000000000000000000000000000000000000',
  //   // '0x00000000' ]
  //   assert.equal(moduleInfo[0].toString(), '0')
  //   assert.equal(moduleInfo[1], '0x0000000000000000000000000000000000000000000000000000000000000000')
  //   assert.equal(moduleInfo[2], '0x0000000000000000000000000000000000000000000000000000000000000000')
  //   assert.equal(moduleInfo[3], '0x0000000000000000000000000000000000000000')
  //   assert.equal(moduleInfo[4], '0x00000000')
  // })
})
