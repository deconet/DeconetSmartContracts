pragma solidity 0.4.24;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "zeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract Relay is Ownable {
    address public licenseSalesContractAddress;
    address public registryContractAddress;
    address public apiRegistryContractAddress;
    address public apiCallsContractAddress;
    uint public version;

    // ------------------------------------------------------------------------
    // Constructor, establishes ownership because contract is owned
    // ------------------------------------------------------------------------
    constructor() public {
        version = 4;
    }

    // ------------------------------------------------------------------------
    // Owner can transfer out any accidentally sent ERC20 tokens (just in case)
    // ------------------------------------------------------------------------
    function transferAnyERC20Token(address tokenAddress, uint tokens) public onlyOwner returns (bool success) {
        return ERC20(tokenAddress).transfer(owner, tokens);
    }

    // ------------------------------------------------------------------------
    // Sets the license sales contract address
    // ------------------------------------------------------------------------
    function setLicenseSalesContractAddress(address newAddress) public onlyOwner {
        require(newAddress != address(0));
        licenseSalesContractAddress = newAddress;
    }

    // ------------------------------------------------------------------------
    // Sets the registry contract address
    // ------------------------------------------------------------------------
    function setRegistryContractAddress(address newAddress) public onlyOwner {
        require(newAddress != address(0));
        registryContractAddress = newAddress;
    }

    // ------------------------------------------------------------------------
    // Sets the api registry contract address
    // ------------------------------------------------------------------------
    function setApiRegistryContractAddress(address newAddress) public onlyOwner {
        require(newAddress != address(0));
        apiRegistryContractAddress = newAddress;
    }

    // ------------------------------------------------------------------------
    // Sets the api calls contract address
    // ------------------------------------------------------------------------
    function setApiCallsContractAddress(address newAddress) public onlyOwner {
        require(newAddress != address(0));
        apiCallsContractAddress = newAddress;
    }
}