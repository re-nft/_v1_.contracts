import {expect} from './chai-setup';
import {ethers, deployments} from 'hardhat';
import {RentNft as RentNftT} from '../typechain/RentNft';
import {Resolver as ResolverT} from '../typechain/Resolver';
import {ERC20 as ERC20T} from '../typechain/ERC20';
import {MyERC721 as ERC721T} from '../typechain/MyERC721';

// default values
const MAX_RENT_DURATION = 1;
const DAILY_RENT_PRICE = 2;
const NFT_PRICE = 3;
const PAYMENT_TOKEN = 0;
const GAS_SPONSOR = '';

const setup = deployments.createFixture(async () => {
  await deployments.fixture('Resolver');
  await deployments.fixture('ERC20');
  await deployments.fixture('ERC721');
  await deployments.fixture('RentNft');
  const signers = await ethers.getSigners();
  const resolver = (await ethers.getContract('Resolver')) as ResolverT;
  const myERC20 = (await ethers.getContract('MyERC20')) as ERC20T;
  const myERC721 = (await ethers.getContract('MyERC721')) as ERC721T;
  await resolver.setPaymentToken(0, myERC20.address);
  await myERC721.award();
  return {
    Resolver: resolver,
    RentNft: (await ethers.getContract('RentNft')) as RentNftT,
    ERC20: myERC20,
    ERC721: myERC721,
    signers: signers.map((acc, ix) => ({[ix]: acc})),
  };
});

// test cases
// normal flows for each. single + batch
//

describe('RentNft', function () {
  describe('Lending', async function () {
    it('lends', async function () {
      const {RentNft, ERC721} = await setup();
      const tokenId = 1;
      await RentNft.lend(
        [ERC721.address],
        [tokenId],
        [MAX_RENT_DURATION],
        [DAILY_RENT_PRICE],
        [NFT_PRICE],
        [PAYMENT_TOKEN],
        GAS_SPONSOR
      );
    });
  });
  describe('Renting', async function () {});
  describe('Returning', async function () {});
  describe('Collateral Claiming', async function () {});
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
