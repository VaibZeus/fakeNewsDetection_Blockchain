const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying with", deployer.address);

    // Deploy PublisherRegistry
    const Pub = await hre.ethers.getContractFactory("PublisherRegistry");
    const pub = await Pub.deploy();
    await pub.deployed();
    console.log("PublisherRegistry:", pub.address);

    // Deploy NewsRegistry: votingPeriod = 60s, minVotes = 1 (for testing)
    const News = await hre.ethers.getContractFactory("NewsRegistry");
    const news = await News.deploy(pub.address, 60, 1);
    await news.deployed();
    console.log("NewsRegistry:", news.address);

    // Optionally add one trusted publisher (deployer for testing)
    const tx = await pub.addPublisher(deployer.address);
    await tx.wait();
    console.log("Added deployer as trusted publisher for testing");

    const tx2 = await pub.addPublisher("0x90f79bf6eb2c4f870365e785982e1f101e93b906");
    await tx2.wait();
    console.log("Added 0x90f.....1e93b906 as trusted publisher for testing");
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
