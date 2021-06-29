import { BigNumber } from "ethers";
import { Event } from "@ethersproject/contracts/lib";
import { ethers, deployments, getNamedAccounts } from "hardhat";

import { expect } from "./chai-setup";
import { ReNFT } from "../frontend/src/hardhat/typechain/ReNFT";
import { Resolver } from "../frontend/src/hardhat/typechain/Resolver";
import { ERC20 } from "../frontend/src/hardhat/typechain/ERC20";
import { E721 } from "../frontend/src/hardhat/typechain/E721";
import { E721B } from "../frontend/src/hardhat/typechain/E721B";
import { E1155 } from "../frontend/src/hardhat/typechain/E1155";
import { E1155B } from "../frontend/src/hardhat/typechain/E1155B";
import { Utils } from "../frontend/src/hardhat/typechain/Utils";

import {
  packPrice,
  takeFee,
  getEvents,
  advanceTime,
  getLatestBlock,
} from "./utils";

// default values
const MAX_RENT_DURATION = 1; // 1 day
const DAILY_RENT_PRICE = packPrice(2);
const NFT_PRICE = packPrice(3);
const PAYMENT_TOKEN_WETH = 1; // default token is WETH
const PAYMENT_TOKEN_DAI = 2;
const PAYMENT_TOKEN_USDC = 3;
// const PAYMENT_TOKEN_USDT = 4;

const SECONDS_IN_A_DAY = 86400;
const DP18 = ethers.utils.parseEther("1");
const ERC20_SEND_AMT = ethers.utils.parseEther("100000000");

type NamedAccount = {
  address: string;
  renft: ReNFT;
  weth: ERC20;
  dai: ERC20;
  usdc: ERC20;
  e721: E721;
  e1155: E1155;
  e721b: E721B;
  e1155b: E1155B;
};

type lendBatchArgs = {
  nftAddresses?: string[];
  tokenIds: number[];
  amounts?: number[];
  maxRentDurations?: number[];
  dailyRentPrices?: string[];
  nftPrices?: string[];
  expectedLendingIds?: number[];
};

const setup = deployments.createFixture(async () => {
  await deployments.fixture(["Test", "Development"]);
  // beneficiary is the party that receives the rent fee cuts
  const { deployer, beneficiary, renter, lender } = await getNamedAccounts();
  const signers = await ethers.getSigners();
  const resolver = ((await ethers.getContract(
    "Resolver"
  )) as unknown) as Resolver;
  const weth = ((await ethers.getContract("WETH")) as unknown) as ERC20;
  const dai = ((await ethers.getContract("DAI")) as unknown) as ERC20;
  const usdc = ((await ethers.getContract("USDC")) as unknown) as ERC20;
  const e721 = ((await ethers.getContract("E721")) as unknown) as E721;
  const e721b = ((await ethers.getContract("E721B")) as unknown) as E721B;
  const e1155 = ((await ethers.getContract("E1155")) as unknown) as E1155;
  const e1155b = ((await ethers.getContract("E1155B")) as unknown) as E1155B;
  const utils = ((await ethers.getContract("Utils")) as unknown) as Utils;
  const renft = ((await ethers.getContract("ReNFT")) as unknown) as ReNFT;

  await weth.transfer(renter, ERC20_SEND_AMT);
  await weth.transfer(lender, ERC20_SEND_AMT);
  await dai.transfer(renter, ERC20_SEND_AMT);
  await dai.transfer(lender, ERC20_SEND_AMT);
  await usdc.transfer(renter, ERC20_SEND_AMT);
  await usdc.transfer(lender, ERC20_SEND_AMT);

  const renftRenter = ((await ethers.getContract(
    "ReNFT",
    renter
  )) as unknown) as ReNFT;
  const renftLender = ((await ethers.getContract(
    "ReNFT",
    lender
  )) as unknown) as ReNFT;
  const wethRenter = ((await ethers.getContract(
    "WETH",
    renter
  )) as unknown) as ERC20;
  const wethLender = ((await ethers.getContract(
    "WETH",
    lender
  )) as unknown) as ERC20;
  const daiRenter = ((await ethers.getContract(
    "DAI",
    renter
  )) as unknown) as ERC20;
  const daiLender = ((await ethers.getContract(
    "DAI",
    lender
  )) as unknown) as ERC20;
  const usdcRenter = ((await ethers.getContract(
    "USDC",
    renter
  )) as unknown) as ERC20;
  const usdcLender = ((await ethers.getContract(
    "USDC",
    lender
  )) as unknown) as ERC20;
  const e721Renter = ((await ethers.getContract(
    "E721",
    renter
  )) as unknown) as E721;
  const e721Lender = ((await ethers.getContract(
    "E721",
    lender
  )) as unknown) as E721;
  const e721bRenter = ((await ethers.getContract(
    "E721B",
    renter
  )) as unknown) as E721;
  const e721bLender = ((await ethers.getContract(
    "E721B",
    lender
  )) as unknown) as E721;
  const e1155Renter = ((await ethers.getContract(
    "E1155",
    renter
  )) as unknown) as E1155;
  const e1155Lender = ((await ethers.getContract(
    "E1155",
    lender
  )) as unknown) as E1155;
  const e1155bRenter = ((await ethers.getContract(
    "E1155B",
    renter
  )) as unknown) as E1155;
  const e1155bLender = ((await ethers.getContract(
    "E1155B",
    lender
  )) as unknown) as E1155;

  await wethRenter.approve(renft.address, ethers.constants.MaxUint256);
  await wethLender.approve(renft.address, ethers.constants.MaxUint256);
  await daiRenter.approve(renft.address, ethers.constants.MaxUint256);
  await daiLender.approve(renft.address, ethers.constants.MaxUint256);
  await usdcRenter.approve(renft.address, ethers.constants.MaxUint256);
  await usdcLender.approve(renft.address, ethers.constants.MaxUint256);

  await e721Renter.setApprovalForAll(renft.address, true);
  await e721Lender.setApprovalForAll(renft.address, true);
  await e721bRenter.setApprovalForAll(renft.address, true);
  await e721bLender.setApprovalForAll(renft.address, true);
  await e1155Renter.setApprovalForAll(renft.address, true);
  await e1155Lender.setApprovalForAll(renft.address, true);
  await e1155bRenter.setApprovalForAll(renft.address, true);
  await e1155bLender.setApprovalForAll(renft.address, true);

  for (let i = 0; i < 10; i++) {
    await e721Lender.award();
    await e721bLender.award();
    await e1155Lender.award();
    await e1155bLender.award();
  }
  await e721.setApprovalForAll(renft.address, true);
  await e721b.setApprovalForAll(renft.address, true);
  await e1155.setApprovalForAll(renft.address, true);
  await e1155b.setApprovalForAll(renft.address, true);

  return {
    resolver,
    renft,
    weth,
    dai,
    usdc,
    e721,
    e1155,
    e721b,
    e1155b,
    utils,
    signers,
    deployer,
    beneficiary,
    renter: {
      address: renter,
      weth: wethRenter,
      dai: daiRenter,
      usdc: usdcRenter,
      e721: e721Renter,
      e721b: e721bRenter,
      e1155: e1155Renter,
      e1155b: e1155bRenter,
      renft: renftRenter,
    },
    lender: {
      address: lender,
      weth: wethLender,
      dai: daiLender,
      usdc: usdcRenter,
      e721: e721Lender,
      e721b: e721bLender,
      e1155: e1155Lender,
      e1155b: e1155bLender,
      renft: renftLender,
    },
  };
});

const captureBalances = async (
  accs: (NamedAccount | ReNFT)[],
  coins: ERC20[]
) => {
  const balances = [];
  for (let i = 0; i < accs.length; i++) {
    for (let j = 0; j < coins.length; j++) {
      balances.push(await coins[j].balanceOf(accs[i].address));
    }
  }
  return balances;
};

