pragma solidity 0.4.24;

import "./Relay.sol";
import "../node_modules/zeppelin-solidity/contracts/token/ERC721/ERC721Token.sol";

contract SoftwareLicenseToken is ERC721Token {
    // address of the relay contract which holds the address of the registry contract.
    address public relayContractAddress;

    // this contract version
    uint public version;

    constructor (string _name, string _symbol) public
        ERC721Token(_name, _symbol)
    {
        version = 1;
    }

    /**
    * Custom accessor to create a unique token
    */
    function mintUniqueTokenTo(
        address _to,
        uint256 _tokenId,
        string  _tokenURI
    ) public
    {
        // look up the LicenseSales address from relay token
        Relay relay = Relay(relayContractAddress);
        address licenseSalesAddress = relay.licenseSalesContractAddress();

        // only let LicenseSales contract mint tokens
        require(msg.sender == licenseSalesAddress, "Only the LicenseSales contract can mint license tokens.");

        super._mint(_to, _tokenId);
        super._setTokenURI(_tokenId, _tokenURI);
    }

    // ------------------------------------------------------------------------
    // Owner can set address of relay contract
    // ------------------------------------------------------------------------
    function setRelayContractAddress(address _relayContractAddress) public onlyOwner {
        require(_relayContractAddress != address(0));
        relayContractAddress = _relayContractAddress;
    }

}