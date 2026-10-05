const { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } = require("@solana/web3.js");
const fs = require("fs");

const walletPath = process.env.HOME + "/.config/solana/id.json"; 
const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")));
const admin = Keypair.fromSecretKey(secretKey);

const PROGRAM_ID = new PublicKey("twKYosyivoy5K19pkNYyxgfGtp4kCtTHBm1cWWzMy3k");
const PRESALE_STATE_PUBKEY = new PublicKey("9JBdwGcmps55rRiptJoTygXY6wJUTxvFTAujEc8wnQ2o");
const AIPARTNER_MINT_PUBKEY = new PublicKey("Auofy4iomuR3zyJib7PyqQZQNbsnVZmpbtpLJyubZT3r");
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

const RPC_URL = "https://mainnet.helius-rpc.com/?api-key=37673d77-fa71-41d2-9572-b8d4defa5cee";

function getAssociatedTokenAddress(mint, owner) {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )[0];
}

async function depositToVault() {
  const connection = new Connection(RPC_URL, "confirmed");

  // 1. 计算金库 PDA 与金库 ATA
  const [presaleAuthorityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("presale_authority"), PRESALE_STATE_PUBKEY.toBuffer()],
    PROGRAM_ID
  );
  const vaultAta = getAssociatedTokenAddress(AIPARTNER_MINT_PUBKEY, presaleAuthorityPda);

  // 2. 计算管理员本身的 AIPartner ATA
  const adminAta = getAssociatedTokenAddress(AIPARTNER_MINT_PUBKEY, admin.publicKey);

  console.log("📍 管理员 ATA:", adminAta.toBase58());
  console.log("🎯 预售金库 ATA:", vaultAta.toBase58());

  // 3. 查询管理员当前的 AIPartner 余额
  const balance = await connection.getTokenAccountBalance(adminAta);
  console.log(`💰 管理员当前代币余额: ${balance.value.uiAmountString}`);

  if (BigInt(balance.value.amount) === BigInt(0)) {
    console.log("❌ 管理员账户中没有可用代币，请确认代币所在的源钱包！");
    return;
  }

  // 4. 构建 Transfer 指令（转入全部或指定数量）
  const amountToTransfer = BigInt(balance.value.amount); // 全部注入预售池
  const transferData = new Uint8Array(9);
  transferData[0] = 3; // Transfer 指令编号
  new DataView(transferData.buffer).setBigUint64(1, amountToTransfer, true);

  const transferIx = new TransactionInstruction({
    keys: [
      { pubkey: adminAta, isSigner: false, isWritable: true },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: admin.publicKey, isSigner: true, isWritable: false },
    ],
    programId: TOKEN_PROGRAM_ID,
    data: transferData,
  });

  const tx = new Transaction().add(transferIx);
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = admin.publicKey;

  console.log("🚀 正在注入预售代币至金库...");
  tx.sign(admin);
  const txid = await connection.sendRawTransaction(tx.serialize());
  console.log(`✅ 代币充值成功！TxID: https://solscan.io/tx/${txid}`);
}

depositToVault().catch(err => console.error("失败:", err));
