import {expect} from './chai-setup';
import {ethers, deployments, getUnnamedAccounts} from 'hardhat';
import { RentNft as RentNftT } from "../typechain/RentNft"

const setup = deployments.createFixture(async () => {
  await deployments.fixture('RentNft');
  await deployments.fixture('ERC20');
  await deployments.fixture('ERC721')
  const signers = await ethers.getSigners();
  return {
    RentNft: (await ethers.getContract('RentNft')) as RentNftT,
    ERC20: (await ethers.getContract('ERC20')) as ERC20T,
    ERC721: (await ethers.getContract('ERC721')) as ERC721T,
    signers: signers.map((acc, ix) => ({[ix]: acc})),
  };
});

describe('RentNft', function () {
  describe("Lending", async function() {
    const { RentNft } = await setup();

  });
  describe("Renting", async function() {});
  describe("Returning", async function() {});
  describe("Collateral Claiming", async function() {});
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
