import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

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

  await deploy('Utils', {
    from: deployer,
    log: true,
  });
};

export default func;

func.tags = ['Test'];
