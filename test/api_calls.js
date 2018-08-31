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

    // try reporting from an address that is not usage address or owner
    let exceptionGenerated = false
    try {
      let result = await apiCalls.reportUsage(apiId, 1000, accounts[2], {from: accounts[5]})
    } catch (e) {
      exceptionGenerated = true
    }
    assert.equal(exceptionGenerated, true)

    // try reporting 0 calls.  should fail.
    exceptionGenerated = false
    try {
      let result = await apiCalls.reportUsage(apiId, 0, accounts[2], {from: accounts[9]})
    } catch (e) {
      exceptionGenerated = true
    }
    assert.equal(exceptionGenerated, true)

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
    const gasPrice = new BigNumber('1')

    let ethBalanceBefore = await web3.eth.getBalance(accounts[2])
    let creditsBalanceBefore = await apiCalls.creditsBalanceOf(accounts[2])

    let addCreditsTxn = await apiCalls.addCredits(accounts[2], {from: accounts[2], value: creditAmount.toNumber(), gasPrice: gasPrice.toNumber()})

    let gasUsed = addCreditsTxn.receipt.gasUsed
    let weiConsumedByGas = gasPrice.times(BigNumber(gasUsed))

    let ethBalanceAfter = await web3.eth.getBalance(accounts[2])
    let creditsBalanceAfter = await apiCalls.creditsBalanceOf(accounts[2])

    assert.equal(creditsBalanceBefore.add(creditAmount).eq(creditsBalanceAfter), true)
    assert.equal(ethBalanceBefore.minus(creditAmount).minus(weiConsumedByGas).eq(ethBalanceAfter), true)

    // try to withdraw more credits than we have
    let exceptionGenerated = false
    try {
      await apiCalls.withdrawCredits(creditsBalanceAfter.plus(new BigNumber('100')).toString(), {from: accounts[2], gasPrice: gasPrice.toNumber()})
    } catch (e) {
      exceptionGenerated = true
    }
    assert.equal(exceptionGenerated, true)

    ethBalanceBefore = await web3.eth.getBalance(accounts[2])
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
    const gasPrice = new BigNumber('1')
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
    let networkFee = BigNumber(totalPayable.times(saleFee.div(100)))
    let calculatedProfit = totalPayable.minus(networkFee)

    if (process.env.DECONET_ACTIVATE_TOKEN_REWARD == "true") {
      assert.equal(tokenBalanceBefore.add(tokenReward).toString(), tokenBalanceAfter.toString())
    } else {
      assert.equal(tokenBalanceBefore.toString(), tokenBalanceAfter.toString())
    }

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

    // test setting approval amount for an acct that already has a lastPaidAt.  it should fail.
    let exceptionGenerated = false
    try {
      await apiCalls.approveAmountAndSetFirstUseTime(apiId, accounts[2], 1000000000, 12345, {from: accounts[2]})
    } catch (e) {
      exceptionGenerated = true
    }
    assert.equal(exceptionGenerated, true)
    

    // test pulling out the txn fees
    let contractBalanceBefore = await web3.eth.getBalance(apiCalls.address)
    let safeWithdrawAmount = await apiCalls.safeWithdrawAmount.call()

    await apiCalls.setWithdrawAddress(accounts[1])
    let withdrawAddressBalanceBefore = await web3.eth.getBalance(accounts[1])
    // safe widthdraw amount should be equal to network fee because we had 1 txn with 1 fee
    assert.equal(safeWithdrawAmount.toString(), networkFee.toString())

    result = await apiCalls.withdrawEther(safeWithdrawAmount.toString(), {from: accounts[1], gasPrice: gasPrice.toNumber()})
    gasUsed = result.receipt.gasUsed
    weiConsumedByGas = gasPrice.times(BigNumber(gasUsed))

    let contractBalanceAfter = await web3.eth.getBalance(apiCalls.address)
    assert.equal(contractBalanceBefore.minus(networkFee).toString(), contractBalanceAfter.toString())

    let withdrawAddressBalanceAfter = await web3.eth.getBalance(accounts[1])
    assert.equal(withdrawAddressBalanceBefore.minus(weiConsumedByGas).plus(networkFee).toString(), withdrawAddressBalanceAfter.toString())

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
    const gasPrice = new BigNumber('1')
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
    const gasPrice = new BigNumber('1')
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

    gasUsed = result.receipt.gasUsed
    weiConsumedByGas = gasPrice.times(BigNumber(gasUsed))

    let sellerBalanceAfter = await web3.eth.getBalance(accounts[1])
    let tokenBalanceAfter = await token.balanceOf.call(accounts[1])
    let totalPayable = maxSpent
    let saleFee = await apiCalls.saleFee.call()
    let networkFee = BigNumber(totalPayable.times(saleFee.div(100)))
    let calculatedProfit = totalPayable.minus(networkFee)

    assert.equal(sellerBalanceBefore.minus(weiConsumedByGas).plus(calculatedProfit).toString(), sellerBalanceAfter.toString())

    if (process.env.DECONET_ACTIVATE_TOKEN_REWARD == "true") {
      assert.equal(tokenBalanceBefore.plus(tokenReward).toString(), tokenBalanceAfter.toString())
    } else {
      assert.equal(tokenBalanceBefore.toString(), tokenBalanceAfter.toString())
    }

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
    const gasPrice = new BigNumber('1')
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
    let networkFee = BigNumber(totalPayable.times(saleFee.div(100)))
    let calculatedProfit = totalPayable.minus(networkFee)

    assert.equal(sellerBalanceBefore.minus(weiConsumedByGas).plus(calculatedProfit).eq(sellerBalanceAfter), true)

    if (process.env.DECONET_ACTIVATE_TOKEN_REWARD == "true") {
      assert.equal(tokenBalanceBefore.plus(tokenReward).toString(), tokenBalanceAfter.toString())
    } else {
      assert.equal(tokenBalanceBefore.toString(), tokenBalanceAfter.toString())
    }

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

