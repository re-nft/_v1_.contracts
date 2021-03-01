import { expect } from './chai-setup';
import { ethers, deployments, getNamedAccounts } from 'hardhat';
import { RentNft as RentNftT } from '../frontend/src/hardhat/typechain/RentNft';
import { Resolver as ResolverT } from '../frontend/src/hardhat/typechain/Resolver';
import { ERC20 as ERC20T } from '../frontend/src/hardhat/typechain/ERC20';
import { MyERC721 as ERC721T } from '../frontend/src/hardhat/typechain/MyERC721';
import { MyERC1155 as ERC1155T } from '../frontend/src/hardhat/typechain/MyERC1155';
import { Utils as UtilsT } from '../frontend/src/hardhat/typechain/Utils';
import { BigNumber } from 'ethers';
import { Event } from '@ethersproject/contracts/lib';

import {
  unpackPrice,
  packPrice,
  getBalance,
  takeFee,
  getEvents,
  advanceTime,
  getLatestBlock,
  getErc20Balance,
  decimalToPaddedHexString,
} from './utils';

// default values
const MAX_RENT_DURATION = 1; // 1 day
const DAILY_RENT_PRICE = 2; // 2 full tokens or 2 ETH
const NFT_PRICE = 3; // 3 full tokens or 3 ETH
const PAYMENT_TOKEN = 2; // default token is DAI (our ERC20)

const SECONDS_IN_A_DAY = 86400;
const DP18 = ethers.utils.parseEther('1');
const ERC20_SEND_AMT = ethers.utils.parseEther('100');

const setup = deployments.createFixture(async () => {
  await deployments.fixture('Resolver');
  await deployments.fixture('ERC20');
  await deployments.fixture('ERC721');
  await deployments.fixture('ERC1155');
  await deployments.fixture('RentNft');
  await deployments.fixture('Utils');
  const { deployer, beneficiary, renter, lender } = await getNamedAccounts();

  const signers = await ethers.getSigners();

  const resolver = ((await ethers.getContract(
    'Resolver'
  )) as unknown) as ResolverT;

  const myERC20 = ((await ethers.getContract('MyERC20')) as unknown) as ERC20T;

  const myERC721 = ((await ethers.getContract(
    'MyERC721'
  )) as unknown) as ERC721T;

  const myERC1155 = ((await ethers.getContract(
    'MyERC1155'
  )) as unknown) as ERC1155T;

  const utils = ((await ethers.getContract('Utils')) as unknown) as UtilsT;

  const renft = ((await ethers.getContract('RentNft')) as unknown) as RentNftT;
  await resolver.setPaymentToken(PAYMENT_TOKEN, myERC20.address);

  await myERC20.transfer(renter, ERC20_SEND_AMT);
  await myERC20.transfer(lender, ERC20_SEND_AMT);

  const renftRenter = ((await ethers.getContract(
    'RentNft',
    renter
  )) as unknown) as RentNftT;
  const renftLender = ((await ethers.getContract(
    'RentNft',
    lender
  )) as unknown) as RentNftT;
  const myERC20Renter = ((await ethers.getContract(
    'MyERC20',
    renter
  )) as unknown) as ERC20T;
  const myERC20Lender = ((await ethers.getContract(
    'MyERC20',
    lender
  )) as unknown) as ERC20T;
  const myERC721Renter = ((await ethers.getContract(
    'MyERC721',
    renter
  )) as unknown) as ERC721T;
  const myERC721Lender = ((await ethers.getContract(
    'MyERC721',
    lender
  )) as unknown) as ERC721T;
  const myERC1155Renter = ((await ethers.getContract(
    'MyERC1155',
    renter
  )) as unknown) as ERC1155T;
  const myERC1155Lender = ((await ethers.getContract(
    'MyERC1155',
    lender
  )) as unknown) as ERC1155T;
  await myERC20Renter.approve(renft.address, ethers.constants.MaxUint256);
  await myERC20Lender.approve(renft.address, ethers.constants.MaxUint256);
  await myERC721Renter.setApprovalForAll(renft.address, true);
  await myERC721Lender.setApprovalForAll(renft.address, true);
  await myERC1155Renter.setApprovalForAll(renft.address, true);
  await myERC1155Lender.setApprovalForAll(renft.address, true);

  // * Ramda.repeat(await myERC721.award(), 10) does not work like I expected
  // * const award = Ramda.repeat(myERC721.award(), 10); await Promise.all(award) doesn't either
  for (let i = 0; i < 10; i++) {
    await myERC721Lender.award();
    await myERC1155Lender.award();
  }
  await myERC721.setApprovalForAll(renft.address, true);
  await myERC1155.setApprovalForAll(renft.address, true);
  return {
    Resolver: resolver,
    RentNft: renft,
    ERC20: myERC20,
    ERC721: myERC721,
    ERC1155: myERC1155,
    Utils: utils,
    signers,
    deployer,
    beneficiary,
    renter: {
      address: renter,
      erc20: myERC20Renter,
      erc721: myERC721Renter,
      erc1155: myERC1155Renter,
      renft: renftRenter,
    },
    lender: {
      address: lender,
      erc20: myERC20Lender,
      erc721: myERC721Lender,
      erc1155: myERC1155Lender,
      renft: renftLender,
    },
  };
});

// all the below share the following
// NFT(s) is(are) taken from the lender and deposited into our contract
// - when someone lends: their NFT deposited into our contract
// - when someone unsafely deposits: we revert their txn
// - when someone lends: if ERC721 we call transferFrom, if ERC1155 we call safeTransferFrom
// - when someone batch lends use appropriate ERC1155 function

type lendBatchArgs = {
  tokenIds: number[];
  maxRentDurations?: number[];
  dailyRentPrices?: string[];
  nftPrices?: string[];
  expectedLendingIds?: number[];
};

