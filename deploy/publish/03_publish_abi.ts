import * as fs from "fs";
import chalk from "chalk";
import bre from "hardhat";
import glob from "glob";
import path from "path";

const publishDir = "../front/src/contracts";
const isTestFile = (contractName: string) =>
  contractName !== "Resolver" && contractName !== "ReNFT";

// Publish to graphdir
function publishContract(contractName: string) {
  console.log(
    " 💽 Publishing",
    chalk.cyan(contractName),
    "to",
    chalk.gray(publishDir)
  );
  try {
    const testDir = `${
      isTestFile(contractName) ? `Test/${contractName}` : contractName
    }`;

    const contract = JSON.parse(
      fs
        .readFileSync(
          `${bre.config.paths.artifacts}/src/${testDir}.sol/${contractName}.json`
        )
        .toString()
    );
    const address = fs
      .readFileSync(`${bre.config.paths.artifacts}/${contractName}.address`)
      .toString();

    const publishContractDir = `${publishDir}/${testDir}`;

    if (!fs.existsSync(`${publishDir}/Test`)) {
      fs.mkdirSync(`${publishDir}/Test`);
    }
    
    fs.writeFileSync(
      `${publishContractDir}.address.js`,
      `module.exports = "${address}";`
    );
    fs.writeFileSync(
      `${publishContractDir}.abi.js`,
      `module.exports = ${JSON.stringify(contract.abi, null, 2)};`
    );
    fs.writeFileSync(
      `${publishContractDir}.bytecode.js`,
      `module.exports = "${contract.bytecode}";`
    );

    console.log(
      " 📠 Published " + chalk.green(contractName) + " to the frontend."
    );

    return true;
  } catch (e) {
    console.log(e);
    if (e.toString().indexOf("no such file or directory") >= 0) {
      console.log(
        chalk.yellow(
          " ⚠️  Can't publish " +
            contractName +
            " yet (make sure it getting deployed)."
        )
      );
    } else {
      console.log(e);
      return false;
    }
  }
}

const tryPublish = (file: string): string => {
  const name = path.basename(file);

  const contractName = name.replace(".sol", "");
  const testDir = `${
    isTestFile(contractName) ? `Test/${contractName}` : contractName
  }`;

  // Add contract to list if publishing is successful
  if (publishContract(contractName)) {
    return testDir;
  }
  return "";
};

async function main(): Promise<void> {
  if (!fs.existsSync(publishDir)) {
    fs.mkdirSync(publishDir);
  }
  console.log(
    glob
      .sync(`${bre.config.paths.sources}/**/*.sol`)
      .filter((source: string) => source.indexOf("interfaces") < 0)
  );
  const finalContractList: Array<string> = glob
    .sync(`${bre.config.paths.sources}/**/*.sol`)
    .filter((source: string) => source.indexOf("interfaces") < 0)
    .map(tryPublish)
    .filter((s) => s !== "");

  fs.writeFileSync(
    `${publishDir}/contracts.js`,
    `module.exports = ${JSON.stringify(finalContractList)};`
  );
}

export default main;
