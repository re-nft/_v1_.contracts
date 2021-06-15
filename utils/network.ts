import "dotenv/config";
import {
  DeployOptions,
  DeployResult,
} from "hardhat-deploy/types";
import * as fs from "fs";
import { BigNumber } from "@ethersproject/bignumber";

export function node_url(networkName: string): string {
  if (networkName) {
    const uri = process.env["ETH_NODE_URI_" + networkName.toUpperCase()];
    if (uri && uri !== "") {
      return uri;
    }
  }

  let uri = process.env.ETH_NODE_URI;
  if (uri) {
    uri = uri.replace("{{networkName}}", networkName);
  }
  if (!uri || uri === "") {
    // throw new Error(`environment variable "ETH_NODE_URI" not configured `);
    return "";
  }
  if (uri.indexOf("{{") >= 0) {
    throw new Error(
      `invalid uri or network not supported by nod eprovider : ${uri}`
    );
  }
  return uri;
}

export function getMnemonic(networkName?: string): string {
  if (networkName) {
    const mnemonic = process.env["MNEMONIC_" + networkName.toUpperCase()];
    if (mnemonic && mnemonic !== "") {
      return mnemonic;
    }
  }

  const mnemonic = process.env.MNEMONIC;
  if (!mnemonic || mnemonic === "") {
    return "test test test test test test test test test test test junk";
  }
  return mnemonic;
}

export function accounts(networkName?: string): { mnemonic: string } {
  return { mnemonic: getMnemonic(networkName) };
}


export const deployContract = async (
  contractName: string,
  deploy: (str: string, options: DeployOptions) => Promise<DeployResult>,
  deployer: string,
  GAS_PRICE: BigNumber,
  args?: unknown[]
): Promise<DeployResult> => {
  console.log(`Deploying ${contractName}`)
  const deployed = await deploy(contractName, {
    from: deployer,
    log: true,
    args: args,
    gasPrice: GAS_PRICE,
  });
  fs.writeFileSync(`artifacts/${contractName}.address`, deployed.address);
  return deployed;
};