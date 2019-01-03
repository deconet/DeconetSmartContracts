pragma solidity 0.4.25;

// this implements the compute() function that is normally implemented by the MakerDAO medianizer contract
// in production, the real deployed medianizer contract address would be used
// this one is used for local testing etc

import "./ds-value/value.sol";

contract Medianizer is DSThing {
    /// Used for testing MakerDAO's medianizer fails.
    bool public shouldFailComputing = false;


    event LogValue(bytes32 val);

    uint128 val;
    bool public has;

    mapping (bytes12 => address) public values;
    mapping (address => bytes12) public indexes;
    bytes12 public next = 0x1;
    uint96 public min = 0x1;

    function set(address wat) public auth {
        bytes12 nextId = bytes12(uint96(next) + 1);
        require(nextId != 0x0);
        this.set(next, wat);
        next = nextId;
    }

    function set(bytes12 pos, address wat) public note auth {
        require(pos != 0x0);
        require(wat == 0 || indexes[wat] == 0);

        indexes[values[pos]] = 0x0; // Making sure to remove a possible existing address in that position

        if (wat != 0) {
            indexes[wat] = pos;
        }

        values[pos] = wat;
    }

    function setMin(uint96 min_) public note auth {
        require(min_ != 0x0);
        min = min_;
    }

    function setNext(bytes12 next_) public note auth {
        require(next_ != 0x0);
        next = next_;
    }

    function unset(bytes12 pos) public auth {
        this.set(pos, 0);
    }

    function unset(address wat) public auth {
        this.set(indexes[wat], 0);
    }

    function void() external auth {
        has = false;
        // TODO: don't allow poke
    }

    function poke() external {
        (bytes32 val_, bool has_) = compute();
        val = uint128(val_);
        has = has_;
        emit LogValue(val_);
    }

    function peek() external view returns (bytes32, bool) {
        return (bytes32(val), has);
    }

    function read() external view returns (bytes32) {
        require(has);
        return bytes32(val);
    }

    function compute() public view returns (bytes32, bool) {
        // hardcoded for testing purposes
        return (0x00000000000000000000000000000000000000000000000b36f7a46de4ef8000, !shouldFailComputing);
    }

    /// Test methods

    function setShouldFailComputing(bool value) public {
        shouldFailComputing = value;
    }
}