const anchor = require("@coral-xyz/anchor");
const { Program } = require("@coral-xyz/anchor");
const { PublicKey, Keypair, SystemProgram } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");

console.log("🚀 启动初始化脚本 (原生 Node.js 模式)...");

async function main() {
  // 1. 读取 IDL 文件
  const idlPath = path.resolve(__dirname, "../target/idl/aipartner_presale.json");
  console.log("📍 读取 IDL 路径:", idlPath);
  if (!fs.existsSync(idlPath)) {
    throw new Error(`找不到 IDL 文件: ${idlPath}`);
  }
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

  // 2. 配置 Provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  console.log("📍 RPC URL:", provider.connection.rpcEndpoint);
  console.log("📍 管理员钱包:", provider.wallet.publicKey.toString());

  // 3. 实例化 Program
  const programId = new PublicKey("AgBSRTVFzdjV9ChfqEEJhCca2mn11Unw1vtZsP3NhqmN");
  const program = new Program(idl, provider);
  console.log("📍 合约地址:", program.programId.toString());

  // 4. 准备关键参数
  const aipartnerMint = new PublicKey("7h69NFkJHXpxSzBbAxeTS92pngcZQQYnqBdZZyMYPWK8");
  const presaleStateKeypair = Keypair.generate();
  console.log("📍 生成预售状态账户 (PresaleState):", presaleStateKeypair.publicKey.toString());

  const rate = new anchor.BN(100);

  // 5. 发送交易
  console.log("⏳ 正在发送 initialize 交易到 Solana 网络...");

  const tx = await program.methods
    .initialize(rate)
    .accounts({
      admin: provider.wallet.publicKey,
      aipartnerMint: aipartnerMint,
      presaleState: presaleStateKeypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([presaleStateKeypair])
    .rpc();

  console.log("✅ 初始化成功！");
  console.log("📝 交易签名 (Transaction Signature):", tx);
  console.log("-----------------------------------------");
  console.log("📌 请务必保存此 Presale State 地址:", presaleStateKeypair.publicKey.toString());
}

main().catch((err) => {
  console.error("❌ 执行失败错误日志:", err);
  process.exit(1);
});
