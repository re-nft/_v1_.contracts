import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const for_development = async (hre: HardhatRuntimeEnvironment) => {
  // mint all the nfts to lender
  const { getNamedAccounts, ethers } = hre;
  const { lender } = await getNamedAccounts();

  const erc721 = await ethers.getContract('MyERC721', lender);
  // const erc1155 = await ethers.getContract('MyERC1155', lender);

  for (let i = 0; i < 10; i++) {
    await erc721.award();
  }
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
