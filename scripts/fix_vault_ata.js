const { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } = require("@solana/web3.js");
const fs = require("fs");

// 1. 读取管理员 Keypair (确保路径指向你的 admin 钱包 keypair 文件，如 id.json 或 admin.json)
const walletPath = process.env.HOME + "/.config/solana/id.json"; 
const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")));
const admin = Keypair.fromSecretKey(secretKey);

const PROGRAM_ID = new PublicKey("twKYosyivoy5K19pkNYyxgfGtp4kCtTHBm1cWWzMy3k");
const PRESALE_STATE_PUBKEY = new PublicKey("9JBdwGcmps55rRiptJoTygXY6wJUTxvFTAujEc8wnQ2o");
const AIPARTNER_MINT_PUBKEY = new PublicKey("Auofy4iomuR3zyJib7PyqQZQNbsnVZmpbtpLJyubZT3r");
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const SYSTEM_PROGRAM_ID = new PublicKey("11111111111111111111111111111111");

const RPC_URL = "https://mainnet.helius-rpc.com/?api-key=37673d77-fa71-41d2-9572-b8d4defa5cee";

async function fixVaultAta() {
  const connection = new Connection(RPC_URL, "confirmed");

  // 计算 presale_authority PDA
  const [presaleAuthorityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("presale_authority"), PRESALE_STATE_PUBKEY.toBuffer()],
    PROGRAM_ID
  );

  // 计算正确且标准规范的 PDA ATA 地址
  const [pdaAipartnerAta] = PublicKey.findProgramAddressSync(
    [presaleAuthorityPda.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), AIPARTNER_MINT_PUBKEY.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  console.log("📍 管理员地址:", admin.publicKey.toBase58());
  console.log("📍 Presale Authority (PDA):", presaleAuthorityPda.toBase58());
  console.log("🎯 正确的标准 ATA 金库地址:", pdaAipartnerAta.toBase58());

  // 构建创建 Associated Token Account 的指令
  const createAtaIx = new TransactionInstruction({
    keys: [
      { pubkey: admin.publicKey, isSigner: true, isWritable: true },       // 垫付租金的人
      { pubkey: pdaAipartnerAta, isSigner: false, isWritable: true },      // 要创建的 ATA
      { pubkey: presaleAuthorityPda, isSigner: false, isWritable: false }, // ATA 所有者 (PDA)
      { pubkey: AIPARTNER_MINT_PUBKEY, isSigner: false, isWritable: false },// 代币 Mint
      { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data: Buffer.alloc(0),
  });

  const tx = new Transaction().add(createAtaIx);
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = admin.publicKey;

  console.log("⏳ 正在为 PDA 初始化创建标准的 Token ATA 账户...");
  tx.sign(admin);
  const txid = await connection.sendRawTransaction(tx.serialize());
  console.log(`✅ 账户创建成功！TxID: https://solscan.io/tx/${txid}`);
}

fixVaultAta().catch(err => console.error("失败:", err));
