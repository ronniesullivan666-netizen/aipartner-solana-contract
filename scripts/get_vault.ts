import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

async function main() {
  const programId = new PublicKey("5vGy3M2wsvkzsRTcoqh9hWvY1wJcJ58hHgSZ2fmC6Mjx");
  const aipartnerMint = new PublicKey("7h69NFkJHXpxSzBbAxeTS92pngcZQQYnqBdZZyMYPWK8");

  // 1. 推导 presale_state PDA (根据你的 initialize 逻辑，一般 seeds 是 [b"presale_state", admin.key()] 或者直接由 account 生成)
  // 让我们用标准 anchor 方式：假设 presale_state 是个 keypair 或者通过 seeds 找
  // 如果你的 presale_state 是由 EoyeazmmgFfBfyjJGW8rQfs89etJ5xBPM5wSA1JNAJ3e 初始化的：
  const admin = new PublicKey("EoyeazmmgFfBfyjJGW8rQfs89etJ5xBPM5wSA1JNAJ3e");
  
  // 如果你的 presale_state 是个 Keypair (在许多标准脚本里是 createKeypair)，我们可以直接找 presale_authority 的 seeds:
  // seeds = [b"presale_authority", presale_state.key().as_ref()]
  // 如果你在初始化时 presale_state 是动态生成的，我们需要看一眼你的 initialize.ts 是怎么写的。
  // 不如我们直接把 scripts/initialize.ts 的内容发给我，或者直接运行它并打印出 presale_state 和 presale_authority？
}

main();