it('should let buyers set their first use time or use a default one if not set', async function () {
    // test summary:
    // tests acct 6 with 20,000 owed and a limit of 3600 with a set first use time
    // tests acct 7 with 700,000 owed and a limit of 604800 without a first use time
    let apiCalls = await APICalls.deployed()
    let token = await Token.deployed()

    const creditAmount = new BigNumber('1000000')
    const gasPrice = new BigNumber('1')
    let tokenReward = new BigNumber('100').times(new BigNumber('10').pow(18))
    let now = new BigNumber(Math.round(new Date().getTime() / 1000))
    let defaultBuyerLastPaidAt = new BigNumber('3600');
    let firstUseTime = now.minus(defaultBuyerLastPaidAt) // 3600 seconds = 1 hour.
    let approvedAmountForAcctSixAndSeven = new BigNumber('1')

    // withdraw any credits from acct 6 and 7 if they exist
    let creditsBalance = await apiCalls.creditsBalanceOf(accounts[6])
    if (creditsBalance.toString() !== '0') {
      await apiCalls.withdrawCredits(creditsBalance.toString(), {from: accounts[6]})
    }
    creditsBalance = await apiCalls.creditsBalanceOf(accounts[7])
    if (creditsBalance.toString() !== '0') {
      await apiCalls.withdrawCredits(creditsBalance.toString(), {from: accounts[7]})
    }


    let ethBalanceBefore = await web3.eth.getBalance(accounts[6])
    let creditsBalanceBefore = await apiCalls.creditsBalanceOf(accounts[6])

    // deposit credits for accounts[6]
    // accts 6 will set a first use time
    let addCreditsTxn = await apiCalls.addCredits(accounts[6], {from: accounts[6], value: creditAmount.toNumber(), gasPrice: gasPrice.toNumber()})

    let gasUsed = addCreditsTxn.receipt.gasUsed
    let weiConsumedByGas = gasPrice.times(BigNumber(gasUsed))

    let ethBalanceAfter = await web3.eth.getBalance(accounts[6])
    let creditsBalanceAfter = await apiCalls.creditsBalanceOf(accounts[6])

    assert.equal(creditsBalanceBefore.add(creditAmount).eq(creditsBalanceAfter), true)
    assert.equal(ethBalanceBefore.minus(creditAmount).minus(weiConsumedByGas).eq(ethBalanceAfter), true)
    assert.equal(addCreditsTxn.logs[0].event, 'LogDepositCredits')

    ethBalanceBefore = await web3.eth.getBalance(accounts[7])
    creditsBalanceBefore = await apiCalls.creditsBalanceOf(accounts[7])

    // deposit credits for accounts[7]
    // accts 7 will NOT set a first use time
    addCreditsTxn = await apiCalls.addCredits(accounts[7], {from: accounts[7], value: creditAmount.toNumber(), gasPrice: gasPrice.toNumber()})

    gasUsed = addCreditsTxn.receipt.gasUsed
    weiConsumedByGas = gasPrice.times(BigNumber(gasUsed))

    ethBalanceAfter = await web3.eth.getBalance(accounts[7])
    creditsBalanceAfter = await apiCalls.creditsBalanceOf(accounts[7])

    assert.equal(creditsBalanceBefore.add(creditAmount).eq(creditsBalanceAfter), true)
    assert.equal(ethBalanceBefore.minus(creditAmount).minus(weiConsumedByGas).eq(ethBalanceAfter), true)
    assert.equal(addCreditsTxn.logs[0].event, 'LogDepositCredits')


    let sellerUsername = uuid.v4().substr(0, 32)
    let apiName = uuid.v4().substr(0, 32)
    let hostname = uuid.v4() + '.com'
    let docsUrl = hostname + '/docs'
    let pricePerCall = new BigNumber('20')
    let apiRegistry = await APIRegistry.deployed()
    let apiCallCountAcctSix = new BigNumber('1000')
    let apiCallCountAcctSeven = new BigNumber('35000')

    let numApisBefore = await apiRegistry.numApis.call()

    // list the api
    await apiRegistry.listApi(pricePerCall.toNumber(), sellerUsername, apiName, hostname, docsUrl, { from: accounts[1] })

    let numApisAfter = await apiRegistry.numApis.call()
    assert.equal(numApisAfter.toNumber(), numApisBefore.toNumber() + 1)

    let apiId = await apiRegistry.getApiId(hostname)

    // set usage reporting address for the api
    await apiCalls.setUsageReportingAddress(accounts[9])

    let totalOwedBefore = await apiCalls.totalOwedForApi(apiId)
    let amountOwedForAcct = await apiCalls.amountOwedForApiForBuyer(apiId, accounts[6])

    // report usage from account 6
    let result = await apiCalls.reportUsage(apiId, apiCallCountAcctSix.toNumber(), accounts[6], {from: accounts[9]})

    assert.equal(result.logs[0].event, 'LogAPICallsMade')

    let totalOwedAfter = await apiCalls.totalOwedForApi(apiId)
    let amountOwedForAcctAfter = await apiCalls.amountOwedForApiForBuyer(apiId, accounts[6])

    assert.equal(totalOwedBefore.add(apiCallCountAcctSix.times(pricePerCall)).toString(), totalOwedAfter.toString())
    assert.equal(amountOwedForAcct.add(apiCallCountAcctSix.times(pricePerCall)).toString(), amountOwedForAcctAfter.toString())

    // report usage from account 7
    totalOwedBefore = await apiCalls.totalOwedForApi(apiId)
    amountOwedForAcct = await apiCalls.amountOwedForApiForBuyer(apiId, accounts[7])

    result = await apiCalls.reportUsage(apiId, apiCallCountAcctSeven.toNumber(), accounts[7], {from: accounts[9]})

    assert.equal(result.logs[0].event, 'LogAPICallsMade')

    totalOwedAfter = await apiCalls.totalOwedForApi(apiId)
    amountOwedForAcctAfter = await apiCalls.amountOwedForApiForBuyer(apiId, accounts[7])

    assert.equal(totalOwedBefore.add(apiCallCountAcctSeven.times(pricePerCall)).toString(), totalOwedAfter.toString())
    assert.equal(amountOwedForAcct.add(apiCallCountAcctSeven.times(pricePerCall)).toString(), amountOwedForAcctAfter.toString())

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

    // get all the info for buyer 6
    let buyerLastPaidAtBefore = await apiCalls.buyerLastPaidAt(apiId, accounts[6])
    // test setting and getting approved amounts and lastPaidAt
    await apiCalls.approveAmountAndSetFirstUseTime(apiId, accounts[6], approvedAmountForAcctSixAndSeven.toString(), firstUseTime.toString(), {from: accounts[6]})

    let approvedAmountForAcctSixAfter = await apiCalls.approvedAmount(apiId, accounts[6])
    assert.equal(approvedAmountForAcctSixAfter.toString(), approvedAmountForAcctSixAndSeven.toString())

    let buyerLastPaidAtAfter = await apiCalls.buyerLastPaidAt(apiId, accounts[6])
    assert.equal(buyerLastPaidAtAfter.toString(), firstUseTime.toString())
    assert.notEqual(buyerLastPaidAtAfter.toString(), buyerLastPaidAtBefore.toString())

    // get all the info for buyer 7
    buyerLastPaidAtBefore = await apiCalls.buyerLastPaidAt(apiId, accounts[7])
    assert.equal(buyerLastPaidAtBefore.toString(), '0')
    // test setting and getting approved amounts and lastPaidAt
    await apiCalls.approveAmount(apiId, accounts[7], approvedAmountForAcctSixAndSeven.toString(), {from: accounts[7]})

    let approvedAmountForAcctSevenAfter = await apiCalls.approvedAmount(apiId, accounts[7])
    assert.equal(approvedAmountForAcctSevenAfter.toString(), approvedAmountForAcctSixAndSeven.toString())

    buyerLastPaidAtAfter = await apiCalls.buyerLastPaidAt(apiId, accounts[7])
    assert.equal(buyerLastPaidAtAfter.toString(), '0')
    assert.equal(buyerLastPaidAtAfter.toString(), buyerLastPaidAtBefore.toString())

    let creditsBalanceBeforeAcctSix = await apiCalls.creditsBalanceOf(accounts[6])
    let creditsBalanceBeforeAcctSeven = await apiCalls.creditsBalanceOf(accounts[7])


    // get buyer info before we make the payment happen
    buyerInfo = await apiCalls.buyerInfoOf(accounts[6])
    let overdraftCountAcctSix = buyerInfo[1]
    let lifetimeCreditsUsedAcctSix = buyerInfo[3]
    let lifetimeExceededApprovalAmountCountAcctSix = buyerInfo[4] 

    buyerInfo = await apiCalls.buyerInfoOf(accounts[7])
    let overdraftCountAcctSeven = buyerInfo[1]
    let lifetimeCreditsUsedAcctSeven = buyerInfo[3]
    let lifetimeExceededApprovalAmountCountAcctSeven = buyerInfo[4] 

    result = await apiCalls.paySeller(apiId, {from: accounts[1], gasPrice: gasPrice.toNumber()})

    // console.log('***********************')
    // console.log(result)
    let blockNum = result.receipt.blockNumber
    let blockNumInfo = await web3.eth.getBlock(blockNum)
    // console.log('***********************')
    // console.log('***********************')
    // console.log(blockNumInfo)
    // set now to the timestamp of the block so it's the same as the actual block "now" time
    now = new BigNumber(blockNumInfo.timestamp)

    gasUsed = result.receipt.gasUsed
    weiConsumedByGas = gasPrice.times(BigNumber(gasUsed))

    let creditsBalanceAfterAcctSix = await apiCalls.creditsBalanceOf(accounts[6])
    let creditsBalanceAfterAcctSeven = await apiCalls.creditsBalanceOf(accounts[7])

    let maxSpentAcctSix = now.minus(firstUseTime).times(approvedAmountForAcctSixAndSeven)
    defaultBuyerLastPaidAt = await apiCalls.defaultBuyerLastPaidAt.call()
    let defaultBuyerLastPaidAtTime = now.minus(defaultBuyerLastPaidAt)
    let maxSpentAcctSeven = now.minus(defaultBuyerLastPaidAtTime).times(approvedAmountForAcctSixAndSeven)

    assert.equal(creditsBalanceBeforeAcctSix.minus(maxSpentAcctSix).toString(), creditsBalanceAfterAcctSix.toString())
    assert.equal(creditsBalanceBeforeAcctSeven.minus(maxSpentAcctSeven).toString(), creditsBalanceAfterAcctSeven.toString())

    // console.log('results logs: ')
    // console.log(result.logs)
    assert.equal(result.logs.length, 3) // 3 events happened - send credits twice and api paid
    assert.equal(result.logs[0].event, 'LogSpendCredits')
    assert.equal(result.logs[1].event, 'LogSpendCredits')
    assert.equal(result.logs[2].event, 'LogAPICallsPaid')

    gasUsed = result.receipt.gasUsed
    weiConsumedByGas = gasPrice.times(BigNumber(gasUsed))

    let sellerBalanceAfter = await web3.eth.getBalance(accounts[1])
    let tokenBalanceAfter = await token.balanceOf.call(accounts[1])
    let totalPayable = maxSpentAcctSix.plus(maxSpentAcctSeven)
    let saleFee = await apiCalls.saleFee.call()
    let networkFee = BigNumber(totalPayable.times(saleFee.div(100)))
    let calculatedProfit = Math.round(totalPayable.minus(networkFee))
    // the seller got paid maxSpent
    assert.equal(sellerBalanceBefore.minus(weiConsumedByGas).plus(calculatedProfit).toString(), sellerBalanceAfter.toString())

    if (process.env.DECONET_ACTIVATE_TOKEN_REWARD == "true") {
      // tokens for 2 buyers should be transferred
      assert.equal(tokenBalanceBefore.plus(tokenReward.times(new BigNumber('2'))).toString(), tokenBalanceAfter.toString())
    } else {
      assert.equal(tokenBalanceBefore.toString(), tokenBalanceAfter.toString())
    }

    // check that buyerExceededApprovedAmount is true for acct6
    let execeededApproval = await apiCalls.buyerExceededApprovedAmount(apiId, accounts[6])
    assert.equal(execeededApproval, true)

    // check that accounts[6] is not overdrafted but has an exceeded amount flag
    buyerInfo = await apiCalls.buyerInfoOf(accounts[6])
    assert.equal(buyerInfo.length, 5)
    assert.equal(buyerInfo[0], false) // overdrafted
    assert.equal(buyerInfo[1], overdraftCountAcctSix.toString()) // lifetime overdraft count
    assert.equal(buyerInfo[2].toString(), creditAmount.minus(maxSpentAcctSix).toString()) // credits
    assert.equal(buyerInfo[3].toString(), lifetimeCreditsUsedAcctSix.plus(maxSpentAcctSix).toString()) // lifetime credits used
    assert.equal(buyerInfo[4].toString(), lifetimeExceededApprovalAmountCountAcctSix.plus(new BigNumber('1')).toString()) // lifetimeExceededApprovalAmountCount

    // check that buyerExceededApprovedAmount is true for acct7
    execeededApproval = await apiCalls.buyerExceededApprovedAmount(apiId, accounts[7])
    assert.equal(execeededApproval, true)

    // check that accounts[6] is not overdrafted but has an exceeded amount flag
    buyerInfo = await apiCalls.buyerInfoOf(accounts[7])
    assert.equal(buyerInfo.length, 5)
    assert.equal(buyerInfo[0], false) // overdrafted
    assert.equal(buyerInfo[1], overdraftCountAcctSeven.toString()) // lifetime overdraft count
    assert.equal(buyerInfo[2].toString(), creditAmount.minus(maxSpentAcctSeven).toString()) // credits
    assert.equal(buyerInfo[3].toString(), lifetimeCreditsUsedAcctSeven.plus(maxSpentAcctSeven).toString()) // lifetime credits used
    assert.equal(buyerInfo[4].toString(), lifetimeExceededApprovalAmountCountAcctSeven.plus(new BigNumber('1')).toString()) // lifetimeExceededApprovalAmountCount
  })

