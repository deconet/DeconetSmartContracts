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

  it('should have the right total supply', function () {
    var token
    return Token.deployed().then(function (instance) {
      token = instance
      return token.totalSupply.call()
    }).then(function (result) {
      assert.equal(result.eq(correctTotalSupply), true, 'total supply is wrong')
    })
  })

  it('should return the balance of token owner', function () {
    var token
    return Token.deployed().then(function (instance) {
      token = instance
      return token.balanceOf.call(accounts[0])
    }).then(function (result) {
      assert.equal(result.eq(correctOwnerSupply), true, 'balance is wrong')
    })
  })


  it('should return the correct balance of license sales contract', function () {
    var token, ls
    return LicenseSales.deployed().then(function (instance) {
      ls = instance
      return Token.deployed()
    }).then(function (instance) {
      token = instance
      return token.balanceOf.call(ls.address)
    }).then(function (result) {
      assert.equal(result.eq(licenseSalesSupply), true, 'balance is wrong')
    })
  })

  it('should transfer right token', function () {
    var token
    return Token.deployed().then(function (instance) {
      token = instance
      return token.transfer(accounts[1], 500000)
    }).then(function () {
      return token.balanceOf.call(accounts[0])
    }).then(function (result) {
      assert.equal(result.eq(correctOwnerSupply.minus(500000)), true, 'accounts[0] balance is wrong')
      return token.balanceOf.call(accounts[1])
    }).then(function (result) {
      assert.equal(result.toNumber(), 500000, 'accounts[1] balance is wrong')
    })
  })

  it("should give accounts[1] authority to spend account[0]'s token", function () {
    var token
    return Token.deployed().then(function (instance) {
      token = instance
      return token.approve(accounts[1], 200000)
    }).then(function () {
      return token.allowance.call(accounts[0], accounts[1])
    }).then(function (result) {
      assert.equal(result.toNumber(), 200000, 'allowance is wrong')
      return token.transferFrom(accounts[0], accounts[2], 200000, {from: accounts[1]})
    }).then(function () {
      return token.balanceOf.call(accounts[0])
    }).then(function (result) {
      assert.equal(result.eq(correctOwnerSupply.minus(700000)), true, 'accounts[0] balance is wrong')
      return token.balanceOf.call(accounts[1])
    }).then(function (result) {
      assert.equal(result.toNumber(), 500000, 'accounts[1] balance is wrong')
      return token.balanceOf.call(accounts[2])
    }).then(function (result) {
      assert.equal(result.toNumber(), 200000, 'accounts[2] balance is wrong')
    })
  })

  it('should show the transfer event', function () {
    var token
    return Token.deployed().then(function (instance) {
      token = instance
      return token.transfer(accounts[1], 100000)
    }).then(function (result) {
      assert.equal(result.logs[0].event, 'Transfer')
    })
  })

  it('should have a version', async function () {
    let token = await Token.deployed()
    let version = await token.version.call({ from: accounts[4] })
    assert.notEqual(version, 0)
  })
})
