// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./IResolver.sol";

// TODO: add dev param comments after you change the spec a bit
interface IReNft is IERC721Receiver, IERC1155Receiver {
    // quick test showed that LentBatch with arrays
    // would cost more than the non-array version
    // like the below
    event Lent(
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 lendingId,
        address indexed lenderAddress,
        uint16 maxRentDuration,
        bytes4 dailyRentPrice,
        bytes4 nftPrice,
        IResolver.PaymentToken paymentToken
    );

    event Rented(
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 lendingId,
        address indexed renterAddress,
        uint16 rentDuration,
        uint32 rentedAt
    );

    event Returned(
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 indexed lendingId,
        address renterAddress,
        uint32 returnedAt
    );

    event CollateralClaimed(
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 indexed lendingId,
        uint32 claimedAt
    );

    event LendingStopped(
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 indexed lendingId,
        uint32 stoppedAt
    );

    function lend(
        address[] memory _nft,
        uint256[] memory _tokenId,
        uint16[] memory _maxRentDuration,
        bytes4[] memory _dailyRentPrice,
        bytes4[] memory _nftPrice,
        IResolver.PaymentToken[] memory _paymentToken
    ) external;

    function rent(
        address[] memory _nft,
        uint256[] memory _tokenId,
        uint256[] memory _id,
        uint16[] memory _rentDuration
    ) external payable;

    function returnIt(
        address[] memory _nft,
        uint256[] memory _tokenId,
        uint256[] memory _id
    ) external;

    /**
     * @dev claim collateral on rentals that are past their due date
     *
     * @param _nft nfts addresses array
     * @param _tokenId token ids per
     * @param _id lending id
     */
    function claimCollateral(
        address[] memory _nft,
        uint256[] memory _tokenId,
        uint256[] memory _id
    ) external;

    function stopLending(
        address[] memory _nft,
        uint256[] memory _tokenId,
        uint256[] memory _id
    ) external;
}
