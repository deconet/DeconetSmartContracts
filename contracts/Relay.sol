pragma solidity ^0.4.19;

import "./Owned.sol";

contract Relay is Owned {
  address public tokenContractAddress;
  address public registryContractAddress;

  // ------------------------------------------------------------------------
  // Constructor, establishes ownership because contract is owned
  // ------------------------------------------------------------------------
  function Relay(address _tokenContractAddress, address _registryContractAddress) public {
    tokenContractAddress = _tokenContractAddress;
    registryContractAddress = _registryContractAddress;

  }

  function setTokenContractAddress(address newAddress) public onlyOwner {
    tokenContractAddress = newAddress;
  }

  function setRegistryContractAddress(address newAddress) public onlyOwner {
    registryContractAddress = newAddress;
  }
}