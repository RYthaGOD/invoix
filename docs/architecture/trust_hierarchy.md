# Trust Hierarchy & Failure Modeling

## The Core Question
**"If the hardware (TEE) fails or is compromised, is the data safe?"**

Invoix operates on a **"Dynamic Trust Root"** model. Unlike a blockchain where the consensus algorithm is static, Invoix's privacy layer (Arcium) is designed to be **agile** in response to physical hardware vulnerabilities (e.g., Foreshadow, Spectre, or compromised SGX keys).

## 1. The Defense-in-Depth Model

Invoix does not rely on a single server or a single manufacturer's key.

### Layer 1: Multi-Party Execution (MXE)
Data is not encrypted to a single machine. It is encrypted to a **Cluster** of Arcium nodes.
*   **Threshold Cryptography**: The decryption key is split into shares (e.g., 3-of-5).
*   **Trust Failure Mitigation**: If one node in the cluster is physically compromised or its TEE broken, the attacker **does not** gain access to the data. They would need to compromise a threshold number of nodes simultaneously, which is exponentially harder.

### Layer 2: Cluster Agility (Hardware Rotation)
Hardware is imperfect. Vulnerabilities are discovered over time. Invoix handles this via the **MXE Account Governance**.

*   **Cluster ID**: Invoix points to a specific `cluster_id` (e.g., `Cluster 1: Intel SGX v2`).
*   **Rejected Clusters**: If a vulnerability is found in the hardware class of Cluster 1, the protocol governance can:
    1.  Add Cluster 1 to `rejected_clusters`.
    2.  Provision a new `Cluster 2` (e.g., `AMD SEV-SNP` or `Intel TDX`).
    3.  Update the protocol to point to Cluster 2.
    4.  **Rekeying**: New invoices are encrypted to Cluster 2. Old data can be legally migrated by the threshold grouping of Cluster 1 to Cluster 2 before fully decommissioning Cluster 1.

## 2. Failure Scenarios

| Scenario | Risk | Mitigation |
| :--- | :--- | :--- |
| **Single Node Failure** | Low | **Redundancy**: Other nodes in the cluster continue processing. No data loss. |
| **Single Node Compromise** | Medium | **Threshold Security**: Attacker has < `t` key shares. Zero data leakage. |
| **Zero-Day Hardware Class Vuln** | Critical | **Cluster Rotation**: Effected immediately via `rejected_clusters`. Network shifts to secure hardware. |
| **Total Global Compromise** | Catastrophic | **Forward Secrecy**: Historical data keys are rotated. Old epochs can be nuked if necessary. |

## 3. Implementation Evidence

This logic is enforced on-chain in `arcium-mxe/src/lib.rs`:

```rust
pub struct MXEAccount {
    pub cluster: Option<u32>,        // Current Active Trust Root
    pub utility_pubkeys: SetUnset<UtilityPubkeys>, // Current Threshold Keys
    pub rejected_clusters: Vec<u32>, // Blacklisted Hardware/ Clusters
    // ...
}
```

By strictly defining the "Active Cluster" on-chain, Invoix ensures that even if old hardware becomes insecure, the protocol has already moved on, leaving the attacker with obsolete, rotated-out target sets.

## 4. Future Hardening: Trust Evolution & Auditability

As Invoix scales, we aim to make trust-root evolution explicit in the proof layer to support long-term auditing and temporal security.

### Trust Epochs
We propose binding each receipt (cNFT) to a specific **Trust Epoch**, defined as:
> **Trust Epoch** = { Active Cluster Set + TEE Hardware Class + Verification Code Hash }

This binding makes historical correctness auditable even across major system migrations or hardware upgrades.

### Temporal Security & Post-Facto Re-verification
If a specific hardware class (e.g., "Intel SGX v2") is found to have a vulnerability years after a transaction settled:
1.  **No Rollback**: Settlement finality is preserved.
2.  **Contextual Flagging**: Receipts verified during that deprecated epoch can be flagged as "Verified under Deprecated Assumptions."
3.  **Degraded-Trust Mode**: Enterprises can clearly verify which receipts rely on fully secure proofs versus those with degraded historical assurances, without sacrificing real-time speed.

This separation of **Settlement Finality** from **Verification Finality** allows the system to remain robust and transparent even as the underlying trusted hardware landscape evolves.

