// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IPublisherRegistry {
    function isTrusted(address _publisher) external view returns (bool);
}

contract NewsRegistry is Ownable {
    enum Status { UnderReview, VerifiedTrue, MarkedFake, Disputed }

    struct Article {
        bytes32 contentHash;
        string uri; // optional original URL or IPFS hash
        address publisher; // if known (publisher wallet)
        address submitter;
        uint256 createdAt;
        Status status;
        uint256 yesVotes;
        uint256 noVotes;
        bool finalized;
    }

    IPublisherRegistry public publisherRegistry;
    uint256 public votingPeriod; // seconds
    uint256 public minVotes;

    mapping(bytes32 => Article) public articles;
    mapping(bytes32 => mapping(address => bool)) public hasVoted; // contentHash => voter => voted

    event Submitted(bytes32 indexed contentHash, address indexed submitter, string uri);
    event PublisherAutoVerified(bytes32 indexed contentHash);
    event Voted(bytes32 indexed contentHash, address indexed voter, bool support);
    event Finalized(bytes32 indexed contentHash, Status finalStatus);

    // Pass deployer as initial owner to Ownable
    constructor(address _publisherRegistry, uint256 _votingPeriod, uint256 _minVotes) Ownable(msg.sender) {
        publisherRegistry = IPublisherRegistry(_publisherRegistry);
        votingPeriod = _votingPeriod;
        minVotes = _minVotes;
    }

    function submitArticle(bytes32 _contentHash, string calldata _uri, address _publisher) external {
        Article storage a = articles[_contentHash];
        require(a.createdAt == 0, "Already submitted");

        a.contentHash = _contentHash;
        a.uri = _uri;
        a.publisher = _publisher;
        a.submitter = msg.sender;
        a.createdAt = block.timestamp;
        a.status = Status.UnderReview;

        // auto-verify if publisher is trusted
        if (_publisher != address(0) && publisherRegistry.isTrusted(_publisher)) {
            a.status = Status.VerifiedTrue;
            a.finalized = true;
            emit PublisherAutoVerified(_contentHash);
            emit Finalized(_contentHash, a.status);
        } else {
            emit Submitted(_contentHash, msg.sender, _uri);
        }
    }

    function vote(bytes32 _contentHash, bool support) external {
        Article storage a = articles[_contentHash];
        require(a.createdAt != 0, "Not submitted");
        require(!a.finalized, "Already finalized");
        require(!hasVoted[_contentHash][msg.sender], "Already voted");

        hasVoted[_contentHash][msg.sender] = true;

        if (support) {
            a.yesVotes += 1;
        } else {
            a.noVotes += 1;
        }
        emit Voted(_contentHash, msg.sender, support);

        uint256 totalVotes = a.yesVotes + a.noVotes;
        if (totalVotes >= minVotes && block.timestamp >= a.createdAt + votingPeriod) {
            // finalize simple majority
            if (a.yesVotes > a.noVotes) {
                a.status = Status.VerifiedTrue;
            } else if (a.noVotes > a.yesVotes) {
                a.status = Status.MarkedFake;
            } else {
                a.status = Status.Disputed;
            }
            a.finalized = true;
            emit Finalized(_contentHash, a.status);
        }
    }

    function getArticle(bytes32 _contentHash) external view returns (
        bytes32 contentHash,
        string memory uri,
        address publisher,
        address submitter,
        uint256 createdAt,
        Status status,
        uint256 yesVotes,
        uint256 noVotes,
        bool finalized
    ) {
        Article storage a = articles[_contentHash];
        return (a.contentHash, a.uri, a.publisher, a.submitter, a.createdAt, a.status, a.yesVotes, a.noVotes, a.finalized);
    }

    // admin functions
    function setVotingParams(uint256 _votingPeriod, uint256 _minVotes) external onlyOwner {
        votingPeriod = _votingPeriod;
        minVotes = _minVotes;
    }
}
