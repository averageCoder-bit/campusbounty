// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title CampusBountyAchievements
 * @notice Non-transferable issuer attestations on BNB Smart Chain Testnet.
 * @dev Not an ERC-721 token, currency, job approval, or evidence of payment.
 *      Only designated issuer accounts can attest a badge to a wallet.
 */
contract CampusBountyAchievements {
    error NotOwner();
    error NotIssuer();
    error InvalidAddress();
    error InvalidAchievement();
    error AlreadyIssued();
    error InvalidProof();

    address public owner;
    mapping(address => bool) public isIssuer;

    struct Proof {
        bytes32 proofHash;
        uint64 issuedAt;
        address issuer;
    }

    mapping(address => mapping(bytes32 => Proof)) private proofs;

    event IssuerUpdated(address indexed issuer, bool enabled);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event AchievementIssued(
        address indexed student,
        bytes32 indexed achievementKey,
        address indexed issuer,
        string achievementId,
        bytes32 proofHash
    );

    constructor(address initialIssuer) {
        if (initialIssuer == address(0)) revert InvalidAddress();
        owner = msg.sender;
        isIssuer[initialIssuer] = true;
        emit OwnershipTransferred(address(0), msg.sender);
        emit IssuerUpdated(initialIssuer, true);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyIssuer() {
        if (!isIssuer[msg.sender]) revert NotIssuer();
        _;
    }

    function transferOwnership(address nextOwner) external onlyOwner {
        if (nextOwner == address(0)) revert InvalidAddress();
        emit OwnershipTransferred(owner, nextOwner);
        owner = nextOwner;
    }

    function setIssuer(address issuer, bool enabled) external onlyOwner {
        if (issuer == address(0)) revert InvalidAddress();
        isIssuer[issuer] = enabled;
        emit IssuerUpdated(issuer, enabled);
    }

    function issueAchievement(
        address student,
        string calldata achievementId,
        bytes32 proofHash
    ) external onlyIssuer {
        if (student == address(0)) revert InvalidAddress();
        bytes memory id = bytes(achievementId);
        if (id.length == 0 || id.length > 80) revert InvalidAchievement();
        if (proofHash == bytes32(0)) revert InvalidProof();
        bytes32 key = keccak256(id);
        if (proofs[student][key].issuedAt != 0) revert AlreadyIssued();
        proofs[student][key] = Proof({
            proofHash: proofHash,
            issuedAt: uint64(block.timestamp),
            issuer: msg.sender
        });
        emit AchievementIssued(student, key, msg.sender, achievementId, proofHash);
    }

    /** Returns information directly from the chain; proof is unique per wallet + achievement. */
    function verifyAchievement(address student, string calldata achievementId)
        external view returns (bool exists, bytes32 proofHash, uint64 issuedAt, address issuer)
    {
        Proof memory p = proofs[student][keccak256(bytes(achievementId))];
        return (p.issuedAt != 0, p.proofHash, p.issuedAt, p.issuer);
    }
}
