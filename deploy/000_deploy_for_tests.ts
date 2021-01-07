import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;
  const {deployer} = await getNamedAccounts();
  await deploy('PaymentToken', {
    from: deployer,
    log: true
    // not owner when testing
    // deterministicDeployment: true,
  });
  await deploy('GanFaceNft', {
    from: deployer,
    log: true
  })
};
export default func;
func.tags = ['PaymentToken', 'GanFaceNft'];