describe("ReNFT", function () {
  context("Lending", async function () {
    let renft: ReNFT;
    let usdc: ERC20;
    let e721: E721;
    let e721b: E721B;
    let e1155: E1155;
    let e1155b: E1155B;
    let lender: NamedAccount;

    beforeEach(async () => {
      const o = await setup();
      renft = o.lender.renft;
      usdc = o.lender.usdc;
      e721 = o.lender.e721;
      e721b = o.lender.e721b;
      e1155 = o.lender.e1155;
      e1155b = o.lender.e1155b;
      lender = o.lender;
    });

    const validateEvent = async (
      e: Event["args"],
      {
        nftAddress,
        tokenId,
        lendingId,
        amount,
      }: {
        nftAddress: string;
        tokenId: number;
        lendingId: number;
        amount: number;
      }
    ) => {
      if (!e) throw new Error("No args");
      expect(e.nftAddress).to.eq(nftAddress);
      expect(e.tokenId).to.eq(tokenId);
      expect(e.lendingId).to.eq(lendingId);
      expect(e.lenderAddress).to.eq(lender.address);
      expect(e.maxRentDuration).to.eq(MAX_RENT_DURATION);
      expect(e.dailyRentPrice).to.eq(DAILY_RENT_PRICE);
      expect(e.nftPrice).to.eq(NFT_PRICE);
      expect(e.paymentToken).to.eq(PAYMENT_TOKEN_WETH);

      switch (e.nftAddress.toLowerCase()) {
        case e721.address.toLowerCase():
          expect(await e721.ownerOf(tokenId)).to.eq(renft.address);
          break;
        case e721b.address.toLowerCase():
          expect(await e721b.ownerOf(tokenId)).to.eq(renft.address);
          break;
        case e1155b.address.toLowerCase():
          expect(await e1155b.balanceOf(renft.address, tokenId)).to.eq(amount);
          break;
        case e1155.address.toLowerCase():
          expect(await e1155.balanceOf(renft.address, tokenId)).to.eq(amount);
          break;
        default:
          throw new Error("unknown address");
      }
    };

    const lendBatch = async ({
      tokenIds,
      nftAddresses = Array(tokenIds.length).fill(e721.address),
      amounts = Array(tokenIds.length).fill(1),
      maxRentDurations = Array(tokenIds.length).fill(MAX_RENT_DURATION),
      dailyRentPrices = Array(tokenIds.length).fill(DAILY_RENT_PRICE),
      nftPrices = Array(tokenIds.length).fill(NFT_PRICE),
      expectedLendingIds = tokenIds.map((_, ix) => ix + 1),
    }: lendBatchArgs & {
      nftAddresses?: string[];
    }) => {
      const txn = await renft.lend(
        nftAddresses,
        tokenIds,
        amounts,
        maxRentDurations,
        dailyRentPrices,
        nftPrices,
        Array(tokenIds.length).fill(PAYMENT_TOKEN_WETH)
      );

      const receipt = await txn.wait();
      const e = getEvents(receipt.events ?? [], "Lent");
      expect(e.length).to.eq(tokenIds.length);

      for (let i = 0; i < tokenIds.length; i++) {
        const ev = e[i].args;
        await validateEvent(ev, {
          nftAddress: nftAddresses[i],
          tokenId: tokenIds[i],
          lendingId: expectedLendingIds[i],
          amount: amounts[i],
        });
      }
    };

    it("721", async function () {
      await lendBatch({ tokenIds: [1] });
    });

    it("721b", async function () {
      await lendBatch({ tokenIds: [1], nftAddresses: [e721b.address] });
    });

    it("1155", async function () {
      await lendBatch({
        tokenIds: [1],
        nftAddresses: [e1155.address],
      });
    });

    it("1155:amounts=[2]", async function () {
      await lendBatch({
        // toeknId 1004 is a shield. see Test/E1155.sol
        tokenIds: [1004],
        amounts: [2],
        nftAddresses: [e1155.address],
      });
    });

    it("721 -> 721", async function () {
      await lendBatch({ tokenIds: [1], expectedLendingIds: [1] });
      await lendBatch({ tokenIds: [2], expectedLendingIds: [2] });
    });

    it("1155 -> 1155", async function () {
      await lendBatch({
        tokenIds: [1],
        amounts: [1],
        expectedLendingIds: [1],
        nftAddresses: [e1155.address],
      });
      await lendBatch({
        tokenIds: [2],
        amounts: [1],
        expectedLendingIds: [2],
        nftAddresses: [e1155.address],
      });
    });

    it("721:tokenIds=[1,2]", async function () {
      await lendBatch({ tokenIds: [1, 2] });
    });

    it("1155:tokenIds=[1,2]", async function () {
      await lendBatch({
        tokenIds: [1, 2],
        amounts: [1, 1],
        nftAddresses: [e1155.address, e1155.address],
      });
    });

    it("{721,721B}", async () => {
      await lendBatch({
        tokenIds: [1, 1],
        amounts: [1, 1],
        maxRentDurations: [1, 1],
        expectedLendingIds: [1, 2],
        nftAddresses: [e721.address, e721b.address],
      });
    });

    it("{721B,721}", async () => {
      await lendBatch({
        tokenIds: [1, 1],
        amounts: [1, 1],
        maxRentDurations: [1, 1],
        expectedLendingIds: [1, 2],
        nftAddresses: [e721b.address, e721.address],
      });
    });

    it("{721,1155}", async () => {
      await lendBatch({
        tokenIds: [1, 1],
        amounts: [1, 1],
        maxRentDurations: [1, 1],
        expectedLendingIds: [1, 2],
        nftAddresses: [e721.address, e1155.address],
      });
    });

    it("{1155,721}", async () => {
      await lendBatch({
        tokenIds: [1, 1],
        amounts: [1, 1],
        maxRentDurations: [1, 1],
        expectedLendingIds: [1, 2],
        nftAddresses: [e1155.address, e721.address],
      });
    });

    it("{1155,1155}", async () => {
      await lendBatch({
        tokenIds: [1, 2],
        amounts: [1, 1],
        maxRentDurations: [1, 1],
        expectedLendingIds: [1, 2],
        nftAddresses: [e1155.address, e1155.address],
      });
    });

    it("{1155,1155B}", async () => {
      await lendBatch({
        tokenIds: [1, 1],
        amounts: [1, 1],
        maxRentDurations: [1, 1],
        expectedLendingIds: [1, 2],
        nftAddresses: [e1155.address, e1155b.address],
      });
    });

    it("{721,721,1155}", async () => {
      await lendBatch({
        tokenIds: [1, 2, 1],
        amounts: [1, 1, 1],
        maxRentDurations: [1, 1, 1],
        expectedLendingIds: [1, 2, 3],
        nftAddresses: [e721.address, e721.address, e1155.address],
      });
    });

    it("{721,1155,721}", async () => {
      await lendBatch({
        tokenIds: [1, 1, 2],
        amounts: [1, 1, 1],
        maxRentDurations: [1, 1, 1],
        expectedLendingIds: [1, 2, 3],
        nftAddresses: [e721.address, e1155.address, e721.address],
      });
    });

    it("{721,1155,1155}", async () => {
      await lendBatch({
        tokenIds: [1, 1, 2],
        amounts: [1, 1, 1],
        maxRentDurations: [1, 1, 1],
        expectedLendingIds: [1, 2, 3],
        nftAddresses: [e721.address, e1155.address, e1155.address],
      });
    });

    it("{721,1155,1155B}", async () => {
      await lendBatch({
        tokenIds: [1, 1, 2],
        amounts: [1, 1, 1],
        maxRentDurations: [1, 1, 1],
        expectedLendingIds: [1, 2, 3],
        nftAddresses: [e721.address, e1155.address, e1155b.address],
      });
    });

    it("{721,1155,1155,721}", async () => {
      await lendBatch({
        tokenIds: [1, 1, 2, 2],
        amounts: [1, 1, 1, 1],
        maxRentDurations: [1, 1, 1, 1],
        expectedLendingIds: [1, 2, 3, 4],
        nftAddresses: [
          e721.address,
          e1155.address,
          e1155.address,
          e721.address,
        ],
      });
    });

    it("{721,1155,1155B,721}", async () => {
      await lendBatch({
        tokenIds: [1, 1, 1, 2],
        amounts: [1, 1, 1, 1],
        maxRentDurations: [1, 1, 1, 1],
        expectedLendingIds: [1, 2, 3, 4],
        nftAddresses: [
          e721.address,
          e1155.address,
          e1155b.address,
          e721.address,
        ],
      });
    });

    it("{1155,721,721}", async () => {
      await lendBatch({
        tokenIds: [1, 1, 2],
        amounts: [1, 1, 1],
        maxRentDurations: [1, 1, 1],
        expectedLendingIds: [1, 2, 3],
        nftAddresses: [e1155.address, e721.address, e721.address],
      });
    });

    it("reverts on unsupported token type", async () => {
      await expect(lendBatch({ nftAddresses: [usdc.address], tokenIds: [1] }))
        .to.be.reverted;
    });

    it("reverts if tries to lend again - 721", async function () {
      const tokenIds = [1];
      await lendBatch({ tokenIds });
      await expect(lendBatch({ tokenIds })).to.be.revertedWith(
        "ERC721: transfer of token that is not own"
      );
    });

    it("reverts if tries to lend again - 1155", async function () {
      const tokenIds = [1];
      await lendBatch({
        tokenIds,
        amounts: [1],
        nftAddresses: [e1155.address],
      });
      // re-lending the same NFT when you have no more amounts will fail
      await expect(
        lendBatch({
          tokenIds,
          amounts: [1],
          nftAddresses: [e1155.address],
        })
      ).to.be.revertedWith("ERC1155: insufficient balance for transfer");
    });

    it("disallows zero day maxRentDuration - 721", async () => {
      const tokenIds = [1];
      await expect(
        lendBatch({ tokenIds, maxRentDurations: [0] })
      ).to.be.revertedWith("ReNFT::duration is zero");
    });

    it("disallows zero day maxRentDuration - 1155", async () => {
      const tokenIds = [1];
      await expect(
        lendBatch({
          tokenIds,
          amounts: [1],
          maxRentDurations: [0],
          nftAddresses: [e1155.address],
        })
      ).to.be.revertedWith("ReNFT::duration is zero");
    });
  });

  context("Price Unpacking", async function () {
    let utils: Utils;

    beforeEach(async () => {
      const o = await setup();
      utils = o.utils;
    });

    it("unpacks valid number", async () => {
      // this is 1.0001 ether
      const price = "0x00010001";
      const unpacked = await utils.unpackPrice(price, DP18);
      expect(unpacked).to.be.equal(ethers.utils.parseEther("1.0001"));
    });

    // we do not allow zeros. If someone passes zero, then we change it
    // to 0.0001 default scale of the coin (10 ** decimals)
    it("reverts on zero price", async () => {
      const price = "0x00000000";
      const unpacked = utils.unpackPrice(price, DP18);
      expect(unpacked).to.be.revertedWith("invalid price");
    });

    // if someone passses max, then we convert to our max
    // which is 9999.9999 default scale of the coin (10 ** decimals)
    it("unpacks max correctly", async () => {
      const price = "0xffffffff";
      const unpacked = await utils.unpackPrice(price, DP18);
      expect(unpacked).to.be.equal(ethers.utils.parseEther("9999.9999"));
    });

    it("unpacks 0.0001 correctly", async () => {
      const price = "0x00000001";
      const unpacked = await utils.unpackPrice(price, DP18);
      expect(unpacked).to.be.equal(ethers.utils.parseEther("0.0001"));
    });

    // this is for different scale tokens. some tokens have 18 dp
    // some have 12 etc. e.g. USDC has 6 decimal places
    it("unpacks DP12 corrctly", async () => {
      const price = "0x00020003";
      const unpacked = await utils.unpackPrice(
        price,
        ethers.utils.parseUnits("1", "szabo")
      );
      expect(unpacked).to.be.equal(ethers.utils.parseUnits("2.0003", "szabo"));
    });

    it("reverts for DP3", async () => {
      const price = "0x00000001";
      const unpacked = utils.unpackPrice(price, "1000");
      expect(unpacked).to.be.revertedWith("invalid scale");
    });

    it("unpacks DP4 correctly", async () => {
      const price = "0x00010001";
      const unpacked = await utils.unpackPrice(price, "10000");
      expect(unpacked).to.be.equal(10001);
    });
  });

  context("Renting", async function () {
    let ReNFT: ReNFT;
    let E721: E721;
    let E1155: E1155;
    let WETH: ERC20;
    let USDC: ERC20;
    let Utils: Utils;

    let lender: NamedAccount;
    let renter: NamedAccount;

    beforeEach(async () => {
      const o = await setup();
      lender = o.lender;
      renter = o.renter;
      Utils = o.utils;
      ReNFT = renter.renft;
      E721 = renter.e721;
      E1155 = renter.e1155;
      USDC = renter.usdc;
      WETH = renter.weth;
    });

    const lendBatch = async ({
      tokenIds,
      nftAddresses = Array(tokenIds.length).fill(E721.address),
      amounts = Array(tokenIds.length).fill(1),
      paymentTokens,
      maxRentDurations = Array(tokenIds.length).fill(MAX_RENT_DURATION),
      dailyRentPrices = Array(tokenIds.length).fill(DAILY_RENT_PRICE),
      nftPrices = Array(tokenIds.length).fill(NFT_PRICE),
    }: lendBatchArgs & { paymentTokens: number[] }) => {
      await lender.renft.lend(
        nftAddresses,
        tokenIds,
        amounts,
        maxRentDurations,
        dailyRentPrices,
        nftPrices,
        paymentTokens
      );
    };

    const validateRented = ({
      lendingId,
      rentDuration,
      rentedAt,
      events,
    }: {
      lendingId: number[];
      renterAddress: string[];
      rentDuration: number[];
      rentedAt: number[];
      events: Event[];
    }) => {
      const es = getEvents(events, "Rented");
      for (let i = 0; i < es.length; i++) {
        const event = es[i].args;
        if (!event) throw new Error("no args");
        expect(event.lendingId).to.be.equal(lendingId[i]);
        expect(event.rentDuration).to.be.equal(rentDuration[i]);
        expect(event.rentedAt).to.be.equal(rentedAt[i]);
      }
    };

    it("rents ok - WETH - e721", async () => {
      await lendBatch({
        tokenIds: [1],
        paymentTokens: [PAYMENT_TOKEN_WETH],
        maxRentDurations: [3],
      });

      const rentDurations = [2];
      const balancesPre = await captureBalances([renter, ReNFT], [WETH]);

      expect(balancesPre[1]).to.be.equal(0);

      const rentAmounts = BigNumber.from(rentDurations[0]).mul(
        await Utils.unpackPrice(DAILY_RENT_PRICE, DP18)
      );
      const pmtAmount = (await Utils.unpackPrice(NFT_PRICE, DP18)).add(
        rentAmounts
      );

      const tx = await ReNFT.rent([E721.address], [1], [1], rentDurations);

      const balancesPost = await captureBalances([renter, ReNFT], [WETH]);
      expect(balancesPost[1]).to.be.equal(pmtAmount);
      expect(balancesPost[0]).to.be.equal(balancesPre[0].sub(pmtAmount));

      const receipt = await tx.wait();

      const rentedAt = [(await getLatestBlock()).timestamp];
      const events = receipt.events ?? [];
      validateRented({
        lendingId: [1],
        renterAddress: [renter.address],
        rentDuration: [2],
        rentedAt,
        events,
      });
    });

    it("rents ok - WETH - e1155", async () => {
      await lendBatch({
        nftAddresses: [E1155.address],
        tokenIds: [1003],
        paymentTokens: [PAYMENT_TOKEN_WETH],
        maxRentDurations: [3],
      });

      const rentDurations = [2];
      const balancesPre = await captureBalances([renter, ReNFT], [WETH]);

      expect(balancesPre[1]).to.be.equal(0);

      const rentAmounts = BigNumber.from(rentDurations[0]).mul(
        await Utils.unpackPrice(DAILY_RENT_PRICE, DP18)
      );
      const pmtAmount = (await Utils.unpackPrice(NFT_PRICE, DP18)).add(
        rentAmounts
      );

      const tx = await ReNFT.rent([E1155.address], [1003], [1], rentDurations);

      const balancesPost = await captureBalances([renter, ReNFT], [WETH]);
      expect(balancesPost[1]).to.be.equal(pmtAmount);
      expect(balancesPost[0]).to.be.equal(balancesPre[0].sub(pmtAmount));

      const receipt = await tx.wait();

      const rentedAt = [(await getLatestBlock()).timestamp];
      const events = receipt.events ?? [];
      validateRented({
        lendingId: [1],
        renterAddress: [renter.address],
        rentDuration: [2],
        rentedAt,
        events,
      });
    });

    it("rents ok - USDC (DP6) - e721", async () => {
      const tokenIds = [1];
      const rentDurations = [2];
      const maxRentDurations = [10];
      const paymentTokens = [PAYMENT_TOKEN_USDC];

      await lendBatch({
        tokenIds,
        paymentTokens,
        maxRentDurations,
      });

      const nftAddress = [E721.address];
      const lendingId = [1];
      const scale = BigNumber.from((10 ** (await USDC.decimals())).toString());

      const balancesPre = await captureBalances([renter, ReNFT], [USDC]);
      const pmtAmount = (await Utils.unpackPrice(NFT_PRICE, scale)).add(
        BigNumber.from(rentDurations[0]).mul(
          await Utils.unpackPrice(DAILY_RENT_PRICE, scale)
        )
      );

      const tx = await ReNFT.rent(
        nftAddress,
        tokenIds,
        lendingId,
        rentDurations
      );

      const receipt = await tx.wait();
      const balancesPost = await captureBalances([renter, ReNFT], [USDC]);

      expect(balancesPost[1]).to.be.equal(pmtAmount);
      expect(balancesPre[0].sub(balancesPost[0])).to.be.equal(pmtAmount);

      const rentedAt = [(await getLatestBlock()).timestamp];
      const events = receipt.events ?? [];
      validateRented({
        lendingId,
        renterAddress: [renter.address],
        rentDuration: rentDurations,
        rentedAt,
        events,
      });
    });

    it("does not rent when insufficient money sent - USDC - e721", async () => {
      const tokenIds = [1];
      await lendBatch({
        tokenIds,
        paymentTokens: [PAYMENT_TOKEN_USDC],
        maxRentDurations: [3],
      });
      const nftAddress = [E721.address];
      const tokenId = [1];
      const lendingId = [1];
      const rentDuration = [2];
      const allRentersBalance = await renter.usdc.balanceOf(renter.address);
      await renter.usdc.transfer(lender.address, allRentersBalance);

      await expect(
        ReNFT.rent(nftAddress, tokenId, lendingId, rentDuration)
      ).to.be.revertedWith("transfer amount exceeds balance");
    });

    it("rents ok - WETH & USDC - e721", async () => {
      const tokenIds = [1, 2];
      const paymentTokens = [1, 3];
      await lendBatch({
        tokenIds,
        paymentTokens,
        maxRentDurations: [10, 5],
      });

      const nftAddress = Array(2).fill(E721.address);
      const lendingId = [1, 2];
      const rentDuration = [1, 1];

      const WETH_SCALE = BigNumber.from(
        (10 ** (await WETH.decimals())).toString()
      );
      const USDC_SCALE = BigNumber.from(
        (10 ** (await USDC.decimals())).toString()
      );

      const pmtAmounts = [
        (await Utils.unpackPrice(NFT_PRICE, WETH_SCALE)).add(
          BigNumber.from(rentDuration[0]).mul(
            await Utils.unpackPrice(DAILY_RENT_PRICE, WETH_SCALE)
          )
        ),
        (await Utils.unpackPrice(NFT_PRICE, USDC_SCALE)).add(
          BigNumber.from(rentDuration[1]).mul(
            await Utils.unpackPrice(DAILY_RENT_PRICE, USDC_SCALE)
          )
        ),
      ];

      // renterWETH, renterUSDC, ReNFTWETH, ReNFTUSDC
      const balancesPre = await captureBalances([renter, ReNFT], [WETH, USDC]);
      const tx = await ReNFT.rent(
        nftAddress,
        tokenIds,
        lendingId,
        rentDuration
      );
      const balancesPost = await captureBalances([renter, ReNFT], [WETH, USDC]);
      const receipt = await tx.wait();

      expect(balancesPost[2]).to.be.equal(pmtAmounts[0]);
      expect(balancesPost[3]).to.be.equal(pmtAmounts[1]);
      expect(balancesPre[0].sub(balancesPost[0])).to.be.equal(pmtAmounts[0]);
      expect(balancesPre[1].sub(balancesPost[1])).to.be.equal(pmtAmounts[1]);

      const rentedAt = Array(2).fill((await getLatestBlock()).timestamp);
      const events = receipt.events ?? [];
      validateRented({
        lendingId,
        renterAddress: [renter.address, renter.address],
        rentDuration,
        rentedAt,
        events,
      });
    });

    it("does not rent when insufficient money sent - WETH & USDC - WETH not sufficient", async () => {
      const tokenIds = [1, 2];
      const paymentTokens = [PAYMENT_TOKEN_WETH, PAYMENT_TOKEN_USDC];
      await lendBatch({
        tokenIds,
        paymentTokens,
        maxRentDurations: [10, 5],
      });
      const nftAddress = Array(2).fill(E721.address);
      const lendingId = [1, 2];
      const rentDuration = [2, 5];

      const allRentersBalance = await renter.weth.balanceOf(renter.address);
      await renter.weth.transfer(lender.address, allRentersBalance);

      const tx = ReNFT.rent(nftAddress, tokenIds, lendingId, rentDuration);
      await expect(tx).to.be.revertedWith("transfer amount exceeds balance");
    });

    it("rents ok - WETH & WETH", async () => {
      const tokenIds = [1, 2];
      await lendBatch({
        tokenIds,
        paymentTokens: [PAYMENT_TOKEN_WETH, PAYMENT_TOKEN_WETH],
        maxRentDurations: [3, 2],
      });
      const nftAddress = [E721.address, E721.address];
      const tokenId = [1, 2];
      const lendingId = [1, 2];
      const rentDuration = [2, 1];

      const WETH_SCALE = BigNumber.from(
        (10 ** (await WETH.decimals())).toString()
      );
      // renterWETH, renterUSDC, ReNFTWETH, ReNFTUSDC
      const balancesPre = await captureBalances([renter, ReNFT], [WETH]);

      const pmtAmounts = [
        (await Utils.unpackPrice(NFT_PRICE, WETH_SCALE)).add(
          BigNumber.from(rentDuration[0]).mul(
            await Utils.unpackPrice(DAILY_RENT_PRICE, WETH_SCALE)
          )
        ),
        (await Utils.unpackPrice(NFT_PRICE, WETH_SCALE)).add(
          BigNumber.from(rentDuration[1]).mul(
            await Utils.unpackPrice(DAILY_RENT_PRICE, WETH_SCALE)
          )
        ),
      ];
      const tx = await ReNFT.rent(nftAddress, tokenId, lendingId, rentDuration);
      const balancesPost = await captureBalances([renter, ReNFT], [WETH]);
      const receipt = await tx.wait();

      expect(balancesPost[1]).to.be.equal(pmtAmounts[0].add(pmtAmounts[1]));
      expect(balancesPre[0].sub(balancesPost[0])).to.be.equal(
        pmtAmounts[0].add(pmtAmounts[1])
      );

      const rentedAt = Array(2).fill((await getLatestBlock()).timestamp);
      const events = receipt.events ?? [];
      validateRented({
        lendingId,
        renterAddress: [renter.address, renter.address],
        rentDuration,
        rentedAt,
        events,
      });
    });

    it("rents ok - USDC & USDC", async () => {
      const tokenIds = [1, 2];
      await lendBatch({
        tokenIds,
        paymentTokens: [PAYMENT_TOKEN_USDC, PAYMENT_TOKEN_USDC],
        maxRentDurations: [3, 2],
      });
      const nftAddress = [E721.address, E721.address];
      const tokenId = [1, 2];
      const lendingId = [1, 2];
      const rentDuration = [2, 1];

      const USDC_SCALE = BigNumber.from(
        (10 ** (await USDC.decimals())).toString()
      );
      const balancesPre = await captureBalances([renter, ReNFT], [USDC]);

      const pmtAmounts = [
        (await Utils.unpackPrice(NFT_PRICE, USDC_SCALE)).add(
          BigNumber.from(rentDuration[0]).mul(
            await Utils.unpackPrice(DAILY_RENT_PRICE, USDC_SCALE)
          )
        ),
        (await Utils.unpackPrice(NFT_PRICE, USDC_SCALE)).add(
          BigNumber.from(rentDuration[1]).mul(
            await Utils.unpackPrice(DAILY_RENT_PRICE, USDC_SCALE)
          )
        ),
      ];

      const tx = await ReNFT.rent(nftAddress, tokenId, lendingId, rentDuration);
      const balancesPost = await captureBalances([renter, ReNFT], [USDC]);
      const receipt = await tx.wait();

      expect(balancesPost[1]).to.be.equal(pmtAmounts[0].add(pmtAmounts[1]));
      expect(balancesPre[0].sub(balancesPost[0])).to.be.equal(
        pmtAmounts[0].add(pmtAmounts[1])
      );

      const rentedAt = Array(2).fill((await getLatestBlock()).timestamp);
      const events = receipt.events ?? [];
      validateRented({
        lendingId,
        renterAddress: [renter.address, renter.address],
        rentDuration,
        rentedAt,
        events,
      });
    });

    it("does not rent - rent duration is zero", async () => {
      const tokenIds = [1];
      const erc20 = 2;
      await lendBatch({
        tokenIds,
        paymentTokens: [erc20],
        maxRentDurations: [3],
      });
      const nftAddress = [E721.address];
      const tokenId = [1];
      const lendingId = [1];
      const rentDuration = [0];
      await expect(
        ReNFT.rent(nftAddress, tokenId, lendingId, rentDuration)
      ).to.be.revertedWith("ReNFT::duration is zero");
    });

    it("does not rent - rent duration exceeds max duration", async () => {
      const tokenIds = [1];
      const erc20 = 2;
      await lendBatch({
        tokenIds,
        paymentTokens: [erc20],
        maxRentDurations: [3],
      });
      await expect(
        ReNFT.rent([E721.address], [1], [1], [4])
      ).to.be.revertedWith("ReNFT::rent duration exceeds allowed max");
    });

    it("does not rent - already rented", async () => {
      const tokenIds = [1];
      await lendBatch({
        tokenIds,
        paymentTokens: [PAYMENT_TOKEN_WETH],
        maxRentDurations: [3],
      });
      const nftAddress = [E721.address];
      const tokenId = [1];
      const lendingId = [1];
      const rentDuration = [1];
      ReNFT.rent(nftAddress, tokenId, lendingId, rentDuration);
      await expect(ReNFT.rent(nftAddress, tokenId, lendingId, rentDuration)).to
        .be.reverted;
    });

    it("does not rent - you are lender", async () => {
      const tokenIds = [1];
      const maxRentDurations = 3;
      const _dailyRentPrices = Array(tokenIds.length).fill(DAILY_RENT_PRICE);
      const _nftPrices = Array(tokenIds.length).fill(NFT_PRICE);

      await lender.renft.lend(
        Array(tokenIds.length).fill(E721.address),
        tokenIds,
        Array(tokenIds.length).fill(1),
        [maxRentDurations],
        _dailyRentPrices,
        _nftPrices,
        [PAYMENT_TOKEN_WETH]
      );

      const nftAddress = [E721.address];
      const tokenId = [1];
      const lendingId = [1];
      const rentDuration = [1];

      await expect(
        lender.renft.rent(nftAddress, tokenId, lendingId, rentDuration)
      ).to.be.revertedWith("cant rent own nft");
    });
  });

  context("Returning", async function () {
    let ReNFT: ReNFT;
    let rentFee: BigNumber;
    let renter: NamedAccount;
    let lender: NamedAccount;
    let USDC: ERC20;
    let WETH: ERC20;
    let DAI: ERC20;
    let Utils: Utils;

    beforeEach(async () => {
      const o = await setup();
      renter = o.renter;
      lender = o.lender;
      Utils = o.utils;
      USDC = o.usdc;
      WETH = o.weth;
      DAI = o.dai;
      ReNFT = o.renft;
      rentFee = await renter.renft.rentFee();
    });

    const lendBatch = async ({
      tokenIds,
      nfts = Array(tokenIds.length).fill(lender.e721.address),
      lendAmounts = Array(tokenIds.length).fill(1),
      paymentTokens,
      maxRentDurations = Array(tokenIds.length).fill(MAX_RENT_DURATION),
      dailyRentPrices = Array(tokenIds.length).fill(DAILY_RENT_PRICE),
      nftPrices = Array(tokenIds.length).fill(NFT_PRICE),
    }: lendBatchArgs & {
      paymentTokens: number[];
      nfts?: string[];
      lendAmounts?: number[];
    }) => {
      await lender.renft.lend(
        nfts,
        tokenIds,
        lendAmounts,
        maxRentDurations,
        dailyRentPrices,
        nftPrices,
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
      const es = getEvents(events, "Rented");
      for (let i = 0; i < es.length; i++) {
        const event = es[i].args;
        if (!event) throw new Error("no args");
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

    it("returns ok - USDC - e721", async () => {
      const rentDuration = 1;
      const drp = 1.6921;
      const col = 0.0001;
      // packs correctly.
      const dailyRentPrice = packPrice(drp);
      const nftPrice = packPrice(col);

      expect(dailyRentPrice).to.be.equal("0x00011B09");
      expect(nftPrice).to.be.equal("0x00000001");

      const USDC_SCALE = 10 ** (await USDC.decimals());

      const unpackedNftPrice = await Utils.unpackPrice(nftPrice, USDC_SCALE);
      const unpackedDailyRentPrice = await Utils.unpackPrice(
        dailyRentPrice,
        USDC_SCALE
      );

      expect(unpackedNftPrice).to.be.equal(100); // 0.0001 * 1_000_000 <- col * (10 ** USDC_SCALE)
      expect(unpackedDailyRentPrice).to.be.equal(1692100); // 1.6921 * 1_000_000

      await lendBatch({
        tokenIds: [1],
        paymentTokens: [PAYMENT_TOKEN_USDC],
        maxRentDurations: [1],
        dailyRentPrices: [dailyRentPrice],
        nftPrices: [nftPrice],
      });

      const { beneficiary } = await getNamedAccounts();

      const balanceBeneficiaryPre = await USDC.balanceOf(beneficiary);
      const balancesPre = await captureBalances(
        [renter, lender, ReNFT],
        [USDC]
      );

      expect(await USDC.balanceOf(ReNFT.address)).to.be.equal(
        BigNumber.from("0")
      );

      let tx = await renter.renft.rent(
        [renter.e721.address],
        [1],
        [1],
        [rentDuration]
      );

      expect(unpackedNftPrice.add(unpackedDailyRentPrice)).to.be.equal(
        await USDC.balanceOf(ReNFT.address)
      );

      let receipt = await tx.wait();
      let es = getEvents(receipt.events ?? [], "Rented");
      // @ts-ignore
      const { rentedAt } = es[0].args;
      const warpTime = 10_000;
      await advanceTime(warpTime);

      tx = await renter.renft.returnIt([renter.e721.address], [1], [1]);

      receipt = await tx.wait();
      es = getEvents(receipt.events ?? [], "Returned");
      // @ts-ignore
      const { returnedAt } = es[0].args;
      const actualRentDuration = returnedAt - rentedAt;

      const balanceBeneficiaryPost = await USDC.balanceOf(beneficiary);
      const balancesPost = await captureBalances(
        [renter, lender, ReNFT],
        [USDC]
      );

      const rentPmt = unpackedDailyRentPrice.mul(rentDuration);
      const rentProRata = rentPmt
        .mul(actualRentDuration)
        .div(rentDuration * 86_400);
      let lenderReceives = BigNumber.from(rentProRata);
      const beneficiaryFee = takeFee(lenderReceives, rentFee);
      lenderReceives = lenderReceives.sub(beneficiaryFee);

      expect(balanceBeneficiaryPost.sub(balanceBeneficiaryPre)).to.be.equal(
        beneficiaryFee
      );
      expect(balancesPost[1].sub(balancesPre[1])).to.be.equal(lenderReceives);
      expect(balancesPost[0].sub(balancesPre[0])).to.be.equal(-rentProRata);
      expect(balancesPost[2].sub(balancesPost[2])).to.be.equal(
        BigNumber.from("0")
      );

      validateReturned({
        events: receipt.events ?? [],
        nftAddress: [renter.e721.address],
        tokenId: [1],
        lendingId: [1],
        renterAddress: [renter.address],
        returnedAt: [(await getLatestBlock()).timestamp],
      });
    });

    it("returns ok - USDC - e1155", async () => {
      const rentDuration = 1;
      const drp = 1.6921;
      const col = 0.0001;

      const dailyRentPrice = packPrice(drp);
      const nftPrice = packPrice(col);

      expect(dailyRentPrice).to.be.equal("0x00011B09");
      expect(nftPrice).to.be.equal("0x00000001");

      const USDC_SCALE = 10 ** (await USDC.decimals());

      const unpackedNftPrice = await Utils.unpackPrice(nftPrice, USDC_SCALE);
      const unpackedDailyRentPrice = await Utils.unpackPrice(
        dailyRentPrice,
        USDC_SCALE
      );

      await lendBatch({
        nfts: [lender.e1155.address],
        tokenIds: [1],
        paymentTokens: [PAYMENT_TOKEN_USDC],
        maxRentDurations: [1],
        dailyRentPrices: [dailyRentPrice],
        nftPrices: [nftPrice],
      });

      const { beneficiary } = await getNamedAccounts();

      const balanceBeneficiaryPre = await USDC.balanceOf(beneficiary);
      const balancesPre = await captureBalances(
        [renter, lender, ReNFT],
        [USDC]
      );

      expect(await USDC.balanceOf(ReNFT.address)).to.be.equal(
        BigNumber.from("0")
      );

      let tx = await renter.renft.rent(
        [renter.e1155.address],
        [1],
        [1],
        [rentDuration]
      );

      expect(unpackedNftPrice.add(unpackedDailyRentPrice)).to.be.equal(
        await USDC.balanceOf(ReNFT.address)
      );

      let receipt = await tx.wait();
      let es = getEvents(receipt.events ?? [], "Rented");
      // @ts-ignore
      const { rentedAt } = es[0].args;
      const warpTime = 10_000;
      await advanceTime(warpTime);

      tx = await renter.renft.returnIt([renter.e1155.address], [1], [1]);

      receipt = await tx.wait();
      es = getEvents(receipt.events ?? [], "Returned");
      // @ts-ignore
      const { returnedAt } = es[0].args;
      const actualRentDuration = returnedAt - rentedAt;

      const balanceBeneficiaryPost = await USDC.balanceOf(beneficiary);
      const balancesPost = await captureBalances(
        [renter, lender, ReNFT],
        [USDC]
      );

      const rentPmt = unpackedDailyRentPrice.mul(rentDuration);
      const rentProRata = rentPmt
        .mul(actualRentDuration)
        .div(rentDuration * 86_400);
      let lenderReceives = BigNumber.from(rentProRata);
      const beneficiaryFee = takeFee(lenderReceives, rentFee);
      lenderReceives = lenderReceives.sub(beneficiaryFee);

      expect(balanceBeneficiaryPost.sub(balanceBeneficiaryPre)).to.be.equal(
        beneficiaryFee
      );
      expect(balancesPost[1].sub(balancesPre[1])).to.be.equal(lenderReceives);
      expect(balancesPost[0].sub(balancesPre[0])).to.be.equal(-rentProRata);
      expect(balancesPost[2].sub(balancesPost[2])).to.be.equal(
        BigNumber.from("0")
      );

      validateReturned({
        events: receipt.events ?? [],
        nftAddress: [renter.e721.address],
        tokenId: [1],
        lendingId: [1],
        renterAddress: [renter.address],
        returnedAt: [(await getLatestBlock()).timestamp],
      });
    });

    it("returns ok - USDC - e1155, e1155, e721", async () => {
      const rentDuration = 1;
      const drp = 1.6921;
      const col = 0.0001;

      const dailyRentPrice = packPrice(drp);
      const nftPrice = packPrice(col);

      expect(dailyRentPrice).to.be.equal("0x00011B09");
      expect(nftPrice).to.be.equal("0x00000001");

      const USDC_SCALE = 10 ** (await USDC.decimals());

      const unpackedNftPrice = await Utils.unpackPrice(nftPrice, USDC_SCALE);
      const unpackedDailyRentPrice = await Utils.unpackPrice(
        dailyRentPrice,
        USDC_SCALE
      );

      await lendBatch({
        nfts: [lender.e1155.address, lender.e1155.address, lender.e721.address],
        tokenIds: [1004, 1005, 1],
        lendAmounts: [10, 9, 1],
        paymentTokens: [
          PAYMENT_TOKEN_USDC,
          PAYMENT_TOKEN_USDC,
          PAYMENT_TOKEN_USDC,
        ],
        maxRentDurations: [1, 1, 1],
        dailyRentPrices: [dailyRentPrice, dailyRentPrice, dailyRentPrice],
        nftPrices: [nftPrice, nftPrice, nftPrice],
      });

      const { beneficiary } = await getNamedAccounts();

      const balanceBeneficiaryPre = await USDC.balanceOf(beneficiary);
      const balancesPre = await captureBalances(
        [renter, lender, ReNFT],
        [USDC]
      );

      expect(await USDC.balanceOf(ReNFT.address)).to.be.equal(
        BigNumber.from("0")
      );

      let tx = await renter.renft.rent(
        [renter.e1155.address, renter.e1155.address, renter.e721.address],
        [1004, 1005, 1],
        [1, 2, 3],
        [rentDuration, rentDuration, rentDuration]
      );

      let collateral = unpackedNftPrice.mul(10);
      collateral = collateral.add(unpackedNftPrice.mul(9));
      collateral = collateral.add(unpackedNftPrice);

      expect(unpackedDailyRentPrice.mul(3).add(collateral)).to.be.equal(
        await USDC.balanceOf(ReNFT.address)
      );

      let receipt = await tx.wait();
      let es = getEvents(receipt.events ?? [], "Rented");
      // @ts-ignore
      const { rentedAt } = es[0].args;
      const warpTime = 10_000;
      await advanceTime(warpTime);

      tx = await renter.renft.returnIt(
        [renter.e1155.address, renter.e1155.address, renter.e721.address],
        [1004, 1005, 1],
        [1, 2, 3]
      );

      receipt = await tx.wait();
      es = getEvents(receipt.events ?? [], "Returned");
      // @ts-ignore
      const { returnedAt } = es[0].args;
      const actualRentDuration = returnedAt - rentedAt;

      const balanceBeneficiaryPost = await USDC.balanceOf(beneficiary);
      const balancesPost = await captureBalances(
        [renter, lender, ReNFT],
        [USDC]
      );

      const rentPmt = unpackedDailyRentPrice.mul(rentDuration);
      const rentProRata = rentPmt
        .mul(actualRentDuration)
        .div(rentDuration * 86_400);
      const lenderReceives = BigNumber.from(rentProRata);
      const beneficiaryFee = takeFee(lenderReceives, rentFee).mul(3);

      expect(balanceBeneficiaryPost.sub(balanceBeneficiaryPre)).to.be.equal(
        beneficiaryFee
      );
      expect(balancesPost[1].sub(balancesPre[1])).to.be.equal(
        lenderReceives.mul(3).sub(beneficiaryFee)
      );
      expect(balancesPost[0].sub(balancesPre[0])).to.be.equal(
        lenderReceives.mul(-3)
      );
      expect(balancesPost[2].sub(balancesPost[2])).to.be.equal(
        BigNumber.from("0")
      );

      validateReturned({
        events: receipt.events ?? [],
        nftAddress: [
          renter.e1155.address,
          renter.e1155.address,
          renter.e721.address,
        ],
        tokenId: [1004, 1005, 1],
        lendingId: [1, 2, 3],
        renterAddress: [renter.address, renter.address, renter.address],
        returnedAt: [returnedAt, returnedAt, returnedAt],
      });
    });

    it("returns ok - USDC, WETH, DAI - e721b, e1155, e721", async () => {
      const rentDuration = 2;
      const drp = 1.6921;
      const col = 0.0001;

      const dailyRentPrice = packPrice(drp);
      const nftPrice = packPrice(col);

      const USDC_SCALE = BigNumber.from("10").pow(await USDC.decimals());
      const WETH_SCALE = BigNumber.from("10").pow(await WETH.decimals());
      const DAI_SCALE = BigNumber.from("10").pow(await DAI.decimals());

      const unpackedNftPriceUSDC = await Utils.unpackPrice(
        nftPrice,
        USDC_SCALE
      );
      const unpackedDailyRentPriceUSDC = await Utils.unpackPrice(
        dailyRentPrice,
        USDC_SCALE
      );
      const unpackedNftPriceWETH = await Utils.unpackPrice(
        nftPrice,
        WETH_SCALE
      );
      const unpackedDailyRentPriceWETH = await Utils.unpackPrice(
        dailyRentPrice,
        WETH_SCALE
      );
      const unpackedNftPriceDAI = await Utils.unpackPrice(nftPrice, DAI_SCALE);
      const unpackedDailyRentPriceDAI = await Utils.unpackPrice(
        dailyRentPrice,
        DAI_SCALE
      );

      await lendBatch({
        nfts: [lender.e721b.address, lender.e1155.address, lender.e721.address],
        tokenIds: [1, 1005, 1],
        lendAmounts: [1, 13, 1],
        paymentTokens: [
          PAYMENT_TOKEN_USDC,
          PAYMENT_TOKEN_WETH,
          PAYMENT_TOKEN_DAI,
        ],
        maxRentDurations: [4, 5, 6],
        dailyRentPrices: [dailyRentPrice, dailyRentPrice, dailyRentPrice],
        nftPrices: [nftPrice, nftPrice, nftPrice],
      });

      const { beneficiary } = await getNamedAccounts();

      const balanceBeneficiaryPreUSDC = await USDC.balanceOf(beneficiary);
      const balanceBeneficiaryPreWETH = await WETH.balanceOf(beneficiary);
      const balanceBeneficiaryPreDAI = await DAI.balanceOf(beneficiary);

      const balancesPre = await captureBalances(
        [renter, lender, ReNFT],
        [USDC, WETH, DAI]
      );

      expect(await USDC.balanceOf(ReNFT.address)).to.be.equal(
        BigNumber.from("0")
      );
      expect(await WETH.balanceOf(ReNFT.address)).to.be.equal(
        BigNumber.from("0")
      );
      expect(await DAI.balanceOf(ReNFT.address)).to.be.equal(
        BigNumber.from("0")
      );

      let tx = await renter.renft.rent(
        [renter.e721b.address, renter.e1155.address, renter.e721.address],
        [1, 1005, 1],
        [1, 2, 3],
        [rentDuration, rentDuration, rentDuration]
      );

      const collateralUSDC = unpackedNftPriceUSDC.mul(1);
      const collateralWETH = unpackedNftPriceWETH.mul(13);
      const collateralDAI = unpackedNftPriceDAI.mul(1);

      expect(
        unpackedDailyRentPriceUSDC.mul(rentDuration).add(collateralUSDC)
      ).to.be.equal(await USDC.balanceOf(ReNFT.address));
      expect(
        unpackedDailyRentPriceWETH.mul(rentDuration).add(collateralWETH)
      ).to.be.equal(await WETH.balanceOf(ReNFT.address));
      expect(
        unpackedDailyRentPriceDAI.mul(rentDuration).add(collateralDAI)
      ).to.be.equal(await DAI.balanceOf(ReNFT.address));

      let receipt = await tx.wait();
      let es = getEvents(receipt.events ?? [], "Rented");
      // @ts-ignore
      const { rentedAt } = es[0].args;
      const warpTime = 10_000;
      await advanceTime(warpTime);

      tx = await renter.renft.returnIt(
        [renter.e721b.address, renter.e1155.address, renter.e721.address],
        [1, 1005, 1],
        [1, 2, 3]
      );

      receipt = await tx.wait();
      es = getEvents(receipt.events ?? [], "Returned");
      // @ts-ignore
      const { returnedAt } = es[0].args;
      const actualRentDuration = returnedAt - rentedAt;

      const balanceBeneficiaryPostUSDC = await USDC.balanceOf(beneficiary);
      const balanceBeneficiaryPostWETH = await WETH.balanceOf(beneficiary);
      const balanceBeneficiaryPostDAI = await DAI.balanceOf(beneficiary);

      const balancesPost = await captureBalances(
        [renter, lender, ReNFT],
        [USDC, WETH, DAI]
      );

      const rentPmtUSDC = unpackedDailyRentPriceUSDC.mul(rentDuration);
      const rentProRataUSDC = rentPmtUSDC
        .mul(actualRentDuration)
        .div(rentDuration * 86_400);
      const lenderReceivesUSDC = BigNumber.from(rentProRataUSDC);
      const beneficiaryFeeUSDC = takeFee(lenderReceivesUSDC, rentFee);

      const rentPmtWETH = unpackedDailyRentPriceWETH.mul(rentDuration);
      const rentProRataWETH = rentPmtWETH
        .mul(actualRentDuration)
        .div(rentDuration * 86_400);
      const lenderReceivesWETH = BigNumber.from(rentProRataWETH);
      const beneficiaryFeeWETH = takeFee(lenderReceivesWETH, rentFee);

      const rentPmtDAI = unpackedDailyRentPriceDAI.mul(rentDuration);
      const rentProRataDAI = rentPmtDAI
        .mul(actualRentDuration)
        .div(rentDuration * 86_400);
      const lenderReceivesDAI = BigNumber.from(rentProRataDAI);
      const beneficiaryFeeDAI = takeFee(lenderReceivesDAI, rentFee);

      expect(
        balanceBeneficiaryPostUSDC.sub(balanceBeneficiaryPreUSDC)
      ).to.be.equal(beneficiaryFeeUSDC);
      expect(
        balanceBeneficiaryPostWETH.sub(balanceBeneficiaryPreWETH)
      ).to.be.equal(beneficiaryFeeWETH);
      expect(
        balanceBeneficiaryPostDAI.sub(balanceBeneficiaryPreDAI)
      ).to.be.equal(beneficiaryFeeDAI);

      expect(balancesPost[3].sub(balancesPre[3])).to.be.equal(
        lenderReceivesUSDC.sub(beneficiaryFeeUSDC)
      );
      expect(balancesPost[0].sub(balancesPre[0])).to.be.equal(
        lenderReceivesUSDC.mul(-1)
      );
      expect(balancesPost[6].sub(balancesPost[6])).to.be.equal(
        BigNumber.from("0")
      );

      expect(balancesPost[4].sub(balancesPre[4])).to.be.equal(
        lenderReceivesWETH.sub(beneficiaryFeeWETH)
      );
      expect(balancesPost[1].sub(balancesPre[1])).to.be.equal(
        lenderReceivesWETH.mul(-1)
      );
      expect(balancesPost[7].sub(balancesPost[7])).to.be.equal(
        BigNumber.from("0")
      );

      expect(balancesPost[5].sub(balancesPre[5])).to.be.equal(
        lenderReceivesDAI.sub(beneficiaryFeeDAI)
      );
      expect(balancesPost[2].sub(balancesPre[2])).to.be.equal(
        lenderReceivesDAI.mul(-1)
      );
      expect(balancesPost[8].sub(balancesPost[8])).to.be.equal(
        BigNumber.from("0")
      );

      validateReturned({
        events: receipt.events ?? [],
        nftAddress: [
          renter.e721b.address,
          renter.e1155.address,
          renter.e721.address,
        ],
        tokenId: [1, 1005, 1],
        lendingId: [1, 2, 3],
        renterAddress: [renter.address, renter.address, renter.address],
        returnedAt: [returnedAt, returnedAt, returnedAt],
      });
    });

    it("returns ok - WETH & USDC", async () => {
      const rentDurations = [2, 4];
      const drpWETH = 1.6921; // acronym for daily rental price
      const collateralWETH = 0.0001; // denotes collateral
      const drpUSDC = 19.1199;
      const collateralUSDC = 8.1929;
      const dailyRentPriceWETH = packPrice(drpWETH);
      const nftPriceWETH = packPrice(collateralWETH);
      const dailyRentPriceUSDC = packPrice(drpUSDC);
      const nftPriceUSDC = packPrice(collateralUSDC);

      const WETH_SCALE = (10 ** (await WETH.decimals())).toString();
      const USDC_SCALE = (10 ** (await USDC.decimals())).toString();

      await lendBatch({
        amounts: [1, 1],
        tokenIds: [1, 2],
        paymentTokens: [PAYMENT_TOKEN_WETH, PAYMENT_TOKEN_USDC],
        maxRentDurations: [3, 200],
        dailyRentPrices: [dailyRentPriceWETH, dailyRentPriceUSDC],
        nftPrices: [nftPriceWETH, nftPriceUSDC],
      });

      const pmtAmtsWoCol = [
        await Utils.unpackPrice(dailyRentPriceWETH, WETH_SCALE),
        await Utils.unpackPrice(dailyRentPriceUSDC, USDC_SCALE),
      ];

      const { beneficiary } = await getNamedAccounts();
      const balanceBeneficiaryWETHPre = await WETH.balanceOf(beneficiary);
      const balanceBeneficiaryUSDCPre = await USDC.balanceOf(beneficiary);
      // renterWETH, renterUSDC, lenderWETH, lenderUSDC
      const balancesPre = await captureBalances(
        [renter, lender, ReNFT],
        [WETH, USDC]
      );

      let tx = await renter.renft.rent(
        [renter.e721.address, renter.e721.address],
        [1, 2],
        [1, 2],
        rentDurations
      );

      let receipt = await tx.wait();
      let es = getEvents(receipt.events ?? [], "Rented");
      // @ts-ignore
      const { rentedAt } = es[0].args;

      await advanceTime(SECONDS_IN_A_DAY + 1969);

      tx = await renter.renft.returnIt(
        [renter.e721.address, renter.e721.address],
        [1, 2],
        [1, 2]
      );

      receipt = await tx.wait();
      es = getEvents(receipt.events ?? [], "Returned");
      // @ts-ignore
      const { returnedAt } = es[0].args;
      const actualRentDuration = returnedAt - rentedAt;

      const balanceBeneficiaryWETHPost = await WETH.balanceOf(beneficiary);
      const balanceBeneficiaryUSDCPost = await USDC.balanceOf(beneficiary);
      const balancesPost = await captureBalances(
        [renter, lender, ReNFT],
        [WETH, USDC]
      );

      const rentPmtWETH = pmtAmtsWoCol[0].mul(rentDurations[0]);
      const rentProRataWETH = rentPmtWETH
        .mul(actualRentDuration)
        .div(rentDurations[0] * 86_400);
      let lenderReceivesWETH = BigNumber.from(rentProRataWETH);
      const beneficiaryFeeWETH = takeFee(lenderReceivesWETH, rentFee);
      lenderReceivesWETH = lenderReceivesWETH.sub(beneficiaryFeeWETH);

      expect(
        balanceBeneficiaryWETHPost.sub(balanceBeneficiaryWETHPre)
      ).to.be.equal(beneficiaryFeeWETH);
      expect(balancesPost[2].sub(balancesPre[2])).to.be.equal(
        lenderReceivesWETH
      );
      expect(balancesPre[0].sub(balancesPost[0])).to.be.equal(rentProRataWETH);
      expect(balancesPost[4].sub(balancesPost[4])).to.be.equal(
        BigNumber.from("0")
      );

      const rentPmtUSDC = pmtAmtsWoCol[1].mul(rentDurations[1]);
      const rentProRataUSDC = rentPmtUSDC
        .mul(actualRentDuration)
        .div(rentDurations[1] * 86_400);
      let lenderReceivesUSDC = BigNumber.from(rentProRataUSDC);
      const beneficiaryFeeUSDC = takeFee(lenderReceivesUSDC, rentFee);
      lenderReceivesUSDC = lenderReceivesUSDC.sub(beneficiaryFeeUSDC);

      expect(
        balanceBeneficiaryUSDCPost.sub(balanceBeneficiaryUSDCPre)
      ).to.be.equal(beneficiaryFeeUSDC);
      expect(balancesPost[3].sub(balancesPre[3])).to.be.equal(
        lenderReceivesUSDC
      );
      expect(balancesPre[1].sub(balancesPost[1])).to.be.equal(rentProRataUSDC);
      expect(balancesPost[5].sub(balancesPost[5])).to.be.equal(
        BigNumber.from("0")
      );

      validateReturned({
        events: receipt.events ?? [],
        nftAddress: [renter.e721.address, renter.e721.address],
        tokenId: [1, 2],
        lendingId: [1, 2],
        renterAddress: [renter.address, renter.address],
        returnedAt: Array(2).fill((await getLatestBlock()).timestamp),
      });
    });

    it("reverts if one of the returned NFTs is past the rent date", async () => {
      const rentDurations = [1, 4];
      const drpWETH = 1.9999; // acronym for dailry rental price
      const colWETH = 0.1001; // denotes collateral
      const drpUSDC = 0.9199;
      const colUSDC = 8.1929;
      const dailyRentPriceEth = packPrice(drpWETH);
      const nftPriceEth = packPrice(colWETH);
      const dailyRentPriceErc20 = packPrice(drpUSDC);
      const nftPriceErc20 = packPrice(colUSDC);

      await lendBatch({
        tokenIds: [1, 2],
        paymentTokens: [1, 2],
        maxRentDurations: [3, 200],
        dailyRentPrices: [dailyRentPriceEth, dailyRentPriceErc20],
        nftPrices: [nftPriceEth, nftPriceErc20],
      });

      await renter.renft.rent(
        [renter.e721.address, renter.e721.address],
        [1, 2],
        [1, 2],
        rentDurations
      );

      await advanceTime(SECONDS_IN_A_DAY + 100);

      await expect(
        renter.renft.returnIt(
          [renter.e721.address, renter.e721.address],
          [1, 2],
          [1, 2]
        )
      ).to.be.revertedWith("");
    });
  });

  context("Collateral Claiming", async function () {
    let renter: NamedAccount;
    let lender: NamedAccount;
    let beneficiary: string;
    let rentFee: BigNumber;
    let WETH: ERC20;
    let USDC: ERC20;
    let Utils: Utils;

    beforeEach(async () => {
      const o = await setup();
      renter = o.renter;
      lender = o.lender;
      WETH = o.weth;
      USDC = o.usdc;
      Utils = o.utils;
      beneficiary = o.beneficiary;
      rentFee = await renter.renft.rentFee();
    });

    const lendBatch = async ({
      tokenIds,
      nfts = Array(tokenIds.length).fill(lender.e721.address),
      lendAmounts = Array(tokenIds.length).fill(1),
      paymentTokens,
      maxRentDurations = Array(tokenIds.length).fill(MAX_RENT_DURATION),
      dailyRentPrices = Array(tokenIds.length).fill(DAILY_RENT_PRICE),
      nftPrices = Array(tokenIds.length).fill(NFT_PRICE),
    }: lendBatchArgs & {
      paymentTokens: number[];
      nfts?: string[];
      lendAmounts?: number[];
    }) => {
      await lender.renft.lend(
        nfts,
        tokenIds,
        lendAmounts,
        maxRentDurations,
        dailyRentPrices,
        nftPrices,
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
      const es = getEvents(events, "Rented");
      for (let i = 0; i < es.length; i++) {
        const event = es[i].args;
        if (!event) throw new Error("no args");
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

    it("claims collateral ok - WETH & USDC", async () => {
      const tokenIds = [1, 2];
      const paymentTokens = [PAYMENT_TOKEN_WETH, PAYMENT_TOKEN_USDC];
      const maxRentDurations = [10, 101];
      const drpWETH = 3.4299;
      const colWETH = 23.112;
      const drpUSDC = 9.5982;
      const colUSDC = 1.2135;
      const dailyRentPrices = [packPrice(drpWETH), packPrice(drpUSDC)];
      const nftPrices = [packPrice(colWETH), packPrice(colUSDC)];

      const WETH_SCALE = (10 ** (await WETH.decimals())).toString();
      const USDC_SCALE = (10 ** (await USDC.decimals())).toString();

      const unpackedDrpWETH = await Utils.unpackPrice(
        dailyRentPrices[0],
        WETH_SCALE
      );
      const unpackedDrpUSDC = await Utils.unpackPrice(
        dailyRentPrices[1],
        USDC_SCALE
      );
      const unpackedColWETH = await Utils.unpackPrice(nftPrices[0], WETH_SCALE);
      const unpackedColUSDC = await Utils.unpackPrice(nftPrices[1], USDC_SCALE);

      await lendBatch({
        tokenIds,
        paymentTokens,
        maxRentDurations,
        dailyRentPrices,
        nftPrices,
      });

      const _nft = Array(2).fill(renter.e721.address);
      const _tokenId = [1, 2];
      const _id = [1, 2];
      const _rentDuration = [1, 4];

      await renter.renft.rent(_nft, _tokenId, _id, _rentDuration);
      await advanceTime(_rentDuration[1] * SECONDS_IN_A_DAY);

      const beneficiaryWETHPre = await WETH.balanceOf(beneficiary);
      const beneficiaryUSDCPre = await USDC.balanceOf(beneficiary);
      const balancesPre = await captureBalances([lender], [WETH, USDC]);

      const tx = await lender.renft.claimCollateral(_nft, _tokenId, _id);

      const beneficiaryWETHPost = await WETH.balanceOf(beneficiary);
      const beneficiaryUSDCPost = await USDC.balanceOf(beneficiary);
      const balancesPost = await captureBalances([lender], [WETH, USDC]);

      const receipt = await tx.wait();
      const events = getEvents(receipt.events ?? [], "CollateralClaimed");

      validateClaimed({
        nftAddress: Array(2).fill(lender.e721.address),
        tokenId: tokenIds,
        lendingId: [1, 2],
        claimedAt: Array(2).fill((await getLatestBlock()).timestamp),
        events,
      });

      const feeWETH = takeFee(unpackedDrpWETH.mul(_rentDuration[0]), rentFee);
      const feeUSDC = takeFee(unpackedDrpUSDC.mul(_rentDuration[1]), rentFee);

      // correct fee implies that the lender amount is correct
      expect(beneficiaryWETHPost.sub(beneficiaryWETHPre)).to.be.equal(feeWETH);
      expect(beneficiaryUSDCPost.sub(beneficiaryUSDCPre)).to.be.equal(feeUSDC);

      const lenderWETH = unpackedDrpWETH.mul(_rentDuration[0]).sub(feeWETH);
      const lenderUSDC = unpackedDrpUSDC.mul(_rentDuration[1]).sub(feeUSDC);

      // also check that the lender received the collateral
      expect(balancesPost[0].sub(balancesPre[0])).to.be.equal(
        lenderWETH.add(unpackedColWETH)
      );
      expect(balancesPost[1].sub(balancesPre[1])).to.to.equal(
        lenderUSDC.add(unpackedColUSDC)
      );
    });

    it("claims collalteral ok - WETH", async () => {
      const tokenIds = [1];
      const paymentTokens = [PAYMENT_TOKEN_WETH];
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
      const _nft = [renter.e721.address];
      const _tokenId = [1];
      const _id = [1];
      const _rentDuration = [1];
      await renter.renft.rent(_nft, _tokenId, _id, _rentDuration);
      await advanceTime(SECONDS_IN_A_DAY);
      const balancePre = await lender.weth.balanceOf(lender.address);
      const beneficiaryBalancePre = await lender.weth.balanceOf(beneficiary);
      const tx = await lender.renft.claimCollateral(_nft, _tokenId, _id);
      const balancePost = await lender.weth.balanceOf(lender.address);
      const renftBalancePost = await lender.weth.balanceOf(
        lender.renft.address
      );
      const receipt = await tx.wait();
      const events = getEvents(receipt.events ?? [], "CollateralClaimed");
      validateClaimed({
        nftAddress: [lender.e721.address],
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
      const beneficiaryBalance = await lender.weth.balanceOf(beneficiary);
      expect(beneficiaryBalance.sub(beneficiaryBalancePre)).to.be.equal(fee);
    });

    // TODO: test pausing

    // it("claims collalteral ok - WETH - e1155 multiple amounts", async () => {
    //   const tokenIds = [1005];
    //   const paymentTokens = [PAYMENT_TOKEN_WETH];
    //   const maxRentDurations = [7];
    //   const drp = 1.0;
    //   const col = 10.0;
    //   const dailyRentPrices = [packPrice(drp)];
    //   const nftPrices = [packPrice(col)];
    //   const _nft = [renter.e1155.address];
    //   const lendAmounts = [20];
    //   await lendBatch({
    //     tokenIds,
    //     nfts: _nft,
    //     lendAmounts,
    //     paymentTokens,
    //     maxRentDurations,
    //     dailyRentPrices,
    //     nftPrices,
    //   });
    //   const _tokenId = [1005];
    //   const _id = [1];
    //   const _rentDuration = [2];
    //   await renter.renft.rent(_nft, _tokenId, _id, _rentDuration);
    //   await advanceTime(2 * SECONDS_IN_A_DAY);
    //   const balancePre = await lender.weth.balanceOf(lender.address);
    //   const beneficiaryBalancePre = await lender.weth.balanceOf(beneficiary);
    //   const tx = await lender.renft.claimCollateral(_nft, _tokenId, _id);
    //   const balancePost = await lender.weth.balanceOf(lender.address);
    //   const renftBalancePost = await lender.weth.balanceOf(
    //     lender.renft.address
    //   );
    //   const receipt = await tx.wait();
    //   const events = getEvents(receipt.events ?? [], "CollateralClaimed");
    //   validateClaimed({
    //     nftAddress: [lender.e1155.address],
    //     tokenId: tokenIds,
    //     lendingId: [1],
    //     claimedAt: [(await getLatestBlock()).timestamp],
    //     events,
    //   });
    //   let fullRentPayment = ethers.utils.parseEther(drp.toString());
    //   const fee = takeFee(fullRentPayment, rentFee);
    //   fullRentPayment = fullRentPayment.sub(fee);
    //   const diff = balancePost.sub(balancePre);
    //   expect(diff).to.be.equal(
    //     ethers.utils.parseEther(col.toString()).add(fullRentPayment)
    //   );
    //   expect(renftBalancePost).to.be.equal(0);
    //   const beneficiaryBalance = await lender.weth.balanceOf(beneficiary);
    //   expect(beneficiaryBalance.sub(beneficiaryBalancePre)).to.be.equal(fee);
    // });

    it("does not claim collateral if not time", async () => {
      const tokenIds = [1];
      const paymentTokens = [PAYMENT_TOKEN_WETH];
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
      const _nft = [renter.e721.address];
      const _tokenId = [1];
      const _id = [1];
      const _rentDuration = [1];
      await renter.renft.rent(_nft, _tokenId, _id, _rentDuration);
      await advanceTime(SECONDS_IN_A_DAY - 10);
      await expect(
        lender.renft.claimCollateral(_nft, _tokenId, _id)
      ).to.be.revertedWith("ReNFT::return date not passed");
    });
  });

  context("Stop Lending", async function () {
    it("stops lending ok", async () => {
      const { lender } = await setup();
      await lender.renft.lend(
        [lender.e721.address],
        [1],
        [1],
        [1],
        [packPrice(1)],
        [packPrice(1)],
        [2]
      );
      expect(await lender.e721.ownerOf(1)).to.be.equal(lender.renft.address);
      const tx = await lender.renft.stopLending(
        [lender.e721.address],
        [1],
        [1]
      );
      const receipt = await tx.wait();
      const events = getEvents(receipt.events ?? [], "LendingStopped");
      const event = events[0];
      if (!event.args) throw new Error("LendingStopped not emitted");
      const { lendingId, stoppedAt } = event.args;
      expect(lendingId).to.be.equal(1);
      expect(stoppedAt).to.be.equal((await getLatestBlock()).timestamp);
      expect(await lender.e721.ownerOf(1)).to.be.equal(lender.address);
    });

    it("does not stop lending when currently rented", async () => {
      const { lender, renter } = await setup();
      await lender.renft.lend(
        [lender.e721.address],
        [1],
        [1],
        [1],
        [packPrice(1)],
        [packPrice(1)],
        [2]
      );
      await renter.renft.rent([lender.e721.address], [1], [1], [1]);
      await expect(lender.renft.stopLending([lender.e721.address], [1], [1])).to
        .be.reverted;
    });
  });

  context("Integration", async function () {
    it("relends ok", async () => {
      const { lender, renter } = await setup();
      const nft = [lender.e721.address];
      const paymentToken = [2];
      const tokenId = [1];
      const maxRentDuration = [1];
      const lendingId = [1];
      const dailyRentPrice = [packPrice(1)];
      const collateralPrice = [packPrice(1)];
      await lender.renft.lend(
        nft,
        tokenId,
        [1],
        maxRentDuration,
        dailyRentPrice,
        collateralPrice,
        paymentToken
      );
      await renter.renft.rent(nft, tokenId, lendingId, [1]);
      await renter.renft.lend(
        nft,
        tokenId,
        [1],
        maxRentDuration,
        dailyRentPrice,
        collateralPrice,
        paymentToken
      );
    });
  });

  // TODO: add test for pausing
  // TODO: add test for multisig interacting with this contract in admin section
  // TODO: add test for multisig interacting with token vesting contracts
  // TODO: test balances of NFTs
  // TODO: claim collateral on multiple

  context("Admin", async () => {
    it("sets the rentFee", async () => {
      const { deployer } = await setup();
      // type convestion should be internalised in some function: getRenft(signer)
      const deployerRenft = ((await ethers.getContract(
        "ReNFT",
        deployer
      )) as unknown) as ReNFT;
      await deployerRenft.setRentFee("559");
      const rentFee = await deployerRenft.rentFee();
      expect(rentFee).to.be.equal("559");
    });

    it("pauses the contract", async () => {
      const { deployer } = await setup();
      const renft = await ethers.getContract("ReNFT", deployer);
      await renft.setPaused(true);
      expect(await renft.paused()).to.be.true;
    });

    it("disallows non-deployer to change paused", async () => {
      const { lender } = await setup();
      const { renft } = lender;
      expect(renft.setPaused(true)).to.be.reverted;
    });

    it("pausing disables lend", async () => {
      const { lender, deployer } = await setup();
      const { renft: renftLender } = lender;
      const renftDeployer = await ethers.getContract("ReNFT", deployer);
      await renftDeployer.setPaused(true);
      expect(
        renftLender.lend(
          [lender.e721.address],
          [1],
          [1],
          [1],
          [packPrice(1)],
          [packPrice(1)],
          [1]
        )
      ).to.be.revertedWith("ReNFT::paused");
    });

    it("pausing disables rent", async () => {
      const { lender, deployer, renter } = await setup();
      const { renft: renftLender } = lender;
      const { renft: renftRenter } = renter;
      const renftDeployer = await ethers.getContract("ReNFT", deployer);
      await renftLender.lend(
        [lender.e721.address],
        [1],
        [1],
        [1],
        [packPrice(1)],
        [packPrice(1)],
        [1]
      );
      await renftDeployer.setPaused(true);
      expect(
        renftRenter.rent([renter.e721.address], [1], [1], [1])
      ).to.be.revertedWith("ReNFT::paused");
    });

    it("pausing diables return", async () => {
      const { lender, deployer, renter } = await setup();
      const { renft: renftLender } = lender;
      const { renft: renftRenter } = renter;
      const renftDeployer = await ethers.getContract("ReNFT", deployer);
      await renftLender.lend(
        [lender.e721.address],
        [1],
        [1],
        [1],
        [packPrice(1)],
        [packPrice(1)],
        [1]
      );
      await renftRenter.rent([lender.e721.address], [1], [1], [1]);
      await renftDeployer.setPaused(true);
      advanceTime(1_000);
      expect(
        renftRenter.returnIt([lender.e721.address], [1], [1])
      ).to.be.revertedWith("ReNFT::paused");
    });

    it("pausing disables stop lend", async () => {
      const { lender, deployer } = await setup();
      const { renft: renftLender } = lender;
      const renftDeployer = await ethers.getContract("ReNFT", deployer);
      await renftLender.lend(
        [lender.e721.address],
        [1],
        [1],
        [1],
        [packPrice(1)],
        [packPrice(1)],
        [1]
      );
      await renftDeployer.setPaused(true);
      expect(
        renftLender.stopLending([lender.e721.address], [1], [1])
      ).to.be.revertedWith("ReNFT::paused");
    });

    it("pausing disables claim collateral", async () => {
      const { lender, deployer, renter } = await setup();
      const { renft: renftLender } = lender;
      const { renft: renftRenter } = renter;
      const renftDeployer = await ethers.getContract("ReNFT", deployer);
      await renftLender.lend(
        [lender.e721.address],
        [1],
        [1],
        [1],
        [packPrice(1)],
        [packPrice(1)],
        [1]
      );
      await renftRenter.rent([renter.e721.address], [1], [1], [1]);
      await renftDeployer.setPaused(true);
      const offset_epsilon = 10;
      advanceTime(SECONDS_IN_A_DAY + offset_epsilon);
      expect(
        renftLender.claimCollateral([lender.e721.address], [1], [1])
      ).to.be.revertedWith("ReNFT::paused");
    });

    it("un-paused the contract", async () => {
      const { deployer } = await setup();
      const renft = await ethers.getContract("ReNFT", deployer);
      await renft.setPaused(true);
      expect(await renft.paused()).to.be.true;
      await renft.setPaused(false);
      expect(await renft.paused()).to.be.false;
    });

    it("disallows non deployer to set the rentFee", async () => {
      const { renter } = await setup();
      await expect(renter.renft.setRentFee("559")).to.be.revertedWith("");
    });

    it("disallows to set the fee that exceeds 100", async () => {
      const { deployer } = await setup();
      const deployerRenft = ((await ethers.getContract(
        "ReNFT",
        deployer
      )) as unknown) as ReNFT;
      await expect(deployerRenft.setRentFee("123456789")).to.be.revertedWith(
        ""
      );
    });

    it("sets the beneficiary", async () => {
      const { deployer, signers } = await setup();
      const deployerRenft = ((await ethers.getContract(
        "ReNFT",
        deployer
      )) as unknown) as ReNFT;
      await deployerRenft.setBeneficiary(signers[4].address);
    });

    it("disallows non deployer to set the beneficiary", async () => {
      const { renter, signers } = await setup();
      await expect(
        renter.renft.setBeneficiary(signers[4].address)
      ).to.be.revertedWith("");
    });
  });

  context("Misc", async () => {
    it("makes whole 9999 when exceeds", async () => {
      const { lender, deployer, renter } = await setup();
      await lender.renft.lend(
        [lender.e721.address],
        [1],
        [1],
        [1],
        ["0xffff0000"],
        ["0x0000ffff"],
        [2]
      );
      const dai = ((await ethers.getContract(
        "DAI",
        deployer
      )) as unknown) as ERC20;
      await dai.transfer(renter.address, ethers.utils.parseEther("11000"));
      const renterBalancePre = await dai.balanceOf(renter.address);
      await renter.renft.rent([renter.e721.address], [1], [1], [1]);
      const renterBalancePost = await dai.balanceOf(renter.address);
      const diff = renterBalancePre.sub(renterBalancePost);
      expect(diff).to.be.equal(
        ethers.utils.parseEther("9999").add(ethers.utils.parseEther("0.9999"))
      );
    });

    it("100% test coverage", async () => {
      const { lender, deployer, renter } = await setup();
      await lender.renft.lend(
        [lender.e721.address],
        [1],
        [1],
        [1],
        ["0x00000001"],
        ["0x00000001"],
        [2]
      );
      const dai = ((await ethers.getContract(
        "DAI",
        deployer
      )) as unknown) as ERC20;
      await dai.transfer(renter.address, ethers.utils.parseEther("11000"));
      const renterBalancePre = await dai.balanceOf(renter.address);
      await renter.renft.rent([renter.e721.address], [1], [1], [1]);
      const renterBalancePost = await dai.balanceOf(renter.address);
      const diff = renterBalancePre.sub(renterBalancePost);
      expect(diff).to.be.equal(
        ethers.utils.parseEther("0.0001").add(ethers.utils.parseEther("0.0001"))
      );
    });
  });
});