describe('RentNft', function () {
  context('Lending', async function () {
    let RentNft: RentNftT;
    let ERC721: ERC721T;
    let ERC1155: ERC1155T;
    type NamedAccount = {
      address: string;
      renft: RentNftT;
      erc20: ERC20T;
      erc721: ERC721T;
    };
    let lender: NamedAccount;

    beforeEach(async () => {
      const o = await setup();
      RentNft = o.lender.renft;
      ERC721 = o.lender.erc721;
      ERC1155 = o.lender.erc1155;
      lender = o.lender;
    });

    const lendBatch = async ({
      tokenIds,
      maxRentDurations = [],
      dailyRentPrices = [],
      nftPrices = [],
      expectedLendingIds = [],
      nftAddresses = Array(tokenIds.length).fill(ERC721.address),
    }: lendBatchArgs & {
      nftAddresses?: string[];
    }) => {
      let _maxRentDurations = maxRentDurations;
      let _dailyRentPrices = dailyRentPrices;
      let _nftPrices = nftPrices;
      let _expectedLendingIds = expectedLendingIds;
      if (maxRentDurations.length === 0) {
        _maxRentDurations = Array(tokenIds.length).fill(MAX_RENT_DURATION);
      }
      if (dailyRentPrices.length === 0) {
        _dailyRentPrices = Array(tokenIds.length)
          .fill(DAILY_RENT_PRICE)
          .map((x) => decimalToPaddedHexString(x, 32));
      }
      if (nftPrices.length === 0) {
        _nftPrices = Array(tokenIds.length)
          .fill(NFT_PRICE)
          .map((x) => decimalToPaddedHexString(x, 32));
      }
      if (expectedLendingIds.length === 0) {
        _expectedLendingIds = tokenIds.map((_, ix) => ix + 1);
      }

      const txn = await RentNft.lend(
        nftAddresses,
        tokenIds,
        _maxRentDurations,
        _dailyRentPrices,
        _nftPrices,
        Array(tokenIds.length).fill(PAYMENT_TOKEN)
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
        expect(nftAddress).to.eq(nftAddresses[i]);
        expect(_tokenId).to.eq(tokenIds[i]);
        expect(lendingId).to.eq(_expectedLendingIds[i]);
        expect(lenderAddress).to.eq(lender.address);
        expect(maxRentDuration).to.eq(MAX_RENT_DURATION);
        expect(dailyRentPrice).to.eq(
          decimalToPaddedHexString(DAILY_RENT_PRICE, 32)
        );
        expect(nftPrice).to.eq(decimalToPaddedHexString(NFT_PRICE, 32));
        expect(paymentToken).to.eq(PAYMENT_TOKEN);
        try {
          const balance = await ERC1155.balanceOf(RentNft.address, tokenIds[i]);
          expect(balance).to.eq(1);
        } catch (e) {
          const newNftOwner = await ERC721.ownerOf(tokenIds[i]);
          expect(newNftOwner).to.eq(RentNft.address);
        }
      }
    };

    it('lends one - ERC721', async function () {
      const tokenIds = [1];
      await lendBatch({ tokenIds });
    });

    it('lends one - ERC1155', async function () {
      const tokenIds = [1];
      await lendBatch({
        tokenIds,
        nftAddresses: [ERC1155.address],
      });
    });

    it('lends one - ERC1155 - multiple amounts', async function () {
      const tokenIds = [1];
      await lendBatch({
        tokenIds,
        nftAddresses: [ERC1155.address],
      });
    });

    it('lends two - one after another - ERC721', async function () {
      const tokenIds = [1, 2];
      await lendBatch({ tokenIds: [tokenIds[0]], expectedLendingIds: [1] });
      await lendBatch({ tokenIds: [tokenIds[1]], expectedLendingIds: [2] });
    });

    it('lends two - one after another - ERC1155', async function () {
      const tokenIds = [1, 2];
      await lendBatch({
        tokenIds: [tokenIds[0]],
        expectedLendingIds: [1],
        nftAddresses: [ERC1155.address],
      });
      await lendBatch({
        tokenIds: [tokenIds[1]],
        expectedLendingIds: [2],
        nftAddresses: [ERC1155.address],
      });
    });

    it('lends in a batch - ERC721', async function () {
      const tokenIds = [1, 2];
      await lendBatch({ tokenIds });
    });

    it('lends in a batch - ERC1155', async function () {
      const tokenIds = [1, 2];
      await lendBatch({
        tokenIds,
        nftAddresses: [ERC1155.address, ERC1155.address],
      });
    });

    it('reverts if tries to lend again - ERC721', async function () {
      const tokenIds = [1];
      await lendBatch({ tokenIds });
      await expect(lendBatch({ tokenIds })).to.be.revertedWith(
        'ERC721: transfer of token that is not own'
      );
    });

    it('reverts if tries to lend again - ERC1155', async function () {
      const tokenIds = [1];
      await lendBatch({
        tokenIds,
        nftAddresses: [ERC1155.address],
      });
      await expect(
        lendBatch({
          tokenIds,
          nftAddresses: [ERC1155.address],
        })
      ).to.be.revertedWith('ERC1155: insufficient balance for transfer');
    });

    it('disallows zero day lend - ERC721', async () => {
      const tokenIds = [1];
      await expect(
        lendBatch({ tokenIds, maxRentDurations: [0] })
      ).to.be.revertedWith('must be at least one day lend');
    });

    it('disallows args diff length - ERC721', async () => {
      const tokenIds = [1];
      const longerThanTokenIds = [1, 2];
      await expect(
        lendBatch({ tokenIds, maxRentDurations: longerThanTokenIds })
      ).to.be.revertedWith('arg arrs diff length');
    });

    it('disallows zero day lend - ERC1155', async () => {
      const tokenIds = [1];
      await expect(
        lendBatch({
          tokenIds,
          maxRentDurations: [0],
          nftAddresses: [ERC1155.address],
        })
      ).to.be.revertedWith('must be at least one day lend');
    });

    it('disallows args diff length - ERC1155', async () => {
      const tokenIds = [1];
      const longerThanTokenIds = [1, 2];
      await expect(
        lendBatch({
          tokenIds,
          maxRentDurations: longerThanTokenIds,
          nftAddresses: [ERC1155.address],
        })
      ).to.be.revertedWith('arg arrs diff length');
    });
  });

  context('Price Unpacking', async function () {
    let Utils: UtilsT;

    beforeEach(async () => {
      const o = await setup();
      Utils = o.Utils;
    });

    it('unpacks valid number', async () => {
      const price = '0x00010001';
      const unpacked = await Utils._unpackPrice(price, DP18);
      expect(unpacked).to.be.equal(ethers.utils.parseEther('1.0001'));
    });

    it('unpacks zero into 0.0001', async () => {
      const price = '0x00000000';
      const unpacked = await Utils._unpackPrice(price, DP18);
      expect(unpacked).to.be.equal(ethers.utils.parseEther('0.0001'));
    });

    it('unpacks max correctly', async () => {
      const price = '0xffffffff';
      const unpacked = await Utils._unpackPrice(price, DP18);
      expect(unpacked).to.be.equal(ethers.utils.parseEther('9999.9999'));
    });

    it('unpacks 0.0001 correctly', async () => {
      const price = '0x00000001';
      const unpacked = await Utils._unpackPrice(price, DP18);
      expect(unpacked).to.be.equal(ethers.utils.parseEther('0.0001'));
    });

    it('unpacks DP12 corrctly', async () => {
      const price = '0x00020003';
      const unpacked = await Utils._unpackPrice(
        price,
        ethers.utils.parseUnits('1', 'szabo')
      );
      expect(unpacked).to.be.equal(ethers.utils.parseUnits('2.0003', 'szabo'));
    });
  });

  context('Renting', async function () {
    let RentNft: RentNftT;
    let ERC721: ERC721T;
    let ERC20: ERC20T;
    type NamedAccount = {
      address: string;
      renft: RentNftT;
      erc20: ERC20T;
      erc721: ERC721T;
    };
    let lender: NamedAccount;
    let renter: NamedAccount;

    beforeEach(async () => {
      const o = await setup();
      lender = o.lender;
      renter = o.renter;
      RentNft = renter.renft;
      ERC721 = renter.erc721;
      ERC20 = renter.erc20;
    });

    const lendBatch = async ({
      tokenIds,
      paymentTokens,
      maxRentDurations = [],
      dailyRentPrices = [],
      nftPrices = [],
    }: lendBatchArgs & { paymentTokens: number[] }) => {
      let _maxRentDurations = maxRentDurations;
      let _dailyRentPrices = dailyRentPrices;
      let _nftPrices = nftPrices;
      if (maxRentDurations.length === 0) {
        _maxRentDurations = Array(tokenIds.length).fill(MAX_RENT_DURATION);
      }
      if (dailyRentPrices.length === 0) {
        _dailyRentPrices = Array(tokenIds.length)
          .fill(DAILY_RENT_PRICE)
          .map((x) => decimalToPaddedHexString(x, 32));
      }
      if (nftPrices.length === 0) {
        _nftPrices = Array(tokenIds.length)
          .fill(NFT_PRICE)
          .map((x) => decimalToPaddedHexString(x, 32));
      }
      await lender.renft.lend(
        Array(tokenIds.length).fill(ERC721.address),
        tokenIds,
        _maxRentDurations,
        _dailyRentPrices,
        _nftPrices,
        paymentTokens
      );
    };

    const validateRented = ({
      nftAddress,
      tokenId,
      lendingId,
      renterAddress,
      rentDuration,
      rentedAt,
      events,
    }: {
      nftAddress: string[];
      tokenId: number[];
      lendingId: number[];
      renterAddress: string[];
      rentDuration: number[];
      rentedAt: number[];
      events: Event[];
    }) => {
      const es = getEvents(events, 'Rented');
      for (let i = 0; i < es.length; i++) {
        const event = es[i].args;
        if (!event) throw new Error('no args');
        const {
          nftAddress: _nftAddress,
          tokenId: _tokenId,
          lendingId: _lendingId,
          renterAddress: _renterAddress,
          rentDuration: _rentDuration,
          rentedAt: _rentedAt,
        } = event;
        expect(_nftAddress).to.be.equal(nftAddress[i]);
        expect(_tokenId).to.be.equal(tokenId[i]);
        expect(_lendingId).to.be.equal(lendingId[i]);
        expect(_renterAddress).to.be.equal(renterAddress[i]);
        expect(_rentDuration).to.be.equal(rentDuration[i]);
        expect(_rentedAt).to.be.equal(rentedAt[i]);
      }
    };

    it('rents ok - one eth', async () => {
      const tokenIds = [1];
      const eth = 1;
      await lendBatch({
        tokenIds,
        paymentTokens: [eth],
        maxRentDurations: [3],
      });
      const nftAddress = [ERC721.address];
      const tokenId = [1];
      const lendingId = [1];
      const rentDuration = [2];
      const dudeBalancePre = await getBalance(renter.address);
      const renftBalancePre = await getBalance(RentNft.address);
      expect(renftBalancePre).to.be.equal(0);
      const pmtAmount = unpackPrice(NFT_PRICE, DP18).add(
        BigNumber.from(rentDuration[0]).mul(unpackPrice(DAILY_RENT_PRICE, DP18))
      );
      const tx = await RentNft.rent(
        nftAddress,  const numHex = decimalToPaddedHexString(Number(price), PRICE_BITSIZE).slice(
          2
        );
      const dudeBalancePost = await getBalance(renter.address);
      const renftBalancePost = await getBalance(RentNft.address);
      expect(renftBalancePost).to.be.equal(pmtAmount);
      const receipt = await tx.wait();
      expect(
        dudeBalancePre.sub(receipt.gasUsed.mul(tx.gasPrice)).sub(pmtAmount)
      ).to.be.equal(dudeBalancePost);
      const rentedAt = [(await getLatestBlock()).timestamp];
      const events = receipt.events ?? [];
      validateRented({
        nftAddress,
        tokenId,
        lendingId,
        renterAddress: [renter.address],
        rentDuration,
        rentedAt,
        events,
      });
    });

    it('does not rent when insufficient money sent - eth', async () => {
      const tokenIds = [1];
      const eth = 1;
      await lendBatch({
        tokenIds,
        paymentTokens: [eth],
        maxRentDurations: [3],
      });
      const nftAddress = [ERC721.address];
      const tokenId = [1];
      const lendingId = [1];
      const rentDuration = [2];
      await expect(
        RentNft.rent(nftAddress, tokenId, lendingId, rentDuration, {
          value: 0,
        })
      ).to.be.revertedWith('insufficient amount');
    });

    it('rents ok - one erc20', async () => {
      const tokenIds = [1];
      const erc20 = 2;
      await lendBatch({
        tokenIds,
        paymentTokens: [erc20],
        maxRentDurations: [10],
      });
      const nftAddress = [ERC721.address];
      const lendingId = [1];
      const rentDuration = [2];
      const dudeBalancePre = await getErc20Balance(
        renter.erc20,
        renter.address
      );
      expect(dudeBalancePre).to.be.equal(ERC20_SEND_AMT);
      const renftBalancePre = await ERC20.balanceOf(RentNft.address);
      expect(renftBalancePre).to.be.equal(0);
      const pmtAmount = unpackPrice(NFT_PRICE, DP18).add(
        BigNumber.from(rentDuration[0]).mul(unpackPrice(DAILY_RENT_PRICE, DP18))
      );
      const tx = await RentNft.rent(
        nftAddress,
        tokenIds,
        lendingId,
        rentDuration
      );
      const receipt = await tx.wait();
      const dudeBalancePost = await ERC20.balanceOf(renter.address);
      const renftBalancePost = await ERC20.balanceOf(RentNft.address);
      expect(renftBalancePost).to.be.equal(pmtAmount);
      expect(dudeBalancePre.sub(pmtAmount)).to.be.equal(dudeBalancePost);
      const rentedAt = [(await getLatestBlock()).timestamp];
      const events = receipt.events ?? [];
      validateRented({
        nftAddress,
        tokenId: tokenIds,
        lendingId,
        renterAddress: [renter.address],
        rentDuration,
        rentedAt,
        events,
      });
    });

    it('does not rent when insufficient money sent - erc20', async () => {
      const tokenIds = [1];
      const erc20 = 2;
      await lendBatch({
        tokenIds,
        paymentTokens: [erc20],
        maxRentDurations: [3],
      });
      const nftAddress = [ERC721.address];
      const tokenId = [1];
      const lendingId = [1];
      const rentDuration = [2];
      await renter.erc20.transfer(lender.address, ERC20_SEND_AMT);
      await expect(
        RentNft.rent(nftAddress, tokenId, lendingId, rentDuration)
      ).to.be.revertedWith('transfer amount exceeds balance');
    });

    it('rents ok - one eth & one erc20', async () => {
      const tokenIds = [1, 2];
      const paymentTokens = [1, 2];
      await lendBatch({
        tokenIds,
        paymentTokens,
        maxRentDurations: [10, 5],
      });
      const nftAddress = Array(2).fill(ERC721.address);
      const lendingId = [1, 2];
      const rentDuration = [2, 5];
      const renterBalancePreERC20 = await getErc20Balance(
        renter.erc20,
        renter.address
      );
      expect(renterBalancePreERC20).to.be.equal(ERC20_SEND_AMT);
      const renftBalancePreERC20 = await ERC20.balanceOf(RentNft.address);
      expect(renftBalancePreERC20).to.be.equal(0);
      const dudeBalancePre = await getBalance(renter.address);
      const renftBalancePre = await getBalance(RentNft.address);
      const pmtAmounts = [
        unpackPrice(NFT_PRICE, DP18).add(
          BigNumber.from(rentDuration[0]).mul(
            unpackPrice(DAILY_RENT_PRICE, DP18)
          )
        ),
        unpackPrice(NFT_PRICE, DP18).add(
          BigNumber.from(rentDuration[1]).mul(
            unpackPrice(DAILY_RENT_PRICE, DP18)
          )
        ),
      ];
      const tx = await RentNft.rent(
        nftAddress,
        tokenIds,
        lendingId,
        rentDuration,
        {
          value: pmtAmounts[0],
        }
      );
      const receipt = await tx.wait();
      const renterBalancePostERC20 = await getErc20Balance(
        renter.erc20,
        renter.address
      );
      const renftBalancePostERC20 = await getErc20Balance(
        renter.erc20,
        RentNft.address
      );
      expect(renftBalancePostERC20).to.be.equal(pmtAmounts[1]);
      expect(renterBalancePreERC20.sub(pmtAmounts[1])).to.be.equal(
        renterBalancePostERC20
      );
      const renterBalancePost = await getBalance(renter.address);
      const renftBalancePost = await getBalance(RentNft.address);
      expect(
        dudeBalancePre
          .sub(tx.gasPrice.mul(receipt.gasUsed))
          .sub(renterBalancePost)
      ).to.be.equal(pmtAmounts[0]);
      expect(renftBalancePost.sub(renftBalancePre)).to.be.equal(pmtAmounts[0]);
      const rentedAt = Array(2).fill((await getLatestBlock()).timestamp);
      const events = receipt.events ?? [];
      validateRented({
        nftAddress,
        tokenId: tokenIds,
        lendingId,
        renterAddress: [renter.address, renter.address],
        rentDuration,
        rentedAt,
        events,
      });
    });

    it('does not rent when insufficient money sent - one eth & one erc20 - eth', async () => {
      const tokenIds = [1, 2];
      const paymentTokens = [1, 2];
      await lendBatch({
        tokenIds,
        paymentTokens,
        maxRentDurations: [10, 5],
      });
      const nftAddress = Array(2).fill(ERC721.address);
      const lendingId = [1, 2];
      const rentDuration = [2, 5];
      const renterBalancePreERC20 = await ERC20.balanceOf(renter.address);
      expect(renterBalancePreERC20).to.be.equal(ERC20_SEND_AMT);
      const renftBalancePreERC20 = await ERC20.balanceOf(RentNft.address);
      expect(renftBalancePreERC20).to.be.equal(0);
      const tx = RentNft.rent(nftAddress, tokenIds, lendingId, rentDuration, {
        value: 0,
      });
      await expect(tx).to.be.revertedWith('insufficient amount');
    });

    it('does not rent when insufficient money sent - one eth & one erc20 - erc20', async () => {
      const tokenIds = [1, 2];
      const paymentTokens = [1, 2];
      await lendBatch({
        tokenIds,
        paymentTokens,
        maxRentDurations: [3, 1],
      });
      const nftAddress = [ERC721.address, ERC721.address];
      const lendingId = [1, 2];
      const rentDuration = [2, 1];
      const renterBalancePre = await getBalance(renter.address);
      const renftBalancePre = await getBalance(RentNft.address);
      const pmtAmounts = [
        unpackPrice(NFT_PRICE, DP18).add(
          BigNumber.from(rentDuration[0]).mul(
            unpackPrice(DAILY_RENT_PRICE, DP18)
          )
        ),
        unpackPrice(NFT_PRICE, DP18).add(
          BigNumber.from(rentDuration[1]).mul(
            unpackPrice(DAILY_RENT_PRICE, DP18)
          )
        ),
      ];
      const tx = await renter.erc20.transfer(lender.address, ERC20_SEND_AMT);
      const receipt = await tx.wait();
      const txGasCost = tx.gasPrice.mul(receipt.gasUsed);
      // even though we are sending ether along, it will not be
      // deposited because the second part of the transaction i.e. erc20
      // will be reverted
      await expect(
        RentNft.rent(nftAddress, tokenIds, lendingId, rentDuration, {
          value: pmtAmounts[0],
        })
      ).to.be.revertedWith('transfer amount exceeds balance');
      const dudeBalancePost = await getBalance(renter.address);
      const renftBalancePost = await getBalance(RentNft.address);
      const latestBlock = await getLatestBlock();
      const failedTxnHash = latestBlock.transactions[0];
      const failedTxn = await ethers.provider.getTransaction(failedTxnHash);
      const failedTxnReceipt = await ethers.provider.getTransactionReceipt(
        failedTxnHash
      );
      expect(
        renterBalancePre
          .sub(failedTxn.gasPrice.mul(failedTxnReceipt.gasUsed))
          .sub(txGasCost)
      ).to.be.equal(dudeBalancePost);
      expect(renftBalancePost.sub(renftBalancePre)).to.be.equal(0);
    });

    it('rents ok - two eth', async () => {
      const tokenIds = [1, 2];
      const eth = 1;
      await lendBatch({
        tokenIds,
        paymentTokens: [eth, eth],
        maxRentDurations: [3, 2],
      });
      const nftAddress = [ERC721.address, ERC721.address];
      const tokenId = [1, 2];
      const lendingId = [1, 2];
      const rentDuration = [2, 1];
      const dudeBalancePre = await getBalance(renter.address);
      const renftBalancePre = await getBalance(RentNft.address);
      expect(renftBalancePre).to.be.equal(0);
      const pmtAmounts = [
        unpackPrice(NFT_PRICE, DP18).add(
          BigNumber.from(rentDuration[0]).mul(
            unpackPrice(DAILY_RENT_PRICE, DP18)
          )
        ),
        unpackPrice(NFT_PRICE, DP18).add(
          BigNumber.from(rentDuration[1]).mul(
            unpackPrice(DAILY_RENT_PRICE, DP18)
          )
        ),
      ];
      const tx = await RentNft.rent(
        nftAddress,
        tokenId,
        lendingId,
        rentDuration,
        { value: pmtAmounts[0].add(pmtAmounts[1]) }
      );
      const renterBalancePost = await getBalance(renter.address);
      const renftBalancePost = await getBalance(RentNft.address);
      expect(renftBalancePost).to.be.equal(pmtAmounts[0].add(pmtAmounts[1]));
      const receipt = await tx.wait();
      expect(
        dudeBalancePre
          .sub(receipt.gasUsed.mul(tx.gasPrice))
          .sub(pmtAmounts[0].add(pmtAmounts[1]))
      ).to.be.equal(renterBalancePost);
      const rentedAt = Array(2).fill((await getLatestBlock()).timestamp);
      const events = receipt.events ?? [];
      validateRented({
        nftAddress,
        tokenId,
        lendingId,
        renterAddress: [renter.address, renter.address],
        rentDuration,
        rentedAt,
        events,
      });
    });

    it('rents ok - two erc20', async () => {
      const tokenIds = [1, 2];
      const erc20 = 2;
      await lendBatch({
        tokenIds,
        paymentTokens: [erc20, erc20],
        maxRentDurations: [3, 2],
      });
      const nftAddress = [ERC721.address, ERC721.address];
      const tokenId = [1, 2];
      const lendingId = [1, 2];
      const rentDuration = [2, 1];
      let renterBalancePre = await renter.erc20.balanceOf(renter.address);
      const renftBalancePre = await renter.erc20.balanceOf(RentNft.address);
      expect(renterBalancePre).to.be.equal(ERC20_SEND_AMT);
      expect(renftBalancePre).to.be.equal(0);
      renterBalancePre = await renter.erc20.balanceOf(renter.address);
      expect(renterBalancePre).to.be.equal(ERC20_SEND_AMT);
      const pmtAmounts = [
        unpackPrice(NFT_PRICE, DP18).add(
          BigNumber.from(rentDuration[0]).mul(
            unpackPrice(DAILY_RENT_PRICE, DP18)
          )
        ),
        unpackPrice(NFT_PRICE, DP18).add(
          BigNumber.from(rentDuration[1]).mul(
            unpackPrice(DAILY_RENT_PRICE, DP18)
          )
        ),
      ];
      const tx = await RentNft.rent(
        nftAddress,
        tokenId,
        lendingId,
        rentDuration
      );
      const dudeBalancePost = await renter.erc20.balanceOf(renter.address);
      const renftBalancePost = await renter.erc20.balanceOf(RentNft.address);
      expect(renftBalancePost).to.be.equal(pmtAmounts[0].add(pmtAmounts[1]));
      const receipt = await tx.wait();
      expect(
        renterBalancePre.sub(pmtAmounts[0].add(pmtAmounts[1]))
      ).to.be.equal(dudeBalancePost);
      const rentedAt = Array(2).fill((await getLatestBlock()).timestamp);
      const events = receipt.events ?? [];
      validateRented({
        nftAddress,
        tokenId,
        lendingId,
        renterAddress: [renter.address, renter.address],
        rentDuration,
        rentedAt,
        events,
      });
    });

    it('does not rent - rent duration is zero', async () => {
      const tokenIds = [1];
      const erc20 = 2;
      await lendBatch({
        tokenIds,
        paymentTokens: [erc20],
        maxRentDurations: [3],
      });
      const nftAddress = [ERC721.address];
      const tokenId = [1];
      const lendingId = [1];
      const rentDuration = [0];
      await expect(
        RentNft.rent(nftAddress, tokenId, lendingId, rentDuration, {
          value: 0,
        })
      ).to.be.revertedWith('should rent for at least a day');
    });

    it('does not rent - rent duration exceeds max duration', async () => {
      const tokenIds = [1];
      const erc20 = 2;
      await lendBatch({
        tokenIds,
        paymentTokens: [erc20],
        maxRentDurations: [3],
      });
      const nftAddress = [ERC721.address];
      const tokenId = [1];
      const lendingId = [1];
      const rentDuration = [4];
      await expect(
        RentNft.rent(nftAddress, tokenId, lendingId, rentDuration, {
          value: 0,
        })
      ).to.be.revertedWith('max rent duration exceeded');
    });

    it('does not rent - already rented', async () => {
      const tokenIds = [1];
      const eth = 1;
      await lendBatch({
        tokenIds,
        paymentTokens: [eth],
        maxRentDurations: [3],
      });
      const nftAddress = [ERC721.address];
      const tokenId = [1];
      const lendingId = [1];
      const rentDuration = [1];
      const pmtAmount = unpackPrice(NFT_PRICE, DP18).add(
        BigNumber.from(rentDuration[0]).mul(unpackPrice(DAILY_RENT_PRICE, DP18))
      );
      RentNft.rent(nftAddress, tokenId, lendingId, rentDuration, {
        value: pmtAmount,
      });
      await expect(
        RentNft.rent(nftAddress, tokenId, lendingId, rentDuration, {
          value: pmtAmount,
        })
      ).to.be.revertedWith('1 already rented');
    });

    it('does not rent - you are lender', async () => {
      const tokenIds = [1];
      const eth = 1;
      const maxRentDurations = 3;
      const _dailyRentPrices = Array(tokenIds.length)
        .fill(DAILY_RENT_PRICE)
        .map((x) => decimalToPaddedHexString(x, 32));
      const _nftPrices = Array(tokenIds.length)
        .fill(NFT_PRICE)
        .map((x) => decimalToPaddedHexString(x, 32));
      await lender.renft.lend(
        Array(tokenIds.length).fill(ERC721.address),
        tokenIds,
        [maxRentDurations],
        _dailyRentPrices,
        _nftPrices,
        [eth]
      );
      const nftAddress = [ERC721.address];
      const tokenId = [1];
      const lendingId = [1];
      const rentDuration = [1];
      const pmtAmount = unpackPrice(NFT_PRICE, DP18).add(
        BigNumber.from(rentDuration[0]).mul(unpackPrice(DAILY_RENT_PRICE, DP18))
      );
      await expect(
        lender.renft.rent(nftAddress, tokenId, lendingId, rentDuration, {
          value: pmtAmount,
        })
      ).to.be.revertedWith('cant rent own nft');
    });
  });

  context('Returning', async function () {
    let rentFee: BigNumber;
    type NamedAccount = {
      address: string;
      erc20: ERC20T;
      erc721: ERC721T;
      renft: RentNftT;
    };
    let renter: NamedAccount;
    let lender: NamedAccount;

    beforeEach(async () => {
      const o = await setup();
      renter = o.renter;
      lender = o.lender;
      rentFee = await renter.renft.rentFee();
    });

    const lendBatch = async ({
      tokenIds,
      paymentTokens,
      maxRentDurations = [],
      dailyRentPrices = [],
      nftPrices = [],
    }: lendBatchArgs & { paymentTokens: number[] }) => {
      let _maxRentDurations = maxRentDurations;
      let _dailyRentPrices = dailyRentPrices;
      let _nftPrices = nftPrices;
      if (maxRentDurations.length === 0) {
        _maxRentDurations = Array(tokenIds.length).fill(MAX_RENT_DURATION);
      }
      if (dailyRentPrices.length === 0) {
        _dailyRentPrices = Array(tokenIds.length).fill(DAILY_RENT_PRICE);
      }
      if (nftPrices.length === 0) {
        _nftPrices = Array(tokenIds.length).fill(NFT_PRICE);
      }
      await lender.renft.lend(
        Array(tokenIds.length).fill(lender.erc721.address),
        tokenIds,
        _maxRentDurations,
        _dailyRentPrices,
        _nftPrices,
        paymentTokens
      );
    };

    const validateReturned = ({
      nftAddress,
      tokenId,
      lendingId,
      renterAddress,
      returnedAt,
      events,
    }: {
      nftAddress: string[];
      tokenId: number[];
      lendingId: number[];
      renterAddress: string[];
      returnedAt: number[];
      events: Event[];
    }) => {
      const es = getEvents(events, 'Rented');
      for (let i = 0; i < es.length; i++) {
        const event = es[i].args;
        if (!event) throw new Error('no args');
        const {
          nftAddress: _nftAddress,
          tokenId: _tokenId,
          lendingId: _lendingId,
          renterAddress: _renterAddress,
          returnedAt: _returnedAt,
        } = event;
        expect(_nftAddress).to.be.equal(nftAddress[i]);
        expect(_tokenId).to.be.equal(tokenId[i]);
        expect(_lendingId).to.be.equal(lendingId[i]);
        expect(_renterAddress).to.be.equal(renterAddress[i]);
        expect(_returnedAt).to.be.equal(returnedAt[i]);
      }
    };

    it('returns ok - one eth', async () => {
      const rentDuration = 1;
      const drp = 1.6921;
      const col = 0.0001;
      const dailyRentPrice = packPrice(drp);
      const nftPrice = packPrice(col);
      await lendBatch({
        tokenIds: [1],
        paymentTokens: [1],
        maxRentDurations: [1],
        dailyRentPrices: [dailyRentPrice],
        nftPrices: [nftPrice],
      });
      const pmtAmt = ethers.utils.parseEther(
        (rentDuration * drp + col).toString()
      );
      const pmtAmtWithoutCollateral = ethers.utils.parseEther(
        (rentDuration * drp).toString()
      );
      await renter.renft.rent(
        [renter.erc721.address],
        [1],
        [1],
        [rentDuration],
        {
          value: pmtAmt,
        }
      );
      let latestBlock = await getLatestBlock();
      const rentedAt = latestBlock.timestamp;
      const lenderBalancePre = await getBalance(lender.address);
      const warpTime = 10_000;
      await advanceTime(warpTime);
      const renterBalancePre = await getBalance(renter.address);
      const tx = await renter.renft.returnIt([renter.erc721.address], [1], [1]);
      latestBlock = await getLatestBlock();
      const returnedAt = latestBlock.timestamp;
      const _rentDuration = returnedAt - rentedAt;
      const lenderBalancePost = await getBalance(lender.address);
      const renterBalancePost = await getBalance(renter.address);
      let sendLenderAmt = pmtAmtWithoutCollateral
        .mul(_rentDuration)
        .div(rentDuration * SECONDS_IN_A_DAY);
      const sendRenterAmt = pmtAmtWithoutCollateral
        .sub(sendLenderAmt)
        .add(ethers.utils.parseEther(col.toString()));
      const fee = takeFee(sendLenderAmt, rentFee);
      sendLenderAmt = sendLenderAmt.sub(fee);
      const receipt = await tx.wait();
      validateReturned({
        events: receipt.events ?? [],
        nftAddress: [renter.erc721.address],
        tokenId: [1],
        lendingId: [1],
        renterAddress: [renter.address],
        returnedAt: [(await getLatestBlock()).timestamp],
      });
      const txGasCost = receipt.gasUsed.mul(tx.gasPrice);
      expect(lenderBalancePost.sub(lenderBalancePre)).to.be.equal(
        sendLenderAmt
      );
      const renterDiff = renterBalancePost
        .sub(renterBalancePre)
        .abs()
        .add(txGasCost);
      expect(sendRenterAmt).to.be.equal(renterDiff);
    });

    it('returns ok - one erc20', async () => {
      const rentDuration = 1;
      const drp = 1.6921;
      const col = 0.0001;
      const dailyRentPrice = packPrice(drp);
      const nftPrice = packPrice(col);
      await lendBatch({
        tokenIds: [1],
        paymentTokens: [2],
        maxRentDurations: [1],
        dailyRentPrices: [dailyRentPrice],
        nftPrices: [nftPrice],
      });
      const pmtAmtWoCollateral = ethers.utils.parseEther(
        (rentDuration * drp).toString()
      );
      await renter.renft.rent(
        [renter.erc721.address],
        [1],
        [1],
        [rentDuration]
      );
      let latestBlock = await getLatestBlock();
      const rentedAt = latestBlock.timestamp;
      const lenderBalancePre = await renter.erc20.balanceOf(lender.address);
      const warpTime = 10_000;
      await advanceTime(warpTime);
      const renterBalancePre = await renter.erc20.balanceOf(renter.address);
      const tx = await renter.renft.returnIt([renter.erc721.address], [1], [1]);
      latestBlock = await getLatestBlock();
      const returnedAt = latestBlock.timestamp;
      const _rentDuration = returnedAt - rentedAt;
      const lenderBalancePost = await renter.erc20.balanceOf(lender.address);
      const renterBalancePost = await renter.erc20.balanceOf(renter.address);
      let sendLenderAmt = pmtAmtWoCollateral
        .mul(_rentDuration)
        .div(rentDuration * SECONDS_IN_A_DAY);
      const sendRenterAmt = pmtAmtWoCollateral
        .sub(sendLenderAmt)
        .add(ethers.utils.parseEther(col.toString()));
      const fee = takeFee(sendLenderAmt, rentFee);
      sendLenderAmt = sendLenderAmt.sub(fee);
      const receipt = await tx.wait();
      validateReturned({
        events: receipt.events ?? [],
        nftAddress: [renter.erc721.address],
        tokenId: [1],
        lendingId: [1],
        renterAddress: [renter.address],
        returnedAt: [(await getLatestBlock()).timestamp],
      });
      expect(lenderBalancePost.sub(lenderBalancePre)).to.be.equal(
        sendLenderAmt
      );
      const renterBalanceDiff = renterBalancePost.sub(renterBalancePre);
      expect(renterBalanceDiff).to.be.equal(sendRenterAmt);
    });

    it('returns ok - one eth one erc20', async () => {
      const rentDurations = [2, 4];
      const drpEth = 1.6921; // acronym for dailry rental price
      const colEth = 0.0001; // denotes collateral
      const drpErc20 = 19.1199;
      const colErc20 = 8.1929;
      const dailyRentPriceEth = packPrice(drpEth);
      const nftPriceEth = packPrice(colEth);
      const dailyRentPriceErc20 = packPrice(drpErc20);
      const nftPriceErc20 = packPrice(colErc20);
      await lendBatch({
        tokenIds: [1, 2],
        paymentTokens: [1, 2],
        maxRentDurations: [3, 365],
        dailyRentPrices: [dailyRentPriceEth, dailyRentPriceErc20],
        nftPrices: [nftPriceEth, nftPriceErc20],
      });
      // todo: a class like events.args where you can access the members
      // via both the index and the name. In fact, just copy that class
      // into my personal utils file (npm package?)
      const pmtAmts = [
        ethers.utils.parseEther(
          (rentDurations[0] * drpEth + colEth).toString()
        ),
        ethers.utils.parseEther(
          (rentDurations[1] * drpErc20 + colErc20).toString()
        ),
      ];
      const pmtAmtsWoCol = [
        ethers.utils.parseEther((rentDurations[0] * drpEth).toString()),
        ethers.utils.parseEther((rentDurations[1] * drpErc20).toString()),
      ];

      await renter.renft.rent(
        [renter.erc721.address, renter.erc721.address],
        [1, 2],
        [1, 2],
        rentDurations,
        {
          value: pmtAmts[0],
        }
      );

      let latestBlock = await getLatestBlock();
      const rentedAt = latestBlock.timestamp;
      await advanceTime(SECONDS_IN_A_DAY + 1969);
      const lenderBalancePreEth = await getBalance(lender.address);
      const renterBalancePreEth = await getBalance(renter.address);
      const lenderBalancePreErc20 = await renter.erc20.balanceOf(
        lender.address
      );
      const renterBalancePreErc20 = await renter.erc20.balanceOf(
        renter.address
      );

      const tx = await renter.renft.returnIt(
        [renter.erc721.address, renter.erc721.address],
        [1, 2],
        [1, 2]
      );

      latestBlock = await getLatestBlock();
      const returnedAt = latestBlock.timestamp;
      const _rentDuration = returnedAt - rentedAt;
      const lenderBalancePostEth = await getBalance(lender.address);
      const renterBalancePostEth = await getBalance(renter.address);
      const lenderBalancePostErc20 = await renter.erc20.balanceOf(
        lender.address
      );
      const renterBalancePostErc20 = await renter.erc20.balanceOf(
        renter.address
      );
      let sendLenderAmtEth = pmtAmtsWoCol[0]
        .mul(_rentDuration)
        .div(rentDurations[0] * SECONDS_IN_A_DAY);
      const sendRenterAmtEth = pmtAmtsWoCol[0]
        .sub(sendLenderAmtEth)
        .add(ethers.utils.parseEther(colEth.toString()));
      let sendLenderAmtErc20 = pmtAmtsWoCol[1]
        .mul(_rentDuration)
        .div(rentDurations[1] * SECONDS_IN_A_DAY);
      const sendRenterAmtErc20 = pmtAmtsWoCol[1]
        .sub(sendLenderAmtErc20)
        .add(ethers.utils.parseEther(colErc20.toString()));
      const feeEth = takeFee(sendLenderAmtEth, rentFee);
      sendLenderAmtEth = sendLenderAmtEth.sub(feeEth);
      const feeErc20 = takeFee(sendLenderAmtErc20, rentFee);
      sendLenderAmtErc20 = sendLenderAmtErc20.sub(feeErc20);
      const receipt = await tx.wait();
      validateReturned({
        events: receipt.events ?? [],
        nftAddress: [renter.erc721.address, renter.erc721.address],
        tokenId: [1, 2],
        lendingId: [1, 2],
        renterAddress: [renter.address, renter.address],
        returnedAt: Array(2).fill((await getLatestBlock()).timestamp),
      });
      const txGasCost = receipt.gasUsed.mul(tx.gasPrice);
      expect(lenderBalancePostEth.sub(lenderBalancePreEth)).to.be.equal(
        sendLenderAmtEth
      );
      const renterDiffEth = renterBalancePostEth
        .sub(renterBalancePreEth)
        .add(txGasCost);
      expect(sendRenterAmtEth).to.be.equal(renterDiffEth);
      expect(lenderBalancePostErc20.sub(lenderBalancePreErc20)).to.be.equal(
        sendLenderAmtErc20
      );
      const renterDiffErc20 = renterBalancePostErc20.sub(renterBalancePreErc20);
      expect(sendRenterAmtErc20).to.be.equal(renterDiffErc20);
    });
    it('reverts if one of the returned NFTs is past the rent date', async () => {
      const rentDurations = [1, 4];
      const drpEth = 1.9999; // acronym for dailry rental price
      const colEth = 0.1001; // denotes collateral
      const drpErc20 = 0.9199;
      const colErc20 = 8.1929;
      const dailyRentPriceEth = packPrice(drpEth);
      const nftPriceEth = packPrice(colEth);
      const dailyRentPriceErc20 = packPrice(drpErc20);
      const nftPriceErc20 = packPrice(colErc20);
      await lendBatch({
        tokenIds: [1, 2],
        paymentTokens: [1, 2],
        maxRentDurations: [3, 365],
        dailyRentPrices: [dailyRentPriceEth, dailyRentPriceErc20],
        nftPrices: [nftPriceEth, nftPriceErc20],
      });
      // todo: a class like events.args where you can access the members
      // via both the index and the name. In fact, just copy that class
      // into my personal utils file (npm package?)
      const pmtAmts = [
        ethers.utils.parseEther(
          (rentDurations[0] * drpEth + colEth).toString()
        ),
        ethers.utils.parseEther(
          (rentDurations[1] * drpErc20 + colErc20).toString()
        ),
      ];

      await renter.renft.rent(
        [renter.erc721.address, renter.erc721.address],
        [1, 2],
        [1, 2],
        rentDurations,
        {
          value: pmtAmts[0],
        }
      );

      await advanceTime(SECONDS_IN_A_DAY + 100);

      await expect(
        renter.renft.returnIt(
          [renter.erc721.address, renter.erc721.address],
          [1, 2],
          [1, 2]
        )
      ).to.be.revertedWith('duration exceeded');
    });
  });

  context('Collateral Claiming', async function () {
    type NamedAccount = {
      address: string;
      erc20: ERC20T;
      erc721: ERC721T;
      renft: RentNftT;
    };
    let renter: NamedAccount;
    let lender: NamedAccount;
    let beneficiary: string;
    let rentFee: BigNumber;

    beforeEach(async () => {
      const o = await setup();
      renter = o.renter;
      lender = o.lender;
      beneficiary = o.beneficiary;
      rentFee = await renter.renft.rentFee();
    });

    const lendBatch = async ({
      tokenIds,
      paymentTokens,
      maxRentDurations = [],
      dailyRentPrices = [],
      nftPrices = [],
    }: lendBatchArgs & { paymentTokens: number[] }) => {
      let _maxRentDurations = maxRentDurations;
      let _dailyRentPrices = dailyRentPrices;
      let _nftPrices = nftPrices;
      if (maxRentDurations.length === 0) {
        _maxRentDurations = Array(tokenIds.length).fill(MAX_RENT_DURATION);
      }
      if (dailyRentPrices.length === 0) {
        _dailyRentPrices = Array(tokenIds.length).fill(DAILY_RENT_PRICE);
      }
      if (nftPrices.length === 0) {
        _nftPrices = Array(tokenIds.length).fill(NFT_PRICE);
      }
      await lender.renft.lend(
        Array(tokenIds.length).fill(lender.erc721.address),
        tokenIds,
        _maxRentDurations,
        _dailyRentPrices,
        _nftPrices,
        paymentTokens
      );
    };

    const validateClaimed = ({
      nftAddress,
      tokenId,
      lendingId,
      claimedAt,
      events,
    }: {
      nftAddress: string[];
      tokenId: number[];
      lendingId: number[];
      claimedAt: number[];
      events: Event[];
    }) => {
      const es = getEvents(events, 'Rented');
      for (let i = 0; i < es.length; i++) {
        const event = es[i].args;
        if (!event) throw new Error('no args');
        const {
          nftAddress: _nftAddress,
          tokenId: _tokenId,
          lendingId: _lendingId,
          claimedAt: _claimedAt,
        } = event;
        expect(_nftAddress).to.be.equal(nftAddress[i]);
        expect(_tokenId).to.be.equal(tokenId[i]);
        expect(_lendingId).to.be.equal(lendingId[i]);
        expect(_claimedAt).to.be.equal(claimedAt[i]);
      }
    };

    it('claims collateral ok - one eth', async () => {
      const tokenIds = [1];
      const paymentTokens = [1];
      const maxRentDurations = [10];
      const drp = 3.4299;
      const col = 23.112;
      const dailyRentPrices = [packPrice(drp)];
      const nftPrices = [packPrice(col)];
      await lendBatch({
        tokenIds,
        paymentTokens,
        maxRentDurations,
        dailyRentPrices,
        nftPrices,
      });
      const _nft = [renter.erc721.address];
      const _tokenId = [1];
      const _id = [1];
      const _rentDuration = [1];
      await renter.renft.rent(_nft, _tokenId, _id, _rentDuration, {
        value: ethers.utils
          .parseEther(drp.toString())
          .add(ethers.utils.parseEther(col.toString())),
      });
      await advanceTime(SECONDS_IN_A_DAY);
      const balancePre = await getBalance(lender.address);
      const beneficiaryBalancePre = await getBalance(beneficiary);
      const tx = await lender.renft.claimCollateral(_nft, _tokenId, _id);
      const balancePost = await getBalance(lender.address);
      const renftBalancePost = await getBalance(lender.renft.address);
      const receipt = await tx.wait();
      const txCost = tx.gasPrice.mul(receipt.gasUsed);
      const events = getEvents(receipt.events ?? [], 'CollateralClaimed');
      validateClaimed({
        nftAddress: [lender.erc721.address],
        tokenId: tokenIds,
        lendingId: [1],
        claimedAt: [(await getLatestBlock()).timestamp],
        events,
      });
      let fullRentPayment = ethers.utils.parseEther(drp.toString());
      const fee = takeFee(fullRentPayment, rentFee);
      fullRentPayment = fullRentPayment.sub(fee);
      const _balancePre = balancePre.sub(txCost);
      const diff = balancePost.sub(_balancePre);
      expect(diff).to.be.equal(
        ethers.utils.parseEther(col.toString()).add(fullRentPayment)
      );
      expect(renftBalancePost).to.be.equal(0);
      const beneficiaryBalance = await getBalance(beneficiary);
      expect(beneficiaryBalance.sub(beneficiaryBalancePre)).to.be.equal(fee);
    });

    it('claims collateral ok - one eth one erc20', async () => {
      const tokenIds = [1, 2];
      const paymentTokens = [1, 2];
      const maxRentDurations = [10, 101];
      const drpEth = 3.4299;
      const colEth = 23.112;
      const drpErc20 = 9.5982;
      const colErc20 = 1.2135;
      const dailyRentPrices = [packPrice(drpEth), packPrice(drpErc20)];
      const nftPrices = [packPrice(colEth), packPrice(colErc20)];
      await lendBatch({
        tokenIds,
        paymentTokens,
        maxRentDurations,
        dailyRentPrices,
        nftPrices,
      });
      const _nft = Array(2).fill(renter.erc721.address);
      const _tokenId = [1, 2];
      const _id = [1, 2];
      const _rentDuration = [1, 4];
      await renter.renft.rent(_nft, _tokenId, _id, _rentDuration, {
        value: ethers.utils
          .parseEther(drpEth.toString())
          .add(ethers.utils.parseEther(colEth.toString())),
      });
      await advanceTime(_rentDuration[1] * SECONDS_IN_A_DAY);
      const balancePre = await getBalance(lender.address);
      const beneficiaryBalancePre = await getBalance(beneficiary);
      const balancePreErc20 = await lender.erc20.balanceOf(lender.address);
      const beneficiaryBalancePreErc20 = await lender.erc20.balanceOf(
        beneficiary
      );
      const tx = await lender.renft.claimCollateral(_nft, _tokenId, _id);
      const balancePostErc20 = await lender.erc20.balanceOf(lender.address);
      const balancePost = await getBalance(lender.address);
      const renftBalancePost = await getBalance(lender.renft.address);
      const receipt = await tx.wait();
      const txCost = tx.gasPrice.mul(receipt.gasUsed);
      const events = getEvents(receipt.events ?? [], 'CollateralClaimed');
      validateClaimed({
        nftAddress: Array(2).fill(lender.erc721.address),
        tokenId: tokenIds,
        lendingId: [1, 2],
        claimedAt: Array(2).fill((await getLatestBlock()).timestamp),
        events,
      });
      let fullRentPayment = ethers.utils.parseEther(drpEth.toString());
      const fee = takeFee(fullRentPayment, rentFee);
      fullRentPayment = fullRentPayment.sub(fee);
      const _balancePre = balancePre.sub(txCost);
      let diff = balancePost.sub(_balancePre);
      expect(diff).to.be.equal(
        ethers.utils.parseEther(colEth.toString()).add(fullRentPayment)
      );
      expect(renftBalancePost).to.be.equal(0);
      const beneficiaryBalance = await getBalance(beneficiary);
      expect(beneficiaryBalance.sub(beneficiaryBalancePre)).to.be.equal(fee);
      // erc20
      let fullRentPaymentErc20 = BigNumber.from(_rentDuration[1]).mul(
        ethers.utils.parseEther(drpErc20.toString())
      );
      const feeErc20 = takeFee(fullRentPaymentErc20, rentFee);
      fullRentPaymentErc20 = fullRentPaymentErc20.sub(feeErc20);
      diff = balancePostErc20.sub(balancePreErc20);
      expect(diff).to.be.equal(
        ethers.utils.parseEther(colErc20.toString()).add(fullRentPaymentErc20)
      );
      const beneficiaryBalanceErc20 = await lender.erc20.balanceOf(beneficiary);
      expect(
        beneficiaryBalanceErc20.sub(beneficiaryBalancePreErc20)
      ).to.be.equal(feeErc20);
    });

    it('claims colalteral ok - one erc20', async () => {
      const tokenIds = [1];
      const paymentTokens = [2];
      const maxRentDurations = [7];
      const drp = 6.4299;
      const col = 63.1912;
      const dailyRentPrices = [packPrice(drp)];
      const nftPrices = [packPrice(col)];
      await lendBatch({
        tokenIds,
        paymentTokens,
        maxRentDurations,
        dailyRentPrices,
        nftPrices,
      });
      const _nft = [renter.erc721.address];
      const _tokenId = [1];
      const _id = [1];
      const _rentDuration = [1];
      await renter.renft.rent(_nft, _tokenId, _id, _rentDuration);
      await advanceTime(SECONDS_IN_A_DAY + 100);
      const balancePre = await lender.erc20.balanceOf(lender.address);
      const beneficiaryBalancePre = await lender.erc20.balanceOf(beneficiary);
      const tx = await lender.renft.claimCollateral(_nft, _tokenId, _id);
      const balancePost = await lender.erc20.balanceOf(lender.address);
      const renftBalancePost = await lender.erc20.balanceOf(
        lender.renft.address
      );
      const receipt = await tx.wait();
      const events = getEvents(receipt.events ?? [], 'CollateralClaimed');
      validateClaimed({
        nftAddress: [lender.erc721.address],
        tokenId: tokenIds,
        lendingId: [1],
        claimedAt: [(await getLatestBlock()).timestamp],
        events,
      });
      let fullRentPayment = ethers.utils.parseEther(drp.toString());
      const fee = takeFee(fullRentPayment, rentFee);
      fullRentPayment = fullRentPayment.sub(fee);
      const diff = balancePost.sub(balancePre);
      expect(diff).to.be.equal(
        ethers.utils.parseEther(col.toString()).add(fullRentPayment)
      );
      expect(renftBalancePost).to.be.equal(0);
      const beneficiaryBalance = await lender.erc20.balanceOf(beneficiary);
      expect(beneficiaryBalance.sub(beneficiaryBalancePre)).to.be.equal(fee);
    });

    it('does not claim collateral if not time', async () => {
      const tokenIds = [1];
      const paymentTokens = [2];
      const maxRentDurations = [7];
      const drp = 6.4299;
      const col = 63.1912;
      const dailyRentPrices = [packPrice(drp)];
      const nftPrices = [packPrice(col)];
      await lendBatch({
        tokenIds,
        paymentTokens,
        maxRentDurations,
        dailyRentPrices,
        nftPrices,
      });
      const _nft = [renter.erc721.address];
      const _tokenId = [1];
      const _id = [1];
      const _rentDuration = [1];
      await renter.renft.rent(_nft, _tokenId, _id, _rentDuration);
      await advanceTime(SECONDS_IN_A_DAY - 1);
      await expect(
        lender.renft.claimCollateral(_nft, _tokenId, _id)
      ).to.be.revertedWith('duration not exceeded');
    });
  });

  context('Stop Lending', async function () {
    it('stops lending ok', async () => {
      const { lender } = await setup();
      await lender.renft.lend(
        [lender.erc721.address],
        [1],
        [1],
        [packPrice(1)],
        [packPrice(1)],
        [2]
      );
      expect(await lender.erc721.ownerOf(1)).to.be.equal(lender.renft.address);
      const tx = await lender.renft.stopLending(
        [lender.erc721.address],
        [1],
        [1]
      );
      const receipt = await tx.wait();
      const events = getEvents(receipt.events ?? [], 'LendingStopped');
      const event = events[0];
      if (!event.args) throw new Error('LendingStopped not emitted');
      const { nftAddress, tokenId, lendingId, stoppedAt } = event.args;
      expect(nftAddress).to.be.equal(lender.erc721.address);
      expect(tokenId).to.be.equal(1);
      expect(lendingId).to.be.equal(1);
      expect(stoppedAt).to.be.equal((await getLatestBlock()).timestamp);
      expect(await lender.erc721.ownerOf(1)).to.be.equal(lender.address);
    });

    it('does not stop lending when currently rented', async () => {
      const { lender, renter } = await setup();
      await lender.renft.lend(
        [lender.erc721.address],
        [1],
        [1],
        [packPrice(1)],
        [packPrice(1)],
        [2]
      );
      await renter.renft.rent([lender.erc721.address], [1], [1], [1]);
      await expect(
        lender.renft.stopLending([lender.erc721.address], [1], [1])
      ).to.be.revertedWith('renter address is not zero address');
    });
  });

  context('Integration', async function () {
    it('relends ok', async () => {
      const { lender, renter } = await setup();
      const nft = [lender.erc721.address];
      const paymentToken = [2];
      const tokenId = [1];
      const maxRentDuration = [1];
      const lendingId = [1];
      const dailyRentPrice = [packPrice(1)];
      const collateralPrice = [packPrice(1)];
      await lender.renft.lend(
        nft,
        tokenId,
        maxRentDuration,
        dailyRentPrice,
        collateralPrice,
        paymentToken
      );
      await renter.renft.rent(nft, tokenId, lendingId, [1]);
      await renter.renft.lend(
        nft,
        tokenId,
        maxRentDuration,
        dailyRentPrice,
        collateralPrice,
        paymentToken
      );
    });

    it('reverts when a mad lend sends an NFT directly', async () => {});

    it('reverts when a mad lad sends us ERC20', async () => {});

    it('reverts when a mad lad sends us ether', async () => {});

    it('reverts when a mad lad sends us ERC20 and ether', async () => {});

    // it('A lends, B rents, B lends, C rents, C defaults', async () => {});

    // it('relends 10 times ok', async () => {});
  });

  context('Admin', async () => {
    it('sets the rentFee', async () => {
      const { deployer } = await setup();
      const deployerRenft = ((await ethers.getContract(
        'RentNft',
        deployer
      )) as unknown) as RentNftT;
      await deployerRenft.setRentFee('559');
      const rentFee = await deployerRenft.rentFee();
      expect(rentFee).to.be.equal('559');
    });
    it('disallows non deployer to set the rentFee', async () => {
      const { renter } = await setup();
      await expect(renter.renft.setRentFee('559')).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });
    it('disallows to set the fee that exceeds 100', async () => {
      const { deployer } = await setup();
      const deployerRenft = ((await ethers.getContract(
        'RentNft',
        deployer
      )) as unknown) as RentNftT;
      await expect(deployerRenft.setRentFee('123456789')).to.be.revertedWith(
        '1 cannot be taking 100 pct fee'
      );
    });
    it('sets the beneficiary', async () => {
      const { deployer, signers } = await setup();
      const deployerRenft = ((await ethers.getContract(
        'RentNft',
        deployer
      )) as unknown) as RentNftT;
      await deployerRenft.setBeneficiary(signers[4].address);
    });
    it('disallows non deployer to set the beneficiary', async () => {
      const { renter, signers } = await setup();
      await expect(
        renter.renft.setBeneficiary(signers[4].address)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  context('For Glory', async () => {
    it('makes whole 9999 when exceeds', async () => {
      const { lender, deployer, renter } = await setup();
      await lender.renft.lend(
        [lender.erc721.address],
        [1],
        [1],
        ['0xffff0000'],
        ['0x0000ffff'],
        [2]
      );
      const erc20 = ((await ethers.getContract(
        'MyERC20',
        deployer
      )) as unknown) as ERC20T;
      await erc20.transfer(renter.address, ethers.utils.parseEther('11000'));
      const renterBalancePre = await erc20.balanceOf(renter.address);
      await renter.renft.rent([renter.erc721.address], [1], [1], [1]);
      const renterBalancePost = await erc20.balanceOf(renter.address);
      const diff = renterBalancePre.sub(renterBalancePost);
      expect(diff).to.be.equal(
        ethers.utils.parseEther('9999').add(ethers.utils.parseEther('0.9999'))
      );
    });

    it('100% test coverage', async () => {
      const { lender, deployer, renter } = await setup();
      await lender.renft.lend(
        [lender.erc721.address],
        [1],
        [1],
        ['0x00000000'],
        ['0x00000000'],
        [2]
      );
      const erc20 = ((await ethers.getContract(
        'MyERC20',
        deployer
      )) as unknown) as ERC20T;
      await erc20.transfer(renter.address, ethers.utils.parseEther('11000'));
      const renterBalancePre = await erc20.balanceOf(renter.address);
      await renter.renft.rent([renter.erc721.address], [1], [1], [1]);
      const renterBalancePost = await erc20.balanceOf(renter.address);
      const diff = renterBalancePre.sub(renterBalancePost);
      expect(diff).to.be.equal(
        ethers.utils.parseEther('0.0001').add(ethers.utils.parseEther('0.0001'))
      );
    });
  });
});
