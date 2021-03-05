import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ERC20 } from '../frontend/src/hardhat/typechain/ERC20';
import { Resolver } from '../frontend/src/hardhat/typechain/Resolver';

const for_development = async (hre: HardhatRuntimeEnvironment) => {
  // mint all the nfts to lender
  const { getNamedAccounts, ethers } = hre;
  const { lender, deployer, beneficiary, renter } = await getNamedAccounts();

  const erc721 = await ethers.getContract('MyERC721', lender);

  for (let i = 0; i < 10; i++) {
    await erc721.award();
  }

  // also send through erc20 balances to everyone
  const erc20 = ((await ethers.getContract(
    'MyERC20',
    deployer
    /* eslint-disable-next-line */
  )) as any) as ERC20;
  const amtToSend = ethers.utils.parseEther('100');
  await erc20.transfer(lender, amtToSend);
  await erc20.transfer(beneficiary, amtToSend);
  await erc20.transfer(renter, amtToSend);

  const resolver = ((await ethers.getContract(
    'Resolver'
  )) as unknown) as Resolver;
  await resolver.setPaymentToken(2, erc20.address);
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  await deploy('MyERC20', {
    from: deployer,
    log: true,
  });
  await deploy('MyERC721', {
    from: deployer,
    log: true,
  });
  await deploy('MyERC1155', {
    from: deployer,
    log: true,
  });
  await deploy('Resolver', {
    from: deployer,
    log: true,
  });
  await deploy('Utils', {
    from: deployer,
    log: true,
  });

  // todo: would interfere with tests
  await for_development(hre);
};
export default func;
func.tags = ['PaymentToken', 'MyERC721', 'MyERC1155', 'Resolver', 'Utils'];
