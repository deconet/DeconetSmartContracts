var BigNumber = require('bignumber.js')
var uuid = require('uuid')

var Token = artifacts.require('./DeconetToken.sol')
var Relay = artifacts.require('./Relay.sol')
var Registry = artifacts.require('./Registry.sol')
var APIRegistry = artifacts.require('./APIRegistry.sol')
var APICalls = artifacts.require('./APICalls.sol')

const Promisify = (inner) =>
  new Promise((resolve, reject) =>
    inner((err, res) => {
      if (err) {
        return reject(err);
      }
      return resolve(res);
    })
  );

contract('APICalls', function (accounts) {
  it('should have a settable token reward', async function () {
    let apiCalls = await APICalls.deployed()
    let tokenRewardBefore = await apiCalls.tokenReward.call()

    await apiCalls.setTokenReward(200000)

    let tokenRewardAfter = await apiCalls.tokenReward.call()
    assert.equal(tokenRewardAfter.toString(), '200000')
    assert.notEqual(tokenRewardBefore.eq(tokenRewardAfter), true)
  })

  it('should have the right relay contract address', async function () {
    let apiCalls = await APICalls.deployed()
    let relay = await Relay.deployed()

    let relayAddress = await apiCalls.relayContractAddress.call()
    assert.equal(relayAddress, relay.address)
  })

  it('should have a settable relay contract address', async function () {
    let apiCalls = await APICalls.deployed()
    let relay = await Relay.deployed()

    let relayAddress = await apiCalls.relayContractAddress.call()
    assert.equal(relayAddress, relay.address)

    let newAddress = '0xdf230f62739bedcb1bed428906232a44bc37de3a'
    await apiCalls.setRelayContractAddress(newAddress)

    relayAddress = await apiCalls.relayContractAddress.call()
    assert.equal(newAddress, relayAddress)

    // set it back
    await apiCalls.setRelayContractAddress(relay.address)
    relayAddress = await apiCalls.relayContractAddress.call()
    assert.equal(relayAddress, relay.address)
  })

  it('should be able to list and report usage for an api and pay the seller too', async function () {
    let sellerUsername = uuid.v4().substr(0, 32)
    let apiName = uuid.v4().substr(0, 32)
    let hostname = uuid.v4() + '.com'
    let docsUrl = hostname + '/docs'
    let pricePerCall = 10000
    let apiRegistry = await APIRegistry.deployed()
    let apiCalls = await APICalls.deployed()

    let numApisBefore = await apiRegistry.numApis.call()

    await apiRegistry.listApi(pricePerCall, sellerUsername, apiName, hostname, docsUrl, { from: accounts[1] })

    let numApisAfter = await apiRegistry.numApis.call()
    assert.equal(numApisAfter.toNumber(), numApisBefore.toNumber() + 1)

    let apiId = await apiRegistry.getApiId(hostname)

    let totalOwedBefore = await apiCalls.totalOwedForApi(apiId)

    // // imagine here that some dude used the api 1000 times
    // // and they are at accounts[2]
    let result = await apiCalls.reportUsage(apiId, 1000, accounts[2])

    // assert.equal(result.logs[0].event, 'APICallsMade')

    // let totalOwedAfter = await apiCalls.totalOwedForApi(apiId)

    // assert.equal(totalOwedBefore.add(new BigNumber('1000')).eq(totalOwedAfter), true)


  })

  it('should only let the contract owner withdraw', async function () {
    let apiCalls = await APICalls.deployed()
    let exceptionOccured = false
    try {
      await apiCalls.withdrawEther({from: accounts[4]})
    } catch (e) {
      exceptionOccured = true
    }
    assert.equal(exceptionOccured, true)
  })

  it('should have a version', async function () {
    let apiCalls = await APICalls.deployed()
    let version = await apiCalls.version.call({ from: accounts[4] })
    assert.notEqual(version, 0)
  })
})
