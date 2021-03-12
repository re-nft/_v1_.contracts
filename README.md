# ReNFT Contracts

## Table of content

- [ReNFT Contracts](#renft-contracts)
  - [Table of content](#table-of-content)
    - [|||| ReNft contract spec](#-renft-contract-spec)
      - [||| Events](#-events)
      - [||| Functions](#-functions)

---

### |||| ReNft contract spec

---

#### ||| Events

`Lent` - when an NFT(s) is/are lent.

`Rented` - when an NFT(s) is/are rented out.

`Returned` - when an NFT(s) is/are returned by the renter back into ReNft contract.

`CollateralClaimed` - when the renter fails to return the NFT(s) in time, lender can claim collateral. Emmitted when lender claimed this collateral(s).

`LendingStopped` - lender can stop lending their NFT(s), these will be sent from the ReNft contract back to the lender.

#### ||| Functions

`lend` - lend some/all of your NFTs. These get sent to ReNft contract for escrow, until the renter is found.

`rent` - rent one/many ERC721/ERC1155 NFTs from the users that have lent them, and which reside in ReNft for escrow.

`returnIt` - return one/all of the rented ERC721/ERC1155 NFTs before the deadline.

`claimCollateral` - called by lender if the renter missed their return date.

`stopLending` - called by lender to release their lent NFT back to them. This marks end of the interaction with ReNft smart contract.
