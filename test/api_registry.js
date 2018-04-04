var uuid = require('uuid')
var BigNumber = require('bignumber.js')

var APIRegistry = artifacts.require('./APIRegistry.sol')
var Token = artifacts.require('./DeconetToken.sol')

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

  it('should be possible to enumerate all apis', async function () {
    let apiRegistry = await APIRegistry.new()
    let numApis = await apiRegistry.numApis.call({ from: accounts[4] })

    for(let i = 1; i <= numApis.toNumber(); i++) {
      let api = await apiRegistry.getApiById(i, { from: accounts[4] })
      assert.equal(api.length, 6)
      assert.notEqual(api[0].toNumber(), false)
      assert.notEqual(api[1], false)
      assert.notEqual(api[2], false)
      assert.notEqual(api[3], false)
      assert.notEqual(api[4], false)
      assert.notEqual(api[5], false)
    }
  })

  it('should let a user list and get an api by name', async function () {
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

    let api = await apiRegistry.getApiByName(hostname, { from: accounts[4] })
    assert.equal(api.length, 6)
    assert.equal(api[0].toNumber(), pricePerCall)
    assert.equal(web3.toAscii(api[1]), sellerUsername)
    assert.equal(web3.toAscii(api[2]), apiName)
    assert.equal(api[3], accounts[1])
    assert.equal(api[4], hostname)
    assert.equal(api[5], docsUrl)

    // make sure it's not possible to list an API whose hostname is already taken
    let exceptionGenerated = false
    try {
      await apiRegistry.listApi(pricePerCall, sellerUsername, apiName, hostname, docsUrl, { from: accounts[1] })
    } catch (e) {
      exceptionGenerated = true
    }
    assert.equal(exceptionGenerated, true)

    // test editing the api as contract owner
    let newPrice = 50000
    let newDocsUrl = hostname + '/newDocs'
    await apiRegistry.editApi(apiId, newPrice, accounts[2], newDocsUrl, { from: accounts[0] })

    api = await apiRegistry.getApiByName(hostname, { from: accounts[4] })
    assert.equal(api.length, 6)
    assert.equal(api[0].toNumber(), newPrice)
    assert.equal(web3.toAscii(api[1]), sellerUsername)
    assert.equal(web3.toAscii(api[2]), apiName)
    assert.equal(api[3], accounts[2])
    assert.equal(api[4], hostname)
    assert.equal(api[5], newDocsUrl)
  })

it('should let a user list and get an api without dynamics', async function () {
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

    let api = await apiRegistry.getApiByIdWithoutDynamics(apiId, { from: accounts[4] })
    assert.equal(api.length, 4)
    assert.equal(api[0].toNumber(), pricePerCall)
    assert.equal(web3.toAscii(api[1]), sellerUsername)
    assert.equal(web3.toAscii(api[2]), apiName)
    assert.equal(api[3], accounts[1])

     // test editing the api as contract owner
    let newPrice = 50000
    let newDocsUrl = hostname + '/newDocs'
    await apiRegistry.editApi(apiId, newPrice, accounts[2], newDocsUrl, { from: accounts[0] })

    api = await apiRegistry.getApiByIdWithoutDynamics(apiId, { from: accounts[4] })
    assert.equal(api.length, 4)
    assert.equal(api[0].toNumber(), newPrice)
    assert.equal(web3.toAscii(api[1]), sellerUsername)
    assert.equal(web3.toAscii(api[2]), apiName)
    assert.equal(api[3], accounts[2])
  })

  it('should return 0 if you try to get an api by an id that does not exist', async function () {
    let apiRegistry = await APIRegistry.deployed()
    let apiId = await apiRegistry.getApiId('fakenonexistanthostname.com')
    assert.equal(apiId, 0)
  })

  it('should return a null struct if you try to get an api by a name that does not exist', async function () {
    let apiRegistry = await APIRegistry.deployed()
    let apiInfo = await apiRegistry.getApiByName('fakenonexistanthostname.com')
    assert.equal(apiInfo[0].toString(), '0')
    assert.equal(apiInfo[1], '0x0000000000000000000000000000000000000000000000000000000000000000')
    assert.equal(apiInfo[2], '0x0000000000000000000000000000000000000000000000000000000000000000')
    assert.equal(apiInfo[3], '0x0000000000000000000000000000000000000000')
    assert.equal(apiInfo[4], '')
    assert.equal(apiInfo[5], '')
  })

  it('can transfer out accidently sent erc20 tokens', async function () {
    let apiRegistry = await APIRegistry.deployed()
    let token = await Token.deployed()

    let paused = await token.paused.call()
    if (paused) {
      // unpause token to allow transfers
      await token.unpause({from: accounts[0]})
    }

    let tokenAmount = new BigNumber('10000')

    // transfer tokens in
    await token.transfer(apiRegistry.address, tokenAmount.toString(), {from: accounts[0]})

    let contractBalanceBefore = await token.balanceOf(apiRegistry.address)
    let ownerBalanceBefore = await token.balanceOf(accounts[0])

    await apiRegistry.transferAnyERC20Token(token.address, tokenAmount.toString(), {from: accounts[0]})

    let contractBalanceAfter = await token.balanceOf(apiRegistry.address)
    let ownerBalanceAfter = await token.balanceOf(accounts[0])

    assert.equal(contractBalanceBefore.minus(tokenAmount).toString(), contractBalanceAfter.toString())
    assert.equal(ownerBalanceBefore.plus(tokenAmount).toString(), ownerBalanceAfter.toString())
  })
  it('should not let a user list an API with bad inputs', async function () {
    let sellerUsername = ''
    let apiName = ''
    let hostname = ''
    let docsUrl = ''
    let pricePerCall = '0'
    let apiRegistry = await APIRegistry.deployed()

    let numApisBefore = await apiRegistry.numApis.call()

    let exceptionGenerated = false
    try {
      await apiRegistry.listApi(pricePerCall, sellerUsername, apiName, hostname, docsUrl, { from: accounts[1] })
    } catch (e) {
      exceptionGenerated = true
    }
    assert.equal(exceptionGenerated, true)

    let numApisAfter = await apiRegistry.numApis.call()
    assert.equal(numApisAfter.toString(), numApisBefore.toString())
  })
})
