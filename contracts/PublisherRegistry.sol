// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract PublisherRegistry is Ownable {
    mapping(address => bool) public isTrusted;
    event PublisherAdded(address indexed publisher);
    event PublisherRemoved(address indexed publisher);

    // Pass deployer as initial owner to the Ownable base
    constructor() Ownable(msg.sender) {}

    function addPublisher(address _publisher) external onlyOwner {
        require(!isTrusted[_publisher], "Already trusted");
        isTrusted[_publisher] = true;
        emit PublisherAdded(_publisher);
    }

    function removePublisher(address _publisher) external onlyOwner {
        require(isTrusted[_publisher], "Not trusted");
        isTrusted[_publisher] = false;
        emit PublisherRemoved(_publisher);
    }

    function trustStatus(address _publisher) external view returns (bool) {
        return isTrusted[_publisher];
    }
}
