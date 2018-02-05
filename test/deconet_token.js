var BigNumber = require('bignumber.js')

var Token = artifacts.require('./DeconetToken.sol')

contract('DeconetToken', function (accounts) {
  var correctTotalSupply = BigNumber('1e+27')

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
      assert.equal(result.eq(correctTotalSupply), true, 'balance is wrong')
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
      assert.equal(result.eq(correctTotalSupply.minus(500000)), true, 'accounts[0] balance is wrong')
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
      assert.equal(result.eq(correctTotalSupply.minus(700000)), true, 'accounts[0] balance is wrong')
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
      console.log(result.logs[0].event)
    })
  })

  it('should make a sale', function () {
    var token = null
    var balanceBefore = null
    return Token.deployed().then(function (instance) {
      token = instance
      return token.balanceOf.call(accounts[2])
    }).then(function (result) {
      balanceBefore = result.toNumber()
      return token.makeSale('sampleproject', 'testuser', accounts[2], 1000, {from: accounts[1]})
    }).then(function () {
      return token.getSaleCountForBuyer.call(accounts[1])
    }).then(function (saleCount) {
      // console.log('saleCount: ' + saleCount)
      assert.equal(saleCount.toNumber(), 1)
      return token.getSaleForBuyerAtIndex.call(accounts[1], 0)
    }).then(function (sale) {
      // console.log(sale)
      assert.equal(sale[0], 'sampleproject')
      assert.equal(sale[1], 'testuser')
      assert.equal(sale[2], accounts[2])
      assert.equal(sale[3], accounts[1])
      assert.equal(sale[4], 1000)
      return token.balanceOf.call(accounts[2])
    }).then(function (result) {
      assert.equal(result.toNumber(), balanceBefore + 100, 'accounts[2] was not transferred the right amount of Deconet Tokens after the sale')
    })
  })
})
