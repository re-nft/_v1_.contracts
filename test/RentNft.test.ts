import {expect} from './chai-setup';
import {ethers, deployments, getNamedAccounts} from 'hardhat';
import {Event} from '@ethersproject/contracts/lib';
import {RentNft as RentNftT} from '../typechain/RentNft';
import {Resolver as ResolverT} from '../typechain/Resolver';
import {ERC20 as ERC20T} from '../typechain/ERC20';
import {MyERC721 as ERC721T} from '../typechain/MyERC721';
import {BitsBobs as BitsBobsT} from '../typechain/BitsBobs';

// default values
const MAX_RENT_DURATION = 1;
const DAILY_RENT_PRICE = 2;
const NFT_PRICE = 3;
const PAYMENT_TOKEN = 2;
const GAS_SPONSOR = ethers.constants.AddressZero;

const getEvents = (events: Event[], name: string) => {
  return events.filter((e) => e?.event?.toLowerCase() === name.toLowerCase());
};

const setup = deployments.createFixture(async () => {
  await deployments.fixture('Resolver');
  await deployments.fixture('ERC20');
  await deployments.fixture('ERC721');
  await deployments.fixture('RentNft');
  await deployments.fixture('BitsBobs');
  const {deployer, beneficiary} = await getNamedAccounts();
  const signers = await ethers.getSigners();
  const resolver = (await ethers.getContract('Resolver')) as ResolverT;
  const myERC20 = (await ethers.getContract('MyERC20')) as ERC20T;
  const myERC721 = (await ethers.getContract('MyERC721')) as ERC721T;
  const bitsBobs = (await ethers.getContract('BitsBobs')) as BitsBobsT;
  const renft = (await ethers.getContract('RentNft')) as RentNftT;
  await resolver.setPaymentToken(PAYMENT_TOKEN, myERC20.address);
  // * Ramda.repeat(await myERC721.award(), 10) does not work like I expected
  // * const award = Ramda.repeat(myERC721.award(), 10); await Promise.all(award) doesn't either
  for (let i = 0; i < 10; i++) {
    await myERC721.award();
  }
  await myERC721.setApprovalForAll(renft.address, true);
  return {
    Resolver: resolver,
    RentNft: renft,
    ERC20: myERC20,
    ERC721: myERC721,
    BitsBobs: bitsBobs,
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
    type lendBatchArgs = {
      tokenIds: number[];
      maxRentDurations?: number[];
      dailyRentPrices?: number[];
      nftPrices?: number[];
      expectedLendingIds?: number[];
    };
    let RentNft: RentNftT;
    let ERC721: ERC721T;
    let deployer: string;
    const lendBatch = async ({
      tokenIds,
      maxRentDurations = [],
      dailyRentPrices = [],
      nftPrices = [],
      expectedLendingIds = [],
    }: lendBatchArgs) => {
      let _maxRentDurations = maxRentDurations;
      let _dailyRentPrices = dailyRentPrices;
      let _nftPrices = nftPrices;
      let _expectedLendingIds = expectedLendingIds;
      if (maxRentDurations.length === 0) {
        _maxRentDurations = Array(tokenIds.length).fill(MAX_RENT_DURATION);
      }
      if (dailyRentPrices.length === 0) {
        _dailyRentPrices = Array(tokenIds.length).fill(DAILY_RENT_PRICE);
      }
      if (nftPrices.length === 0) {
        _nftPrices = Array(tokenIds.length).fill(NFT_PRICE);
      }
      if (expectedLendingIds.length === 0) {
        _expectedLendingIds = tokenIds.map((v, ix) => ix + 1);
      }
      const txn = await RentNft.lend(
        Array(tokenIds.length).fill(ERC721.address),
        tokenIds,
        _maxRentDurations,
        _dailyRentPrices,
        _nftPrices,
        Array(tokenIds.length).fill(PAYMENT_TOKEN),
        GAS_SPONSOR
      );
      const receipt = await txn.wait();
      const e = getEvents(receipt.events ?? [], 'Lent');
      expect(e.length).to.eq(tokenIds.length);
      for (let i = 0; i < tokenIds.length; i++) {
        const event = e[i].args;
        if (!event) throw new Error('No args');
        const {
          nftAddress,
          tokenId: _tokenId,
          lendingId,
          lenderAddress,
          maxRentDuration,
          dailyRentPrice,
          nftPrice,
          paymentToken,
        } = event;
        expect(nftAddress).to.eq(ERC721.address);
        expect(_tokenId).to.eq(tokenIds[i]);
        expect(lendingId).to.eq(_expectedLendingIds[i]);
        expect(lenderAddress).to.eq(deployer);
        expect(maxRentDuration).to.eq(MAX_RENT_DURATION);
        expect(dailyRentPrice).to.eq(DAILY_RENT_PRICE);
        expect(nftPrice).to.eq(NFT_PRICE);
        expect(paymentToken).to.eq(PAYMENT_TOKEN);
        const newNftOwner = await ERC721.ownerOf(tokenIds[i]);
        expect(newNftOwner).to.eq(RentNft.address);
      }
    };
    beforeEach(async () => {
      const setupObj = await setup();
      RentNft = setupObj.RentNft;
      ERC721 = setupObj.ERC721;
      deployer = setupObj.deployer;
    });
    it('lends one', async function () {
      const tokenIds = [1];
      await lendBatch({tokenIds});
    });
    it('lends two - one after another', async function () {
      const tokenIds = [1, 2];
      await lendBatch({tokenIds: [tokenIds[0]], expectedLendingIds: [1]});
      await lendBatch({tokenIds: [tokenIds[1]], expectedLendingIds: [2]});
    });
    it('lends in a batch', async function () {
      const tokenIds = [1, 2];
      await lendBatch({tokenIds});
    });
    it('reverts if tries to lend again', async function () {
      const tokenIds = [1];
      await lendBatch({tokenIds});
      await expect(lendBatch({tokenIds})).to.be.revertedWith(
        'ERC721: transfer of token that is not own'
      );
    });
    it('disallows zero day lend', async () => {
      const tokenIds = [1];
      await expect(
        lendBatch({tokenIds, maxRentDurations: [0]})
      ).to.be.revertedWith('must be at least one day lend');
    });
    it('disallows args diff length', async () => {
      const tokenIds = [1];
      const longerThanTokenIds = [1, 2];
      await expect(
        lendBatch({tokenIds, maxRentDurations: longerThanTokenIds})
      ).to.be.revertedWith('arg arrs diff length');
    });
  });
  context('Price Unpacking', async function () {
    let Unpacker: BitsBobsT;

    it('unpacks well', async () => {});
  });
  context('Renting', async function () {
    let RentNft: RentNftT;
    let ERC721: ERC721T;
    let deployer: string;
    beforeEach(async () => {
      const setupObj = await setup();
      RentNft = setupObj.RentNft;
      ERC721 = setupObj.ERC721;
      deployer = setupObj.deployer;
    });
  });
  context('Returning', async function () {});
  context('Collateral Claiming', async function () {});
});
