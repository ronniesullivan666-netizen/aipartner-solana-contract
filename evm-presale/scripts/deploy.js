import hre from "hardhat";

async function main() {
  const FEE_RECEIVER = "0xf6B3d16c273Fb35b9D6454B7FbE2F35DdC18Bf66"; // 你的实际收款地址

  // 根据传入的 --network 参数动态匹配 USDT 合约地址
  const networkName = hre.network.name;
  let USDT_ADDRESS = "";

  if (networkName === "bsc") {
    USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955"; // BSC 主网 USDT
  } else if (networkName === "mainnet") {
    USDT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7"; // 以太坊主网 USDT
  } else {
    throw new Error(`未配置当前网络 (${networkName}) 的 USDT 地址！`);
  }

  console.log(`正在部署 AIPartnerPresale 到 ${networkName} 网络...`);
  console.log(`使用的 USDT 地址: ${USDT_ADDRESS}`);
  console.log(`收款地址: ${FEE_RECEIVER}`);

  const AIPartnerPresale = await hre.ethers.getContractFactory("AIPartnerPresale");
  const presale = await AIPartnerPresale.deploy(USDT_ADDRESS, FEE_RECEIVER);

  await presale.waitForDeployment();
  const address = await presale.getAddress();

  console.log(`AIPartnerPresale 已成功部署到 ${networkName}，合约地址: ${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});