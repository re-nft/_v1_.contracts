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
    /// @dev quick test showed that LentBatch with arrays
    /// @dev would cost more than the non-array version
    /// @dev like the below
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

    /**
     * @dev lend will send your NFT to ReNft contract, it acts as an escrow
     * contract between the lender and the renter
     */
    function lend(
        address[] memory _nft,
        uint256[] memory _tokenId,
        uint16[] memory _maxRentDuration,
        bytes4[] memory _dailyRentPrice,
        bytes4[] memory _nftPrice,
        IResolver.PaymentToken[] memory _paymentToken
    ) external;

    /**
     * @dev on calling this, renter sends rentDuration * dailyRentPrice
     * to cover for the potentially full cost of renting. They also
     * must send the collateral - nft price set by the lender
     */
    function rent(
        address[] memory _nft,
        uint256[] memory _tokenId,
        uint256[] memory _id,
        uint16[] memory _rentDuration
    ) external payable;

    /**
     * @dev renters call this to return the rented NFT before the
     * deadline. If they fail to do so, they will lose the posted
     * collateral
     */
    function returnIt(
        address[] memory _nft,
        uint256[] memory _tokenId,
        uint256[] memory _id
    ) external;

    /**
     * @dev claim collateral on rentals that are past their due date
     */
    function claimCollateral(
        address[] memory _nft,
        uint256[] memory _tokenId,
        uint256[] memory _id
    ) external;

    /**
     * @dev stop lending releases the NFT from our escrow and sends it back
     * to you
     */
    function stopLending(
        address[] memory _nft,
        uint256[] memory _tokenId,
        uint256[] memory _id
    ) external;
}
