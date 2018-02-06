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
    var tokenBalanceBefore = null
    var tokenBalanceAfter = null
    var ethBalanceBefore = null
    var ethBalanceAfter = null
    var contractEthBalanceBefore = null
    var contractEthBalanceAfter = null
    var ethValue = 50000
    return Token.deployed().then(function (instance) {
      token = instance
      return token.balanceOf.call(accounts[2])
    }).then(function (tokenBalance) {
      tokenBalanceBefore = tokenBalance.toNumber()
      return web3.eth.getBalance(accounts[2])
    }).then(function (acctBalance) {
      ethBalanceBefore = acctBalance
      return web3.eth.getBalance(token.address)
    }).then(function (contractBalance) {
      contractEthBalanceBefore = contractBalance
      return token.makeSale('sampleproject', 'testuser', accounts[2], {from: accounts[1], value: ethValue})
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
      assert.equal(sale[4], ethValue)
      assert.equal(sale[5] > 0, true)

      return token.getSaleCountForSeller.call(accounts[2])
    }).then(function (saleCount) {
      // console.log('saleCount: ' + saleCount)
      assert.equal(saleCount.toNumber(), 1)
      return token.getSaleForSellerAtIndex.call(accounts[2], 0)
    }).then(function (sale) {
      // console.log(sale)
      assert.equal(sale[0], 'sampleproject')
      assert.equal(sale[1], 'testuser')
      assert.equal(sale[2], accounts[2])
      assert.equal(sale[3], accounts[1])
      assert.equal(sale[4], ethValue)
      assert.equal(sale[5] > 0, true)

      return token.balanceOf.call(accounts[2])
    }).then(function (tokenBalance) {
      tokenBalanceAfter = tokenBalance.toNumber()
      return web3.eth.getBalance(accounts[2])
    }).then(function (acctBalance) {
      ethBalanceAfter = acctBalance
      return token.tokenReward.call()
    }).then(function (tokenReward) {
      assert.equal(tokenBalanceAfter, tokenBalanceBefore + tokenReward.toNumber(), 'accounts[2] was not transferred the right amount of Deconet Tokens after the sale')
      return web3.eth.getBalance(token.address)
    }).then(function (contractBalance) {
      contractEthBalanceAfter = contractBalance
      return token.saleFee.call()
    }).then(function (saleFee) {
      var sellerPayout = ethValue * 100 / saleFee.toNumber() / 100
      var ethDiff = ethBalanceAfter.minus(ethBalanceBefore).toNumber()
      assert.equal(ethDiff, sellerPayout, 'The seller account was not transferred the right amount of eth after the sale')
      var contractEthDiff = contractEthBalanceAfter.minus(contractEthBalanceBefore).toNumber()
      assert.equal(contractEthDiff, ethValue - sellerPayout, 'The contract account does not have the right amount of eth in it after the sale')
    })
  })
})
