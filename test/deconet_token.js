var BigNumber = require('bignumber.js')
var uuid = require('uuid')

var Token = artifacts.require('./DeconetToken.sol')
var Relay = artifacts.require('./Relay.sol')
var Registry = artifacts.require('./Registry.sol')
var LicenseSales = artifacts.require('./LicenseSales.sol')

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
  var licenseSalesSupply = correctTotalSupply.div(10)
  var correctOwnerSupply = correctTotalSupply.minus(licenseSalesSupply)

  it('should have the right total supply', async function () {
    let token = await Token.deployed()
    let result = await token.totalSupply.call()
    assert.equal(result.eq(correctTotalSupply), true, 'total supply is wrong')
  })

  it('should return the balance of token owner', async function () {
    let token = await Token.deployed()
    let result = await token.balanceOf.call(accounts[0])
    assert.equal(result.eq(correctOwnerSupply), true, 'balance is wrong')
  })


  it('should return the correct balance of license sales contract', async function () {
    let token = await Token.deployed()
    let ls = await LicenseSales.deployed()
    let result = await token.balanceOf.call(ls.address)
    assert.equal(result.eq(licenseSalesSupply), true, 'balance is wrong')
  })

  it('should transfer right token', async function () {
    let token = await Token.deployed()
    await token.transfer(accounts[1], 500000)
    let result = await token.balanceOf.call(accounts[0])
    assert.equal(result.eq(correctOwnerSupply.minus(500000)), true, 'accounts[0] balance is wrong')
    result = await token.balanceOf.call(accounts[1])
    assert.equal(result.toNumber(), 500000, 'accounts[1] balance is wrong')
  })

  it("should give accounts[1] authority to spend account[0]'s token", async function () {
    let token = await Token.deployed()

    // try approving token transfer without unpausing token.  should get an exception
    let exceptionGenerated = false
    try {
      await token.approve(accounts[1], 200000)
    } catch (e) {
      exceptionGenerated = true
    }
    assert.equal(exceptionGenerated, true)

    // unpause token contract
    await token.unpause({from: accounts[0]})

    // try approval again
    await token.approve(accounts[1], 200000)
    let result = await token.allowance.call(accounts[0], accounts[1])
    assert.equal(result.toNumber(), 200000, 'allowance is wrong')
    await token.transferFrom(accounts[0], accounts[2], 200000, {from: accounts[1]})
    result = await token.balanceOf.call(accounts[0])
    assert.equal(result.eq(correctOwnerSupply.minus(700000)), true, 'accounts[0] balance is wrong')
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

  it('should only be transferrable by the owner when the contract is paused', async function () {
    let token = await Token.deployed()

    // first, give accounts[1] some tokens from owner.  this should work.
    await token.transfer(accounts[1], 100000)

    // get balance before we attempt the transfer
    let tokenBalanceAcctOneBefore = token.balanceOf.call(accounts[1])

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
    let tokenBalanceAcctOneAfter = token.balanceOf.call(accounts[1])
    assert.equal(tokenBalanceAcctOneBefore, tokenBalanceAcctOneAfter)

    // unpause token contract
    await token.unpause({from: accounts[0]})

    let tokenBalanceAcctTwoBefore = token.balanceOf.call(accounts[2])

    // transfer again
    await token.transfer(accounts[2], 10000, {from: accounts[1]})

    tokenBalanceAcctOneAfter = token.balanceOf.call(accounts[1])
    assert.equal(tokenBalanceAcctOneBefore.sub(new BigNumber('10000')).eq(tokenBalanceAcctOneAfter), true)

    let tokenBalanceAcctTwoAfter = token.balanceOf.call(accounts[2])
    assert.equal(tokenBalanceAcctTwoBefore.add(new BigNumber('10000')).eq(tokenBalanceAcctTwoAfter), true)
  })
})
