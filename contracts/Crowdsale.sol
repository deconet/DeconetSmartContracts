pragma solidity 0.4.24;

import "../node_modules/zeppelin-solidity/contracts/ownership/Ownable.sol";
import "./DeconetToken.sol";
import "./Medianizer.sol";
import "../node_modules/zeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "../other_dependencies/ds-math/src/math.sol";


// ----------------------------------------------------------------------------
// Handles the crowdsale of tokens
// ----------------------------------------------------------------------------
contract Crowdsale is Ownable, DSMath {
    Medianizer public priceFeedContract;

    address public opsAdmin;

    uint public ethMinContributionAmount = 0;

    uint256 public tokensPerDollar = 1;
    uint256 public usdRaised;
    uint256 public ethRaised;

    mapping(address => uint256) public ethContributions;
    bool public crowdsaleClosed = true;
    mapping (address => bool) public whitelistedAddresses;

    event SaleEnded(uint totalEthRaised, uint totalUsdRaised);
    event FundTransfer(address indexed backer, uint tokenAmount, uint usdAmount, uint ethPrice);
    event WhitelistUpdated(address indexed _account, uint8 _phase);


    // the token address
    DeconetToken public tokenContract;

    // this contract version
    uint public version;

    // the address that is authorized to withdraw eth
    address private withdrawAddress;

    // ------------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------------
    constructor() public {
        version = 1;

        // default withdrawAddress is owner
        withdrawAddress = msg.sender;
    }

    function () public payable {
        deposit();
    }

    // get the eth price from the makerdao oracle
    function getEthPrice() public view returns (uint256) {
        bytes32 price;
        bool success;
        (price, success) = priceFeedContract.compute();
        require(success, "ETH price could not be retrieved");
        return uint256(price);
    }

    // add a user to the crowdsale whitelist
    function updateWhitelist(address _account, uint8 _phase) public onlyOps {
        if (_phase == 0) {
            whitelistedAddresses[_account] = false;
            emit WhitelistUpdated(_account, _phase);
        } else if (_phase == 1) {
            whitelistedAddresses[_account] = true;
            emit WhitelistUpdated(_account, _phase);
        }
    }

    // close or open the crowdsale
    function setCrowdsaleClosed(bool _newValue) public onlyOwner {
        crowdsaleClosed = _newValue;
        if (_newValue) {
            emit SaleEnded(ethRaised, usdRaised);
        }
    }

    // set the tokens per dollar
    function setTokensPerDollar(uint256 _newValue) public onlyOwner {
        tokensPerDollar = _newValue;
    }

    function setPriceFeedContractAddress(address _priceFeedAddress) public onlyOwner {
        require(_priceFeedAddress != address(0), "Price feed contract address must not be zero.");
        priceFeedContract = Medianizer(_priceFeedAddress);
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
        require(msg.sender == withdrawAddress, "Sender must be withdrawal address");
        withdrawAddress.transfer(address(this).balance);
    }

    // ------------------------------------------------------------------------
    // Owner can set address of who can withdraw
    // ------------------------------------------------------------------------
    function setWithdrawAddress(address _withdrawAddress) public onlyOwner {
        require(_withdrawAddress != address(0), "Withdraw address must not be zero.");
        withdrawAddress = _withdrawAddress;
    }

    function setOpsAdminAddress(address _opsAdminAddress) public onlyOwner {
        require(_opsAdminAddress != address(0), "Ops admin address must not be zero.");
        opsAdmin = _opsAdminAddress;
    }

    // ------------------------------------------------------------------------
    // Owner can set address of token contract
    // ------------------------------------------------------------------------
    function setTokenContractAddress(address _tokenContractAddress) public onlyOwner {
        require(_tokenContractAddress != address(0), "Token contract address must not be zero.");
        tokenContract = DeconetToken(_tokenContractAddress);
    }

    // ------------------------------------------------------------------------
    // Owner can set ETH minumum contribution amount
    // ------------------------------------------------------------------------
    function setEthMinContributionAmount(uint _amount) public onlyOwner {
        ethMinContributionAmount = _amount;
    }

    function deposit() internal {
        require(!crowdsaleClosed, "The crowdsale is closed");
        require(whitelistedAddresses[msg.sender], "You are not on the token sale whitelist");
        require(
            msg.value >= ethMinContributionAmount, 
            "Contribution amount must be greater than configured minimum."
        );

        // get eth price from makerdao oracle
        uint256 ethPrice = getEthPrice();

        // calculate how much they are buying in USD based on current eth price
        uint256 usdBought = wmul(msg.value, ethPrice);

        // calculate how many tokens they get for that usd
        uint256 tokensBought = wmul(usdBought, tokensPerDollar);

        // log the contribution
        ethContributions[msg.sender] = add(ethContributions[msg.sender], msg.value);

        // add to the total USD raised
        usdRaised = add(usdRaised, usdBought);

        // add to the total ETH raised
        ethRaised = add(ethRaised, msg.value);

        // transfer the tokens to the buyer
        tokenContract.transfer(msg.sender, tokensBought);

        emit FundTransfer(msg.sender, tokensBought, usdBought, ethPrice);
    }

    modifier onlyOps() {
        require(msg.sender == owner || msg.sender == opsAdmin, "Only ops users can use this function");
        _;
    }
}
