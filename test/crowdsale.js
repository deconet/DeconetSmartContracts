var BigNumber = require("bignumber.js")
BigNumber.config({ EXPONENTIAL_AT: 1e+9 })
const Crowdsale = artifacts.require("./Crowdsale.sol")
const Medianizer = artifacts.require("./Medianizer.sol")
const DeconetToken = artifacts.require("./DeconetToken.sol")

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

contract("Crowdsale", async (accounts) => {
  let mainAccount = accounts[0]

  let crowdsale = undefined
  let medianizer = undefined
  let deconetToken = undefined

  before(async () => {
    deconetToken = await DeconetToken.new({from: mainAccount})
  })

  beforeEach(async () => {
    crowdsale = await Crowdsale.new({from: mainAccount})
  })

  const SendTokensToCrowdsale = async (amount) => {
    await deconetToken.transfer(amount, crowdsale.address, {from: mainAccount})
  }

  const DeployMedianizerAndSetToCrowdsale = async () => {
    medianizer = await Medianizer.new({from: mainAccount})
    await crowdsale.setPriceFeedContractAddress(medianizer.address, {from: mainAccount})
  }

  it("should correctly return medianizer eth price", async () => {
    await DeployMedianizerAndSetToCrowdsale()
    await medianizer.setShouldFailComputing(false)
    let medianizerPriceAndStatus = await medianizer.compute()
    let medianizerPrice = web3.utils.toBN(medianizerPriceAndStatus[0])
    let crowdsalePrice = await crowdsale.getEthPrice()
    expect(crowdsalePrice.toString()).to.be.equal(medianizerPrice.toString())
  })

  it("should fail to get eth price when medianizer computation is unsuccessful.", async () => {
    await DeployMedianizerAndSetToCrowdsale()
    await medianizer.setShouldFailComputing(true)
    let medianizerPriceAndStatus = await medianizer.compute()
    expect(medianizerPriceAndStatus[1]).to.be.false
    let result = await crowdsale.getEthPrice()
    expect(result[0]).to.be.equal(undefined)
    expect(result[1]).to.be.equal(undefined)
  })

  it("should let owner to close and open crowdsale.", async () => {
    let setAndCheck = async (newValue) => {
      let txn = await crowdsale.setCrowdsaleClosed(newValue, {from: mainAccount})
      let actualValue = await crowdsale.crowdsaleClosed()
      expect(actualValue).to.be.equal(newValue)
      if (!actualValue) return
      let emittedEvent = txn.logs[0]
      expect(emittedEvent.event).to.be.equal("SaleEnded")
      expect(emittedEvent.args.totalEthRaised.toString()).to.be.equal("0")
      expect(emittedEvent.args.totalUsdRaised.toString()).to.be.equal("0")
    }
    await setAndCheck(true)
    await setAndCheck(true)
    await setAndCheck(false)
    await setAndCheck(true)
    await setAndCheck(false)
    await setAndCheck(false)
  })

  it("should fail for not owner to close and open crowdsale.", async () => {
    let setAndCheck = async (newValue, from) => {
      let value = await crowdsale.crowdsaleClosed()
      await crowdsale.setCrowdsaleClosed(newValue, {from: from}).catch(async (err) => {
        assert.isOk(err, "Expected error.")
        let actualValue = await crowdsale.crowdsaleClosed()
        expect(actualValue).to.be.equal(value)
      }).then(async (txn) => {
        if(txn) {
          assert.fail("Should have failed above.")
        }
      })
    }
    await setAndCheck(true, accounts[1])
    await setAndCheck(true, accounts[3])
    await setAndCheck(false, accounts[4])
    await setAndCheck(true, accounts[5])
    await setAndCheck(false, accounts[6])
    await setAndCheck(false, accounts[8])
  })

  it("should let owner to set tokens amount per dollar.", async () => {
    let setAndCheck = async (newValue) => {
      let txn = await crowdsale.setTokensPerDollar(newValue, {from: mainAccount})
      let actualValue = await crowdsale.tokensPerDollar()
      expect(actualValue.toString()).to.be.equal(newValue)
    }
    await setAndCheck("3")
    await setAndCheck("4")
    await setAndCheck("1000")
    await setAndCheck("12")
    await setAndCheck("34")
    await setAndCheck("67")
  })

  it("should fail for not owner to set tokens amount per dollar.", async () => {
    let setAndCheck = async (newValue, from) => {
      let value = await crowdsale.tokensPerDollar()
      await crowdsale.setTokensPerDollar(newValue, {from: from}).catch(async (err) => {
        assert.isOk(err, "Expected error.")
        let actualValue = await crowdsale.tokensPerDollar()
        expect(actualValue.toString()).to.be.equal(value.toString())
      }).then(async (txn) => {
        if(txn) {
          assert.fail("Should have failed above.")
        }
      })
    }
    await setAndCheck("3", accounts[1])
    await setAndCheck("55", accounts[3])
    await setAndCheck("89", accounts[4])
    await setAndCheck("100", accounts[5])
    await setAndCheck("1001", accounts[6])
    await setAndCheck("111", accounts[8])
  })

  it("should set price feed contract address by owner", async () => {
    let priceFeedContract = await crowdsale.priceFeedContract()
    await DeployMedianizerAndSetToCrowdsale()
    let medianizerAddress = await crowdsale.priceFeedContract()
    expect(medianizerAddress).to.be.not.equal(priceFeedContract)
    expect(medianizerAddress).to.be.equal(medianizer.address)
  })

  it("shouldn't set price feed contract address by not an owner or to zero value", async () => {
    let priceFeedContract = await crowdsale.priceFeedContract()
    medianizer = await Medianizer.new({from: mainAccount})
    let checkFailure = async (sender, address) => {
      await crowdsale.setPriceFeedContractAddress(
        address,
        { from: sender, gasPrice: 1 }
      ).catch(async (err) => {
        assert.isOk(err, "Exception should be thrown for that transaction.")
        let medianizerAddress = await crowdsale.priceFeedContract()
        expect(medianizerAddress).to.be.equal(priceFeedContract)
      }).then((txn) => {
        if(txn) {
          assert.fail("Should have failed above.")
        }
      })
    }
    await checkFailure(mainAccount, ZERO_ADDRESS)
    await checkFailure(accounts[3], ZERO_ADDRESS)
    await checkFailure(accounts[6], medianizer.address)
  })

  it("should transfer out ERC20 tokens or fail for invalid sender and invalid amount.", async () => {
    let testToken = await DeconetToken.new({from: accounts[1], gasPrice: 1})
    await testToken.unpause({from: accounts[1]})
    let initialBalance = (new BigNumber(10)).pow(18).times(1000)
    await testToken.transfer(
      crowdsale.address,
      initialBalance.toString(),
      {from: accounts[1], gasPrice: 1}
    )
    let transferAndTest = async (sender, amount) => {
      let initialSenderBalance = await testToken.balanceOf(sender)
      let initialContractBalance = await testToken.balanceOf(crowdsale.address)
      await crowdsale.transferAnyERC20Token(
        testToken.address,
        amount.toString(),
        {from: sender, gasPrice: 1}
      ).catch(async (err) => {
        assert.isOk(err, "Error is expected, balance should not changed.")
        expect(sender == mainAccount && initialBalance.gt(amount)).to.be.false
        let senderBalance = await testToken.balanceOf(sender)
        let contractBalance = await testToken.balanceOf(crowdsale.address)
        expect(senderBalance.toString()).to.be.equal(initialSenderBalance.toString())
        expect(contractBalance.toString()).to.be.equal(initialContractBalance.toString())
      }).then(async (txn) => {
        if(txn) {
          expect(sender == mainAccount && initialBalance.gt(amount)).to.be.true
          let senderBalance = await testToken.balanceOf.call(sender)
          let contractBalance = await testToken.balanceOf.call(crowdsale.address)
          expect(senderBalance.toString()).to.be.equal(amount.plus(initialSenderBalance).toString())
          let initialContractBalanceBN = new BigNumber(initialContractBalance)
          expect(contractBalance.toString()).to.be.equal(initialContractBalanceBN.minus(amount).toString())
          initialBalance = initialBalance.minus(amount)
        }
      })
    }
    await transferAndTest(
      mainAccount,
      initialBalance.div(4)
    )
    await transferAndTest(
      mainAccount,
      initialBalance.div(5)
    )
    await transferAndTest(
      accounts[3],
      initialBalance.div(5)
    )
    await transferAndTest(
      mainAccount,
      initialBalance.div(5)
    )
    await transferAndTest(
      mainAccount,
      initialBalance.times(2)
    )
    await transferAndTest(
      accounts[7],
      initialBalance.times(2)
    )
  })

  it("should set non-zero withdraw address by owner.", async () => {
    await crowdsale.setWithdrawAddress(accounts[1], {from: mainAccount})
    await crowdsale.setWithdrawAddress(accounts[3], {from: mainAccount})
    await crowdsale.setWithdrawAddress(accounts[5], {from: mainAccount})
  })

  it(
    "shouldn't set zero withdraw address by owner or fail whole txn by not an owner.",
    async () => {
      let checkFailure = async (sender, address) => {
        await crowdsale.setWithdrawAddress(
          address,
          { from: sender, gasPrice: 1 }
        ).catch(async (err) => {
          assert.isOk(err, "Exception should be thrown for that transaction.")
        }).then((txn) => {
          if(txn) {
            assert.fail("Should have failed above.")
          }
        })
      }
      await checkFailure(mainAccount, ZERO_ADDRESS)
      await checkFailure(accounts[3], ZERO_ADDRESS)
      await checkFailure(accounts[6], accounts[5])
    }
  )

  it("should set non-zero ops admin address by owner.", async () => {
    await crowdsale.setOpsAdminAddress(accounts[1], {from: mainAccount})
    await crowdsale.setOpsAdminAddress(accounts[3], {from: mainAccount})
    await crowdsale.setOpsAdminAddress(accounts[5], {from: mainAccount})
  })

  it(
    "shouldn't set zero ops admin address by owner or fail whole txn by not an owner.",
    async () => {
      let checkFailure = async (sender, address) => {
        await crowdsale.setOpsAdminAddress(
          address,
          { from: sender, gasPrice: 1 }
        ).catch(async (err) => {
          assert.isOk(err, "Exception should be thrown for that transaction.")
        }).then((txn) => {
          if(txn) {
            assert.fail("Should have failed above.")
          }
        })
      }
      await checkFailure(mainAccount, ZERO_ADDRESS)
      await checkFailure(accounts[3], ZERO_ADDRESS)
      await checkFailure(accounts[6], accounts[5])
    }
  )

  it("should set non-zero token contract address by owner.", async () => {
    let deconetToken = await DeconetToken.new({from: accounts[6]})
    await crowdsale.setTokenContractAddress(deconetToken.address, {from: mainAccount})
    deconetToken = await DeconetToken.new({from: accounts[2]})
    await crowdsale.setTokenContractAddress(deconetToken.address, {from: mainAccount})
    deconetToken = await DeconetToken.new({from: mainAccount})
    await crowdsale.setTokenContractAddress(deconetToken.address, {from: mainAccount})
    await crowdsale.setTokenContractAddress(accounts[3], {from: mainAccount})
    await crowdsale.setTokenContractAddress(accounts[9], {from: mainAccount})
  })

  it(
    "shouldn't set zero token contract address by owner or fail whole txn by not an owner.",
    async () => {
      let checkFailure = async (sender, address) => {
        await crowdsale.setTokenContractAddress(
          address,
          { from: sender, gasPrice: 1 }
        ).catch(async (err) => {
          assert.isOk(err, "Exception should be thrown for that transaction.")
        }).then((txn) => {
          if(txn) {
            assert.fail("Should have failed above.")
          }
        })
      }
      await checkFailure(mainAccount, ZERO_ADDRESS)
      await checkFailure(accounts[3], ZERO_ADDRESS)
      await checkFailure(accounts[6], accounts[5])
    }
  )

  it("should set ETH min contribution amount by owner.", async () => {
    let setAndCheck = async (amount) => {
      amount = web3.utils.toWei(amount)
      await crowdsale.setEthMinContributionAmount(amount.toString(), {from: mainAccount})
      let actualAmount = await crowdsale.ethMinContributionAmount()
      expect(actualAmount.toString()).to.be.equal(amount.toString())
    }

    await setAndCheck("0.00001")
    await setAndCheck("0.01")
    await setAndCheck("100")
    await setAndCheck("1")
  })

  it(
    "shouldn't set ETH min contribution amount by not an owner.",
    async () => {
      let checkFailure = async (sender, amount) => {
        await crowdsale.setEthMinContributionAmount(
          web3.utils.toWei(amount),
          { from: sender, gasPrice: 1 }
        ).catch(async (err) => {
          assert.isOk(err, "Exception should be thrown for that transaction.")
        }).then((txn) => {
          if(txn) {
            assert.fail("Should have failed above.")
          }
        })
      }

      await checkFailure(accounts[3], "0.1")
      await checkFailure(accounts[6], "1")
    }
  )

  it("should update whitelisted status of an address correctly.", async () => {
    let opsAdmin = accounts[9]
    await crowdsale.setOpsAdminAddress(opsAdmin, {from: mainAccount})

    let updateAndCheck = async (address, status, sender) => {
      let phase = status ? "1" : "0"
      let txn = await crowdsale.updateWhitelist(address, phase, {from: sender})
      let actualStatus = await crowdsale.whitelistedAddresses.call(address)
      expect(actualStatus).to.be.equal(status)

      let emittedEvent = txn.logs[0]
      expect(emittedEvent.event).to.be.equal("WhitelistUpdated")
      expect(emittedEvent.args._account).to.be.equal(address)
      expect(emittedEvent.args._phase.toString()).to.be.equal(phase)
    }

    await updateAndCheck(accounts[3], true, opsAdmin)
    await updateAndCheck(accounts[3], false, mainAccount)
    await updateAndCheck(accounts[4], true, mainAccount)
    await updateAndCheck(accounts[4], false, opsAdmin)
    await updateAndCheck(accounts[5], true, mainAccount)
    await updateAndCheck(accounts[6], false, opsAdmin)

    let address = accounts[8]
    let status = await crowdsale.whitelistedAddresses.call(address)
    let txn = await crowdsale.updateWhitelist(address, "3", {from: mainAccount})
    expect(txn.logs).to.be.empty
    let actualStatus = await crowdsale.whitelistedAddresses.call(address)
    expect(actualStatus).to.be.equal(status)
  })

  it(
    "should fail updating whitelisted status of an address correctly from not owner or ops admin address.",
    async () => {
      let opsAdmin = accounts[9]
      await crowdsale.setOpsAdminAddress(opsAdmin, {from: mainAccount})

      let updateAndCheck = async (address, status, sender) => {
        let phase = status ? "1" : "0"
        let storedStatus = await crowdsale.whitelistedAddresses.call(address)
        await crowdsale.updateWhitelist(
          address,
          phase,
          {from: sender}
        ).catch(async (err) => {
          assert.isOk(err, "Exception should be thrown for that transaction.")
          let actualStatus = await crowdsale.whitelistedAddresses.call(address)
          expect(actualStatus).to.be.equal(storedStatus)
        }).then(async (txn) => {
          if(txn) {
            assert.fail("Should have failed above.")
          }
        })
      }

      await updateAndCheck(accounts[3], true, accounts[2])
      await updateAndCheck(accounts[3], false, accounts[4])
      await updateAndCheck(accounts[4], true, accounts[5])
      await updateAndCheck(accounts[4], false, accounts[5])
      await updateAndCheck(accounts[5], true,  accounts[7])
      await updateAndCheck(accounts[6], false, accounts[7])
    }
  )

  it("should correctly process deposit.", async () => {
    let testToken = await DeconetToken.new({from: accounts[1], gasPrice: 1})
    await testToken.unpause({from: accounts[1]})
    let initialBalance = (new BigNumber(10)).pow(18 + 6).times(2)
    await testToken.transfer(
      crowdsale.address,
      initialBalance.toString(),
      {from: accounts[1], gasPrice: 1}
    )

    let tokensPerDollar = new BigNumber(10).pow(19)

    await crowdsale.setTokenContractAddress(testToken.address, {from: mainAccount})
    await crowdsale.setTokensPerDollar(tokensPerDollar.toString(), {from: mainAccount})
    await crowdsale.setCrowdsaleClosed(false, {from: mainAccount})
    await DeployMedianizerAndSetToCrowdsale()

    let contributeAndCheckState = async (contributor, amount) => {
      await crowdsale.updateWhitelist(contributor, "1", {from: mainAccount})
      amount = new BigNumber(web3.utils.toWei(amount))
      let contribution = await crowdsale.ethContributions(contributor)
      let usdRaised = await crowdsale.usdRaised()
      let ethRaised = await crowdsale.ethRaised()
      let initialSenderBalance = await testToken.balanceOf(contributor)
      let initialContractBalance = await testToken.balanceOf(crowdsale.address)

      let txn = await crowdsale.sendTransaction({from: contributor, value: amount.toString()})

      let ethPrice = await crowdsale.getEthPrice()
      let usdAmount = new BigNumber(ethPrice.toString()).times(amount).div(new BigNumber(10).pow(18))
      let tokensAmount = usdAmount.times(tokensPerDollar).div(new BigNumber(10).pow(18))

      let actualContribution = await crowdsale.ethContributions(contributor)
      let actualUsdRaised = await crowdsale.usdRaised()
      let actualEthRaised = await crowdsale.ethRaised()
      let actualSenderBalance = await testToken.balanceOf(contributor)
      let actualContractBalance = await testToken.balanceOf(crowdsale.address)

      expect(actualContribution.toString()).to.be.equal(
        new BigNumber(contribution).plus(amount).toString()
      )
      expect(actualUsdRaised.toString()).to.be.equal(
        new BigNumber(usdRaised).plus(usdAmount).toString()
      )
      expect(actualEthRaised.toString()).to.be.equal(
        new BigNumber(ethRaised).plus(amount).toString()
      )
      expect(actualSenderBalance.toString()).to.be.equal(
        new BigNumber(initialSenderBalance).plus(tokensAmount).toString()
      )
      expect(actualContractBalance.toString()).to.be.equal(
        new BigNumber(initialContractBalance).minus(tokensAmount).toString()
      )

      let emittedEvent = txn.logs[0]
      expect(emittedEvent.event).to.be.equal("FundTransfer")
      expect(emittedEvent.args.backer).to.be.equal(contributor)
      expect(emittedEvent.args.tokenAmount.toString()).to.be.equal(tokensAmount.toString())
      expect(emittedEvent.args.usdAmount.toString()).to.be.equal(usdAmount.toString())
      expect(emittedEvent.args.ethPrice.toString()).to.be.equal(ethPrice.toString())
    }

    await contributeAndCheckState(accounts[3], "0.1")
    await contributeAndCheckState(accounts[4], "0.3")
    await contributeAndCheckState(accounts[5], "1")
    await contributeAndCheckState(accounts[6], "3")
    await contributeAndCheckState(accounts[9], "9")
  })

  it(
    "should fail processing deposit for some expected reason.",
    async () => {
      let testToken = await DeconetToken.new({from: accounts[1], gasPrice: 1})
      await testToken.unpause({from: accounts[1]})
      let initialBalance = (new BigNumber(10)).pow(18 + 6).times(2)
      await testToken.transfer(
        crowdsale.address,
        initialBalance.toString(),
        {from: accounts[1], gasPrice: 1}
      )

      let tokensPerDollar = new BigNumber(10).pow(19)

      await crowdsale.setEthMinContributionAmount("0", {from: mainAccount})
      await crowdsale.setTokenContractAddress(testToken.address, {from: mainAccount})
      await crowdsale.setTokensPerDollar(tokensPerDollar.toString(), {from: mainAccount})
      await crowdsale.setCrowdsaleClosed(false, {from: mainAccount})
      await DeployMedianizerAndSetToCrowdsale()

      let contributeAndCheckState = async (contributor, amount) => {
        amount = new BigNumber(web3.utils.toWei(amount))
        await crowdsale.sendTransaction(
          {from: contributor, value: amount.toString()}
        ).catch(async (err) => {
          assert.isOk(err, "Expected crash.")
        }).then(async (txn) => {
          if(txn) {
            assert.fail("Should have failed above.")
          }
        })
      }

      let contributor = accounts[3]

      await crowdsale.updateWhitelist(contributor, "1", {from: mainAccount})
      // the contribution should go through.
      await crowdsale.sendTransaction({from: contributor, value: web3.utils.toWei("1".toString())})

      // Fail if address is not whitelisted.
      await crowdsale.updateWhitelist(contributor, "0", {from: mainAccount})
      await contributeAndCheckState(contributor, "0.1")

      await crowdsale.updateWhitelist(contributor, "1", {from: mainAccount})

      // Fail because set min contribution amount is super high.
      await crowdsale.setEthMinContributionAmount(web3.utils.toWei("1000"), {from: mainAccount})
      await contributeAndCheckState(contributor, "0.3")

      await crowdsale.setEthMinContributionAmount(web3.utils.toWei("0.05"), {from: mainAccount})

      // Fail while crowdsale is closed any contributions are forbidden.
      await crowdsale.setCrowdsaleClosed(true, {from: mainAccount})
      await contributeAndCheckState(contributor, "1")

      await crowdsale.setCrowdsaleClosed(false, {from: mainAccount})

      // Fails if ETH price computation is unsuccessful.
      await medianizer.setShouldFailComputing(true)
      await contributeAndCheckState(contributor, "3")
      await medianizer.setShouldFailComputing(false)

      await crowdsale.setPriceFeedContractAddress(accounts[2], {from: mainAccount})
      await contributeAndCheckState(contributor, "3")

      await crowdsale.setPriceFeedContractAddress(medianizer.address, {from: mainAccount})

      // Fail if token transfer is not possible because of not enough tokens amount or any other reason.
      await crowdsale.setTokensPerDollar(new BigNumber(10).pow(45).toString(), {from: mainAccount})
      await contributeAndCheckState(contributor, "9")

      await crowdsale.setTokensPerDollar(tokensPerDollar.toString(), {from: mainAccount})
      await crowdsale.setTokenContractAddress(accounts[1], {from: mainAccount})
      await contributeAndCheckState(contributor, "2")

      await crowdsale.setTokenContractAddress(testToken.address, {from: mainAccount})

      // Confirming that everything gets back to operational state and this contribution should go through.
      await crowdsale.sendTransaction({from: contributor, value: web3.utils.toWei("1".toString())})
    }
  )

  it("should correctly withdraw ether from withdraw address.", async () => {
    let testToken = await DeconetToken.new({from: accounts[1], gasPrice: 1})
    await testToken.unpause({from: accounts[1]})
    let initialBalance = (new BigNumber(10)).pow(18 + 6).times(2)
    await testToken.transfer(
      crowdsale.address,
      initialBalance.toString(),
      {from: accounts[1], gasPrice: 1}
    )

    let tokensPerDollar = new BigNumber(10).pow(19)

    await crowdsale.setTokenContractAddress(testToken.address, {from: mainAccount})
    await crowdsale.setTokensPerDollar(tokensPerDollar.toString(), {from: mainAccount})
    await crowdsale.setCrowdsaleClosed(false, {from: mainAccount})
    await crowdsale.setEthMinContributionAmount(web3.utils.toWei("0.05"), {from: mainAccount})
    await DeployMedianizerAndSetToCrowdsale()
    let contributor = accounts[2]
    await crowdsale.updateWhitelist(contributor, "1", {from: mainAccount})
    await crowdsale.sendTransaction({from: contributor, value: web3.utils.toWei("1")})

    let withdraw = async (sender) => {
      let balance = await web3.eth.getBalance(crowdsale.address)
      expect(new BigNumber(balance).gt("0")).to.be.true
      await crowdsale.withdrawEther({from: sender})
      balance = await web3.eth.getBalance(crowdsale.address)
      expect(balance.toString()).to.be.equal("0")
    }

    await crowdsale.setWithdrawAddress(accounts[1], {from: mainAccount})
    await withdraw(accounts[1])
    await crowdsale.sendTransaction({from: contributor, value: web3.utils.toWei("0.1")})
    await crowdsale.setWithdrawAddress(accounts[2], {from: mainAccount})
    await withdraw(accounts[2])
  })

  it("should fail withdraw ether from not withdraw address.", async () => {
    let testToken = await DeconetToken.new({from: accounts[1], gasPrice: 1})
    await testToken.unpause({from: accounts[1]})
    let initialBalance = (new BigNumber(10)).pow(18 + 6).times(2)
    await testToken.transfer(
      crowdsale.address,
      initialBalance.toString(),
      {from: accounts[1], gasPrice: 1}
    )

    let tokensPerDollar = new BigNumber(10).pow(19)

    await crowdsale.setTokenContractAddress(testToken.address, {from: mainAccount})
    await crowdsale.setTokensPerDollar(tokensPerDollar.toString(), {from: mainAccount})
    await crowdsale.setCrowdsaleClosed(false, {from: mainAccount})
    await crowdsale.setEthMinContributionAmount(web3.utils.toWei("0.05"), {from: mainAccount})
    await DeployMedianizerAndSetToCrowdsale()
    let contributor = accounts[2]
    await crowdsale.updateWhitelist(contributor, "1", {from: mainAccount})
    await crowdsale.sendTransaction({from: contributor, value: web3.utils.toWei("1")})

    let withdrawAndCheckFailure = async (sender) => {
      let balance = await web3.eth.getBalance(crowdsale.address)
      await crowdsale.withdrawEther({from: sender}).catch(async (err) => {
        assert.isOk(err, "Exception should be thrown for that transaction.")
        let actualBalance = await web3.eth.getBalance(crowdsale.address)
        expect(actualBalance.toString()).to.be.equal(balance.toString())
      }).then((txn) => {
        if(txn) {
          assert.fail("Should have failed above.")
        }
      })

    }

    await crowdsale.setWithdrawAddress(accounts[1], {from: mainAccount})
    await withdrawAndCheckFailure(accounts[2])
    await crowdsale.setWithdrawAddress(accounts[2], {from: mainAccount})
    await withdrawAndCheckFailure(accounts[3])
    await crowdsale.setWithdrawAddress(accounts[3], {from: mainAccount})
    await withdrawAndCheckFailure(accounts[4])
  })
})
