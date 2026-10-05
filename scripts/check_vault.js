const { Connection, PublicKey } = require("@solana/web3.js");

const PROGRAM_ID = new PublicKey("twKYosyivoy5K19pkNYyxgfGtp4kCtTHBm1cWWzMy3k");
const PRESALE_STATE_PUBKEY = new PublicKey("9JBdwGcmps55rRiptJoTygXY6wJUTxvFTAujEc8wnQ2o");
const AIPARTNER_MINT_PUBKEY = new PublicKey("Auofy4iomuR3zyJib7PyqQZQNbsnVZmpbtpLJyubZT3r");
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

// 使用稳定的高速 RPC 节点
const RPC_URL = "https://mainnet.helius-rpc.com/?api-key=37673d77-fa71-41d2-9572-b8d4defa5cee";

async function checkBalance() {
  const [presaleAuthorityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("presale_authority"), PRESALE_STATE_PUBKEY.toBuffer()],
    PROGRAM_ID
  );

  const [pdaAipartnerAta] = PublicKey.findProgramAddressSync(
    [presaleAuthorityPda.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), AIPARTNER_MINT_PUBKEY.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  console.log("=========================================");
  console.log("📍 Presale Authority (PDA):", presaleAuthorityPda.toBase58());
  console.log("🎯 预售代币金库地址 (PDA AIPartner ATA):", pdaAipartnerAta.toBase58());
  console.log("=========================================");

  const connection = new Connection(RPC_URL, "confirmed");

  try {
    const balanceInfo = await connection.getTokenAccountBalance(pdaAipartnerAta);
    console.log(`✅ 检测成功！预售金库当前 AIPartner 代币余额: ${balanceInfo.value.uiAmountString}`);
    console.log(`🔢 原始精度微粒数 (Amount): ${balanceInfo.value.amount}`);
  } catch (e) {
    console.log("⚠️ 查询失败，错误详情:", e.message);
  }
}

checkBalance();
