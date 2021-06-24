# 🥂 **ReNFT Contract**

![ReNFT](https://raw.githubusercontent.com/re-nft/assets/main/mainLogov1.png)

## Table of content

- [🖼️ What is ReNFT](#🖼️-what-is-renft)
  - [🖼️🌊 Flow](#🖼️🌊-flow)
- [🤏🏻 ReNft contract spec](#🤏🏻-renft-contract-spec)
  - [🤏🏻👨🏻‍💻 Events](#🤏🏻👨🏻‍💻-events)
  - [🤏🏻👩🏽‍✈️ Functions](#🤏🏻👩🏽‍✈️-functions)
- [🎨 Marketing](#🎨-marketing)

## 🖼️ What is ReNFT

ReNFT is an Ethereum protocol for ERC-721 and ERC-1155 lending and renting. The protocol is incredibly minimalistic.
The core contract is implemented in `src/ReNFT.sol`, you can find the interface in `src/interfaces/IReNFT.sol`.
It allows for a combination of ERC-721 and ERC-1155 to be lent in a single transaction. There is a complementary [npm package](https://github.com/re-nft/sdk), that will help you pass the arguments to the contract correctly, such that your users save on gas. This library prepares the arguments to be passed to the contract such that ERC1155s invoke their batch functions.

There is a subgraph implementation, you can find it [here](https://github.com/re-nft/subgraph).

### 🖼️🌊 Flow

1. Lender specifies a number of parameters

   a. maximum number of days that his NFT can be rented out for

   **why?** we don't want renters to hold on to NFTs for too long

   b. daily rent price

   c. NFT price. In case the NFT is not returned, the lender is entitled to claim the collateral

   d. payment token. The lender receives rent payments in this token. Collateral is priced in this token, as well.

2. Lender lends NFT(s)

3. Renter agrees to the terms and pays **full collateral** and **all of the rent** up front

4. Step 5 or Step 6 below

5. Renter returns in time

   4a. Unused rent amounts + collateral gets returned to the renter

   4b. NFT(s) is/are returned to the lender and deposited back into the ReNFT contract

   **why?** so that the lender does not have to re-deposit the NFT(s) back for lending

6. Renter does no return in time

   5a. Lender claims the collateral

   5b. Collateral along with full rent payment gets sent to the lender

## 🤏🏻 **ReNFT contract spec**

### 🤏🏻👨🏻‍💻 **_Events_**

`Lent` - when an NFT(s) is/are lent.

`Rented` - when an NFT(s) is/are rented out.

`Returned` - when an NFT(s) is/are returned by the renter back into ReNFT contract.

`CollateralClaimed` - when the renter fails to return the NFT(s) in time, lender can claim collateral. Emmitted when lender claimed this collateral(s).

`LendingStopped` - lender can stop lending their NFT(s), these will be sent from the ReNFT contract back to the lender.

### 🤏🏻👩🏽‍✈️ **_Functions_**

`lend` - lend some/all of your NFTs. These get sent to ReNFT contract for escrow, until the renter is found.

`rent` - rent one/many ERC721/ERC1155 NFTs from the users that have lent them, and which reside in ReNFT for escrow.

`returnIt` - return one/all of the rented ERC721/ERC1155 NFTs before the deadline.

`claimCollateral` - called by lender if the renter missed their return date.

`stopLending` - called by lender to release their lent NFT back to them. This marks end of the interaction with ReNFT smart contract.

## 🎨 Marketing

For ReNFT branding materials, head [here](https://github.com/re-nft/assets).
