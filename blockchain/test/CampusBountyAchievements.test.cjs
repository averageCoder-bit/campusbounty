const assert = require('node:assert/strict');
const { ethers } = require('hardhat');

describe('CampusBountyAchievements', function () {
  it('permits issuer attestation, verifies, and refuses duplicates and unauthorized callers', async () => {
    const [owner, student, stranger] = await ethers.getSigners();
    const factory = await ethers.getContractFactory('CampusBountyAchievements');
    const contract = await factory.deploy(owner.address);
    await contract.waitForDeployment();
    const hash = ethers.keccak256(ethers.toUtf8Bytes('real graded capstone evidence'));
    await (await contract.issueAchievement(student.address, 'computing-apprentice', hash)).wait();
    const result = await contract.verifyAchievement(student.address, 'computing-apprentice');
    assert.equal(result[0], true);
    assert.equal(result[1], hash);
    assert.equal(result[3], owner.address);
    await assert.rejects(contract.issueAchievement(student.address, 'computing-apprentice', hash));
    await assert.rejects(contract.connect(stranger).issueAchievement(student.address, 'false-badge', hash));
    const notIssued = await contract.verifyAchievement(student.address, 'not-issued');
    assert.equal(notIssued[0], false);
  });
});
