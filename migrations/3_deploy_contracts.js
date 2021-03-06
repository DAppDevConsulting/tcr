/* global artifacts */

const Registry = artifacts.require('Registry.sol');
const Token = artifacts.require('EIP20.sol');
const Parameterizer = artifacts.require('Parameterizer.sol');
const DLL = artifacts.require('dll/DLL.sol');
const AttributeStore = artifacts.require('attrstore/AttributeStore.sol');
const PLCRVoting = artifacts.require('PLCRVoting.sol');

const fs = require('fs');

module.exports = (deployer, network, accounts) => {
  async function setupForTests() {
    async function giveTokensTo(addresses) {
      const token = await Token.deployed();
      const user = addresses[0];
      await token.transfer(user, '100000');
      if (addresses.length === 1) { return true; }
      return giveTokensTo(addresses.slice(1));
    }

    async function approveRegistryFor(addresses) {
      const token = await Token.deployed();
      const user = addresses[0];
      const balanceOfUser = await token.balanceOf(user);
      await token.approve(Registry.address, balanceOfUser, { from: user });
      if (addresses.length === 1) { return true; }
      return approveRegistryFor(addresses.slice(1));
    }

    async function approveParameterizerFor(addresses) {
      const token = await Token.deployed();
      const user = addresses[0];
      const balanceOfUser = await token.balanceOf(user);
      await token.approve(Parameterizer.address, balanceOfUser, { from: user });
      if (addresses.length === 1) { return true; }
      return approveParameterizerFor(addresses.slice(1));
    }

    async function approvePLCRFor(addresses) {
      const token = await Token.deployed();
      const registry = await Registry.deployed();
      const user = addresses[0];
      const balanceOfUser = await token.balanceOf(user);
      const plcrAddr = await registry.voting.call();
      await token.approve(plcrAddr, balanceOfUser, { from: user });
      if (addresses.length === 1) { return true; }
      return approvePLCRFor(addresses.slice(1));
    }

    await giveTokensTo(accounts);
    await approveRegistryFor(accounts);
    await approveParameterizerFor(accounts);
    await approvePLCRFor(accounts);
  }

  const config = JSON.parse(fs.readFileSync('./conf/config.json'));
  const parameterizerConfig = config.paramDefaults;
  let tokenAddress = config.TokenAddress;

  deployer.deploy(DLL);
  deployer.deploy(AttributeStore);

  deployer.link(DLL, PLCRVoting);
  deployer.link(AttributeStore, PLCRVoting);

  deployer.link(DLL, Parameterizer);
  deployer.link(AttributeStore, Parameterizer);

  deployer.link(DLL, Registry);
  deployer.link(AttributeStore, Registry);

  return deployer.then(async () => {
    if (network === 'test') {
      tokenAddress = Token.address;
    }
    return deployer.deploy(
      PLCRVoting,
      tokenAddress,
    );
  })
    .then(() =>
      deployer.deploy(
        Parameterizer,
        tokenAddress,
        PLCRVoting.address,
        parameterizerConfig.minDeposit,
        parameterizerConfig.pMinDeposit,
        parameterizerConfig.applyStageLength,
        parameterizerConfig.pApplyStageLength,
        parameterizerConfig.commitStageLength,
        parameterizerConfig.pCommitStageLength,
        parameterizerConfig.revealStageLength,
        parameterizerConfig.pRevealStageLength,
        parameterizerConfig.dispensationPct,
        parameterizerConfig.pDispensationPct,
        parameterizerConfig.voteQuorum,
        parameterizerConfig.pVoteQuorum,
      )
        .then(() =>
          deployer.deploy(
            Registry,
            tokenAddress,
            PLCRVoting.address,
            Parameterizer.address,
          ))
        .then(async () => {
          if (network === 'test') {
            await setupForTests();
          }
        }).catch((err) => { throw err; }));
};
