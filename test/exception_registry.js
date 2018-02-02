var ExceptionRegistry = artifacts.require('ExceptionRegistry')

contract('ExceptionRegistry', function (accounts) {
  it('should make a sale', function () {
    var instance = null
    return ExceptionRegistry.deployed().then(function (contract) {
      instance = contract
      return instance.makeSale('sampleproject', 'testuser', accounts[1], {from: accounts[0]})
    }).then(function () {
      return instance.getSaleCountForBuyer.call(accounts[0])
    }).then(function (saleCount) {
      // console.log('saleCount: ' + saleCount)
      assert.equal(saleCount, 1)
      return instance.getSaleForBuyerAtIndex.call(accounts[0], 0)
    }).then(function (sale) {
      // console.log(sale)
      assert.equal(sale[0], 'sampleproject')
      assert.equal(sale[1], 'testuser')
      assert.equal(sale[2], accounts[1])
      assert.equal(sale[3], accounts[0])
    })
  })
})
