var BigNumber = require('bignumber.js')
var uuid = require('uuid')

BigNumber.config({ EXPONENTIAL_AT: 1e+9 })

var Token = artifacts.require('./DeconetToken.sol')
var Relay = artifacts.require('./Relay.sol')
var Registry = artifacts.require('./Registry.sol')
var LicenseSales = artifacts.require('./LicenseSales.sol')

const Promisify = (inner) =>
  new Promise((resolve, reject) =>
    inner((err, res) => {
      if (err) {
        return reject(err);
      }
      return resolve(res);
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
    assert.equal(web3.utils.toChecksumAddress(newAddress), relayAddress)

    // set it back
    await ls.setRelayContractAddress(relay.address)
    relayAddress = await ls.relayContractAddress.call()
    assert.equal(relayAddress, relay.address)
  })

  it('should be able to list and buy a module', async function () {
    let sellerUsername = web3.utils.toHex(uuid.v4().substr(0, 32))
    let moduleName = web3.utils.toHex(uuid.v4().substr(0, 32))
    let modulePrice = new BigNumber(50000)
    let licenseId = '0x00000001'
    let registry = await Registry.deployed()
    let token = await Token.deployed()
    let ls = await LicenseSales.deployed()

    // check if token is paused.  if not, pause it.
    let paused = await token.paused.call()
    if (paused) {
      // unpause token to allow transfers
      await token.unpause({from: accounts[0]})
    }

    let usernameAndProjectName = `${sellerUsername}/${moduleName}`

    await registry.listModule(modulePrice.toString(), sellerUsername, moduleName, usernameAndProjectName, licenseId, { from: accounts[2] })

    // check that the module is actually in the registry
    let moduleId = await registry.getModuleId(usernameAndProjectName)
    assert.notEqual(moduleId.toString(), '0')

    // try sending but with less eth that the price of the module
    let exceptionGenerated = false
    try {
      await ls.makeSale(moduleId, {from: accounts[1], value: modulePrice.minus(100).toString() })
    } catch (e) {
      exceptionGenerated = true
    }
    assert.equal(exceptionGenerated, true)

    let tokenBalanceBefore = (await token.balanceOf.call(accounts[2])).toString()
    let ethBalanceBefore = await web3.eth.getBalance(accounts[2])
    let contractEthBalanceBefore = await web3.eth.getBalance(ls.address)

    await ls.makeSale(moduleId, {from: accounts[1], value: modulePrice.toString() })

    let tokenBalanceAfter = (await token.balanceOf.call(accounts[2])).toString()
    let ethBalanceAfter = await web3.eth.getBalance(accounts[2])
    let tokenReward = await ls.tokenReward.call()
    if (process.env.DECONET_ACTIVATE_TOKEN_REWARD == "true") {
      assert.equal(tokenBalanceAfter, new BigNumber(tokenBalanceBefore).plus(tokenReward).toString(), 'accounts[2] was not transferred the right amount of Deconet Tokens after the sale')
    } else {
      assert.equal(tokenBalanceAfter, tokenBalanceBefore, 'accounts[2] was not transferred the right amount of Deconet Tokens after the sale')
    }

    let saleFee = new BigNumber(await ls.saleFee.call())
    let contractEthBalanceAfter = new BigNumber(await web3.eth.getBalance(ls.address))
    let networkFee = saleFee.div(100).times(modulePrice)
    let sellerPayout = modulePrice.minus(networkFee)
    let ethDiff = new BigNumber(ethBalanceAfter).minus(ethBalanceBefore)
    assert.equal(ethDiff.toString(), sellerPayout.toString(), 'The seller account was not transferred the right amount of eth after the sale')

    let contractEthDiff = contractEthBalanceAfter.minus(contractEthBalanceBefore)
    assert.equal(contractEthDiff.toString(), modulePrice.minus(sellerPayout).toString(), 'The contract account does not have the right amount of eth in it after the sale')

    let sales = await ls.getPastEvents(
      "LicenseSale",
      {fromBlock: "latest", toBlock: "latest"}
    )

    assert.equal(sales.length, 1)

    let sale = sales[0].args

    assert.equal(sale.moduleName, moduleName)
    assert.equal(sale.sellerUsername, sellerUsername)
    assert.equal(sale.sellerAddress, accounts[2])
    assert.equal(sale.buyerAddress, accounts[1])
    assert.equal(sale.price.toString(), modulePrice.toString())
    assert.equal(new BigNumber(sale.soldAt).gt(0), true)
    assert.equal(sale.rewardedTokens.toString(), tokenReward.toString())
    assert.equal(sale.networkFee.toString(), networkFee.toString())
    assert.equal(sale.licenseId, '0x00000001', 'wrong license')

    // test withdraw
    let gasPrice = new BigNumber('1')
    let contractBalanceBefore = await web3.eth.getBalance(ls.address)
    await ls.setWithdrawAddress(accounts[1])
    let withdrawAddressBalanceBefore = new BigNumber(await web3.eth.getBalance(accounts[1]))

    result = await ls.withdrawEther({from: accounts[1], gasPrice: gasPrice.toNumber()})
    gasUsed = result.receipt.gasUsed
    weiConsumedByGas = gasPrice.times(gasUsed)

    let contractBalanceAfter = await web3.eth.getBalance(ls.address)
    assert.equal(contractBalanceAfter.toString(), '0')

    let withdrawAddressBalanceAfter = await web3.eth.getBalance(accounts[1])
    assert.equal(withdrawAddressBalanceBefore.minus(weiConsumedByGas).plus(contractBalanceBefore).toString(), withdrawAddressBalanceAfter.toString())
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

  it('can transfer out accidently sent erc20 tokens', async function () {
    let licenseSales = await LicenseSales.deployed()
    let token = await Token.deployed()

    let paused = await token.paused.call()
    if (paused) {
      // unpause token to allow transfers
      await token.unpause({from: accounts[0]})
    }

    let tokenAmount = new BigNumber('10000')

    // transfer tokens in
    await token.transfer(licenseSales.address, tokenAmount.toString(), {from: accounts[0]})

    let contractBalanceBefore = await token.balanceOf(licenseSales.address)
    let ownerBalanceBefore = await token.balanceOf(accounts[0])

    await licenseSales.transferAnyERC20Token(token.address, tokenAmount.toString(), {from: accounts[0]})

    let contractBalanceAfter = await token.balanceOf(licenseSales.address)
    let ownerBalanceAfter = await token.balanceOf(accounts[0])

    assert.equal(new BigNumber(contractBalanceBefore).minus(tokenAmount).toString(), contractBalanceAfter.toString())
    assert.equal(new BigNumber(ownerBalanceBefore).plus(tokenAmount).toString(), ownerBalanceAfter.toString())
  })

  it('should be possible to set the sale fee', async function () {
    let licenseSales = await LicenseSales.deployed()
    let newSaleFee = 5

    let saleFeeBefore = await licenseSales.saleFee.call()

    await licenseSales.setSaleFee(newSaleFee)

    let saleFeeAfter = await licenseSales.saleFee.call()

    assert.equal(saleFeeAfter.toString(), newSaleFee.toString())

    newSaleFee = saleFeeBefore

    // set it back
    await licenseSales.setSaleFee(saleFeeBefore)

    saleFeeAfter = await licenseSales.saleFee.call()

    assert.equal(saleFeeBefore.toString(), saleFeeAfter.toString())
  })
  it('should not let user set 0 address for withdraw address', async function () {
    let licenseSales = await LicenseSales.deployed()
    let exceptionOccured = false
    try {
      await licenseSales.setWithdrawAddress('0x0000000000000000000000000000000000000000')
    } catch (e) {
      exceptionOccured = true
    }
    assert.equal(exceptionOccured, true)
  })
  it('should not let user set 0 address for relay address', async function () {
    let licenseSales = await LicenseSales.deployed()
    let exceptionOccured = false
    try {
      await licenseSales.setRelayContractAddress('0x0000000000000000000000000000000000000000')
    } catch (e) {
      exceptionOccured = true
    }
    assert.equal(exceptionOccured, true)
  })
  it('should not let user set 0 address for token address', async function () {
    let licenseSales = await LicenseSales.deployed()
    let exceptionOccured = false
    try {
      await licenseSales.setTokenContractAddress('0x0000000000000000000000000000000000000000')
    } catch (e) {
      exceptionOccured = true
    }
    assert.equal(exceptionOccured, true)
  })
  it('should not let user make a sale for a module with id 0', async function () {
    let licenseSales = await LicenseSales.deployed()
    let exceptionOccured = false
    try {
      await licenseSales.makeSale('0')
    } catch (e) {
      exceptionOccured = true
    }
    assert.equal(exceptionOccured, true)
  })
    it('should not let user make a sale for a nonexistant module', async function () {
    let licenseSales = await LicenseSales.deployed()
    let exceptionOccured = false
    try {
      await licenseSales.makeSale('99999999', {from: accounts[1], value: 100})
    } catch (e) {
      exceptionOccured = true
    }
    assert.equal(exceptionOccured, true)
  })
})