it('should let buyers use a default first use time of 1 week ago if not set, and process a single buyer at a time', async function () {
    // test summary:
    // tests acct 7 with 700,000 owed and a limit of 604800 without a first use time
    let apiCalls = await APICalls.deployed()
    let token = await Token.deployed()

    const creditAmount = new BigNumber('1000000')
    const gasPrice = new BigNumber('1')
    let tokenReward = new BigNumber('100').times(new BigNumber('10').pow(18))
    let now = new BigNumber(Math.round(new Date().getTime() / 1000))
    let approvedAmountForAcctSixAndSeven = new BigNumber('1')

    let creditsBalance = await apiCalls.creditsBalanceOf(accounts[7])
    if (creditsBalance.toString() !== '0') {
      await apiCalls.withdrawCredits(creditsBalance.toString(), {from: accounts[7]})
    }

    let ethBalanceBefore = await web3.eth.getBalance(accounts[7])
    let creditsBalanceBefore = await apiCalls.creditsBalanceOf(accounts[7])

    // deposit credits for accounts[7]
    // accts 7 will NOT set a first use time
    addCreditsTxn = await apiCalls.addCredits(accounts[7], {from: accounts[7], value: creditAmount.toNumber(), gasPrice: gasPrice.toNumber()})

    gasUsed = addCreditsTxn.receipt.gasUsed
    weiConsumedByGas = gasPrice.times(BigNumber(gasUsed))

    ethBalanceAfter = await web3.eth.getBalance(accounts[7])
    creditsBalanceAfter = await apiCalls.creditsBalanceOf(accounts[7])

    assert.equal(creditsBalanceBefore.add(creditAmount).eq(creditsBalanceAfter), true)
    assert.equal(ethBalanceBefore.minus(creditAmount).minus(weiConsumedByGas).eq(ethBalanceAfter), true)
    assert.equal(addCreditsTxn.logs[0].event, 'LogDepositCredits')


    let sellerUsername = uuid.v4().substr(0, 32)
    let apiName = uuid.v4().substr(0, 32)
    let hostname = uuid.v4() + '.com'
    let docsUrl = hostname + '/docs'
    let pricePerCall = new BigNumber('20')
    let apiRegistry = await APIRegistry.deployed()
    let apiCallCountAcctSix = new BigNumber('1000')
    let apiCallCountAcctSeven = new BigNumber('35000')

    let numApisBefore = await apiRegistry.numApis.call()

    // list the api
    await apiRegistry.listApi(pricePerCall.toNumber(), sellerUsername, apiName, hostname, docsUrl, { from: accounts[1] })

    let numApisAfter = await apiRegistry.numApis.call()
    assert.equal(numApisAfter.toNumber(), numApisBefore.toNumber() + 1)

    let apiId = await apiRegistry.getApiId(hostname)

    // set usage reporting address for the api
    await apiCalls.setUsageReportingAddress(accounts[9])

    // report usage from account 7
    let totalOwedBefore = await apiCalls.totalOwedForApi(apiId)
    let amountOwedForAcct = await apiCalls.amountOwedForApiForBuyer(apiId, accounts[7])

    result = await apiCalls.reportUsage(apiId, apiCallCountAcctSeven.toNumber(), accounts[7], {from: accounts[9]})

    assert.equal(result.logs[0].event, 'LogAPICallsMade')

    totalOwedAfter = await apiCalls.totalOwedForApi(apiId)
    amountOwedForAcctAfter = await apiCalls.amountOwedForApiForBuyer(apiId, accounts[7])

    assert.equal(totalOwedBefore.add(apiCallCountAcctSeven.times(pricePerCall)).toString(), totalOwedAfter.toString())
    assert.equal(amountOwedForAcct.add(apiCallCountAcctSeven.times(pricePerCall)).toString(), amountOwedForAcctAfter.toString())

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

    // get all the info for buyer 7
    buyerLastPaidAtBefore = await apiCalls.buyerLastPaidAt(apiId, accounts[7])
    assert.equal(buyerLastPaidAtBefore.toString(), '0')
    // test setting and getting approved amounts and lastPaidAt
    await apiCalls.approveAmount(apiId, accounts[7], approvedAmountForAcctSixAndSeven.toString(), {from: accounts[7]})

    let approvedAmountForAcctSevenAfter = await apiCalls.approvedAmount(apiId, accounts[7])
    assert.equal(approvedAmountForAcctSevenAfter.toString(), approvedAmountForAcctSixAndSeven.toString())

    buyerLastPaidAtAfter = await apiCalls.buyerLastPaidAt(apiId, accounts[7])
    assert.equal(buyerLastPaidAtAfter.toString(), '0')
    assert.equal(buyerLastPaidAtAfter.toString(), buyerLastPaidAtBefore.toString())

    let creditsBalanceBeforeAcctSeven = await apiCalls.creditsBalanceOf(accounts[7])


    // get buyer info before we make the payment happen
    buyerInfo = await apiCalls.buyerInfoOf(accounts[7])
    let overdraftCountAcctSeven = buyerInfo[1]
    let lifetimeCreditsUsedAcctSeven = buyerInfo[3]
    let lifetimeExceededApprovalAmountCountAcctSeven = buyerInfo[4] 

    result = await apiCalls.paySellerForBuyer(apiId, accounts[7], {from: accounts[1], gasPrice: gasPrice.toNumber()})

    // console.log('***********************')
    // console.log(result)
    let blockNum = result.receipt.blockNumber
    let blockNumInfo = await web3.eth.getBlock(blockNum)
    // console.log('***********************')
    // console.log('***********************')
    // console.log(blockNumInfo)
    // set now to the timestamp of the block so it's the same as the actual block "now" time
    now = new BigNumber(blockNumInfo.timestamp)

    gasUsed = result.receipt.gasUsed
    weiConsumedByGas = gasPrice.times(BigNumber(gasUsed))

    let creditsBalanceAfterAcctSeven = await apiCalls.creditsBalanceOf(accounts[7])

    let defaultBuyerLastPaidAt = await apiCalls.defaultBuyerLastPaidAt.call()
    let defaultBuyerLastPaidAtTime = now.minus(defaultBuyerLastPaidAt)
    let maxSpentAcctSeven = now.minus(defaultBuyerLastPaidAtTime).times(approvedAmountForAcctSixAndSeven)

    assert.equal(creditsBalanceBeforeAcctSeven.minus(maxSpentAcctSeven).toString(), creditsBalanceAfterAcctSeven.toString())

    // console.log('results logs: ')
    // console.log(result.logs)
    assert.equal(result.logs.length, 2) // 2 events happened - send credits once and api paid
    assert.equal(result.logs[0].event, 'LogSpendCredits')
    assert.equal(result.logs[1].event, 'LogAPICallsPaid')

    gasUsed = result.receipt.gasUsed
    weiConsumedByGas = gasPrice.times(BigNumber(gasUsed))

    let sellerBalanceAfter = await web3.eth.getBalance(accounts[1])
    let tokenBalanceAfter = await token.balanceOf.call(accounts[1])
    let totalPayable = maxSpentAcctSeven
    let saleFee = await apiCalls.saleFee.call()
    let networkFee = BigNumber(totalPayable.times(saleFee.div(100)))
    let calculatedProfit = Math.round(totalPayable.minus(networkFee))
    // the seller got paid maxSpent
    assert.equal(sellerBalanceBefore.minus(weiConsumedByGas).plus(calculatedProfit).toString(), sellerBalanceAfter.toString())

    if (process.env.DECONET_ACTIVATE_TOKEN_REWARD == "true") {
      // tokens for 1 buyer should be transferred
      assert.equal(tokenBalanceBefore.plus(tokenReward).toString(), tokenBalanceAfter.toString())
    } else {
      assert.equal(tokenBalanceBefore.toString(), tokenBalanceAfter.toString())
    }

    // check that buyerExceededApprovedAmount is true for acct7
    execeededApproval = await apiCalls.buyerExceededApprovedAmount(apiId, accounts[7])
    assert.equal(execeededApproval, true)

    // check that accounts[6] is not overdrafted but has an exceeded amount flag
    buyerInfo = await apiCalls.buyerInfoOf(accounts[7])
    assert.equal(buyerInfo.length, 5)
    assert.equal(buyerInfo[0], false) // overdrafted
    assert.equal(buyerInfo[1], overdraftCountAcctSeven.toString()) // lifetime overdraft count
    assert.equal(buyerInfo[2].toString(), creditAmount.minus(maxSpentAcctSeven).toString()) // credits
    assert.equal(buyerInfo[3].toString(), lifetimeCreditsUsedAcctSeven.plus(maxSpentAcctSeven).toString()) // lifetime credits used
    assert.equal(buyerInfo[4].toString(), lifetimeExceededApprovalAmountCountAcctSeven.plus(new BigNumber('1')).toString()) // lifetimeExceededApprovalAmountCount
  })

  it('should let sellers get paid for a single buyer at a time and work for many cycles', async function () {
    let apiCalls = await APICalls.deployed()
    let token = await Token.deployed()

    const debugThisTest = true
    const creditAmount = new BigNumber('1000000')
    const gasPrice = new BigNumber('1')
    let tokenReward = new BigNumber('100').times(new BigNumber('10').pow(18))
    let globalNow = new BigNumber(Math.round(new Date().getTime() / 1000))
    let accountsToTest = 5;
    let cyclesToTest = 5;

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

    // make sure token reward is set to 100
    await apiCalls.setTokenReward(tokenReward.toString())

    let getRandomInt = function (min, max) {
      return new BigNumber(Math.floor(Math.random() * (max - min + 1)) + min)
    }

    let accountEntries = {}

    // run through accountsToTest accounts, from accounts[30] to accounts[30 + accountsToTest]  
    // set them up with balances, credits, etc
    for (let i = 0; i < accountsToTest; i++) {
      let accountNumber = i + 30
      let account = accounts[accountNumber]
      let accountEntry = {
        accountNumber: accountNumber,
        account: account,
        credits: getRandomInt(0, 30000),
        approved: getRandomInt(0, 10000),
        apiCalls: getRandomInt(1, 1000), // pricePerCall is 20 so max owed is apiCalls * pricePerCall = 20,000
        firstUseTime: globalNow.minus(getRandomInt(200, 10000))
      }
      accountEntry.owed = accountEntry.apiCalls.times(pricePerCall)

      if (debugThisTest) {
        console.log('---------------------')
        console.log('generated account ' + accountNumber + ' with address ' + account)
        console.log('credits: ' + accountEntry.credits.toString())
        console.log('approved: ' + accountEntry.approved.toString())
        console.log('apiCalls: ' + accountEntry.apiCalls.toString())
        console.log('firstUseTime: ' + accountEntry.firstUseTime.toString())
        console.log('owed: ' + accountEntry.owed.toString())
      }

      // add credits for acct
      let creditsBalance = await apiCalls.creditsBalanceOf(account)
      if (creditsBalance.toString() !== '0') {
        // remove credits if they exist
        await apiCalls.withdrawCredits(creditsBalance.toString(), {from: account})
      }

      let balanceBefore = await web3.eth.getBalance(account)

      // add accountEntry.credits
      let result = await apiCalls.addCredits(account, {from: account, value: accountEntry.credits.toNumber(), gasPrice: gasPrice.toNumber()})
      assert.equal(result.logs[0].event, 'LogDepositCredits')
      gasUsed = result.receipt.gasUsed
      weiConsumedByGas = gasPrice.times(BigNumber(gasUsed))

      let balanceAfter = await web3.eth.getBalance(account)
      assert.equal(balanceBefore.minus(accountEntry.credits).minus(weiConsumedByGas).toString(), balanceAfter.toString())

      // set approval limit
      await apiCalls.approveAmountAndSetFirstUseTime(apiId, account, accountEntry.approved.toString(), accountEntry.firstUseTime.toString(), {from: account})

      accountEntries[account] = accountEntry
    }

    if (debugThisTest) {
      console.log('---------------------')
      console.log('---------------------')
      console.log('---------------------')
      console.log('---------------------')
      console.log('---------------------')
    }

    // do 5 cycles of charging user and paying seller
    for (var j = 0; j < cyclesToTest; j++){
      console.log('on full cycle ' + j)
      for (let i = 0; i < accountsToTest; i++){
        let accountNumber = i + 30
        let account = accounts[accountNumber]
        let accountEntry = accountEntries[account]
        if (debugThisTest) {
          console.log('---------------------')
          console.log('testing account ' + accountNumber + ' with address ' + account)
          console.log('credits: ' + accountEntry.credits.toString())
          console.log('approved: ' + accountEntry.approved.toString())
          console.log('apiCalls: ' + accountEntry.apiCalls.toString())
          console.log('firstUseTime: ' + accountEntry.firstUseTime.toString())
          console.log('owed: ' + accountEntry.owed.toString())
        }

        let amountOwedBefore = await apiCalls.amountOwedForApiForBuyer(apiId, account)
        // report accountEntry.apiCalls of usage
        result = await apiCalls.reportUsage(apiId, accountEntry.apiCalls.toNumber(), account, {from: accounts[9]})
        assert.equal(result.logs[0].event, 'LogAPICallsMade')
        let amountOwedAfter = await apiCalls.amountOwedForApiForBuyer(apiId, account)
        assert.equal(amountOwedAfter.minus(amountOwedBefore).toString(), accountEntry.apiCalls.times(pricePerCall).toString())
        assert.notEqual(amountOwedBefore.toString(), amountOwedAfter.toString())

        let buyerInfo = await apiCalls.buyerInfoOf(account)
        let lifetimeOverdraftCountBefore = buyerInfo[1]
        let lifetimeCreditsUsedBefore = buyerInfo[3]
        let lifetimeExceededApprovalAmountCountBefore = buyerInfo[4]

        // pay the seller
        let buyerCreditsBefore = await apiCalls.creditsBalanceOf(account)
        let sellerBalanceBefore = await web3.eth.getBalance(accounts[1])
        let sellerTokenBalanceBefore = await token.balanceOf(accounts[1])
        result = await apiCalls.paySellerForBuyer(apiId, account)
        let sellerBalanceAfter = await web3.eth.getBalance(accounts[1])
        let sellerTokenBalanceAfter = await token.balanceOf(accounts[1])
        let buyerCreditsAfter = await apiCalls.creditsBalanceOf(account)
        let buyerSpent = buyerCreditsBefore.minus(buyerCreditsAfter)

        let blockNum = result.receipt.blockNumber
        let blockNumInfo = await web3.eth.getBlock(blockNum)
        let now = new BigNumber(blockNumInfo.timestamp)

        let maxApprovedAmount = now.minus(accountEntry.firstUseTime).times(accountEntry.approved)

        let buyerExceededApprovedAmount = await apiCalls.buyerExceededApprovedAmount(apiId, account)

        buyerInfo = await apiCalls.buyerInfoOf(account)
        let overdraftedAfter = buyerInfo[0]
        let lifetimeOverdraftCountAfter = buyerInfo[1]
        let lifetimeCreditsUsedAfter = buyerInfo[3]
        let lifetimeExceededApprovalAmountCountAfter = buyerInfo[4]

        // confirm that lifetimeCreditsUsed is working correctly
        assert.equal(buyerSpent.toString(), lifetimeCreditsUsedAfter.minus(lifetimeCreditsUsedBefore).toString())

        // confirm that the buyer spent less than their approved limit in maxApprovedAmount
        assert(maxApprovedAmount.minus(buyerSpent).isGreaterThanOrEqualTo(new BigNumber('0')), true)

        // determine whether or not account is in nonzeroAddresses
        let nonzeroAddresses = []
        let elementCount = await apiCalls.nonzeroAddressesLengthForApi(apiId)
        if (elementCount != 0){
            for(var k = 0; k < elementCount; k++){
                let nonzeroAddr = await apiCalls.nonzeroAddressesElementForApi(apiId, k)
                nonzeroAddresses.push(nonzeroAddr)
            }
        }
        assert.equal(nonzeroAddresses.length, elementCount)

        // test for all 4 final cases
        if (accountEntry.credits.isGreaterThanOrEqualTo(accountEntry.owed)) {
          assert.equal(overdraftedAfter, false) // account is not overdrafted
          assert.equal(lifetimeOverdraftCountAfter.toString(), lifetimeOverdraftCountBefore.toString()) // lifetime overdraft count.  should not have increased
          if (maxApprovedAmount.isGreaterThanOrEqualTo(accountEntry.owed)) {
            assert.equal(buyerExceededApprovedAmount, false)
            assert.equal(buyerInfo[4].toString(), lifetimeExceededApprovalAmountCountBefore.toString()) // lifetimeExceededAmounts should be unchanged
            // verify that buyer paid what they owe in entirety
            assert.equal(accountEntry.owed.toString(), buyerCreditsBefore.minus(buyerCreditsAfter).toString())
            if (process.env.DECONET_ACTIVATE_TOKEN_REWARD == "true") {
              // verify that seller was rewarded tokens
              assert.equal(sellerTokenBalanceAfter.minus(sellerTokenBalanceBefore).toString(), tokenReward.toString())
            } else {
              assert.equal(sellerTokenBalanceAfter.toString(), sellerTokenBalanceBefore.toString())
            }
            assert.equal(result.logs[0].event, 'LogSpendCredits')
            assert.equal(result.logs[1].event, 'LogAPICallsPaid')

            // verify that the buyer is no longer in nonzeroAddresses array
            assert.equal(nonzeroAddresses.indexOf(account), -1)

          } else {
            assert.equal(buyerExceededApprovedAmount, true)
            assert.equal(buyerInfo[4].toString(), lifetimeExceededApprovalAmountCountBefore.plus(new BigNumber('1')).toString()) // lifetimeExceededAmounts should have increased by 1
            // verify that buyer paid max amount spendable
            assert.equal(maxApprovedAmount.toString(), buyerCreditsBefore.minus(buyerCreditsAfter).toString())
            // verifu seller was rewarded if some eth was paid
            if (!buyerSpent.eq(new BigNumber('0'))) {
              if (process.env.DECONET_ACTIVATE_TOKEN_REWARD == "true") {
                assert.equal(sellerTokenBalanceAfter.minus(sellerTokenBalanceBefore).toString(), tokenReward.toString())
              } else {
                assert.equal(sellerTokenBalanceAfter.toString(), sellerTokenBalanceBefore.toString())
              }
              assert.equal(result.logs[0].event, 'LogSpendCredits')
              assert.equal(result.logs[1].event, 'LogAPICallsPaid')
            }
            // verify that the buyer is still in nonzeroAddresses array
            assert.notEqual(nonzeroAddresses.indexOf(account), -1)
          }
        } else {
          // overdraft
          assert.equal(overdraftedAfter, true) // overdrafted should be true
          assert.equal(lifetimeOverdraftCountAfter.toString(), lifetimeOverdraftCountBefore.plus(new BigNumber('1')).toString()) // lifetime overdraft count.  This should have 1 added to it

          // verify that the buyer is still in nonzeroAddresses array
          assert.notEqual(nonzeroAddresses.indexOf(account), -1)

          if (accountEntry.credits.isGreaterThanOrEqualTo(maxApprovedAmount)) {
            assert.equal(maxApprovedAmount.toString(), buyerCreditsBefore.minus(buyerCreditsAfter).toString())
            // verifu seller was rewarded if some eth was paid
            if (!buyerSpent.eq(new BigNumber('0'))) {
              if (process.env.DECONET_ACTIVATE_TOKEN_REWARD == "true") {
                assert.equal(sellerTokenBalanceAfter.minus(sellerTokenBalanceBefore).toString(), tokenReward.toString())
              } else {
                assert.equal(sellerTokenBalanceAfter.toString(), sellerTokenBalanceBefore.toString())
              }
              assert.equal(result.logs[0].event, 'LogSpendCredits')
              assert.equal(result.logs[1].event, 'LogAPICallsPaid')
            }
          } else {
            assert.equal(accountEntry.credits.toString(), buyerCreditsBefore.minus(buyerCreditsAfter).toString())
            // verifu seller was rewarded if some eth was paid
            if (!buyerSpent.eq(new BigNumber('0'))) {
              if (process.env.DECONET_ACTIVATE_TOKEN_REWARD == "true") {
                assert.equal(sellerTokenBalanceAfter.minus(sellerTokenBalanceBefore).toString(), tokenReward.toString())
              } else {
                assert.equal(sellerTokenBalanceAfter.toString(), sellerTokenBalanceBefore.toString())
              }
              assert.equal(result.logs[0].event, 'LogSpendCredits')
              assert.equal(result.logs[1].event, 'LogAPICallsPaid')
            }
          }
        }

        // account has been processed and tested.  set new apiCallCount and update credits
        accountEntry.credits = new BigNumber(buyerCreditsAfter.toString())
        console.log('set credits to ' + accountEntry.credits.toString())
        accountEntry.apiCalls = getRandomInt(1, 1000) // pricePerCall is 20 so max owed is apiCalls * pricePerCall = 20,000
        // make sure to add existing owed as well as new owed
        let existingOwed = await apiCalls.amountOwedForApiForBuyer(apiId, account)
        accountEntry.owed = accountEntry.apiCalls.times(pricePerCall).plus(existingOwed)
        accountEntry.firstUseTime = now
      }
    }
  })
  

  it('should only let the contract owner or withdraw address actually withdraw', async function () {
    let apiCalls = await APICalls.deployed()
    let exceptionOccured = false
    try {
      await apiCalls.withdrawEther(1, {from: accounts[4]})
    } catch (e) {
      exceptionOccured = true
    }
    assert.equal(exceptionOccured, true)
  })

  it('should only let the contract owner withdraw less than the contract holds', async function () {
    let apiCalls = await APICalls.deployed()
    let contractBalance = await web3.eth.getBalance(apiCalls.address)
    let exceptionOccured = false
    try {
      await apiCalls.withdrawEther(contractBalance.plus(new BigNumber('100')).toString(), {from: accounts[1]})
    } catch (e) {
      exceptionOccured = true
    }
    assert.equal(exceptionOccured, true)
  })

  it('should only let the contract owner withdraw less than the safe withdraw amount', async function () {
    let apiCalls = await APICalls.deployed()
    let safeWithdrawAmount = await apiCalls.safeWithdrawAmount.call()
    let exceptionOccured = false
    try {
      await apiCalls.withdrawEther(safeWithdrawAmount.plus(new BigNumber('100')).toString(), {from: accounts[1]})
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

  it('can transfer out accidently sent erc20 tokens', async function () {
    let apiCalls = await APICalls.deployed()
    let token = await Token.deployed()

    let paused = await token.paused.call()
    if (paused) {
      // unpause token to allow transfers
      await token.unpause({from: accounts[0]})
    }

    let tokenAmount = new BigNumber('10000')

    // transfer tokens in
    await token.transfer(apiCalls.address, tokenAmount.toString(), {from: accounts[0]})

    let contractBalanceBefore = await token.balanceOf(apiCalls.address)
    let ownerBalanceBefore = await token.balanceOf(accounts[0])

    await apiCalls.transferAnyERC20Token(token.address, tokenAmount.toString(), {from: accounts[0]})

    let contractBalanceAfter = await token.balanceOf(apiCalls.address)
    let ownerBalanceAfter = await token.balanceOf(accounts[0])

    assert.equal(contractBalanceBefore.minus(tokenAmount).toString(), contractBalanceAfter.toString())
    assert.equal(ownerBalanceBefore.plus(tokenAmount).toString(), ownerBalanceAfter.toString())
  })

  it('should be possible to set the sale fee', async function () {
    let apiCalls = await APICalls.deployed()
    let newSaleFee = 5

    let saleFeeBefore = await apiCalls.saleFee.call()

    await apiCalls.setSaleFee(newSaleFee)

    let saleFeeAfter = await apiCalls.saleFee.call()

    assert.equal(saleFeeAfter.toString(), newSaleFee.toString())

    newSaleFee = saleFeeBefore

    // set it back
    await apiCalls.setSaleFee(saleFeeBefore)

    saleFeeAfter = await apiCalls.saleFee.call()

    assert.equal(saleFeeBefore.toString(), saleFeeAfter.toString())
  })
  it('should not let user set 0 address for withdraw address', async function () {
    let apiCalls = await APICalls.deployed()
    let exceptionOccured = false
    try {
      await apiCalls.setWithdrawAddress('0x0000000000000000000000000000000000000000')
    } catch (e) {
      exceptionOccured = true
    }
    assert.equal(exceptionOccured, true)
  })
  it('should not let user set 0 address for usage reporting address', async function () {
    let apiCalls = await APICalls.deployed()
    let exceptionOccured = false
    try {
      await apiCalls.setUsageReportingAddress('0x0000000000000000000000000000000000000000')
    } catch (e) {
      exceptionOccured = true
    }
    assert.equal(exceptionOccured, true)
  })
  it('should not let user set 0 address for relay contract address', async function () {
    let apiCalls = await APICalls.deployed()
    let exceptionOccured = false
    try {
      await apiCalls.setRelayContractAddress('0x0000000000000000000000000000000000000000')
    } catch (e) {
      exceptionOccured = true
    }
    assert.equal(exceptionOccured, true)
  })
  it('should not let user set 0 address for token address', async function () {
    let apiCalls = await APICalls.deployed()
    let exceptionOccured = false
    try {
      await apiCalls.setTokenContractAddress('0x0000000000000000000000000000000000000000')
    } catch (e) {
      exceptionOccured = true
    }
    assert.equal(exceptionOccured, true)
  })
  it('should not let user report usage if the seller address is wrong', async function () {
    let apiCalls = await APICalls.deployed()
    let exceptionOccured = false
    try {
      await apiCalls.reportUsage('99999', 1000, accounts[2], {from: accounts[9]})
    } catch (e) {
      exceptionOccured = true
    }
    assert.equal(exceptionOccured, true)
  })
  it('should not let user pay seller for buyer if listing does not exist', async function () {
    let apiCalls = await APICalls.deployed()
    let exceptionOccured = false
    try {
      await apiCalls.paySellerForBuyer('9999999', accounts[3])
    } catch (e) {
      exceptionOccured = true
    }
    assert.equal(exceptionOccured, true)
  })
  it('should not let user pay seller if listing does not exist', async function () {
    let apiCalls = await APICalls.deployed()
    let exceptionOccured = false
    try {
      await apiCalls.paySeller('9999999')
    } catch (e) {
      exceptionOccured = true
    }
    assert.equal(exceptionOccured, true)
  })
  it('should not let user approve amount for an invalid buyer or api', async function () {
    let apiCalls = await APICalls.deployed()
    let exceptionOccured = false
    try {
      await apiCalls.approveAmount('0', '0x0000000000000000000000000000000000000000', 0, {from: accounts[9]})
    } catch (e) {
      exceptionOccured = true
    }
    assert.equal(exceptionOccured, true)
  })
  it('should only let the user approve an amount if they are the user or reporting address', async function () {
    let apiCalls = await APICalls.deployed()
    let exceptionOccured = false
    try {
      await apiCalls.approveAmount(1, accounts[1], 0, {from: accounts[2]})
    } catch (e) {
      exceptionOccured = true
    }
    assert.equal(exceptionOccured, true)
  })
  it('should not let user approve amount w/first use time for an invalid buyer or api', async function () {
    let apiCalls = await APICalls.deployed()
    let exceptionOccured = false
    try {
      await apiCalls.approveAmountAndSetFirstUseTime('0', '0x0000000000000000000000000000000000000000', 0, 12345,  {from: accounts[9]})
    } catch (e) {
      exceptionOccured = true
    }
    assert.equal(exceptionOccured, true)
  })
  it('should only let the user approve an amount w/first use time if they are the user or reporting address', async function () {
    let apiCalls = await APICalls.deployed()
    let exceptionOccured = false
    try {
      await apiCalls.approveAmountAndSetFirstUseTime(1, accounts[1], 0, 12345, {from: accounts[2]})
    } catch (e) {
      exceptionOccured = true
    }
    assert.equal(exceptionOccured, true)
  })
})
