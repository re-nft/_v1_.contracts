# 🥂 **ReNFT Contracts**

## **Table of content**

- [🤏🏻 ReNft contract spec](#🤏🏻-renft-contract-spec)
  - [🤏🏻👨🏻‍💻 Events](#🤏🏻👨🏻‍💻-events)
  - [🤏🏻👩🏽‍✈️ Functions](#🤏🏻👩🏽‍✈️-functions)
- [❤ Dev like a reNFTer](#❤-dev-like-a-renfter)

---

### 🤏🏻 **ReNft contract spec**

---

#### 🤏🏻👨🏻‍💻 ***Events***

`Lent` - when an NFT(s) is/are lent.

`Rented` - when an NFT(s) is/are rented out.

`Returned` - when an NFT(s) is/are returned by the renter back into ReNft contract.

`CollateralClaimed` - when the renter fails to return the NFT(s) in time, lender can claim collateral. Emmitted when lender claimed this collateral(s).

`LendingStopped` - lender can stop lending their NFT(s), these will be sent from the ReNft contract back to the lender.

#### 🤏🏻👩🏽‍✈️ ***Functions***

`lend` - lend some/all of your NFTs. These get sent to ReNft contract for escrow, until the renter is found.

`rent` - rent one/many ERC721/ERC1155 NFTs from the users that have lent them, and which reside in ReNft for escrow.

`returnIt` - return one/all of the rented ERC721/ERC1155 NFTs before the deadline.

`claimCollateral` - called by lender if the renter missed their return date.

`stopLending` - called by lender to release their lent NFT back to them. This marks end of the interaction with ReNft smart contract.

---

### **❤ Dev like a reNFTer**

---

![hackerman](https://external-preview.redd.it/4lnFFyQJ8ZuV11zAkHW9q3VUfPHS-KL29kb76c0RM2s.jpg?auto=webp&s=20de54cd38fe99d817d283f802053c16f08e4ad9)

*kʌmfi vscode plugins*
--

[better comments](https://marketplace.visualstudio.com/items?itemName=aaron-bond.better-comments)

[markdownlint](https://marketplace.visualstudio.com/items?itemName=DavidAnson.vscode-markdownlint)


TODO:
- yarn upgrade all that can be upgraded
- yarn remove the deps that are not used
- minimal configs everywhere
- what is rimraf
- do we need cross-env
- pakcage.json env vars
- avoid generating the typechain artifacts twice
- solidity coverage does not work correctly, so I removed it for now
- husky pre-commit & pre-push
- gas reporting does not work
