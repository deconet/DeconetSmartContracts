pragma solidity ^0.4.19;

import "./Owned.sol";

contract Relay is Owned {
  address public tokenContractAddress;
  address public registryContractAddress;
  uint public version;

  // ------------------------------------------------------------------------
  // Constructor, establishes ownership because contract is owned
  // ------------------------------------------------------------------------
  function Relay() public {
    version = 1;
  }

  function setTokenContractAddress(address newAddress) public onlyOwner {
    tokenContractAddress = newAddress;
  }

  function setRegistryContractAddress(address newAddress) public onlyOwner {
    registryContractAddress = newAddress;
  }
}