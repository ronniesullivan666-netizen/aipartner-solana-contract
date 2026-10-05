"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const anchor = __importStar(require("@coral-xyz/anchor"));
const anchor_1 = require("@coral-xyz/anchor");
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
console.log("🚀 Starting initialization script...");
function loadIdl() {
    const idlPath = path.resolve(__dirname, "../target/idl/aipartner_presale.json");
    if (!fs.existsSync(idlPath)) {
        throw new Error(`IDL file not found at ${idlPath}`);
    }
    const rawData = fs.readFileSync(idlPath, "utf-8");
    return JSON.parse(rawData);
}
async function main() {
    const idl = loadIdl();
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const programId = new web3_js_1.PublicKey("AgBSRTVFzdjV9ChfqEEJhCca2mn11Unw1vtZsP3NhqmN");
    const program = new anchor_1.Program(idl, provider);

    console.log("Using Program ID:", program.programId.toString());
    console.log("Using Admin Wallet:", provider.wallet.publicKey.toString());

    const aipartnerMint = new web3_js_1.PublicKey("7h69NFkJHXpxSzBbAxeTS92pngcZQQYnqBdZZyMYPWK8");

    // ==================== 修改开始：固定 Presale State 密钥 ====================
    const keypairPath = path.resolve(__dirname, "../state-keypair.json");
    let presaleStateKeypair;

    if (fs.existsSync(keypairPath)) {
        // 如果文件已存在，直接读取固定密钥
        const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")));
        presaleStateKeypair = web3_js_1.Keypair.fromSecretKey(secretKey);
        console.log("🔑 Loaded fixed Presale State Keypair from file.");
    } else {
        // 如果文件不存在，生成一个新的并保存到本地
        presaleStateKeypair = web3_js_1.Keypair.generate();
        fs.writeFileSync(keypairPath, JSON.stringify(Array.from(presaleStateKeypair.secretKey)));
        console.log("🔑 Created and saved NEW fixed Presale State Keypair.");
    }
    // ==================== 修改结束 ====================

    console.log("Presale State Account:", presaleStateKeypair.publicKey.toString());

    // 1. 计算 presale_authority PDA
    const [presaleAuthority] = web3_js_1.PublicKey.findProgramAddressSync(
        [Buffer.from("presale_authority"), presaleStateKeypair.publicKey.toBuffer()],
        program.programId
    );
    console.log("📌 Presale Authority PDA:", presaleAuthority.toString());

    // 2. 计算该 PDA 对应的 AIPartner 金库 ATA 地址
    const vaultAipartnerAccount = (0, spl_token_1.getAssociatedTokenAddressSync)(
        aipartnerMint,
        presaleAuthority,
        true // 允许所有者是 PDA
    );
    console.log("📌 Vault AIPartner Account:", vaultAipartnerAccount.toString());

    const rate = new anchor.BN(100);

    try {
        console.log("Sending initialize transaction...");
        const tx = await program.methods
            .initialize(rate)
            .accounts({
                admin: provider.wallet.publicKey,
                aipartnerMint: aipartnerMint,
                vaultAipartnerAccount: vaultAipartnerAccount,
                presaleAuthority: presaleAuthority,
                presaleState: presaleStateKeypair.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .signers([presaleStateKeypair])
            .rpc();

        console.log("✅ Initialization successful!");
        console.log("Transaction Signature:", tx);
    }
    catch (error) {
        console.error("❌ Initialization failed:", error);
    }
}
main()
    .then(() => process.exit(0))
    .catch((err) => {
    console.error("💥 Unexpected Fatal Error:", err);
    process.exit(1);
});
