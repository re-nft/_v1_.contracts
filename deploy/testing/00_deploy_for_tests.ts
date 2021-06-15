import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deployContract } from "../../utils/network";

const each = async function (arr: string[], fn: (item: string) => Promise<unknown>) {
  // take an array and a function
  for (const item of arr) await fn(item);
};
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy } = deployments;
  const { lender, deployer, beneficiary } = await getNamedAccounts();

  const signer = await ethers.getSigner(deployer);
  const gasPrice =
    (await signer.getGasPrice()) ?? ethers.utils.parseUnits("50", "gwei");

  await each(["WETH", "DAI", "USDC", "USDT", "TUSD"], (item) =>
    deployContract(item, deploy, deployer, gasPrice, [deployer])
  );
  await deployContract("E721", deploy, deployer, gasPrice);
  await deployContract("E721B", deploy, deployer, gasPrice);
  await deployContract("E1155", deploy, deployer, gasPrice, [
    deployer,
    beneficiary,
    lender,
  ]);
  await deployContract("E1155B", deploy, deployer, gasPrice, [
    deployer,
    beneficiary,
    lender,
  ]);
  await deployContract("Utils", deploy, deployer, gasPrice);
};

export default func;

func.tags = ["Test"];
