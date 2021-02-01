import { ethers } from 'hardhat';
import { BigNumber, BigNumberish } from 'ethers';
import { Event } from '@ethersproject/contracts/lib';
import { Block } from '@ethersproject/abstract-provider';
import { ERC20 } from '../frontend/src/hardhat/typechain/ERC20';

const PRICE_BITSIZE = 32;

export const decimalToPaddedHexString = (
  number: number,
  bitsize: number
): string => {
  const byteCount = Math.ceil(bitsize / 8);
  const maxBinValue = Math.pow(2, bitsize) - 1;

  /* In node.js this function fails for bitsize above 32bits */
  if (bitsize > 32) throw 'number above maximum value';

  /* Conversion to unsigned form based on  */
  if (number < 0) number = maxBinValue + number + 1;

  return (
    '0x' +
    (number >>> 0)
      .toString(16)
      .toUpperCase()
      .padStart(byteCount * 2, '0')
  );
};

export const advanceTime = async (seconds: number): Promise<void> => {
  await ethers.provider.send('evm_increaseTime', [seconds]);
  await ethers.provider.send('evm_mine', []);
};

// price is bytes4 in Solidity
export const unpackPrice = (
  price: BigNumberish,
  scale: BigNumber
): BigNumber => {
  // price is from 1 to 4294967295. i.e. from 0x00000001 to 0xffffffff
  const numHex = decimalToPaddedHexString(Number(price), PRICE_BITSIZE).slice(
    2
  );
  let whole = parseInt(numHex.slice(0, 4), 16);
  let decimal = parseInt(numHex.slice(4), 16);
  if (whole > 9999) whole = 9999;
  if (decimal > 9999) decimal = 9999;
  const w = BigNumber.from(whole).mul(scale);
  const d = BigNumber.from(decimal).mul(scale.div(10_000));
  const _price = w.add(d);
  return _price;
};

export const getEvents = (events: Event[], name: string): Event[] => {
  return events.filter((e) => e?.event?.toLowerCase() === name.toLowerCase());
};

// given the target price, give back the hex equivalent
export const packPrice = (price: number): string => {
  if (price > 9999.9999) throw new Error('too high');
  if (price < 0.0001) throw new Error('too low');
  const stringVersion = price.toString();
  const parts = stringVersion.split('.');
  let res: string;
  if (parts.length == 2) {
    const whole = parts[0];
    let decimal = parts[1];
    while (decimal.length < 4) {
      decimal += '0';
    }
    const wholeHex = decimalToPaddedHexString(Number(whole), 16);
    const decimalHex = decimalToPaddedHexString(Number(decimal), 16);
    const hexRepr = wholeHex.concat(decimalHex.slice(2));
    // res = parseInt(hexRepr, 16);
    res = hexRepr;
  } else {
    if (parts.length != 1) throw new Error('price packing issue');
    const whole = parts[0];
    const wholeHex = decimalToPaddedHexString(Number(whole), 16);
    const decimalHex = '0000';
    // res = parseInt(wholeHex.slice(2).concat(decimalHex), 16);
    res = wholeHex.concat(decimalHex);
  }
  return res;
};

export const getBalance = async (address: string): Promise<BigNumber> => {
  return await ethers.provider.getBalance(address);
};

export const getErc20Balance = async (
  contract: ERC20,
  balanceOf: string
): Promise<BigNumber> => {
  return await contract.balanceOf(balanceOf);
};

export const takeFee = (rent: BigNumber, rentFee: BigNumber): BigNumber =>
  rent.mul(rentFee).div(10_000);

export const getLatestBlock = async (): Promise<Block> => {
  return await ethers.provider.getBlock('latest');
};
