/* eslint-disable */
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
//@ts-ignore
import { ERC20 } from '../../frontend/src/hardhat/typechain/ERC20';
//@ts-ignore
import { MyERC721 } from '../../frontend/src/hardhat/typechain/MyERC721';
//@ts-ignore
import { Resolver } from '../../frontend/src/hardhat/typechain/Resolver';

/**
 * Gives everyone a bit of ERC20 test tokens & mints all erc721s
 * to lender named account, & erc1155s to lender and other top 2
 * accounts
 * @param hre
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, ethers, deployments } = hre;
  const { lender, deployer, beneficiary, renter } = await getNamedAccounts();
  const { deploy } = deployments;

  await deploy('Resolver', {
    from: deployer,
    log: true,
    args: [deployer],
  });

  const resolver = ((await ethers.getContract(
    'Resolver',
    deployer
  )) as any) as Resolver;

  await deploy('ReNFT', {
    from: deployer,
    log: true,
    args: [resolver.address, beneficiary, deployer],
  });

  const erc721 = ((await ethers.getContract(
    'MyERC721',
    lender
  )) as any) as MyERC721;
  const e721b = ((await ethers.getContract(
    'E721B',
    lender
  )) as any) as MyERC721;

  for (let i = 0; i < 10; i++) await erc721.award();
  for (let i = 0; i < 10; i++) await e721b.award();

  // * also send through 100 erc20 tokens to everyone
  const td18 = ((await ethers.getContract(
    'TD18',
    deployer
  )) as any) as ERC20;
  const td1 = ((await ethers.getContract(
    'TD1',
    deployer
  )) as any) as ERC20;
  const amtToSend = ethers.utils.parseEther('100000000');

  await td1.transfer(lender, amtToSend);
  await td1.transfer(beneficiary, amtToSend);
  await td1.transfer(renter, amtToSend);

  await td18.transfer(lender, amtToSend);
  await td18.transfer(beneficiary, amtToSend);
  await td18.transfer(renter, amtToSend);

  // * set the resolver to resolve to the correct payment token
  await resolver.setPaymentToken(2, td18.address);
  await resolver.setPaymentToken(3, td1.address);
};

export default func;

func.tags = ['Development'];
func.dependencies = ['Test'];
