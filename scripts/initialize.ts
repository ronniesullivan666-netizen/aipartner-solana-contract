// 在文件最上方添加未捕获异常的全局监听
process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 未捕获的 Promise 异常:", reason);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("💥 未捕获的全局异常:", err);
  process.exit(1);
});

import * as anchor from "@coral-xyz/anchor";
import { Program, Idl } from "@coral-xyz/anchor";
import { PublicKey, Keypair, Connection } from "@solana/web3.js";
import { 
  getAssociatedTokenAddressSync, 
  createAssociatedTokenAccountInstruction, 
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("🚀 开始执行预售合约初始化脚本...");

  // 1. 配置网络连接与管理员 Wallet
  const rpcUrl = "https://mainnet.helius-rpc.com/?api-key=37673d77-fa71-41d2-9572-b8d4defa5cee";
  const walletPath = "/root/.config/solana/id.json";

  if (!fs.existsSync(walletPath)) {
    throw new Error(`找不到 Wallet 密钥文件: ${walletPath}`);
  }

  const rawWalletKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const adminKeypair = Keypair.fromSecretKey(Uint8Array.from(rawWalletKey));
  const wallet = new anchor.Wallet(adminKeypair);

  const connection = new Connection(rpcUrl, "confirmed");
  const provider = new anchor.AnchorProvider(connection, wallet, {
    preflightCommitment: "confirmed",
  });
  anchor.setProvider(provider);

  console.log("📌 管理员钱包地址:", wallet.publicKey.toString());

  // 2. 加载 IDL 文件
  const idlPath = path.resolve(__dirname, "../target/idl/aipartner_presale.json");
  if (!fs.existsSync(idlPath)) {
    throw new Error(`找不到 IDL 文件: ${idlPath}`);
  }
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

  const programId = new PublicKey("AgBSRTVFzdjV9ChfqEEJhCca2mn11Unw1vtZsP3NhqmN");
  idl.address = programId.toString();

  const program = new Program(idl as Idl, provider);
  console.log("📌 合约 Program ID:", program.programId.toString());

  // 3. 配置 Mint 与派生地址
  const aipartnerMint = new PublicKey("BJ4DHhY2bhsgrjV3gVVd3YkDPRvUZZpbfzLtBNuKNXgs");
  const presaleStateKeypair = Keypair.generate();

  console.log("\n==========================================");
  console.log("⭐ [重要] 请记录 Presale State 地址:");
  console.log("Presale State Pubkey:", presaleStateKeypair.publicKey.toString());
  console.log("==========================================\n");

  const [presaleAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("presale_authority"), presaleStateKeypair.publicKey.toBuffer()],
    program.programId
  );
  console.log("📌 Presale Authority PDA:", presaleAuthority.toString());

  const vaultAipartnerAccount = getAssociatedTokenAddressSync(
    aipartnerMint,
    presaleAuthority,
    true
  );
  console.log("📌 Vault AIPartner ATA:", vaultAipartnerAccount.toString());

  // 4. 检查预售金库 ATA 是否存在
  const vaultAccountInfo = await connection.getAccountInfo(vaultAipartnerAccount);
  let preInstructions = [];
  if (!vaultAccountInfo) {
    console.log("🔨 预售金库 ATA 未创建，添加创建 ATA 指令...");
    const createAtaIx = createAssociatedTokenAccountInstruction(
      wallet.publicKey,
      vaultAipartnerAccount,
      presaleAuthority,
      aipartnerMint
    );
    preInstructions.push(createAtaIx);
  }

  const rate = new anchor.BN(100);

  // 5. 发送交易
  console.log("⌛ 正在提交初始化交易到 Solana 主网...");
  const tx = await program.methods
    .initialize(rate)
    .accounts({
      admin: wallet.publicKey,
      aipartnerMint: aipartnerMint,
      vaultAipartnerAccount: vaultAipartnerAccount,
      presaleAuthority: presaleAuthority,
      presaleState: presaleStateKeypair.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .preInstructions(preInstructions)
    .signers([presaleStateKeypair])
    .rpc();

  console.log("\n🎉 初始化成功！");
  console.log("交易签名 (TxHash):", tx);
}

// 确保显式调用 main()，并正确捕获 Promise 错误
main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ 执行出错:", err);
    process.exit(1);
  });