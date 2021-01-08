import {expect} from './chai-setup';
import {ethers, deployments, getNamedAccounts} from 'hardhat';
import {Event} from "@ethersproject/contracts/lib"
import {RentNft as RentNftT} from '../typechain/RentNft';
import {Resolver as ResolverT} from '../typechain/Resolver';
import {ERC20 as ERC20T} from '../typechain/ERC20';
import {MyERC721 as ERC721T} from '../typechain/MyERC721';

// default values
const MAX_RENT_DURATION = 1;
const DAILY_RENT_PRICE = 2;
const NFT_PRICE = 3;
const PAYMENT_TOKEN = 0;
const GAS_SPONSOR = ethers.constants.AddressZero;

const LendingId = 1;

const getEvent = (events: Event[], name: string) => {
  let evt: Event | undefined = undefined;
  for (const event of events) {
    if (event?.event?.toLowerCase() === name.toLocaleLowerCase()) {
      evt = event;
      break;
    }
  }
  return evt;
}

const setup = deployments.createFixture(async () => {
  await deployments.fixture('Resolver');
  await deployments.fixture('ERC20');
  await deployments.fixture('ERC721');
  await deployments.fixture('RentNft');
  const {deployer, beneficiary} = await getNamedAccounts();
  const signers = await ethers.getSigners();
  const resolver = (await ethers.getContract('Resolver')) as ResolverT;
  const myERC20 = (await ethers.getContract('MyERC20')) as ERC20T;
  const myERC721 = (await ethers.getContract('MyERC721')) as ERC721T;
  const renft = (await ethers.getContract('RentNft')) as RentNftT;
  await resolver.setPaymentToken(0, myERC20.address);
  await myERC721.award();
  await myERC721.setApprovalForAll(renft.address, true);
  return {
    Resolver: resolver,
    RentNft: renft,
    ERC20: myERC20,
    ERC721: myERC721,
    signers: signers.map((acc, ix) => ({[ix]: acc})),
    deployer,
    beneficiary,
  };
});

// all the below share the following
// NFT(s) is(are) taken from the lender and deposited into our contract
// - when someone lends: their NFT deposited into our contract
// - when someone unsafely deposits: we revert their txn
// - when someone lends: if ERC721 we call transferFrom, if ERC1155 we call safeTransferFrom
// - when someone batch lends use appropriate ERC1155 function

// - fork off the mainnet to test the ChiGasSaver

describe('RentNft', function () {
  context('Lending', async function () {
    it('lends', async function () {
      const {RentNft, ERC721, deployer } = await setup();
      const tokenId = 1;
      const txn = await RentNft.lend(
        [ERC721.address],
        [tokenId],
        [MAX_RENT_DURATION],
        [DAILY_RENT_PRICE],
        [NFT_PRICE],
        [PAYMENT_TOKEN],
        GAS_SPONSOR
      );
      const receipt = await txn.wait();
      const e = getEvent(receipt.events ?? [], "Lent");
      if (!e || !e?.args) throw new Error("Lent event not emitted");
      const {
        nftAddress,
        tokenId: _tokenId,
        lendingId,
        lenderAddress,
        maxRentDuration,
        dailyRentPrice,
        nftPrice,
        paymentToken
      } = e.args;
      expect(nftAddress).to.eq(ERC721.address);
      expect(_tokenId).to.eq(tokenId);
      expect(lendingId).to.eq(LendingId);
      expect(lenderAddress).to.eq(deployer);
      expect(maxRentDuration).to.eq(MAX_RENT_DURATION);
      expect(dailyRentPrice).to.eq(DAILY_RENT_PRICE);
      expect(nftPrice).to.eq(NFT_PRICE);
      expect(paymentToken).to.eq(PAYMENT_TOKEN);
      const newNftOwner = await ERC721.ownerOf(tokenId);
      expect(newNftOwner).to.eq(RentNft.address);
    });
  });

  // address indexed nftAddress,
  // uint256 indexed tokenId,
  // uint256 lendingId,
  // address indexed lenderAddress,
  // uint16 maxRentDuration,
  // uint32 dailyRentPrice,
  // uint32 nftPrice,
  // Resolver.PaymentToken paymentToken

  // describe('Renting', async function () {});
  // describe('Returning', async function () {});
  // describe('Collateral Claiming', async function () {});
  // it('calling it directly without pre-approval result in Allowance error', async function () {
  //   const {ERC20Consumer} = await setup();
  //   await expect(ERC20Consumer.purchase(1)).to.be.revertedWith(
  //     'NOT_ENOUGH_ALLOWANCE'
  //   );
  // });
  // it('calling it via erc20transfer gateway works', async function () {
  //   const {ERC20Consumer, ERC20TransferGateway, ERC20Token} = await setup();
  //   const {data, to} = await ERC20Consumer.populateTransaction.purchase(1);
  //   await ERC20TransferGateway.transferERC20AndCall(
  //     ERC20Token.address,
  //     '500000000000000000',
  //     to,
  //     data
  //   );
  // });
  // it('calling it via erc20transfer gateway but with wrong amount fails', async function () {
  //   const {ERC20Consumer, ERC20TransferGateway, ERC20Token} = await setup();
  //   const {data, to} = await ERC20Consumer.populateTransaction.purchase(1);
  //   await expect(
  //     ERC20TransferGateway.transferERC20AndCall(
  //       ERC20Token.address,
  //       '400000000000000000',
  //       to,
  //       data
  //     )
  //   ).to.be.revertedWith('UNEXPECTED_AMOUNT');
  // });
});
