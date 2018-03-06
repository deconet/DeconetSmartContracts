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

contract('LicenseSales', function (accounts) {
  it('should have a settable token reward', async function () {
    let ls = await LicenseSales.deployed()
    let tokenRewardBefore = await ls.tokenReward.call()

    await ls.setTokenReward(200000)

    let tokenRewardAfter = await ls.tokenReward.call()
    assert.equal(tokenRewardAfter.toString(), '200000')
    assert.notEqual(tokenRewardBefore.eq(tokenRewardAfter), true)
  })

  it('should have the right relay contract address', async function () {
    let ls = await LicenseSales.deployed()
    let relay = await Relay.deployed()

    let relayAddress = await ls.relayContractAddress.call()
    assert.equal(relayAddress, relay.address)
  })

  it('should have a settable relay contract address', async function () {
    let ls = await LicenseSales.deployed()
    let relay = await Relay.deployed()

    let relayAddress = await ls.relayContractAddress.call()
    assert.equal(relayAddress, relay.address)

    let newAddress = '0xdf230f62739bedcb1bed428906232a44bc37de3a'
    await ls.setRelayContractAddress(newAddress)

    relayAddress = await ls.relayContractAddress.call()
    assert.equal(newAddress, relayAddress)

    // set it back
    await ls.setRelayContractAddress(relay.address)
    relayAddress = await ls.relayContractAddress.call()
    assert.equal(relayAddress, relay.address)
  })

  it('should be able to list and buy a module', async function () {
    let sellerUsername = uuid.v4().substr(0, 32)
    let moduleName = uuid.v4().substr(0, 32)
    let modulePrice = 50000
    let licenseId = '0x00000001'
    let registry = await Registry.deployed()
    let token = await Token.deployed()
    let ls = await LicenseSales.deployed()

    // unpause token to allow transfers
    await token.unpause({from: accounts[0]})

    let usernameAndProjectName = `${sellerUsername}/${moduleName}`

    await registry.listModule(modulePrice, sellerUsername, moduleName, usernameAndProjectName, licenseId, { from: accounts[2] })

    // check that the module is actually in the registry
    let moduleId = await registry.getModuleId(usernameAndProjectName)
    assert.notEqual(moduleId.toNumber(), 0)

    let tokenBalanceBefore = (await token.balanceOf.call(accounts[2])).toNumber()
    let ethBalanceBefore = await web3.eth.getBalance(accounts[2])
    let contractEthBalanceBefore = await web3.eth.getBalance(ls.address)

    await ls.makeSale(moduleId, {from: accounts[1], value: modulePrice})

    let tokenBalanceAfter = (await token.balanceOf.call(accounts[2])).toNumber()
    let ethBalanceAfter = await web3.eth.getBalance(accounts[2])
    let tokenReward = await ls.tokenReward.call()
    assert.equal(tokenBalanceAfter, tokenBalanceBefore + tokenReward.toNumber(), 'accounts[2] was not transferred the right amount of Deconet Tokens after the sale')

    let saleFee = await ls.saleFee.call()
    let contractEthBalanceAfter = await web3.eth.getBalance(ls.address)
    let networkFee = modulePrice * 100 / saleFee.toNumber() / 100
    let sellerPayout = modulePrice - networkFee
    let ethDiff = ethBalanceAfter.minus(ethBalanceBefore).toNumber()
    assert.equal(ethDiff, sellerPayout, 'The seller account was not transferred the right amount of eth after the sale')

    let contractEthDiff = contractEthBalanceAfter.minus(contractEthBalanceBefore).toNumber()
    assert.equal(contractEthDiff, modulePrice - sellerPayout, 'The contract account does not have the right amount of eth in it after the sale')

    let saleEvent = ls.LicenseSale({}, {fromBlock: 0, toBlock: 'latest'})
    let sales = await Promisify(cb => saleEvent.get(cb))

    assert.equal(sales.length, 1)
    
    let sale = sales[0].args

    assert.equal(web3.toAscii(sale.moduleName), moduleName)
    assert.equal(web3.toAscii(sale.sellerUsername), sellerUsername)
    assert.equal(sale.sellerAddress, accounts[2])
    assert.equal(sale.buyerAddress, accounts[1])
    assert.equal(sale.price.toNumber(), modulePrice)
    assert.equal(sale.soldAt.toNumber() > 0, true)
    assert.equal(sale.rewardedTokens.toString(), tokenReward.toString())
    assert.equal(sale.networkFee.toString(), networkFee.toString())
    assert.equal(sale.licenseId, '0x00000001', 'wrong license')

    // test withdraw
    let ownerBalanceBefore = await web3.eth.getBalance(accounts[0])
    let gasPrice = 1000000000
    let withdrawTx = await ls.withdrawEther({from: accounts[0], gasPrice: gasPrice})
    let weiConsumedByGas = BigNumber(gasPrice).times(BigNumber(withdrawTx.receipt.gasUsed))
     // subtract gas costs from original balance before withdraw
    ownerBalanceBefore = ownerBalanceBefore.minus(weiConsumedByGas)
    let ownerBalanceAfter = await web3.eth.getBalance(accounts[0])
    ethDiff = ownerBalanceAfter.minus(ownerBalanceBefore).toString()
    assert.equal(ethDiff, networkFee)
  })

  it('should only let the contract owner withdraw', async function () {
    let ls = await LicenseSales.deployed()
    let exceptionOccured = false
    try {
      await ls.withdrawEther({from: accounts[4]})
    } catch (e) {
      exceptionOccured = true
    }
    assert.equal(exceptionOccured, true)
  })

  it('should have a version', async function () {
    let ls = await LicenseSales.deployed()
    let version = await ls.version.call({ from: accounts[4] })
    assert.notEqual(version, 0)
  })
})
