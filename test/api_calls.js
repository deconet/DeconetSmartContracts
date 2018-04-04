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

  it('should have a settable defaultBuyerLastPaidAt variable', async function () {
    let apiCalls = await APICalls.deployed()

    let originalDefaultBuyerLastPaidAt = await apiCalls.defaultBuyerLastPaidAt.call()

    let newDefaultBuyerLastPaidAt = new BigNumber('86400') // 1 day in seconds
    // make sure we are changing the value
    assert.notEqual(originalDefaultBuyerLastPaidAt.toString(), newDefaultBuyerLastPaidAt.toString())
    await apiCalls.setDefaultBuyerLastPaidAt(newDefaultBuyerLastPaidAt.toString())

    let afterDefaultBuyerLastPaidAt = await apiCalls.defaultBuyerLastPaidAt.call()
    assert.equal(newDefaultBuyerLastPaidAt.toString(), afterDefaultBuyerLastPaidAt.toString())
    assert.notEqual(afterDefaultBuyerLastPaidAt.toString(), originalDefaultBuyerLastPaidAt.toString())

    // set it back
    await apiCalls.setDefaultBuyerLastPaidAt(originalDefaultBuyerLastPaidAt.toString())
    afterDefaultBuyerLastPaidAt = await apiCalls.defaultBuyerLastPaidAt.call()
    assert.equal(afterDefaultBuyerLastPaidAt.toString(), originalDefaultBuyerLastPaidAt.toString())
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

  it('should let buyers deposit credits, use apis, and pay the seller for usage.  best case test where credits >= approved >= owed for accounts[2] and where owed > credits >= approved for accounts[3].', async function () {
    let apiCalls = await APICalls.deployed()
    let token = await Token.deployed()

    const creditAmount = new BigNumber('1000000')
    const gasPrice = new BigNumber('1000000000')
    let tokenReward = new BigNumber('100').times(new BigNumber('10').pow(18))

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
    let amountOwedForAcctTwoBefore = await apiCalls.amountOwedForApiForBuyer(apiId, accounts[2])

    // set usage reporting address for the api
    await apiCalls.setUsageReportingAddress(accounts[9])

    // report usage from an account with ample credits to cover the balance
    let result = await apiCalls.reportUsage(apiId, apiCallCount.toNumber(), accounts[2], {from: accounts[9]})

    assert.equal(result.logs[0].event, 'LogAPICallsMade')

    let totalOwedAfter = await apiCalls.totalOwedForApi(apiId)
    let amountOwedForAcctTwoAfter = await apiCalls.amountOwedForApiForBuyer(apiId, accounts[2])

    assert.equal(totalOwedBefore.add(apiCallCount.times(pricePerCall)).eq(totalOwedAfter), true)
    assert.equal(amountOwedForAcctTwoBefore.add(apiCallCount.times(pricePerCall)).eq(amountOwedForAcctTwoAfter), true)

    totalOwedBefore = totalOwedAfter
    let amountOwedForAcctThreeBefore = await apiCalls.amountOwedForApiForBuyer(apiId, accounts[3])

    // make sure accounts[3] has no credits
    let acctThreeCredits = await apiCalls.creditsBalanceOf(accounts[3])
    if (acctThreeCredits.toString() !== '0') {
      await apiCalls.withdrawCredits(acctThreeCredits.toString())
    }

    // make sure token reward is set to 100
    await apiCalls.setTokenReward(tokenReward.toString())

    // report usage from an account with no credits
    result = await apiCalls.reportUsage(apiId, apiCallCount.toNumber(), accounts[3], {from: accounts[9]})

    assert.equal(result.logs[0].event, 'LogAPICallsMade')

    totalOwedAfter = await apiCalls.totalOwedForApi(apiId)
    let amountOwedForAcctThreeAfter = await apiCalls.amountOwedForApiForBuyer(apiId, accounts[3])

    assert.equal(totalOwedBefore.add(apiCallCount.times(pricePerCall)).eq(totalOwedAfter), true)
    assert.equal(amountOwedForAcctThreeBefore.add(apiCallCount.times(pricePerCall)).eq(amountOwedForAcctThreeAfter), true)

    let sellerBalanceBefore = await web3.eth.getBalance(accounts[1])

    // check if token is paused.  if so, unpause it.
    // this is because paySeller will fail if token is paused.
    let paused = await token.paused.call()
    if (paused) {
      // unpause token to allow transfers
      await token.unpause({from: accounts[0]})
    }

    // get token balances for both accounts
    let tokenBalanceBefore = await token.balanceOf.call(accounts[1])

    let buyerInfo = await apiCalls.buyerInfoOf(accounts[2])
    let lifetimeCreditsUsedBeforeAcctTwo = buyerInfo[3]

    // make sure that accounts [2] and [3] both have high enough approvedAmounts for this API so that paySeller will pay the entire balance
    await apiCalls.approveAmount(apiId, accounts[2], 1000000000, {from: accounts[2]})
    await apiCalls.approveAmount(apiId, accounts[3], 1000000000, {from: accounts[3]})

    result = await apiCalls.paySeller(apiId, {from: accounts[1], gasPrice: gasPrice.toNumber()})

    assert.equal(result.logs[0].event, 'LogSpendCredits')

    gasUsed = result.receipt.gasUsed
    weiConsumedByGas = gasPrice.times(BigNumber(gasUsed))

    let sellerBalanceAfter = await web3.eth.getBalance(accounts[1])
    let tokenBalanceAfter = await token.balanceOf.call(accounts[1])
    let totalPayable = apiCallCount.times(pricePerCall)
    let saleFee = await apiCalls.saleFee.call()
    let networkFee = totalPayable.times(new BigNumber('100')).div(saleFee).div(new BigNumber('100'))
    let calculatedProfit = totalPayable.minus(networkFee)

    assert.equal(tokenBalanceBefore.add(tokenReward).toString(), tokenBalanceAfter.toString())

    assert.equal(sellerBalanceBefore.minus(weiConsumedByGas).add(calculatedProfit).eq(sellerBalanceAfter), true)

    amountOwedForAcctThreeAfter = await apiCalls.amountOwedForApiForBuyer(apiId, accounts[3])
    assert.equal(amountOwedForAcctThreeAfter.toString(), totalPayable.toString())

    amountOwedForAcctTwoAfter = await apiCalls.amountOwedForApiForBuyer(apiId, accounts[2])
    assert.equal(amountOwedForAcctTwoAfter.toString(), '0')

    // check that accounts[3] is overdrafted
    buyerInfo = await apiCalls.buyerInfoOf(accounts[3])
    assert.equal(buyerInfo.length, 5)
    assert.equal(buyerInfo[0], true) // overdrafted
    assert.equal(buyerInfo[1], 1) // lifetime overdraft count
    assert.equal(buyerInfo[2], 0) // credits
    assert.equal(buyerInfo[3], 0) // lifetime credits used
    assert.equal(buyerInfo[4], 0) // lifetimeExceededApprovalAmountCount

    // check that accounts[2] is not overdrafted
    buyerInfo = await apiCalls.buyerInfoOf(accounts[2])
    assert.equal(buyerInfo.length, 5)
    assert.equal(buyerInfo[0], false) // overdrafted
    assert.equal(buyerInfo[1], 0) // lifetime overdraft count
    assert.equal(buyerInfo[2].toString(), creditAmount.minus(totalPayable).toString()) // credits
    assert.notEqual(buyerInfo[3].toString, '0')
    assert.equal(buyerInfo[3].toString(), lifetimeCreditsUsedBeforeAcctTwo.plus(totalPayable).toString()) // lifetime credits used
    assert.equal(buyerInfo[4], 0) // lifetimeExceededApprovalAmountCount

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

it('should not pay the seller anything if approved amounts are zero.  tests case where credits >= owed > approved for acct 2 and where owed > credits >= approved for acct 3', async function () {
    let apiCalls = await APICalls.deployed()
    let token = await Token.deployed()

    const creditAmount = new BigNumber('1000000')
    const gasPrice = new BigNumber('1000000000')
    let tokenReward = new BigNumber('100').times(new BigNumber('10').pow(18))

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
    let amountOwedForAcctTwoBefore = await apiCalls.amountOwedForApiForBuyer(apiId, accounts[2])

    // set usage reporting address for the api
    await apiCalls.setUsageReportingAddress(accounts[9])

    // report usage from an account with ample credits to cover the balance
    let result = await apiCalls.reportUsage(apiId, apiCallCount.toNumber(), accounts[2], {from: accounts[9]})

    assert.equal(result.logs[0].event, 'LogAPICallsMade')

    let totalOwedAfter = await apiCalls.totalOwedForApi(apiId)
    let amountOwedForAcctTwoAfter = await apiCalls.amountOwedForApiForBuyer(apiId, accounts[2])

    assert.equal(totalOwedBefore.add(apiCallCount.times(pricePerCall)).eq(totalOwedAfter), true)
    assert.equal(amountOwedForAcctTwoBefore.add(apiCallCount.times(pricePerCall)).eq(amountOwedForAcctTwoAfter), true)

    totalOwedBefore = totalOwedAfter
    let amountOwedForAcctThreeBefore = await apiCalls.amountOwedForApiForBuyer(apiId, accounts[3])

    // make sure accounts[3] has no credits
    let acctThreeCredits = await apiCalls.creditsBalanceOf(accounts[3])
    if (acctThreeCredits.toString() !== '0') {
      await apiCalls.withdrawCredits(acctThreeCredits.toString())
    }

    // make sure token reward is set to 100
    await apiCalls.setTokenReward(tokenReward.toString())

    // report usage from an account with no credits
    result = await apiCalls.reportUsage(apiId, apiCallCount.toNumber(), accounts[3], {from: accounts[9]})

    assert.equal(result.logs[0].event, 'LogAPICallsMade')

    totalOwedAfter = await apiCalls.totalOwedForApi(apiId)
    let amountOwedForAcctThreeAfter = await apiCalls.amountOwedForApiForBuyer(apiId, accounts[3])

    assert.equal(totalOwedBefore.add(apiCallCount.times(pricePerCall)).eq(totalOwedAfter), true)
    assert.equal(amountOwedForAcctThreeBefore.add(apiCallCount.times(pricePerCall)).eq(amountOwedForAcctThreeAfter), true)

    let sellerBalanceBefore = await web3.eth.getBalance(accounts[1])
    let tokenBalanceBefore = await token.balanceOf.call(accounts[1])

    // check if token is paused.  if so, unpause it.
    // this is because paySeller will fail if token is paused.
    let paused = await token.paused.call()
    if (paused) {
      // unpause token to allow transfers
      await token.unpause({from: accounts[0]})
    }

    // test setting and getting approved amounts
    await apiCalls.approveAmount(apiId, accounts[2], 120, {from: accounts[2]})
    await apiCalls.approveAmount(apiId, accounts[3], 240, {from: accounts[3]})

    let approvedAmountForAcctTwo = await apiCalls.approvedAmount(apiId, accounts[2])
    assert.equal(approvedAmountForAcctTwo.toString(), '120')

    let approvedAmountForAcctThree = await apiCalls.approvedAmount(apiId, accounts[3])
    assert.equal(approvedAmountForAcctThree.toString(), '240')

    // make sure that accounts [2] and [3] both have 0 approvedAmounts for this API so that paySeller will pay nothing
    await apiCalls.approveAmount(apiId, accounts[2], 0, {from: accounts[2]})
    await apiCalls.approveAmount(apiId, accounts[3], 0, {from: accounts[3]})

    creditsBalanceBefore = await apiCalls.creditsBalanceOf(accounts[2])

    // get overdraft counts before we call paySeller
    let buyerInfo = await apiCalls.buyerInfoOf(accounts[3])
    let overdraftCountAcctThree = buyerInfo[1]

    buyerInfo = await apiCalls.buyerInfoOf(accounts[2])
    let overdraftCountAcctTwo = buyerInfo[1]
    let lifetimeCreditsUsedAcctTwo = buyerInfo[3]
    let lifetimeExceededApprovalAmountCountAcctTwo = buyerInfo[4] 

    result = await apiCalls.paySeller(apiId, {from: accounts[1], gasPrice: gasPrice.toNumber()})

    gasUsed = result.receipt.gasUsed
    weiConsumedByGas = gasPrice.times(BigNumber(gasUsed))

    creditsBalanceAfter = await apiCalls.creditsBalanceOf(accounts[2])

    // since approval amount is 0, creditsBalanceBefore should equal after
    assert.equal(creditsBalanceBefore.eq(creditsBalanceAfter), true)

    assert.equal(result.logs.length, 0) // no events happened because nothing was approved.

    gasUsed = result.receipt.gasUsed
    weiConsumedByGas = gasPrice.times(BigNumber(gasUsed))

    let sellerBalanceAfter = await web3.eth.getBalance(accounts[1])
    let tokenBalanceAfter = await token.balanceOf.call(accounts[1])
    // the seller got paid nothing
    assert.equal(sellerBalanceBefore.minus(weiConsumedByGas).eq(sellerBalanceAfter), true)
    // no tokens should be transferred
    assert.equal(tokenBalanceBefore.toString(), tokenBalanceAfter.toString())

    // check that buyerExceededApprovedAmount is true for acct2 and false for acct3
    // this is becaue accts3 is overdrafted and that takes precedence over execeededAmount
    let execeededApproval = await apiCalls.buyerExceededApprovedAmount(apiId, accounts[2])
    assert.equal(execeededApproval, true)
    execeededApproval = await apiCalls.buyerExceededApprovedAmount(apiId, accounts[3])
    assert.equal(execeededApproval, false)

    // check that accounts[3] is overdrafted
    buyerInfo = await apiCalls.buyerInfoOf(accounts[3])
    assert.equal(buyerInfo.length, 5)
    assert.equal(buyerInfo[0], true) // overdrafted
    assert.equal(buyerInfo[1].toString(), overdraftCountAcctThree.add(new BigNumber('1')).toString()) // lifetime overdraft count
    assert.equal(buyerInfo[2], 0) // credits
    assert.equal(buyerInfo[3], 0) // lifetime credits used
    assert.equal(buyerInfo[4], 0) // lifetimeExceededApprovalAmountCount

    // check that accounts[2] is not overdrafted but has an exceeded amount flag
    buyerInfo = await apiCalls.buyerInfoOf(accounts[2])
    assert.equal(buyerInfo.length, 5)
    assert.equal(buyerInfo[0], false) // overdrafted
    assert.equal(buyerInfo[1], overdraftCountAcctTwo.toString()) // lifetime overdraft count
    assert.equal(buyerInfo[2].toString(), creditAmount.toString()) // credits
    assert.equal(buyerInfo[3].toString(), lifetimeCreditsUsedAcctTwo.toString()) // lifetime credits used
    assert.equal(buyerInfo[4].toString(), lifetimeExceededApprovalAmountCountAcctTwo.plus(new BigNumber('1')).toString()) // lifetimeExceededApprovalAmountCount
  })

  it('should only pay the seller the approved amounts.  tests case where credits >= owed > approved for acct 2 and owed > credits >= approved for acct 3', async function () {
    let apiCalls = await APICalls.deployed()
    let token = await Token.deployed()

    const creditAmount = new BigNumber('100000000000')
    const gasPrice = new BigNumber('1000000000')
    const acctTwoApprovedAmount = new BigNumber('1')
    let tokenReward = new BigNumber('100').times(new BigNumber('10').pow(18))

    // remove all credits from accts[2] so we will have exactly creditAmount
    let acctTwoCredits = await apiCalls.creditsBalanceOf(accounts[2])
    if (acctTwoCredits.toString() !== '0') {
      await apiCalls.withdrawCredits(acctTwoCredits.toString(), {from: accounts[2]})
    }

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
    let pricePerCall = new BigNumber('20000')
    let apiRegistry = await APIRegistry.deployed()
    let apiCallCount = new BigNumber('1000')

    let numApisBefore = await apiRegistry.numApis.call()

    // list the api
    await apiRegistry.listApi(pricePerCall.toNumber(), sellerUsername, apiName, hostname, docsUrl, { from: accounts[1] })

    let numApisAfter = await apiRegistry.numApis.call()
    assert.equal(numApisAfter.toNumber(), numApisBefore.toNumber() + 1)

    let apiId = await apiRegistry.getApiId(hostname)

    let totalOwedBefore = await apiCalls.totalOwedForApi(apiId)
    let amountOwedForAcctTwoBefore = await apiCalls.amountOwedForApiForBuyer(apiId, accounts[2])

    // set usage reporting address for the api
    await apiCalls.setUsageReportingAddress(accounts[9])

    // report usage from an account with ample credits to cover the balance
    let result = await apiCalls.reportUsage(apiId, apiCallCount.toNumber(), accounts[2], {from: accounts[9]})

    assert.equal(result.logs[0].event, 'LogAPICallsMade')

    let totalOwedAfter = await apiCalls.totalOwedForApi(apiId)
    let amountOwedForAcctTwoAfter = await apiCalls.amountOwedForApiForBuyer(apiId, accounts[2])

    assert.equal(totalOwedBefore.add(apiCallCount.times(pricePerCall)).eq(totalOwedAfter), true)
    assert.equal(amountOwedForAcctTwoBefore.add(apiCallCount.times(pricePerCall)).eq(amountOwedForAcctTwoAfter), true)

    totalOwedBefore = totalOwedAfter
    let amountOwedForAcctThreeBefore = await apiCalls.amountOwedForApiForBuyer(apiId, accounts[3])

    // make sure accounts[3] has no credits
    let acctThreeCredits = await apiCalls.creditsBalanceOf(accounts[3])
    if (acctThreeCredits.toString() !== '0') {
      await apiCalls.withdrawCredits(acctThreeCredits.toString())
    }

    // make sure token reward is set to 100
    await apiCalls.setTokenReward(tokenReward.toString())

    // report usage from an account with no credits
    result = await apiCalls.reportUsage(apiId, apiCallCount.toNumber(), accounts[3], {from: accounts[9]})

    assert.equal(result.logs[0].event, 'LogAPICallsMade')

    totalOwedAfter = await apiCalls.totalOwedForApi(apiId)
    let amountOwedForAcctThreeAfter = await apiCalls.amountOwedForApiForBuyer(apiId, accounts[3])

    assert.equal(totalOwedBefore.add(apiCallCount.times(pricePerCall)).eq(totalOwedAfter), true)
    assert.equal(amountOwedForAcctThreeBefore.add(apiCallCount.times(pricePerCall)).eq(amountOwedForAcctThreeAfter), true)

    let sellerBalanceBefore = await web3.eth.getBalance(accounts[1])
    let tokenBalanceBefore = await token.balanceOf.call(accounts[1])

    // check if token is paused.  if so, unpause it.
    // this is because paySeller will fail if token is paused.
    let paused = await token.paused.call()
    if (paused) {
      // unpause token to allow transfers
      await token.unpause({from: accounts[0]})
    }

    // set approved amount for accounts[2] to acctTwoApprovedAmount
    await apiCalls.approveAmount(apiId, accounts[2], acctTwoApprovedAmount.toString(), {from: accounts[2]})
    // make sure that accounts[3] has 0 approvedAmounts for this API so that paySeller will pay nothing
    await apiCalls.approveAmount(apiId, accounts[3], 0, {from: accounts[3]})

    creditsBalanceBefore = await apiCalls.creditsBalanceOf(accounts[2])

    // get overdraft counts before we call paySeller
    let buyerInfo = await apiCalls.buyerInfoOf(accounts[3])
    let overdraftCountAcctThree = buyerInfo[1]

    buyerInfo = await apiCalls.buyerInfoOf(accounts[2])
    let overdraftCountAcctTwo = buyerInfo[1]
    let lifetimeCreditsUsedBeforeAcctTwo = buyerInfo[3] 
    let lifetimeExceededApprovalAmountCountBeforeAcctTwo = buyerInfo[4]

    let now = new BigNumber(Math.round(new Date().getTime() / 1000))
    let buyerLastPaidAtAcctTwo = await apiCalls.buyerLastPaidAt(apiId, accounts[2])
    if (buyerLastPaidAtAcctTwo.toString() === '0') {
      let defaultBuyerLastPaidAt = await apiCalls.defaultBuyerLastPaidAt()
      buyerLastPaidAtAcctTwo = now.minus(defaultBuyerLastPaidAt)
    }

    result = await apiCalls.paySeller(apiId, {from: accounts[1], gasPrice: gasPrice.toNumber()})

    gasUsed = result.receipt.gasUsed
    weiConsumedByGas = gasPrice.times(BigNumber(gasUsed))

    creditsBalanceAfter = await apiCalls.creditsBalanceOf(accounts[2])

    let maxSpent = now.minus(buyerLastPaidAtAcctTwo).times(acctTwoApprovedAmount)

    // since approval amount is acctTwoApprovedAmount, creditsBalanceBefore minus acctTwoApprovedAmount should equal after
    // console.log('now: ' + now.toString())
    // console.log('buyerLastPaidAtAcctTwo: ' + buyerLastPaidAtAcctTwo.toString())
    // console.log('acctTwoApprovedAmount: ' + acctTwoApprovedAmount.toString())
    // console.log('maxSpent:' + maxSpent.toString())
    // console.log('creditsBalanceBefore: ' + creditsBalanceBefore.toString())
    // console.log('creditsBalanceBefore - maxSpent: ' + creditsBalanceBefore.minus(maxSpent).toString())
    // console.log('creditsBalanceAfter: ' + creditsBalanceAfter.toString())
    assert.equal(creditsBalanceBefore.minus(maxSpent).eq(creditsBalanceAfter), true)

    assert.equal(result.logs.length, 2) // two events happened - send credits and api paid
    assert.equal(result.logs[0].event, 'LogSpendCredits')
    assert.equal(result.logs[1].event, 'LogAPICallsPaid')
    // console.log('------------------')
    // console.log(result.logs)

    gasUsed = result.receipt.gasUsed
    weiConsumedByGas = gasPrice.times(BigNumber(gasUsed))

    let sellerBalanceAfter = await web3.eth.getBalance(accounts[1])
    let tokenBalanceAfter = await token.balanceOf.call(accounts[1])
    let totalPayable = maxSpent
    let saleFee = await apiCalls.saleFee.call()
    let networkFee = totalPayable.times(new BigNumber('100')).div(saleFee).div(new BigNumber('100'))
    let calculatedProfit = totalPayable.minus(networkFee)

    assert.equal(sellerBalanceBefore.minus(weiConsumedByGas).plus(calculatedProfit).eq(sellerBalanceAfter), true)
    assert.equal(tokenBalanceBefore.plus(tokenReward).toString(), tokenBalanceAfter.toString())

    // check that buyerExceededApprovedAmount is true for acct2 and false for acct3
    // this is becaue accts3 is overdrafted and that takes precedence over execeededAmount
    let execeededApproval = await apiCalls.buyerExceededApprovedAmount(apiId, accounts[2])
    assert.equal(execeededApproval, true)
    execeededApproval = await apiCalls.buyerExceededApprovedAmount(apiId, accounts[3])
    assert.equal(execeededApproval, false)

    // check that accounts[3] is overdrafted
    buyerInfo = await apiCalls.buyerInfoOf(accounts[3])
    assert.equal(buyerInfo.length, 5)
    assert.equal(buyerInfo[0], true) // overdrafted
    assert.equal(buyerInfo[1].toString(), overdraftCountAcctThree.add(new BigNumber('1')).toString()) // lifetime overdraft count
    assert.equal(buyerInfo[2], 0) // credits
    assert.equal(buyerInfo[3], 0) // lifetime credits used
    assert.equal(buyerInfo[4], 0) // lifetimeExceededApprovalAmountCount

    // check that accounts[2] is not overdrafted but has an exceeded amount flag
    buyerInfo = await apiCalls.buyerInfoOf(accounts[2])
    assert.equal(buyerInfo.length, 5)
    assert.equal(buyerInfo[0], false) // overdrafted
    assert.equal(buyerInfo[1], overdraftCountAcctTwo.toString()) // lifetime overdraft count
    assert.equal(buyerInfo[2].toString(), creditAmount.minus(maxSpent).toString()) // credits
    assert.equal(buyerInfo[3].toString(), lifetimeCreditsUsedBeforeAcctTwo.add(maxSpent).toString()) // lifetime credits used
    assert.equal(buyerInfo[4].toString(), lifetimeExceededApprovalAmountCountBeforeAcctTwo.plus(new BigNumber('1')).toString()) // lifetimeExceededApprovalAmountCount
  })

  it('should only pay the seller the approved amounts.  tests case where owed > approved > credits for acct 2 and owed > credits >= approved for acct 3', async function () {
    let apiCalls = await APICalls.deployed()
    let token = await Token.deployed()

    const creditAmount = new BigNumber('10000')
    const gasPrice = new BigNumber('1000000000')
    const acctTwoApprovedAmount = new BigNumber('1')
    let tokenReward = new BigNumber('100').times(new BigNumber('10').pow(18))

    // remove all credits from accts[2] so we will have exactly creditAmount
    let acctTwoCredits = await apiCalls.creditsBalanceOf(accounts[2])
    if (acctTwoCredits.toString() !== '0') {
      await apiCalls.withdrawCredits(acctTwoCredits.toString(), {from: accounts[2]})
    }

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
    let pricePerCall = new BigNumber('20000')
    let apiRegistry = await APIRegistry.deployed()
    let apiCallCount = new BigNumber('1000')

    let numApisBefore = await apiRegistry.numApis.call()

    // list the api
    await apiRegistry.listApi(pricePerCall.toNumber(), sellerUsername, apiName, hostname, docsUrl, { from: accounts[1] })

    let numApisAfter = await apiRegistry.numApis.call()
    assert.equal(numApisAfter.toNumber(), numApisBefore.toNumber() + 1)

    let apiId = await apiRegistry.getApiId(hostname)

    let totalOwedBefore = await apiCalls.totalOwedForApi(apiId)
    let amountOwedForAcctTwoBefore = await apiCalls.amountOwedForApiForBuyer(apiId, accounts[2])

    // set usage reporting address for the api
    await apiCalls.setUsageReportingAddress(accounts[9])

    // report usage from an account with ample credits to cover the balance
    let result = await apiCalls.reportUsage(apiId, apiCallCount.toNumber(), accounts[2], {from: accounts[9]})

    assert.equal(result.logs[0].event, 'LogAPICallsMade')

    let totalOwedAfter = await apiCalls.totalOwedForApi(apiId)
    let amountOwedForAcctTwoAfter = await apiCalls.amountOwedForApiForBuyer(apiId, accounts[2])

    assert.equal(totalOwedBefore.add(apiCallCount.times(pricePerCall)).eq(totalOwedAfter), true)
    assert.equal(amountOwedForAcctTwoBefore.add(apiCallCount.times(pricePerCall)).eq(amountOwedForAcctTwoAfter), true)

    totalOwedBefore = totalOwedAfter
    let amountOwedForAcctThreeBefore = await apiCalls.amountOwedForApiForBuyer(apiId, accounts[3])

    // make sure accounts[3] has no credits
    let acctThreeCredits = await apiCalls.creditsBalanceOf(accounts[3])
    if (acctThreeCredits.toString() !== '0') {
      await apiCalls.withdrawCredits(acctThreeCredits.toString())
    }

    // make sure token reward is set to 100
    await apiCalls.setTokenReward(tokenReward.toString())

    // report usage from an account with no credits
    result = await apiCalls.reportUsage(apiId, apiCallCount.toNumber(), accounts[3], {from: accounts[9]})

    assert.equal(result.logs[0].event, 'LogAPICallsMade')

    totalOwedAfter = await apiCalls.totalOwedForApi(apiId)
    let amountOwedForAcctThreeAfter = await apiCalls.amountOwedForApiForBuyer(apiId, accounts[3])

    assert.equal(totalOwedBefore.add(apiCallCount.times(pricePerCall)).eq(totalOwedAfter), true)
    assert.equal(amountOwedForAcctThreeBefore.add(apiCallCount.times(pricePerCall)).eq(amountOwedForAcctThreeAfter), true)

    let sellerBalanceBefore = await web3.eth.getBalance(accounts[1])
    let tokenBalanceBefore = await token.balanceOf.call(accounts[1])

    // check if token is paused.  if so, unpause it.
    // this is because paySeller will fail if token is paused.
    let paused = await token.paused.call()
    if (paused) {
      // unpause token to allow transfers
      await token.unpause({from: accounts[0]})
    }

    // set approved amount for accounts[2] to acctTwoApprovedAmount
    await apiCalls.approveAmount(apiId, accounts[2], acctTwoApprovedAmount.toString(), {from: accounts[2]})
    // make sure that accounts[3] has 0 approvedAmounts for this API so that paySeller will pay nothing
    await apiCalls.approveAmount(apiId, accounts[3], 0, {from: accounts[3]})

    creditsBalanceBefore = await apiCalls.creditsBalanceOf(accounts[2])

    // get overdraft counts before we call paySeller
    let buyerInfo = await apiCalls.buyerInfoOf(accounts[3])
    let overdraftCountAcctThree = buyerInfo[1]

    buyerInfo = await apiCalls.buyerInfoOf(accounts[2])
    let overdraftCountAcctTwo = buyerInfo[1]
    let lifetimeCreditsUsedBeforeAcctTwo = buyerInfo[3] 
    let lifetimeExceededApprovalAmountCountBeforeAcctTwo = buyerInfo[4]

    let now = new BigNumber(Math.round(new Date().getTime() / 1000))
    let buyerLastPaidAtAcctTwo = await apiCalls.buyerLastPaidAt(apiId, accounts[2])
    if (buyerLastPaidAtAcctTwo.toString() === '0') {
      let defaultBuyerLastPaidAt = await apiCalls.defaultBuyerLastPaidAt()
      buyerLastPaidAtAcctTwo = now.minus(defaultBuyerLastPaidAt)
    }

    result = await apiCalls.paySeller(apiId, {from: accounts[1], gasPrice: gasPrice.toNumber()})

    gasUsed = result.receipt.gasUsed
    weiConsumedByGas = gasPrice.times(BigNumber(gasUsed))

    creditsBalanceAfter = await apiCalls.creditsBalanceOf(accounts[2])

    // since approval amount is acctTwoApprovedAmount, creditsBalanceBefore minus acctTwoApprovedAmount should equal after
    // console.log('now: ' + now.toString())
    // console.log('buyerLastPaidAtAcctTwo: ' + buyerLastPaidAtAcctTwo.toString())
    // console.log('acctTwoApprovedAmount: ' + acctTwoApprovedAmount.toString())
    // console.log('maxSpent:' + maxSpent.toString())
    // console.log('creditsBalanceBefore: ' + creditsBalanceBefore.toString())
    // console.log('creditsBalanceBefore - maxSpent: ' + creditsBalanceBefore.minus(maxSpent).toString())
    // console.log('creditsBalanceAfter: ' + creditsBalanceAfter.toString())
    assert.equal(creditsBalanceBefore.minus(creditAmount).eq(creditsBalanceAfter), true)

    assert.equal(result.logs.length, 2) // two events happened - send credits and api paid
    assert.equal(result.logs[0].event, 'LogSpendCredits')
    assert.equal(result.logs[1].event, 'LogAPICallsPaid')
    // console.log('------------------')
    // console.log(result.logs)

    gasUsed = result.receipt.gasUsed
    weiConsumedByGas = gasPrice.times(BigNumber(gasUsed))

    let sellerBalanceAfter = await web3.eth.getBalance(accounts[1])
    let tokenBalanceAfter = await token.balanceOf.call(accounts[1])
    let totalPayable = creditAmount
    let saleFee = await apiCalls.saleFee.call()
    let networkFee = totalPayable.times(new BigNumber('100')).div(saleFee).div(new BigNumber('100'))
    let calculatedProfit = totalPayable.minus(networkFee)

    assert.equal(sellerBalanceBefore.minus(weiConsumedByGas).plus(calculatedProfit).eq(sellerBalanceAfter), true)
    assert.equal(tokenBalanceBefore.plus(tokenReward).toString(), tokenBalanceAfter.toString())

    // check that buyerExceededApprovedAmount is falser for acct2 and false for acct3
    // this is becaue accts3 is overdrafted and that takes precedence over execeededAmount
    let execeededApproval = await apiCalls.buyerExceededApprovedAmount(apiId, accounts[2])
    assert.equal(execeededApproval, false)
    execeededApproval = await apiCalls.buyerExceededApprovedAmount(apiId, accounts[3])
    assert.equal(execeededApproval, false)

    // check that accounts[3] is overdrafted
    buyerInfo = await apiCalls.buyerInfoOf(accounts[3])
    assert.equal(buyerInfo.length, 5)
    assert.equal(buyerInfo[0], true) // overdrafted
    assert.equal(buyerInfo[1].toString(), overdraftCountAcctThree.add(new BigNumber('1')).toString()) // lifetime overdraft count
    assert.equal(buyerInfo[2], 0) // credits
    assert.equal(buyerInfo[3], 0) // lifetime credits used
    assert.equal(buyerInfo[4], 0) // lifetimeExceededApprovalAmountCount

    // check that accounts[2] is overdrafted
    buyerInfo = await apiCalls.buyerInfoOf(accounts[2])
    assert.equal(buyerInfo.length, 5)
    assert.equal(buyerInfo[0], true) // overdrafted
    assert.equal(buyerInfo[1], overdraftCountAcctTwo.add(new BigNumber('1')).toString()) // lifetime overdraft count
    assert.equal(buyerInfo[2].toString(), '0') // credits
    assert.equal(buyerInfo[3].toString(), lifetimeCreditsUsedBeforeAcctTwo.add(creditAmount).toString()) // lifetime credits used
    assert.equal(buyerInfo[4].toString(), lifetimeExceededApprovalAmountCountBeforeAcctTwo.toString()) // lifetimeExceededApprovalAmountCount
  })

it('should let buyers set their first use time', async function () {
    let apiCalls = await APICalls.deployed()
    let token = await Token.deployed()

    const creditAmount = new BigNumber('1000000')
    const gasPrice = new BigNumber('1000000000')
    let tokenReward = new BigNumber('100').times(new BigNumber('10').pow(18))
    let now = new BigNumber(Math.round(new Date().getTime() / 1000))
    let defaultBuyerLastPaidAt = new BigNumber('3600');
    let firstUseTime = now.minus(defaultBuyerLastPaidAt) // 3600 seconds = 1 hour.
    let approvedAmountForAcctSix = new BigNumber('1')

    let ethBalanceBefore = await web3.eth.getBalance(accounts[6])
    let creditsBalanceBefore = await apiCalls.creditsBalanceOf(accounts[6])

    // deposit credits for accounts[6]
    let addCreditsTxn = await apiCalls.addCredits(accounts[6], {from: accounts[6], value: creditAmount.toNumber(), gasPrice: gasPrice.toNumber()})

    let gasUsed = addCreditsTxn.receipt.gasUsed
    let weiConsumedByGas = gasPrice.times(BigNumber(gasUsed))

    let ethBalanceAfter = await web3.eth.getBalance(accounts[6])
    let creditsBalanceAfter = await apiCalls.creditsBalanceOf(accounts[6])

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
    let amountOwedForAcctTwoBefore = await apiCalls.amountOwedForApiForBuyer(apiId, accounts[6])

    // set usage reporting address for the api
    await apiCalls.setUsageReportingAddress(accounts[9])

    // report usage from an account with ample credits to cover the balance
    let result = await apiCalls.reportUsage(apiId, apiCallCount.toNumber(), accounts[6], {from: accounts[9]})

    assert.equal(result.logs[0].event, 'LogAPICallsMade')

    let totalOwedAfter = await apiCalls.totalOwedForApi(apiId)
    let amountOwedForAcctTwoAfter = await apiCalls.amountOwedForApiForBuyer(apiId, accounts[6])

    assert.equal(totalOwedBefore.add(apiCallCount.times(pricePerCall)).toString(), totalOwedAfter.toString())
    assert.equal(amountOwedForAcctTwoBefore.add(apiCallCount.times(pricePerCall)).toString(), amountOwedForAcctTwoAfter.toString())

    // make sure token reward is set to 100
    await apiCalls.setTokenReward(tokenReward.toString())

    let sellerBalanceBefore = await web3.eth.getBalance(accounts[1])
    let tokenBalanceBefore = await token.balanceOf.call(accounts[1])

    // check if token is paused.  if so, unpause it.
    // this is because paySeller will fail if token is paused.
    let paused = await token.paused.call()
    if (paused) {
      // unpause token to allow transfers
      await token.unpause({from: accounts[0]})
    }

    let buyerLastPaidAtBefore = await apiCalls.buyerLastPaidAt(apiId, accounts[6])
    // test setting and getting approved amounts and lastPaidAt
    await apiCalls.approveAmountAndSetFirstUseTime(apiId, accounts[6], approvedAmountForAcctSix.toString(), firstUseTime.toString(), {from: accounts[6]})

    let approvedAmountForAcctSixAfter = await apiCalls.approvedAmount(apiId, accounts[6])
    assert.equal(approvedAmountForAcctSixAfter.toString(), approvedAmountForAcctSix.toString())

    let buyerLastPaidAtAfter = await apiCalls.buyerLastPaidAt(apiId, accounts[6])
    assert.equal(buyerLastPaidAtAfter.toString(), firstUseTime.toString())
    assert.notEqual(buyerLastPaidAtAfter.toString(), buyerLastPaidAtBefore.toString())

    creditsBalanceBefore = await apiCalls.creditsBalanceOf(accounts[6])

    // get buyer info before we make the payment happen
    buyerInfo = await apiCalls.buyerInfoOf(accounts[6])
    let overdraftCountAcctSix = buyerInfo[1]
    let lifetimeCreditsUsedAcctSix = buyerInfo[3]
    let lifetimeExceededApprovalAmountCountAcctSix = buyerInfo[4] 

    result = await apiCalls.paySeller(apiId, {from: accounts[1], gasPrice: gasPrice.toNumber()})

    console.log('***********************')
    console.log(result)
    let blockNum = result.receipt.blockNumber
    let blockNumInfo = await web3.eth.getBlock(blockNum)
    console.log('***********************')
    console.log('***********************')
    console.log(blockNumInfo)
    // set now to the timestamp of the block so it's the same as the actual block "now" time
    now = new BigNumber(blockNumInfo.timestamp)

    gasUsed = result.receipt.gasUsed
    weiConsumedByGas = gasPrice.times(BigNumber(gasUsed))

    creditsBalanceAfter = await apiCalls.creditsBalanceOf(accounts[6])


    let maxSpent = now.minus(firstUseTime).times(approvedAmountForAcctSix)

    // since approval amount is 0, creditsBalanceBefore should equal after
    assert.equal(creditsBalanceBefore.minus(maxSpent).toString(), creditsBalanceAfter.toString())

    assert.equal(result.logs.length, 2) // two events happened - send credits and api paid
    assert.equal(result.logs[0].event, 'LogSpendCredits')
    assert.equal(result.logs[1].event, 'LogAPICallsPaid')

    gasUsed = result.receipt.gasUsed
    weiConsumedByGas = gasPrice.times(BigNumber(gasUsed))

    let sellerBalanceAfter = await web3.eth.getBalance(accounts[1])
    let tokenBalanceAfter = await token.balanceOf.call(accounts[1])
    let totalPayable = maxSpent
    let saleFee = await apiCalls.saleFee.call()
    let networkFee = totalPayable.times(new BigNumber('100')).div(saleFee).div(new BigNumber('100'))
    let calculatedProfit = Math.round(totalPayable.minus(networkFee))
    // the seller got paid maxSpent
    assert.equal(sellerBalanceBefore.minus(weiConsumedByGas).plus(calculatedProfit).toString(), sellerBalanceAfter.toString())
    // tokens for 1 buyer should be transferred
    assert.equal(tokenBalanceBefore.plus(tokenReward).toString(), tokenBalanceAfter.toString())

    // check that buyerExceededApprovedAmount is true for acct2
    let execeededApproval = await apiCalls.buyerExceededApprovedAmount(apiId, accounts[6])
    assert.equal(execeededApproval, true)

    // check that accounts[2] is not overdrafted but has an exceeded amount flag
    buyerInfo = await apiCalls.buyerInfoOf(accounts[6])
    assert.equal(buyerInfo.length, 5)
    assert.equal(buyerInfo[0], false) // overdrafted
    assert.equal(buyerInfo[1], overdraftCountAcctSix.toString()) // lifetime overdraft count
    assert.equal(buyerInfo[2].toString(), creditAmount.minus(maxSpent).toString()) // credits
    assert.equal(buyerInfo[3].toString(), lifetimeCreditsUsedAcctSix.plus(maxSpent).toString()) // lifetime credits used
    assert.equal(buyerInfo[4].toString(), lifetimeExceededApprovalAmountCountAcctSix.plus(new BigNumber('1')).toString()) // lifetimeExceededApprovalAmountCount
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
