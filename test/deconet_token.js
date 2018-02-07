var BigNumber = require('bignumber.js')

var Token = artifacts.require('./DeconetToken.sol')

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

  it('should have a settable token reward', async function () {
    let token = await Token.deployed()
    let tokenRewardBefore = await token.tokenReward.call()

    await token.setTokenReward(200000)

    let tokenRewardAfter = await token.tokenReward.call()
    assert.equal(tokenRewardAfter, 200000)
    assert.notEqual(tokenRewardBefore, tokenRewardAfter)
  })

  it('should make a sale', async function () {
    let weiSaleValue = 50000

    let token = await Token.deployed()

    let tokenBalanceBefore = (await token.balanceOf.call(accounts[2])).toNumber()
    let ethBalanceBefore = await web3.eth.getBalance(accounts[2])
    let contractEthBalanceBefore = await web3.eth.getBalance(token.address)

    await token.makeSale('sampleproject', 'testuser', accounts[2], 'GPL3', {from: accounts[1], value: weiSaleValue})

    let tokenBalanceAfter = (await token.balanceOf.call(accounts[2])).toNumber()
    let ethBalanceAfter = await web3.eth.getBalance(accounts[2])
    let tokenReward = await token.tokenReward.call()
    assert.equal(tokenBalanceAfter, tokenBalanceBefore + tokenReward.toNumber(), 'accounts[2] was not transferred the right amount of Deconet Tokens after the sale')

    let saleFee = await token.saleFee.call()
    let contractEthBalanceAfter = await web3.eth.getBalance(token.address)
    let networkFee = weiSaleValue * 100 / saleFee.toNumber() / 100
    let sellerPayout = weiSaleValue - networkFee
    let ethDiff = ethBalanceAfter.minus(ethBalanceBefore).toNumber()
    assert.equal(ethDiff, sellerPayout, 'The seller account was not transferred the right amount of eth after the sale')

    let contractEthDiff = contractEthBalanceAfter.minus(contractEthBalanceBefore).toNumber()
    assert.equal(contractEthDiff, weiSaleValue - sellerPayout, 'The contract account does not have the right amount of eth in it after the sale')

    let saleEvent = token.LicenseSale({}, {fromBlock: 0, toBlock: 'latest'})
    let sales = await Promisify(cb => saleEvent.get(cb))

    assert.equal(sales.length, 1)
    
    let sale = sales[0].args

    assert.equal(sale.projectName, 'sampleproject')
    assert.equal(sale.sellerUsername, 'testuser')
    assert.equal(sale.sellerAddress, accounts[2])
    assert.equal(sale.buyerAddress, accounts[1])
    assert.equal(sale.price.toNumber(), weiSaleValue)
    assert.equal(sale.soldAt.toNumber() > 0, true)
    assert.equal(sale.rewardedTokens.toString(), tokenReward.toString())
    assert.equal(sale.networkFee.toString(), networkFee.toString())
    assert.equal(web3.toAscii(sale.licenseId), 'GPL3', 'wrong license')
  })
})
