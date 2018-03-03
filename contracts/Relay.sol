pragma solidity 0.4.19;

import "./Owned.sol";

contract Relay is Owned {
  address public licenseSalesContractAddress;
  address public registryContractAddress;
  uint public version;

  // ------------------------------------------------------------------------
  // Constructor, establishes ownership because contract is owned
  // ------------------------------------------------------------------------
  function Relay() public {
    version = 2;
  }

  function setLicenseSalesContractAddress(address newAddress) public onlyOwner {
    licenseSalesContractAddress = newAddress;
  }

  function setRegistryContractAddress(address newAddress) public onlyOwner {
    registryContractAddress = newAddress;
  }
}