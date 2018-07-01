pragma solidity 0.4.24;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "./Relay.sol";
import "./Registry.sol";
import "./DeconetToken.sol";
import "zeppelin-solidity/contracts/token/ERC20/ERC20.sol";


// ----------------------------------------------------------------------------
// Holds the logic behind paying the seller and rewarding them with tokens, and logs the sales
// ----------------------------------------------------------------------------
contract LicenseSales is Ownable {
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
    address private withdrawAddress;

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
    constructor() public {
        version = 1;

        // default token reward of 100 tokens.  
        // token has 18 decimal places so that's why 100 * 10^18
        tokenReward = 100 * 10**18;

        // default saleFee of 10%
        saleFee = 10;

        // default withdrawAddress is owner
        withdrawAddress = msg.sender;
    }

    // ------------------------------------------------------------------------
    // Owner can transfer out any accidentally sent ERC20 tokens (just in case)
    // ------------------------------------------------------------------------
    function transferAnyERC20Token(address tokenAddress, uint tokens) public onlyOwner returns (bool success) {
        return ERC20(tokenAddress).transfer(owner, tokens);
    }

    // ------------------------------------------------------------------------
    // Owner can transfer out any ETH
    // ------------------------------------------------------------------------
    function withdrawEther() public {
        require(msg.sender == withdrawAddress);
        withdrawAddress.transfer(this.balance);
    }

    // ------------------------------------------------------------------------
    // Owner can set address of who can withdraw
    // ------------------------------------------------------------------------
    function setWithdrawAddress(address _withdrawAddress) public onlyOwner {
        require(_withdrawAddress != address(0));
        withdrawAddress = _withdrawAddress;
    }

    // ------------------------------------------------------------------------
    // Owner can set address of relay contract
    // ------------------------------------------------------------------------
    function setRelayContractAddress(address _relayContractAddress) public onlyOwner {
        require(_relayContractAddress != address(0));
        relayContractAddress = _relayContractAddress;
    }

    // ------------------------------------------------------------------------
    // Owner can set address of token contract
    // ------------------------------------------------------------------------
    function setTokenContractAddress(address _tokenContractAddress) public onlyOwner {
        require(_tokenContractAddress != address(0));
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
        require(moduleId != 0);

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
        uint fee = msg.value.mul(saleFee).div(100); 
        uint payout = msg.value.sub(fee);

        // log the sale
        emit LicenseSale(
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

        // give seller some tokens for the sale
        rewardTokens(sellerAddress);
        
        // pay seller the ETH
        sellerAddress.transfer(payout);
    }

    // ------------------------------------------------------------------------
    // Reward user with tokens IF the contract has them in it's allowance
    // ------------------------------------------------------------------------
    function rewardTokens(address toReward) private {
        DeconetToken token = DeconetToken(tokenContractAddress);
        address tokenOwner = token.owner();

        // check balance of tokenOwner
        uint tokenOwnerBalance = token.balanceOf(tokenOwner);
        uint tokenOwnerAllowance = token.allowance(tokenOwner, address(this));
        if (tokenOwnerBalance >= tokenReward && tokenOwnerAllowance >= tokenReward) {
            token.transferFrom(tokenOwner, toReward, tokenReward);
        }
    }
}
