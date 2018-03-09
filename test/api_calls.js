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

  it('should be able to list and report usage for an api', async function () {
    let sellerUsername = uuid.v4().substr(0, 32)
    let apiName = uuid.v4().substr(0, 32)
    let hostname = uuid.v4() + '.com'
    let docsUrl = hostname + '/docs'
    let pricePerCall = 1
    let apiRegistry = await APIRegistry.deployed()
    let apiCalls = await APICalls.deployed()

    let numApisBefore = await apiRegistry.numApis.call()

    await apiRegistry.listApi(pricePerCall, sellerUsername, apiName, hostname, docsUrl, { from: accounts[1] })

    let numApisAfter = await apiRegistry.numApis.call()
    assert.equal(numApisAfter.toNumber(), numApisBefore.toNumber() + 1)

    let apiId = await apiRegistry.getApiId(hostname)

    let totalOwedBefore = await apiCalls.totalOwedForApi(apiId)

    // set usage reporting address for the api
    await apiCalls.setUsageReportingAddress(accounts[9])

    // // imagine here that some dude used the api 1000 times
    // // and they are at accounts[2]
    let result = await apiCalls.reportUsage(apiId, 1000, accounts[2], {from: accounts[9]})

    assert.equal(result.logs[0].event, 'LogAPICallsMade')

    let totalOwedAfter = await apiCalls.totalOwedForApi(apiId)

    assert.equal(totalOwedBefore.add(new BigNumber('1000')).eq(totalOwedAfter), true)
  })

  it('should let buyers deposit credits, check their balance, and withdraw credits', async function () {
    let apiCalls = await APICalls.deployed()

    const creditAmount = new BigNumber('100000')
    const gasPrice = new BigNumber('1000000000')

    let ethBalanceBefore = await web3.eth.getBalance(accounts[2])
    let creditsBalanceBefore = await apiCalls.creditsBalanceOf(accounts[2])

    let addCreditsTxn = await apiCalls.addCredits(accounts[2], {from: accounts[2], value: creditAmount.toNumber(), gasPrice: gasPrice.toNumber()})

    let gasUsed = addCreditsTxn.receipt.gasUsed
    let weiConsumedByGas = gasPrice.times(BigNumber(gasUsed))

    let ethBalanceAfter = await web3.eth.getBalance(accounts[2])
    let creditsBalanceAfter = await apiCalls.creditsBalanceOf(accounts[2])

    assert.equal(creditsBalanceBefore.add(creditAmount).eq(creditsBalanceAfter), true)
    assert.equal(ethBalanceBefore.minus(creditAmount).minus(weiConsumedByGas).eq(ethBalanceAfter), true)

    ethBalanceBefore = ethBalanceAfter
    creditsBalanceBefore = creditsBalanceAfter

    let withdrawCreditsTxn = await apiCalls.withdrawCredits(creditsBalanceAfter, {from: accounts[2], gasPrice: gasPrice.toNumber()})

    gasUsed = withdrawCreditsTxn.receipt.gasUsed
    weiConsumedByGas = gasPrice.times(BigNumber(gasUsed))

    ethBalanceAfter = await web3.eth.getBalance(accounts[2])
    creditsBalanceAfter = await apiCalls.creditsBalanceOf(accounts[2])

    assert.equal(ethBalanceBefore.minus(weiConsumedByGas).add(creditAmount).eq(ethBalanceAfter), true)
    assert.equal(creditsBalanceBefore.minus(creditAmount).eq(creditsBalanceAfter), true)
  })

  it('should let buyers deposit credits, use apis, and pay the seller for usage', async function () {
    let apiCalls = await APICalls.deployed()
    let token = await Token.deployed()

    const creditAmount = new BigNumber('1000000')
    const gasPrice = new BigNumber('1000000000')

    let ethBalanceBefore = await web3.eth.getBalance(accounts[2])
    let creditsBalanceBefore = await apiCalls.creditsBalanceOf(accounts[2])

    // deposit credits for accounts[2]
    let addCreditsTxn = await apiCalls.addCredits(accounts[2], {from: accounts[2], value: creditAmount.toNumber(), gasPrice: gasPrice.toNumber()})

    let gasUsed = addCreditsTxn.receipt.gasUsed
    let weiConsumedByGas = gasPrice.times(BigNumber(gasUsed))

    let ethBalanceAfter = await web3.eth.getBalance(accounts[2])
    let creditsBalanceAfter = await apiCalls.creditsBalanceOf(accounts[2])

    assert.equal(creditsBalanceBefore.add(creditAmount).eq(creditsBalanceAfter), true)
    assert.equal(ethBalanceBefore.minus(creditAmount).minus(weiConsumedByGas).eq(ethBalanceAfter), true)
    assert.equal(addCreditsTxn.logs[0].event, 'LogDepositCredits')


    let sellerUsername = uuid.v4().substr(0, 32)
    let apiName = uuid.v4().substr(0, 32)
    let hostname = uuid.v4() + '.com'
    let docsUrl = hostname + '/docs'
    let pricePerCall = new BigNumber('20')
    let apiRegistry = await APIRegistry.deployed()
    let apiCallCount = new BigNumber('1000')

    let numApisBefore = await apiRegistry.numApis.call()

    // list the api
    await apiRegistry.listApi(pricePerCall.toNumber(), sellerUsername, apiName, hostname, docsUrl, { from: accounts[1] })

    let numApisAfter = await apiRegistry.numApis.call()
    assert.equal(numApisAfter.toNumber(), numApisBefore.toNumber() + 1)

    let apiId = await apiRegistry.getApiId(hostname)

    let totalOwedBefore = await apiCalls.totalOwedForApi(apiId)

    // set usage reporting address for the api
    await apiCalls.setUsageReportingAddress(accounts[9])

    // report usage from an account with ample credits to cover the balance
    let result = await apiCalls.reportUsage(apiId, apiCallCount.toNumber(), accounts[2], {from: accounts[9]})

    assert.equal(result.logs[0].event, 'LogAPICallsMade')

    let totalOwedAfter = await apiCalls.totalOwedForApi(apiId)

    assert.equal(totalOwedBefore.add(apiCallCount.times(pricePerCall)).eq(totalOwedAfter), true)

    totalOwedBefore = totalOwedAfter

    // make sure accounts[3] has no credits
    let acctThreeCredits = await apiCalls.creditsBalanceOf(accounts[3])
    if (acctThreeCredits.toString() !== '0') {
      await apiCalls.withdrawCredits(acctThreeCredits.toString())
    }

    // make sure token reward is set to 100
    await apiCalls.setTokenReward(new BigNumber('100').times(new BigNumber('10').pow(18)).toString())

    // report usage from an account with no credits
    result = await apiCalls.reportUsage(apiId, apiCallCount.toNumber(), accounts[3], {from: accounts[9]})

    assert.equal(result.logs[0].event, 'LogAPICallsMade')

    totalOwedAfter = await apiCalls.totalOwedForApi(apiId)

    assert.equal(totalOwedBefore.add(apiCallCount.times(pricePerCall)).eq(totalOwedAfter), true)

    let sellerBalanceBefore = await web3.eth.getBalance(accounts[1])

    // check if token is paused.  if so, unpause it.
    // this is because paySeller will fail if token is paused.
    let paused = await token.paused.call()
    if (paused) {
      // unpause token to allow transfers
      await token.unpause({from: accounts[0]})
    }

    result = await apiCalls.paySeller(apiId, {from: accounts[1], gasPrice: gasPrice.toNumber()})

    assert.equal(result.logs[0].event, 'LogAPICallsPaid')

    gasUsed = result.receipt.gasUsed
    weiConsumedByGas = gasPrice.times(BigNumber(gasUsed))

    let sellerBalanceAfter = await web3.eth.getBalance(accounts[1])
    let totalPayable = apiCallCount.times(pricePerCall)
    let saleFee = await apiCalls.saleFee.call()
    let networkFee = totalPayable.times(new BigNumber('100')).div(saleFee).div(new BigNumber('100'))
    let calculatedProfit = totalPayable.minus(networkFee)

    assert.equal(sellerBalanceBefore.minus(weiConsumedByGas).add(calculatedProfit).eq(sellerBalanceAfter), true)

    // check that accounts[3] is overdrafted
    let buyerInfo = await apiCalls.buyerInfoOf(accounts[3])
    assert.equal(buyerInfo.length, 4)
    assert.equal(buyerInfo[0], true) // overdrafted
    assert.equal(buyerInfo[1], 1) // lifetime overdraft count
    assert.equal(buyerInfo[2], 0) // credits
    assert.equal(buyerInfo[3], 0) // lifetime credits used

    // check that accounts[2] is not overdrafted
    buyerInfo = await apiCalls.buyerInfoOf(accounts[2])
    assert.equal(buyerInfo.length, 4)
    assert.equal(buyerInfo[0], false) // overdrafted
    assert.equal(buyerInfo[1], 0) // lifetime overdraft count
    assert.equal(buyerInfo[2], creditAmount.minus(totalPayable).toString()) // credits
    assert.equal(buyerInfo[3], totalPayable.toString()) // lifetime credits used

    // check that nonzeroBalances holds accounts[3] only.
    let nonzeroAddressesLength = await apiCalls.nonzeroAddressesLengthForApi(apiId)
    assert.equal(nonzeroAddressesLength.toString(), 1)

    let nonzeroAddressesElement = await apiCalls.nonzeroAddressesElementForApi(apiId, 0)
    assert.equal(nonzeroAddressesElement, accounts[3])

    // pull the remaining credits out
    ethBalanceBefore = await web3.eth.getBalance(accounts[2])
    creditsBalanceBefore = await apiCalls.creditsBalanceOf(accounts[2])

    let withdrawCreditsTxn = await apiCalls.withdrawCredits(creditsBalanceBefore.toString(), {from: accounts[2], gasPrice: gasPrice.toNumber()})

    gasUsed = withdrawCreditsTxn.receipt.gasUsed
    weiConsumedByGas = gasPrice.times(BigNumber(gasUsed))

    ethBalanceAfter = await web3.eth.getBalance(accounts[2])
    creditsBalanceAfter = await apiCalls.creditsBalanceOf(accounts[2])

    assert.equal(ethBalanceBefore.minus(weiConsumedByGas).minus(totalPayable).add(creditAmount).eq(ethBalanceAfter), true)
    assert.equal(creditsBalanceAfter.toString(), '0')
    assert.equal(withdrawCreditsTxn.logs[0].event, 'LogWithdrawCredits')
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
