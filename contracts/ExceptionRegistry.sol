pragma solidity ^0.4.19;

import "./Owned.sol";

contract ExceptionRegistry is Owned {

  struct Sale {
    string projectName;
    string sellerUsername;
    address sellerAddress;
    address buyerAddress;
    uint price;
  }

 mapping(address => Sale[]) sales;

  /// 
  // function ExceptionRegistry() public {

  // }

  function makeSale(string projectName, string sellerUsername, address sellerAddress, uint price) public {
    sales[msg.sender].push(Sale({
      projectName: projectName,
      sellerUsername: sellerUsername,
      sellerAddress: sellerAddress,
      buyerAddress: msg.sender,
      price: price
    }));
  }
  function getSaleCountForBuyer(address buyer) public view returns (uint) {
    return sales[buyer].length;
  }
  function getSaleForBuyerAtIndex(address buyer, uint index) public view returns (string, string, address, address, uint) {
    return (
      sales[buyer][index].projectName,
      sales[buyer][index].sellerUsername,
      sales[buyer][index].sellerAddress,
      sales[buyer][index].buyerAddress,
      sales[buyer][index].price
    );
  }
}