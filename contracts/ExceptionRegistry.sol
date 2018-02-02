pragma solidity ^0.4.19;

import "./Owned.sol";

contract ExceptionRegistry is Owned {

  struct Sale {
    string projectName;
    string sellerUsername;
    address sellerAddress;
    address buyerAddress;
  }

 mapping(address => Sale[]) sales;

  /// 
  // function ExceptionRegistry() public {

  // }

  function makeSale(string projectName, string sellerUsername, address sellerAddress) public {
    sales[msg.sender].push(Sale({
      projectName: projectName,
      sellerUsername: sellerUsername,
      sellerAddress: sellerAddress,
      buyerAddress: msg.sender
    }));
  }
  function getSaleCountForBuyer(address buyer) public view returns (uint) {
    return sales[buyer].length;
  }
  function getSaleForBuyerAtIndex(address buyer, uint index) public view returns (string, string, address, address) {
    return (
      sales[buyer][index].projectName,
      sales[buyer][index].sellerUsername,
      sales[buyer][index].sellerAddress,
      sales[buyer][index].buyerAddress
    );
  }
}