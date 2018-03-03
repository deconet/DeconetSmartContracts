pragma solidity 0.4.19;

import "./Owned.sol";

contract Relay is Owned {
  address public licenseSalesContractAddress;
  address public registryContractAddress;
  address public apiRegistryContractAddress;
  uint public version;

  // ------------------------------------------------------------------------
  // Constructor, establishes ownership because contract is owned
  // ------------------------------------------------------------------------
  function Relay() public {
    version = 3;
  }

  function setLicenseSalesContractAddress(address newAddress) public onlyOwner {
    licenseSalesContractAddress = newAddress;
  }

  function setRegistryContractAddress(address newAddress) public onlyOwner {
    registryContractAddress = newAddress;
  }

  function setApiRegistryContractAddress(address newAddress) public onlyOwner {
    apiRegistryContractAddress = newAddress;
  }
}