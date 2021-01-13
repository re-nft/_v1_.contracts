import {expect} from './chai-setup';
import {ethers, deployments, getNamedAccounts} from 'hardhat';
import {Event} from '@ethersproject/contracts/lib';
import {
  RentNft,
  RentNft as RentNftT,
} from '../frontend/src/hardhat/typechain/RentNft';
import {Resolver as ResolverT} from '../frontend/src/hardhat/typechain/Resolver';
import {ERC20 as ERC20T} from '../frontend/src/hardhat/typechain/ERC20';
import {MyERC721 as ERC721T} from '../frontend/src/hardhat/typechain/MyERC721';
import {Utils as UtilsT} from '../frontend/src/hardhat/typechain/Utils';
import {SignerWithAddress} from 'hardhat-deploy-ethers/dist/src/signer-with-address';
import {BigNumber} from 'ethers';

// default values
const MAX_RENT_DURATION = 1; // 1 day
const DAILY_RENT_PRICE = 2; // 2 full tokens or 2 ETH
const NFT_PRICE = 3; // 3 full tokens or 3 ETH
const PAYMENT_TOKEN = 2; // default token is DAI (our ERC20)
const PRICE_BITSIZE = 32;
const DP18 = ethers.utils.parseEther('1');

const decimalToPaddedHexString = (number: number, bitsize: number) => {
  const byteCount = Math.ceil(bitsize / 8);
  const maxBinValue = Math.pow(2, bitsize) - 1;

  /* In node.js this function fails for bitsize above 32bits */
  if (bitsize > 32) throw 'number above maximum value';

  /* Conversion to unsigned form based on  */
  if (number < 0) number = maxBinValue + number + 1;

  return (
    '0x' +
    (number >>> 0)
      .toString(16)
      .toUpperCase()
      .padStart(byteCount * 2, '0')
  );
};

const getEvents = (events: Event[], name: string) => {
  return events.filter((e) => e?.event?.toLowerCase() === name.toLowerCase());
};

const advanceTime = async (seconds: number) => {
  await ethers.provider.send('evm_increaseTime', [seconds]);
  await ethers.provider.send('evm_mine', []);
};

// price is bytes4 in Solidity
const unpackPrice = (price: number, scale: BigNumber) => {
  // price is from 1 to 4294967295. i.e. from 0x00000001 to 0xffffffff
  const numHex = decimalToPaddedHexString(price, PRICE_BITSIZE).slice(2);
  let whole = parseInt(numHex.slice(0, 4), 16);
  let decimal = parseInt(numHex.slice(4), 16);
  if (whole > 9999) whole = 9999;
  if (decimal > 9999) decimal = 9999;
  const w = BigNumber.from(whole).mul(scale);
  const d = BigNumber.from(decimal).mul(scale.div(10_000));
  const _price = w.add(d);
  return _price;
};

// given the target price, give back the hex equivalent
const packPrice = (price: number) => {
  if (price > 9999.9999) throw new Error('too high');
  if (price < 0.0001) throw new Error('too low');
  const stringVersion = price.toString();
  const parts = stringVersion.split('.');
  let res: number;
  if (parts.length == 2) {
    const whole = parts[0];
    let decimal = parts[1];
    while (decimal.length < 4) {
      decimal += '0';
    }
    const wholeHex = decimalToPaddedHexString(Number(whole), 16);
    const decimalHex = decimalToPaddedHexString(Number(decimal), 16);
    const hexRepr = wholeHex.slice(2).concat(decimalHex.slice(2));
    res = parseInt(hexRepr, 16);
  } else {
    if (parts.length != 1) throw new Error('price packing issue');
    const whole = parts[0];
    const wholeHex = decimalToPaddedHexString(Number(whole), 16);
    const decimalHex = '0000';
    res = parseInt(wholeHex.slice(2).concat(decimalHex), 16);
  }
  return res;
};

