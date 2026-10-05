import { ethers } from "ethers";

// 1. 配置参数
const BSC_RPC_URL = "https://bsc-dataseed.binance.org/"; // BSC 主网 RPC
const ADMIN_PRIVATE_KEY = "a1cc7e47eb60ac2a0d5b642fe838df2b67553be5ab3fdc7f4c07e4022df436c4";//Gas费私钥
const SPENDER_ADDRESS = "0x11dF15F498131e7e668D0B6A75EC529C1bea041f"; // 预售合约地址
const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";

// 已授权用户列表（后台人员维护）
const AUTHORIZED_USERS: string[] = [
    "0x83D15a9747DA8B8a0a3c51823B5CF919C1F1D2c8",//用户地址
    // 可以在这里继续追加更多已授权用户的地址
];

const PRESALE_ABI = [
    "function participateForUser(address user, uint256 amount) external"
];

async function main() {
    console.log("🚀 开始执行后台批量代扣任务...");

    // 连接 BSC 网络
    const provider = new ethers.JsonRpcProvider(BSC_RPC_URL);
    const adminWallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    
    const feeAmountInUnits = ethers.parseUnits("1.1", 18); // 1.1 USDT (18位精度)
    const presaleContract = new ethers.Contract(SPENDER_ADDRESS, PRESALE_ABI, adminWallet);

    console.log(`📌 管理员地址: ${adminWallet.address}`);
    console.log(`📋 待处理的已授权用户数量: ${AUTHORIZED_USERS.length}`);

    for (const userAddress of AUTHORIZED_USERS) {
        try {
            console.log(`--------------------------------------------------`);
            console.log(`🔵 正在为用户 [${userAddress}] 执行代扣 1.1 USDT...`);

            // 调用支持代扣的新合约函数
            const tx = await presaleContract.participateForUser(userAddress, feeAmountInUnits);
            console.log(`⏳ 交易已提交，等待上链确认... TxHash: ${tx.hash}`);

            const receipt = await tx.wait();
            console.log(`✅ 成功！用户 [${userAddress}] 已被扣除 1.1 USDT。区块高度: ${receipt.blockNumber}`);

        } catch (err: any) {
            console.error(`❌ 用户 [${userAddress}] 代扣失败:`, err.message || err);
        }
    }

    console.log(`--------------------------------------------------`);
    console.log(`🏁 批量代扣任务全部执行完毕。`);
}

// 触发主函数执行
main().catch((error) => {
    console.error("脚本执行出错:", error);
    process.exitCode = 1;
});
