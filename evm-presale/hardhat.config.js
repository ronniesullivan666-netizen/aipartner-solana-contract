import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";

dotenv.config();

/** @type import('hardhat/config').HardhatUserConfig */
export default {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: false,
        runs: 200,
      },
      evmVersion: "paris", // 强制指定与部署时一致的 EVM 版本，解决 PUSH0 字节码差异
    },
  },
  networks: {
    mainnet: {
      url: "https://ethereum-rpc.publicnode.com",
      accounts: [process.env.PRIVATE_KEY],
    },
    bsc: {
      url: "https://bsc-dataseed.binance.org/",
      accounts: [process.env.PRIVATE_KEY],
    }
  },
  // 修改为符合 V2 规范的单一全局 API Key 配置
  etherscan: {
    apiKey: process.env.BSCSCAN_API_KEY,
  },
  sourcify: {
    enabled: false,
  },
};
