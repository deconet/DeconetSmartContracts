var BigNumber = require('bignumber.js')
var uuid = require('uuid')

var Token = artifacts.require('./DeconetToken.sol')
var Relay = artifacts.require('./Relay.sol')
var Registry = artifacts.require('./Registry.sol')
var LicenseSales = artifacts.require('./LicenseSales.sol')
var APICalls = artifacts.require('./APICalls.sol')

const Promisify = (inner) =>
  new Promise((resolve, reject) =>
    inner((err, res) => {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    })
  );

contract('DeconetToken', function (accounts) {
  var correctTotalSupply = BigNumber('1e+27')
  var licenseSalesSupplyAllowance = correctTotalSupply.div(20) // 5 percent
  var apiCallsSupplyAllowance = correctTotalSupply.div(20) // 5 percent

  it('should have the right total supply', async function () {
    let token = await Token.deployed()
    let result = await token.totalSupply.call()
    assert.equal(result.eq(correctTotalSupply), true, 'total supply is wrong')
  })

  it('should return the balance of token owner', async function () {
    let token = await Token.deployed()
    let result = await token.balanceOf.call(accounts[0])
    assert.equal(result.eq(correctTotalSupply), true, 'balance is wrong')
  })


  it('should return the correct allowance of license sales contract', async function () {
    let token = await Token.deployed()
    let ls = await LicenseSales.deployed()
    let result = await token.allowance.call(accounts[0], ls.address)
    if (process.env.DECONET_ACTIVATE_TOKEN_REWARD == "true") {
      assert.equal(result.eq(licenseSalesSupplyAllowance), true, 'balance is wrong')
    } else {
      assert.equal(result.eq(BigNumber('0')), true, 'balance is wrong')
    }
  })

  it('should return the correct allowance of api calls contract', async function () {
    let token = await Token.deployed()
    let apiCalls = await APICalls.deployed()
    let result = await token.allowance.call(accounts[0], apiCalls.address)
    if (process.env.DECONET_ACTIVATE_TOKEN_REWARD == "true") {
      assert.equal(result.eq(apiCallsSupplyAllowance), true, 'balance is wrong')
    } else {
      assert.equal(result.eq(BigNumber('0')), true, 'balance is wrong')
    }
  })

  it('should transfer right token', async function () {
    let token = await Token.deployed()
    await token.transfer(accounts[1], 500000)
    let result = await token.balanceOf.call(accounts[0])
    assert.equal(result.eq(correctTotalSupply.minus(500000)), true, 'accounts[0] balance is wrong')
    result = await token.balanceOf.call(accounts[1])
    assert.equal(result.toNumber(), 500000, 'accounts[1] balance is wrong')
  })

  it("should give accounts[1] authority to spend account[0]'s token", async function () {
    let token = await Token.deployed()

    // try approval again
    await token.approve(accounts[1], 200000)
    let result = await token.allowance.call(accounts[0], accounts[1])
    assert.equal(result.toNumber(), 200000, 'allowance is wrong')

    // check if token is paused.  if not, pause it.
    let paused = await token.paused.call()
    if (!paused) {
      await token.pause({from: accounts[0]})
    }

    // try token transfer without unpausing token.  should get an exception
    let exceptionGenerated = false
    try {
      await token.transferFrom(accounts[0], accounts[2], 200000, {from: accounts[1]})
    } catch (e) {
      exceptionGenerated = true
    }
    assert.equal(exceptionGenerated, true)

    // unpause token contract
    await token.unpause({from: accounts[0]})

    await token.transferFrom(accounts[0], accounts[2], 200000, {from: accounts[1]})
    result = await token.balanceOf.call(accounts[0])
    assert.equal(result.eq(correctTotalSupply.minus(700000)), true, 'accounts[0] balance is wrong')
    result = await token.balanceOf.call(accounts[1])
    assert.equal(result.toNumber(), 500000, 'accounts[1] balance is wrong')
    result = await token.balanceOf.call(accounts[2])
    assert.equal(result.toNumber(), 200000, 'accounts[2] balance is wrong')
  })

  it('should show the transfer event', async function () {
    let token = await Token.deployed()

    let result = await token.transfer(accounts[1], 100000)
    assert.equal(result.logs[0].event, 'Transfer')
  })

  it('should have a version', async function () {
    let token = await Token.deployed()
    let version = await token.version.call({ from: accounts[4] })
    assert.notEqual(version, 0)
  })

  it('should have a pausable approve function', async function () {
    let token = await Token.deployed()

    // check if token is paused.  pause it if not.
    let paused = await token.paused.call()
    if (!paused) {
      await token.pause({from: accounts[0]})
    }

    // try token transfer from acct 1 to acct 2 without unpausing token.
    // we should get an exception
    let exceptionGenerated = false
    try {
      await token.approve(accounts[2], 100, {from: accounts[1]})
    } catch (e) {
      exceptionGenerated = true
    }
    assert.equal(exceptionGenerated, true)
  })

  it('should be pausable', async function () {
    let token = await Token.deployed()

    // check if token is paused.  unpause it.
    let paused = await token.paused.call()
    if (paused) {
      await token.unpause({from: accounts[0]})
    }

    // get balance before we attempt the transfer
    let tokenBalanceAcctOneBefore = await token.balanceOf.call(accounts[1])
    let tokenBalanceAcctTwoBefore = await token.balanceOf.call(accounts[2])

    await token.transfer(accounts[2], 10000, {from: accounts[1]})

    let tokenBalanceAcctOneAfter = await token.balanceOf.call(accounts[1])
    let tokenBalanceAcctTwoAfter = await token.balanceOf.call(accounts[2])

    assert.equal(tokenBalanceAcctOneBefore.minus(new BigNumber('10000')).eq(tokenBalanceAcctOneAfter), true)
    assert.equal(tokenBalanceAcctTwoBefore.add(new BigNumber('10000')).eq(tokenBalanceAcctTwoAfter), true)

    // pause the token
    await token.pause({from: accounts[0]})

    // get balance before we attempt the transfer
    tokenBalanceAcctOneBefore = await token.balanceOf.call(accounts[1])
    tokenBalanceAcctTwoBefore = await token.balanceOf.call(accounts[2])

    // try token transfer from acct 1 to acct 2 without unpausing token.
    // we should get an exception
    let exceptionGenerated = false
    try {
      await token.transfer(accounts[2], 10000, {from: accounts[1]})
    } catch (e) {
      exceptionGenerated = true
    }
    assert.equal(exceptionGenerated, true)

    tokenBalanceAcctOneAfter = await token.balanceOf.call(accounts[1])
    tokenBalanceAcctTwoAfter = await token.balanceOf.call(accounts[2])

    assert.equal(tokenBalanceAcctOneBefore.eq(tokenBalanceAcctOneAfter), true)
    assert.equal(tokenBalanceAcctTwoBefore.eq(tokenBalanceAcctTwoAfter), true)
  })

  it('should only be transferrable by the owner when the contract is paused', async function () {
    let token = await Token.deployed()

    // first, give accounts[1] some tokens from owner.  this should work.
    await token.transfer(accounts[1], 100000)

    // get balance before we attempt the transfer
    let tokenBalanceAcctOneBefore = await token.balanceOf.call(accounts[1])

    // check if token is paused.  if not, pause it.
    let paused = await token.paused.call()
    if (!paused) {
      await token.pause({from: accounts[0]})
    }

    // try token transfer from acct 1 to acct 2 without unpausing token.
    // we should get an exception
    let exceptionGenerated = false
    try {
      await token.transfer(accounts[2], 10000, {from: accounts[1]})
    } catch (e) {
      exceptionGenerated = true
    }
    assert.equal(exceptionGenerated, true)

    // make sure no tokens were actually transferred
    let tokenBalanceAcctOneAfter = await token.balanceOf.call(accounts[1])
    assert.equal(tokenBalanceAcctOneBefore.toString(), tokenBalanceAcctOneAfter.toString())

    // unpause token contract
    await token.unpause({from: accounts[0]})

    let tokenBalanceAcctTwoBefore = await token.balanceOf.call(accounts[2])

    // transfer again
    await token.transfer(accounts[2], 10000, {from: accounts[1]})

    tokenBalanceAcctOneAfter = await token.balanceOf.call(accounts[1])

    assert.equal(tokenBalanceAcctOneBefore.minus(new BigNumber('10000')).eq(tokenBalanceAcctOneAfter), true)

    let tokenBalanceAcctTwoAfter = await token.balanceOf.call(accounts[2])
    assert.equal(tokenBalanceAcctTwoBefore.add(new BigNumber('10000')).eq(tokenBalanceAcctTwoAfter), true)
  })

  it('can transfer out accidently sent erc20 tokens', async function () {
    let token = await Token.deployed()

    let paused = await token.paused.call()
    if (paused) {
      // unpause token to allow transfers
      await token.unpause({from: accounts[0]})
    }

    let tokenAmount = new BigNumber('10000')

    // transfer tokens in
    await token.transfer(token.address, tokenAmount.toString(), {from: accounts[0]})

    let contractBalanceBefore = await token.balanceOf(token.address)
    let ownerBalanceBefore = await token.balanceOf(accounts[0])

    await token.transferAnyERC20Token(token.address, tokenAmount.toString(), {from: accounts[0]})

    let contractBalanceAfter = await token.balanceOf(token.address)
    let ownerBalanceAfter = await token.balanceOf(accounts[0])

    assert.equal(contractBalanceBefore.minus(tokenAmount).toString(), contractBalanceAfter.toString())
    assert.equal(ownerBalanceBefore.plus(tokenAmount).toString(), ownerBalanceAfter.toString())
  })

  it('should have working increaseApproval and decreaseApproval functions', async function () {
    let token = await Token.deployed()

    let tokenAmount = new BigNumber('10000')
    let increaseAmount = new BigNumber('50')
    let decreaseAmount = new BigNumber('200')
    let acctOwner = accounts[2]
    let spender = accounts[3]

    await token.approve(spender, tokenAmount.toString(), {from: acctOwner})

    let approvedAmount = await token.allowance(acctOwner, spender)
    assert.equal(approvedAmount.toString(), tokenAmount.toString())

    // increase approval
    await token.increaseApproval(spender, increaseAmount.toString(), {from: acctOwner})
    let approvedAmountAfter = await token.allowance(acctOwner, spender)
    assert.equal(approvedAmountAfter.toString(), tokenAmount.plus(increaseAmount).toString())

    // reset approvedAmount to it's real value
    approvedAmount = approvedAmountAfter

    // decrease approval
    await token.decreaseApproval(spender, decreaseAmount.toString(), {from: acctOwner})
    approvedAmountAfter = await token.allowance(acctOwner, spender)
    assert.equal(approvedAmountAfter.toString(), approvedAmount.minus(decreaseAmount).toString())
    assert.equal(approvedAmountAfter.toString(), tokenAmount.plus(increaseAmount).minus(decreaseAmount).toString())
  })
})
