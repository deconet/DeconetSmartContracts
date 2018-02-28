pragma solidity ^0.4.19;

import "./Owned.sol";
import "./Relay.sol";
import "./Registry.sol";
import "./DeconetToken.sol";


// ----------------------------------------------------------------------------
// Holds the logic behind paying the seller and rewarding them with tokens, and logs the sales
// ----------------------------------------------------------------------------
contract LicenseSales is Owned {
    using SafeMath for uint;

    // the amount rewarded to a seller for selling a license
    uint public tokenReward;

    // the fee this contract takes from every sale.  expressed as percent.  so a value of 3 indicates a 3% txn fee
    uint public saleFee;

    // address of the relay contract which holds the address of the registry contract.
    address public relayContractAddress;

    // the token address
    address public tokenContractAddress;

    // this contract version
    uint public version;

    // the address that is authorized to withdraw eth
    address private withdrawlAddress;

    event LicenseSale(
        bytes32 moduleName,
        bytes32 sellerUsername,
        address indexed sellerAddress,
        address indexed buyerAddress,
        uint price,
        uint soldAt,
        uint rewardedTokens,
        uint networkFee,
        bytes4 licenseId
    );


    // ------------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------------
    function LicenseSales() public {
        version = 1;

        // default token reward of 100 tokens.  
        // token has 18 decimal places so that's why 100 * 10^18
        tokenReward = 100 * 10**18;

        // default saleFee of 10%
        saleFee = 10;

        // default withdrawlAddress is owner
        withdrawlAddress = msg.sender;
    }

    // ------------------------------------------------------------------------
    // Don't accept ethers (just in case)
    // ------------------------------------------------------------------------
    function () public payable {
        revert();
    }

    // ------------------------------------------------------------------------
    // Owner can transfer out any accidentally sent ERC20 tokens (just in case)
    // ------------------------------------------------------------------------
    function transferAnyERC20Token(address tokenAddress, uint tokens) public onlyOwner returns (bool success) {
        return ERC20Interface(tokenAddress).transfer(owner, tokens);
    }

    // ------------------------------------------------------------------------
    // Owner can transfer out any ETH
    // ------------------------------------------------------------------------
    function withdrawEther() public {
        require(msg.sender == withdrawlAddress);
        withdrawlAddress.transfer(this.balance);
    }

    // ------------------------------------------------------------------------
    // Owner can set address of who can withdraw
    // ------------------------------------------------------------------------
    function setWithdrawlAddress(address _withdrawlAddress) public onlyOwner {
        withdrawlAddress = _withdrawlAddress;
    }

    // ------------------------------------------------------------------------
    // Owner can set address of relay contract
    // ------------------------------------------------------------------------
    function setRelayContractAddress(address _relayContractAddress) public onlyOwner {
        relayContractAddress = _relayContractAddress;
    }

    // ------------------------------------------------------------------------
    // Owner can set address of token contract
    // ------------------------------------------------------------------------
    function setTokenContractAddress(address _tokenContractAddress) public onlyOwner {
        tokenContractAddress = _tokenContractAddress;
    }

    // ------------------------------------------------------------------------
    // Owner can set token reward
    // ------------------------------------------------------------------------
    function setTokenReward(uint _tokenReward) public onlyOwner {
        tokenReward = _tokenReward;
    }

    // ------------------------------------------------------------------------
    // Owner can set the sale fee
    // ------------------------------------------------------------------------
    function setSaleFee(uint _saleFee) public onlyOwner {
        saleFee = _saleFee;
    }

    // ------------------------------------------------------------------------
    // Anyone can make a sale if they provide a moduleId
    // ------------------------------------------------------------------------
    function makeSale(uint moduleId) public payable {
        // look up the registry address from relay token
        Relay relay = Relay(relayContractAddress);
        address registryAddress = relay.registryContractAddress();

        // get the module info from registry
        Registry registry = Registry(registryAddress);

        uint price;
        bytes32 sellerUsername;
        bytes32 moduleName;
        address sellerAddress;
        bytes4 licenseId;

        (price, sellerUsername, moduleName, sellerAddress, licenseId) = registry.getModuleById(moduleId);

        // make sure the customer has sent enough eth
        require(msg.value >= price);

        // make sure the module is actually valid
        require(sellerUsername != "" && moduleName != "" && sellerAddress != address(0) && licenseId != "");

        // calculate fee and payout
        // fixed point math at 2 decimal places
        uint fee = msg.value.mul(100).div(saleFee).div(100);
        uint payout = msg.value.sub(fee);
        
        // give seller some tokens for the sale as well
        DeconetToken token = DeconetToken(tokenContractAddress);
        token.transfer(sellerAddress, tokenReward);
        
        // pay seller the ETH
        sellerAddress.transfer(payout);

        // log the sale
        LicenseSale(
            moduleName,
            sellerUsername,
            sellerAddress,
            msg.sender,
            price,
            block.timestamp,
            tokenReward,
            fee,
            licenseId
        );
    }
}