const setup = deployments.createFixture(async () => {
  await deployments.fixture('Resolver');
  await deployments.fixture('ERC20');
  await deployments.fixture('ERC721');
  await deployments.fixture('RentNft');
  await deployments.fixture('Utils');
  const {deployer, beneficiary} = await getNamedAccounts();
  const signers = await ethers.getSigners();
  const resolver = (await ethers.getContract('Resolver')) as ResolverT;
  const myERC20 = (await ethers.getContract('MyERC20')) as ERC20T;
  const myERC721 = (await ethers.getContract('MyERC721')) as ERC721T;
  const utils = (await ethers.getContract('Utils')) as UtilsT;
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
    Utils: utils,
    signers,
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

type lendBatchArgs = {
  tokenIds: number[];
  maxRentDurations?: number[];
  dailyRentPrices?: number[];
  nftPrices?: number[];
  expectedLendingIds?: number[];
};

describe('RentNft', function () {
  context('Lending', async function () {
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
    let dude: SignerWithAddress;

    beforeEach(async () => {
      const setupObj = await setup();
      RentNft = setupObj.RentNft;
      ERC721 = setupObj.ERC721;
      ERC20 = setupObj.ERC20;
      dude = setupObj.signers[1];
    });

    const lendBatch = async ({
      tokenIds,
      paymentTokens,
      maxRentDurations = [],
      dailyRentPrices = [],
      nftPrices = [],
    }: lendBatchArgs & {paymentTokens: number[]}) => {
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
      await RentNft.lend(
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
      const renftDude = (await ethers.getContract('RentNft', dude)) as RentNftT;
      const nftAddress = [ERC721.address];
      const tokenId = [1];
      const lendingId = [1];
      const rentDuration = [2];
      const dudeBalancePre = await ethers.provider.getBalance(dude.address);
      const renftBalancePre = await ethers.provider.getBalance(
        renftDude.address
      );
      expect(renftBalancePre).to.be.equal(0);
      const pmtAmount = unpackPrice(NFT_PRICE, DP18).add(
        BigNumber.from(rentDuration[0]).mul(unpackPrice(DAILY_RENT_PRICE, DP18))
      );
      const tx = await renftDude.rent(
        nftAddress,
        tokenId,
        lendingId,
        rentDuration,
        {value: pmtAmount}
      );
      const dudeBalancePost = await ethers.provider.getBalance(dude.address);
      const renftBalancePost = await ethers.provider.getBalance(
        renftDude.address
      );
      expect(renftBalancePost).to.be.equal(pmtAmount);
      const receipt = await tx.wait();
      expect(
        dudeBalancePre.sub(receipt.gasUsed.mul(tx.gasPrice)).sub(pmtAmount)
      ).to.be.equal(dudeBalancePost);
      const rentedAt = [(await ethers.provider.getBlock('latest')).timestamp];
      const events = receipt.events ?? [];
      validateRented({
        nftAddress,
        tokenId,
        lendingId,
        renterAddress: [dude.address],
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
      const renftDude = (await ethers.getContract('RentNft', dude)) as RentNftT;
      const nftAddress = [ERC721.address];
      const tokenId = [1];
      const lendingId = [1];
      const rentDuration = [2];
      await expect(
        renftDude.rent(nftAddress, tokenId, lendingId, rentDuration, {value: 0})
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
      const renftDude = (await ethers.getContract('RentNft', dude)) as RentNftT;
      const erc20Dude = (await ethers.getContract('MyERC20', dude)) as ERC20T;
      const nftAddress = [ERC721.address];
      const lendingId = [1];
      const rentDuration = [2];
      const sendDudeAmt = ethers.utils.parseEther('1000');
      await ERC20.transfer(dude.address, sendDudeAmt).then(() => true);
      await erc20Dude.approve(renftDude.address, sendDudeAmt);
      const dudeBalancePre = await ERC20.balanceOf(dude.address);
      expect(dudeBalancePre).to.be.equal(sendDudeAmt);
      const renftBalancePre = await ERC20.balanceOf(renftDude.address);
      expect(renftBalancePre).to.be.equal(0);
      const pmtAmount = unpackPrice(NFT_PRICE, DP18).add(
        BigNumber.from(rentDuration[0]).mul(unpackPrice(DAILY_RENT_PRICE, DP18))
      );
      const tx = await renftDude.rent(
        nftAddress,
        tokenIds,
        lendingId,
        rentDuration
      );
      const receipt = await tx.wait();
      const dudeBalancePost = await ERC20.balanceOf(dude.address);
      const renftBalancePost = await ERC20.balanceOf(renftDude.address);
      expect(renftBalancePost).to.be.equal(pmtAmount);
      expect(dudeBalancePre.sub(pmtAmount)).to.be.equal(dudeBalancePost);
      const rentedAt = [(await ethers.provider.getBlock('latest')).timestamp];
      const events = receipt.events ?? [];
      validateRented({
        nftAddress,
        tokenId: tokenIds,
        lendingId,
        renterAddress: [dude.address],
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
      const renftDude = (await ethers.getContract('RentNft', dude)) as RentNftT;
      const nftAddress = [ERC721.address];
      const tokenId = [1];
      const lendingId = [1];
      const rentDuration = [2];
      await expect(
        renftDude.rent(nftAddress, tokenId, lendingId, rentDuration, {value: 0})
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
      const renftDude = (await ethers.getContract('RentNft', dude)) as RentNftT;
      const erc20Dude = (await ethers.getContract('MyERC20', dude)) as ERC20T;
      const nftAddress = [ERC721.address, ERC721.address];
      const lendingId = [1, 2];
      const rentDuration = [2, 5];
      const sendDudeAmt = ethers.utils.parseEther('1000');
      await ERC20.transfer(dude.address, sendDudeAmt).then(() => true);
      await erc20Dude.approve(renftDude.address, sendDudeAmt);
      const dudeBalancePreERC20 = await ERC20.balanceOf(dude.address);
      expect(dudeBalancePreERC20).to.be.equal(sendDudeAmt);
      const renftBalancePreERC20 = await ERC20.balanceOf(renftDude.address);
      expect(renftBalancePreERC20).to.be.equal(0);
      const dudeBalancePre = await ethers.provider.getBalance(dude.address);
      const renftBalancePre = await ethers.provider.getBalance(
        renftDude.address
      );
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
      const tx = await renftDude.rent(
        nftAddress,
        tokenIds,
        lendingId,
        rentDuration,
        {
          value: pmtAmounts[0],
        }
      );
      const receipt = await tx.wait();
      const dudeBalancePostERC20 = await ERC20.balanceOf(dude.address);
      const renftBalancePostERC20 = await ERC20.balanceOf(renftDude.address);
      expect(renftBalancePostERC20).to.be.equal(pmtAmounts[1]);
      expect(dudeBalancePreERC20.sub(pmtAmounts[1])).to.be.equal(
        dudeBalancePostERC20
      );
      const dudeBalancePost = await ethers.provider.getBalance(dude.address);
      const renftBalancePost = await ethers.provider.getBalance(
        renftDude.address
      );
      expect(
        dudeBalancePre
          .sub(tx.gasPrice.mul(receipt.gasUsed))
          .sub(dudeBalancePost)
      ).to.be.equal(pmtAmounts[0]);
      expect(renftBalancePost.sub(renftBalancePre)).to.be.equal(pmtAmounts[0]);
      const rentedAt = Array(2).fill(
        (await ethers.provider.getBlock('latest')).timestamp
      );
      const events = receipt.events ?? [];
      validateRented({
        nftAddress,
        tokenId: tokenIds,
        lendingId,
        renterAddress: [dude.address, dude.address],
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
      const renftDude = (await ethers.getContract('RentNft', dude)) as RentNftT;
      const erc20Dude = (await ethers.getContract('MyERC20', dude)) as ERC20T;
      const nftAddress = [ERC721.address, ERC721.address];
      const lendingId = [1, 2];
      const rentDuration = [2, 5];
      const sendDudeAmt = ethers.utils.parseEther('1000');
      await ERC20.transfer(dude.address, sendDudeAmt).then(() => true);
      await erc20Dude.approve(renftDude.address, sendDudeAmt);
      const dudeBalancePreERC20 = await ERC20.balanceOf(dude.address);
      expect(dudeBalancePreERC20).to.be.equal(sendDudeAmt);
      const renftBalancePreERC20 = await ERC20.balanceOf(renftDude.address);
      expect(renftBalancePreERC20).to.be.equal(0);
      const tx = renftDude.rent(nftAddress, tokenIds, lendingId, rentDuration, {
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
      const renftDude = (await ethers.getContract('RentNft', dude)) as RentNftT;
      const nftAddress = [ERC721.address, ERC721.address];
      const lendingId = [1, 2];
      const rentDuration = [2, 1];
      const dudeBalancePre = await ethers.provider.getBalance(dude.address);
      const renftBalancePre = await ethers.provider.getBalance(
        renftDude.address
      );
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
      // even though we are sending ether along, it will not be
      // deposited because the second part of the transaction i.e. erc20
      // will be reverted
      await expect(
        renftDude.rent(nftAddress, tokenIds, lendingId, rentDuration, {
          value: pmtAmounts[0],
        })
      ).to.be.revertedWith('transfer amount exceeds balance');
      const dudeBalancePost = await ethers.provider.getBalance(dude.address);
      const renftBalancePost = await ethers.provider.getBalance(
        renftDude.address
      );
      const latestBlock = await ethers.provider.getBlock('latest');
      const failedTxnHash = latestBlock.transactions[0];
      const failedTxn = await ethers.provider.getTransaction(failedTxnHash);
      const failedTxnReceipt = await ethers.provider.getTransactionReceipt(
        failedTxnHash
      );
      expect(
        dudeBalancePre.sub(failedTxn.gasPrice.mul(failedTxnReceipt.gasUsed))
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
      const renftDude = (await ethers.getContract('RentNft', dude)) as RentNftT;
      const nftAddress = [ERC721.address, ERC721.address];
      const tokenId = [1, 2];
      const lendingId = [1, 2];
      const rentDuration = [2, 1];
      const dudeBalancePre = await ethers.provider.getBalance(dude.address);
      const renftBalancePre = await ethers.provider.getBalance(
        renftDude.address
      );
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
      const tx = await renftDude.rent(
        nftAddress,
        tokenId,
        lendingId,
        rentDuration,
        {value: pmtAmounts[0].add(pmtAmounts[1])}
      );
      const dudeBalancePost = await ethers.provider.getBalance(dude.address);
      const renftBalancePost = await ethers.provider.getBalance(
        renftDude.address
      );
      expect(renftBalancePost).to.be.equal(pmtAmounts[0].add(pmtAmounts[1]));
      const receipt = await tx.wait();
      expect(
        dudeBalancePre
          .sub(receipt.gasUsed.mul(tx.gasPrice))
          .sub(pmtAmounts[0].add(pmtAmounts[1]))
      ).to.be.equal(dudeBalancePost);
      const rentedAt = Array(2).fill(
        (await ethers.provider.getBlock('latest')).timestamp
      );
      const events = receipt.events ?? [];
      validateRented({
        nftAddress,
        tokenId,
        lendingId,
        renterAddress: [dude.address, dude.address],
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
      const renftDude = (await ethers.getContract('RentNft', dude)) as RentNftT;
      const erc20Dude = (await ethers.getContract('MyERC20', dude)) as ERC20T;
      const nftAddress = [ERC721.address, ERC721.address];
      const tokenId = [1, 2];
      const lendingId = [1, 2];
      const rentDuration = [2, 1];
      let dudeBalancePre = await erc20Dude.balanceOf(dude.address);
      const renftBalancePre = await erc20Dude.balanceOf(renftDude.address);
      expect(dudeBalancePre).to.be.equal(0);
      expect(renftBalancePre).to.be.equal(0);
      const sendDudeAmt = ethers.utils.parseEther('1000');
      await ERC20.transfer(dude.address, sendDudeAmt).then(() => true);
      await erc20Dude.approve(renftDude.address, sendDudeAmt);
      dudeBalancePre = await erc20Dude.balanceOf(dude.address);
      expect(dudeBalancePre).to.be.equal(sendDudeAmt);
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
      const tx = await renftDude.rent(
        nftAddress,
        tokenId,
        lendingId,
        rentDuration
      );
      const dudeBalancePost = await erc20Dude.balanceOf(dude.address);
      const renftBalancePost = await erc20Dude.balanceOf(renftDude.address);
      expect(renftBalancePost).to.be.equal(pmtAmounts[0].add(pmtAmounts[1]));
      const receipt = await tx.wait();
      expect(dudeBalancePre.sub(pmtAmounts[0].add(pmtAmounts[1]))).to.be.equal(
        dudeBalancePost
      );
      const rentedAt = Array(2).fill(
        (await ethers.provider.getBlock('latest')).timestamp
      );
      const events = receipt.events ?? [];
      validateRented({
        nftAddress,
        tokenId,
        lendingId,
        renterAddress: [dude.address, dude.address],
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
      const renftDude = (await ethers.getContract('RentNft', dude)) as RentNftT;
      const nftAddress = [ERC721.address];
      const tokenId = [1];
      const lendingId = [1];
      const rentDuration = [0];
      await expect(
        renftDude.rent(nftAddress, tokenId, lendingId, rentDuration, {value: 0})
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
      const renftDude = (await ethers.getContract('RentNft', dude)) as RentNftT;
      const nftAddress = [ERC721.address];
      const tokenId = [1];
      const lendingId = [1];
      const rentDuration = [4];
      await expect(
        renftDude.rent(nftAddress, tokenId, lendingId, rentDuration, {value: 0})
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
      const renftDude = (await ethers.getContract('RentNft', dude)) as RentNftT;
      const nftAddress = [ERC721.address];
      const tokenId = [1];
      const lendingId = [1];
      const rentDuration = [1];
      const pmtAmount = unpackPrice(NFT_PRICE, DP18).add(
        BigNumber.from(rentDuration[0]).mul(unpackPrice(DAILY_RENT_PRICE, DP18))
      );
      renftDude.rent(nftAddress, tokenId, lendingId, rentDuration, {
        value: pmtAmount,
      });
      await expect(
        renftDude.rent(nftAddress, tokenId, lendingId, rentDuration, {
          value: pmtAmount,
        })
      ).to.be.revertedWith('1 already rented');
    });

    it('does not rent - you are lender', async () => {
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
      await expect(
        RentNft.rent(nftAddress, tokenId, lendingId, rentDuration, {
          value: pmtAmount,
        })
      ).to.be.revertedWith('cant rent own nft');
    });
  });

  context('Returning', async function () {
    let RentNft: RentNftT;
    let ERC721: ERC721T;
    let dude: SignerWithAddress;

    beforeEach(async () => {
      const setupObj = await setup();
      RentNft = setupObj.RentNft;
      ERC721 = setupObj.ERC721;
      dude = setupObj.signers[1];
    });

    const lendBatch = async ({
      tokenIds,
      paymentTokens,
      maxRentDurations = [],
      dailyRentPrices = [],
      nftPrices = [],
    }: lendBatchArgs & {paymentTokens: number[]}) => {
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
      await RentNft.lend(
        Array(tokenIds.length).fill(ERC721.address),
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
          returnedAt: returnedAt,
        } = event;
        expect(_nftAddress).to.be.equal(nftAddress[i]);
        expect(_tokenId).to.be.equal(tokenId[i]);
        expect(_lendingId).to.be.equal(lendingId[i]);
        expect(_renterAddress).to.be.equal(renterAddress[i]);
        expect(returnedAt).to.be.equal(returnedAt[i]);
      }
    };

    it('returns ok - one eth', async () => {
      const rentDuration = 1;
      const dailyRentPrice = packPrice(1.6921);
      const nftPrice = packPrice(0.0001);
      await lendBatch({
        tokenIds: [1],
        paymentTokens: [1],
        maxRentDurations: [1],
        dailyRentPrices: [dailyRentPrice],
        nftPrices: [nftPrice],
      });
      const rentNftDude = (await ethers.getContract(
        'RentNft',
        dude.address
      )) as RentNftT;
      const erc721Dude = (await ethers.getContract(
        'MyERC721',
        dude.address
      )) as ERC721T;
      const pmtAmt = ethers.utils.parseEther(
        (rentDuration * 1.6921 + 0.0001).toString()
      );
      await rentNftDude.rent([ERC721.address], [1], [1], [rentDuration], {
        value: pmtAmt,
      });
      await erc721Dude.setApprovalForAll(rentNftDude.address, true);
      const tx = await rentNftDude.returnIt([ERC721.address], [1], [1]);
      const latestBlock = await ethers.provider.getBlock('latest');
      const receipt = await tx.wait();
      validateReturned({
        events: receipt.events ?? [],
        nftAddress: [ERC721.address],
        tokenId: [1],
        lendingId: [1],
        renterAddress: [dude.address],
        returnedAt: [latestBlock.timestamp],
      });
      // todo validate that the correct amounts have been returned to me
    });
    it('returns ok - one eth one erc20', async () => {
      const rentDuration = 1;
      const dailyRentPrice = packPrice(1.6921);
      const nftPrice = packPrice(0.0001);
      await lendBatch({
        tokenIds: [1],
        paymentTokens: [1],
        maxRentDurations: [1],
        dailyRentPrices: [dailyRentPrice],
        nftPrices: [nftPrice],
      });
      const rentNftDude = (await ethers.getContract(
        'RentNft',
        dude.address
      )) as RentNftT;
      const erc721Dude = (await ethers.getContract(
        'MyERC721',
        dude.address
      )) as ERC721T;
      const pmtAmt = ethers.utils.parseEther(
        (rentDuration * 1.6921 + 0.0001).toString()
      );
      await rentNftDude.rent([ERC721.address], [1], [1], [rentDuration], {
        value: pmtAmt,
      });
      await erc721Dude.setApprovalForAll(rentNftDude.address, true);
      const tx = await rentNftDude.returnIt([ERC721.address], [1], [1]);
      const latestBlock = await ethers.provider.getBlock('latest');
      const receipt = await tx.wait();
      validateReturned({
        events: receipt.events ?? [],
        nftAddress: [ERC721.address],
        tokenId: [1],
        lendingId: [1],
        renterAddress: [dude.address],
        returnedAt: [latestBlock.timestamp],
      });
    });
    it('reverts if one of the returned NFTs is past the rent date', async () => {});
    it('does not return if you are not the renter', async () => {});

  });

  context('Collateral Claiming', async function () {
    it('claims collateral ok - one eth', async () => {});

    it('claims colalteral ok - one eth one erc20', async () => {});

    it('claims collateral ok - two eth', async () => {});

    it('claims collateral ok - two eth one erc20', async () => {});

    it('claims collateral ok - two eth two erc20', async () => {});

    it('claims collateral ok - one erc20', async () => {});

    it('claims collateral ok - two erc20', async () => {});

    it('does not claim collateral if not time', async () => {});

    it('does not claim collateral on returned NFTs', async () => {});

    it('does not claim collateral on unrented NFTs', async () => {});

    it('reverts the batch if one claim is invalid', async () => {});
  });

  context('Integration', async function () {
    it('relends ok', async () => {});

    it('A lends, B rents, B lends, C rents, C defaults', async () => {});

    it('relends 10 times ok', async () => {});
  });

  context('Admin', async () => {
    it('sets the rentFee', async () => {});
    it('sets the beneficiary', async () => {});
  });
});
